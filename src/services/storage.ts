import { CafeInfo, Category, MenuItem, Order, OrderRound, OrderStatus, TableItem } from '../types';
import { INITIAL_CAFE, INITIAL_CATEGORIES, INITIAL_MENU_ITEMS, INITIAL_SAMPLE_ORDERS, INITIAL_TABLES } from '../data/initialData';
import { soundService } from './sound';
import { isRealtimeEnabled, subscribeToResourceChanges, RealtimeResource } from './realtime';

const STORAGE_KEYS = {
  CAFE: 'negis_kitchen_info',
  TABLES: 'negis_kitchen_tables',
  CATEGORIES: 'negis_kitchen_categories',
  MENU_ITEMS: 'negis_kitchen_menu_items',
  ORDERS: 'negis_kitchen_orders',
  ORDER_SEQ: 'negis_kitchen_order_seq',
  ACTIVE_TABLE_ID: 'negis_kitchen_active_table_id',
  CUSTOMER_LAST_ORDER_ID: 'negis_kitchen_customer_last_order',
  CUSTOMER_ORDER_IDS: 'negis_kitchen_customer_order_ids',
  ADMIN_AUTH: 'negis_kitchen_admin_auth',
  SYNCED_ORDER_IDS: 'negis_kitchen_synced_order_ids',
};

// Kitchen backlog rule: while more than this many orders are still waiting to
// be cooked, the kitchen is behind, and every order past that point inherits
// the queue's delay on top of its own cooking time.
const KITCHEN_BUSY_THRESHOLD = 5;
const KITCHEN_BUSY_EXTRA_MIN = 8;

// Order numbers run ORD-1001 through ORD-9009 and then start over at 1001.
// Mirrored in server/api.ts, which validates and can reassign the id.
const ORDER_ID_MIN = 1001;
const ORDER_ID_MAX = 9009;
const ORDER_ID_RANGE = ORDER_ID_MAX - ORDER_ID_MIN + 1;

const nextOrderNumber = (n: number): number => (n >= ORDER_ID_MAX ? ORDER_ID_MIN : n + 1);

// The order number a given id carries, or null if it isn't one of ours.
const orderIdNumber = (id: string): number | null => {
  const match = /^ORD-(\d+)$/.exec(id || '');
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return n >= ORDER_ID_MIN && n <= ORDER_ID_MAX ? n : null;
};

// How many acknowledged order ids to remember. Only needs to outlive the window
// in which a deleted order could still be sitting in some device's localStorage.
const SYNCED_ORDER_ID_MEMORY = 300;

// How long an order may sit unacknowledged by the server before we assume its
// POST was lost and re-send it, how long to wait between those re-sends, and
// how many we allow before giving up and leaving it as a local-only order.
const ORDER_SYNC_GRACE_MS = 15000;
const ORDER_SYNC_RETRY_INTERVAL_MS = 30000;
const ORDER_SYNC_MAX_ATTEMPTS = 5;

type EventType =
  | 'ORDERS_UPDATED'
  | 'MENU_UPDATED'
  | 'CATEGORIES_UPDATED'
  | 'TABLES_UPDATED'
  | 'CAFE_UPDATED'
  | 'NEW_ORDER';

type Listener = (type: EventType, payload?: unknown) => void;

export interface DailyRevenueDay {
  date: string;
  ordersCount: number;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  revenue: number;
}

export interface DailyRevenueReport {
  month: string;
  timeZone: string;
  days: DailyRevenueDay[];
  totalRevenue: number;
  totalOrders: number;
}

class StorageService {
  private listeners: Set<Listener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  // Orders with a POST currently in flight. A create can take several seconds
  // (cold serverless start, slow DB), and the poll below runs every few
  // seconds — without this the same order gets POSTed again and again while
  // the first attempt is still running, and every one of those duplicates is
  // recorded as an extra round on the order.
  private ordersBeingSynced: Set<string> = new Set();
  // Per-order retry bookkeeping, so a genuinely failing order backs off
  // instead of hammering the server on every single poll tick.
  private orderSyncAttempts: Map<string, { attempts: number; lastAttemptAt: number }> = new Map();

  constructor() {
    this.initStorage();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('negis_kitchen_sync_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type) {
            this.notifyLocal(event.data.type, event.data.payload);
          }
        };
      } catch {
        // Fallback to storage event
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.ORDERS) {
          this.notifyLocal('ORDERS_UPDATED');
        } else if (e.key === STORAGE_KEYS.MENU_ITEMS || e.key === STORAGE_KEYS.CATEGORIES) {
          this.notifyLocal('MENU_UPDATED');
        } else if (e.key === STORAGE_KEYS.TABLES) {
          this.notifyLocal('TABLES_UPDATED');
        } else if (e.key === STORAGE_KEYS.CAFE) {
          this.notifyLocal('CAFE_UPDATED');
        }
      });

      // A round's timer hitting zero does NOT mean the dish is actually
      // done — it just means the kitchen is now running late. Rounds sit in
      // that overdue "Delayed" state (see KitchenOrderCard) until staff
      // explicitly adds more time or marks it ready themselves; nothing
      // here silently auto-completes it on their behalf.

      // Initial cloud sync from Neon database
      this.syncFromServer();

      // Live updates pushed via Pusher when another device changes data.
      subscribeToResourceChanges((resource) => this.handleResourceChanged(resource));

      // Safety-net poll in case a push is missed (or Pusher isn't configured,
      // in which case this is the only sync mechanism and runs frequently).
      const pollIntervalMs = isRealtimeEnabled() ? 20000 : 3000;
      setInterval(() => this.pollOrdersAndTables(), pollIntervalMs);
    }
  }

  private handleResourceChanged(resource: RealtimeResource): void {
    if (resource === 'orders' || resource === 'tables') {
      this.pollOrdersAndTables();
    } else if (resource === 'categories' || resource === 'menu') {
      this.refreshMenuData();
    } else if (resource === 'cafe') {
      this.refreshCafe();
    }
  }

  private async refreshMenuData(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const [categories, menuItems] = await Promise.all([
        this.apiFetch<Category[]>('/categories'),
        this.apiFetch<MenuItem[]>('/menu'),
      ]);
      if (categories) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
        this.notify('CATEGORIES_UPDATED', categories);
      }
      if (menuItems) {
        localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(menuItems));
        this.notify('MENU_UPDATED', menuItems);
      }
    } catch {
      // ignore
    }
  }

  private async refreshCafe(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const cafe = await this.apiFetch<CafeInfo>('/cafe');
      if (cafe) {
        localStorage.setItem(STORAGE_KEYS.CAFE, JSON.stringify(cafe));
        this.notify('CAFE_UPDATED', cafe);
      }
    } catch {
      // ignore
    }
  }

  private async apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    // VITE_API_URL lets you point the frontend at a different backend origin.
    // In production (Vercel), both frontend and API share the same origin.
    // In local dev, you can point to Vercel's API if local DB connection fails.
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
    try {
      const res = await fetch(`${apiBase}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public async syncFromServer(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const [cafe, tables, categories, menuItems, orders] = await Promise.all([
        this.apiFetch<CafeInfo>('/cafe'),
        this.apiFetch<TableItem[]>('/tables'),
        this.apiFetch<Category[]>('/categories'),
        this.apiFetch<MenuItem[]>('/menu'),
        this.apiFetch<Order[]>('/orders'),
      ]);

      if (cafe) {
        localStorage.setItem(STORAGE_KEYS.CAFE, JSON.stringify(cafe));
        this.notifyLocal('CAFE_UPDATED', cafe);
      }
      if (tables && tables.length > 0) {
        localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
        this.notifyLocal('TABLES_UPDATED', tables);
      }
      if (categories && categories.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
        this.notifyLocal('CATEGORIES_UPDATED', categories);
      }
      if (menuItems && menuItems.length > 0) {
        localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(menuItems));
        this.notifyLocal('MENU_UPDATED', menuItems);
      }
      // Same guard as the poll: an empty list means "nothing seeded yet" or a
      // half-up database, not "every order was deleted" — never let it wipe
      // orders that are still only stored locally.
      if (orders && orders.length > 0) {
        this.rememberSyncedOrderIds(orders.map((o) => o.id));
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
        this.notifyLocal('ORDERS_UPDATED', orders);
      }
    } catch {
      // offline fallback
    }
  }

  private async pollOrdersAndTables(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const [serverOrders, tables] = await Promise.all([
        this.apiFetch<Order[]>('/orders'),
        this.apiFetch<TableItem[]>('/tables'),
      ]);

      if (serverOrders && serverOrders.length > 0) {
        const currentOrders = this.getOrders();
        const currentIds = new Set(currentOrders.map((o) => o.id));
        const hasNew = serverOrders.some((o) => !currentIds.has(o.id));

        // Merge server orders with local orders: preserve any locally-created
        // orders that haven't been persisted to the server yet.
        const serverIds = new Set(serverOrders.map((o) => o.id));
        this.rememberSyncedOrderIds(serverOrders.map((o) => o.id));
        const syncedBefore = this.getSyncedOrderIds();

        // An order the server has never acknowledged is one whose POST may have
        // been lost — worth re-sending. An order the server acknowledged once
        // and no longer returns was deleted on purpose, so re-sending it would
        // resurrect it on every poll forever; drop our copy instead.
        const localOnly = currentOrders.filter((o) => !serverIds.has(o.id));
        const deletedRemotely = localOnly.filter((o) => syncedBefore.has(o.id));
        const neverSynced = localOnly.filter((o) => !syncedBefore.has(o.id));

        // Server orders with rounds=[] should inherit status from local copy
        // to avoid the auto-serve race condition.
        const mergedOrders = serverOrders.map((serverOrder) => {
          const localCopy = currentOrders.find((lo) => lo.id === serverOrder.id);
          if (localCopy && (!serverOrder.rounds || serverOrder.rounds.length === 0) && localCopy.rounds && localCopy.rounds.length > 0) {
            // Server hasn't returned round data yet — keep local copy intact
            return localCopy;
          }
          return serverOrder;
        });

        const merged = [...mergedOrders, ...neverSynced];
        const isDifferent = JSON.stringify(merged) !== JSON.stringify(currentOrders);

        if (isDifferent) {
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(merged));
          if (hasNew) {
            const newest = serverOrders[0];
            this.notify('NEW_ORDER', newest);
          }
          this.notify('ORDERS_UPDATED', merged);
        }

        // A "local-only" order usually just means its own createOrder() POST
        // hasn't resolved yet — give that a moment. But if the POST genuinely
        // failed (network blip, server briefly down) it would otherwise sit
        // here forever as a phantom duplicate, since nothing else retries it.
        // Re-POST it, reusing the same id, so it can never end up as two
        // separate records.
        const now = Date.now();
        for (const order of neverSynced) {
          if (now - order.createdAt > ORDER_SYNC_GRACE_MS) {
            this.retrySyncOrder(order);
          }
        }

        if (deletedRemotely.length > 0) {
          console.info(
            '[storage] dropping locally-held orders deleted on the server:',
            deletedRemotely.map((o) => o.id).join(', ')
          );
        }
      }
      // If server returns empty array, do NOT overwrite local orders —
      // the DB may not be seeded yet or could be temporarily unavailable.

      if (tables && tables.length > 0) {
        const currentTables = this.getTables();
        if (JSON.stringify(tables) !== JSON.stringify(currentTables)) {
          localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
          this.notify('TABLES_UPDATED', tables);
        }
      }
    } catch {
      // ignore
    }
  }

  // Re-POSTs an order that never made it to the server, reusing its
  // existing id so the retry can never create a second, differently-ID'd
  // record — the server accepts a client-supplied id on creation.
  private getSyncedOrderIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SYNCED_ORDER_IDS);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  }

  // Remembers that the server has these orders, so a later poll can tell a
  // never-delivered order (re-send it) from a deleted one (let it go).
  private rememberSyncedOrderIds(ids: string[]): void {
    try {
      const known = this.getSyncedOrderIds();
      const before = known.size;
      for (const id of ids) known.add(id);
      if (known.size === before) return;
      const trimmed = [...known].slice(-SYNCED_ORDER_ID_MEMORY);
      localStorage.setItem(STORAGE_KEYS.SYNCED_ORDER_IDS, JSON.stringify(trimmed));
    } catch {
      // storage full or unavailable — retries just stay as they were
    }
  }

  private async retrySyncOrder(order: Order): Promise<void> {
    // Never run a second POST for an order while one is still in flight. The
    // poll fires every few seconds (and again on every realtime 'orders'
    // event, which our own writes trigger), so without this a create that
    // simply takes a while to answer gets re-sent over and over — and the
    // server records each of those re-sends as another round on the order.
    if (this.ordersBeingSynced.has(order.id)) return;

    const record = this.orderSyncAttempts.get(order.id) || { attempts: 0, lastAttemptAt: 0 };
    if (record.attempts >= ORDER_SYNC_MAX_ATTEMPTS) return;
    if (Date.now() - record.lastAttemptAt < ORDER_SYNC_RETRY_INTERVAL_MS) return;

    this.orderSyncAttempts.set(order.id, {
      attempts: record.attempts + 1,
      lastAttemptAt: Date.now(),
    });
    this.ordersBeingSynced.add(order.id);

    try {
      // force=true so the server skips its 30-min "fold this into the table's
      // active order" rule. A retry is asking for one specific order to exist
      // under one specific id — never for a round to be tacked onto whatever
      // else that table happens to have open. Paired with the server's
      // id-already-exists check, re-sending is then a no-op rather than a
      // phantom round.
      const serverOrder = await this.apiFetch<Order>('/orders?force=true', {
        method: 'POST',
        body: JSON.stringify(order),
      });
      if (serverOrder) {
        // The server may have merged this into an already-existing active
        // order for the table (the same 30-min-combine rule createOrder
        // uses) instead of creating a fresh row under our id — drop the
        // phantom entry either way rather than risk a duplicate-id row.
        const withoutPhantom = this.getOrders().filter((o) => o.id !== order.id);
        const next = withoutPhantom.some((o) => o.id === serverOrder.id)
          ? withoutPhantom.map((o) => (o.id === serverOrder.id ? serverOrder : o))
          : [...withoutPhantom, serverOrder];
        this.saveOrders(next);
        this.orderSyncAttempts.delete(order.id);
      }
    } catch {
      // will retry again on a later poll, once the backoff above has elapsed
    } finally {
      this.ordersBeingSynced.delete(order.id);
    }
  }

  private initStorage() {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(STORAGE_KEYS.CAFE)) {
      localStorage.setItem(STORAGE_KEYS.CAFE, JSON.stringify(INITIAL_CAFE));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TABLES)) {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(INITIAL_TABLES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MENU_ITEMS)) {
      localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(INITIAL_MENU_ITEMS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_SAMPLE_ORDERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDER_SEQ)) {
      localStorage.setItem(STORAGE_KEYS.ORDER_SEQ, String(ORDER_ID_MIN));
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(type: EventType, payload?: unknown) {
    this.notifyLocal(type, payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, payload });
      } catch {
        // Channel closed or error
      }
    }
  }

  private notifyLocal(type: EventType, payload?: unknown) {
    this.listeners.forEach((l) => {
      try {
        l(type, payload);
      } catch (err) {
        console.error('Listener error:', err);
      }
    });
  }

  // --- CAFE INFO ---
  public getCafe(): CafeInfo {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CAFE);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.id !== 'negis-kitchen') {
          parsed.id = 'negis-kitchen';
          parsed.name = "Negi's Kitchen";
          localStorage.setItem(STORAGE_KEYS.CAFE, JSON.stringify(parsed));
        }
        return parsed;
      }
      return INITIAL_CAFE;
    } catch {
      return INITIAL_CAFE;
    }
  }

  public updateCafe(cafe: CafeInfo): CafeInfo {
    localStorage.setItem(STORAGE_KEYS.CAFE, JSON.stringify(cafe));
    this.notify('CAFE_UPDATED', cafe);
    this.apiFetch('/cafe', { method: 'PUT', body: JSON.stringify(cafe) });
    return cafe;
  }

  // --- TABLES ---
  public getTables(): TableItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TABLES);
      return data ? JSON.parse(data) : INITIAL_TABLES;
    } catch {
      return INITIAL_TABLES;
    }
  }

  public getTableById(id: string): TableItem | undefined {
    return this.getTables().find((t) => t.id === id || t.code === id);
  }

  public saveTables(tables: TableItem[]): void {
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify('TABLES_UPDATED', tables);
  }

  public addTable(table: Omit<TableItem, 'id' | 'code'>): TableItem {
    const tables = this.getTables();
    const cleanNum = table.number.replace(/[^0-9]/g, '') || String(tables.length + 1).padStart(2, '0');
    const newTable: TableItem = {
      ...table,
      id: `table-${cleanNum}`,
      code: `table-${cleanNum}`,
    };
    tables.push(newTable);
    this.saveTables(tables);
    this.apiFetch('/tables', { method: 'POST', body: JSON.stringify(table) });
    return newTable;
  }

  public updateTable(id: string, updates: Partial<TableItem>): TableItem | null {
    const tables = this.getTables();
    const idx = tables.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    tables[idx] = { ...tables[idx], ...updates };
    this.saveTables(tables);
    this.apiFetch(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    return tables[idx];
  }

  public deleteTable(id: string): boolean {
    const tables = this.getTables().filter((t) => t.id !== id);
    this.saveTables(tables);
    this.apiFetch(`/tables/${id}`, { method: 'DELETE' });
    return true;
  }

  // --- CATEGORIES ---
  public getCategories(): Category[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  }

  public saveCategories(cats: Category[]): void {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
    this.notify('CATEGORIES_UPDATED', cats);
    this.notify('MENU_UPDATED', cats);
  }

  public addCategory(name: string, icon: string = 'Utensils'): Category {
    const cats = this.getCategories();
    const id = `cat-${Date.now()}`;
    const newCat: Category = {
      id,
      name,
      icon,
      displayOrder: cats.length + 1,
    };
    cats.push(newCat);
    this.saveCategories(cats);
    this.apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name, icon }) });
    return newCat;
  }

  public updateCategory(id: string, name: string, icon?: string): Category | null {
    const cats = this.getCategories();
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    cats[idx] = {
      ...cats[idx],
      name,
      ...(icon ? { icon } : {}),
    };
    this.saveCategories(cats);
    this.apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, icon }) });
    return cats[idx];
  }

  public deleteCategory(id: string): boolean {
    const cats = this.getCategories().filter((c) => c.id !== id);
    this.saveCategories(cats);
    this.apiFetch(`/categories/${id}`, { method: 'DELETE' });
    return true;
  }

  // --- MENU ITEMS ---
  public getMenuItems(): MenuItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
      return data ? JSON.parse(data) : INITIAL_MENU_ITEMS;
    } catch {
      return INITIAL_MENU_ITEMS;
    }
  }

  public saveMenuItems(items: MenuItem[]): void {
    localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(items));
    this.notify('MENU_UPDATED', items);
  }

  public addMenuItem(itemData: Omit<MenuItem, 'id'>): MenuItem {
    const items = this.getMenuItems();
    const newItem: MenuItem = {
      ...itemData,
      id: `item-${Date.now()}`,
    };
    items.push(newItem);
    this.saveMenuItems(items);
    this.apiFetch('/menu', { method: 'POST', body: JSON.stringify(itemData) });
    return newItem;
  }

  public updateMenuItem(id: string, updates: Partial<MenuItem>): MenuItem | null {
    const items = this.getMenuItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates };
    this.saveMenuItems(items);
    this.apiFetch(`/menu/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    return items[idx];
  }

  public toggleItemAvailability(id: string): boolean {
    const items = this.getMenuItems();
    const item = items.find((i) => i.id === id);
    if (!item) return false;
    item.isAvailable = !item.isAvailable;
    this.saveMenuItems(items);
    this.apiFetch(`/menu/${id}/availability`, { method: 'PATCH' });
    return item.isAvailable;
  }

  public toggleMenuItemAvailability(id: string): boolean {
    return this.toggleItemAvailability(id);
  }

  public deleteMenuItem(id: string): boolean {
    const items = this.getMenuItems().filter((i) => i.id !== id);
    this.saveMenuItems(items);
    this.apiFetch(`/menu/${id}`, { method: 'DELETE' });
    return true;
  }

  // --- ORDERS & REAL-TIME ---
  public getOrders(): Order[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return data ? JSON.parse(data) : INITIAL_SAMPLE_ORDERS;
    } catch {
      return INITIAL_SAMPLE_ORDERS;
    }
  }

  public getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id);
  }

  public saveOrders(orders: Order[]): void {
    // Collapse repeats of the same id. Local and server copies of one order
    // meet here from several directions (create, retry, poll), and a stray
    // duplicate would show the kitchen the same ticket twice.
    const byId = new Map<string, Order>();
    for (const order of orders) {
      byId.set(order.id, order);
    }
    const deduped = [...byId.values()];
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(deduped));
    this.notify('ORDERS_UPDATED', deduped);
  }

  public getNextOrderNumber(): string {
    // Every order number we already know about, plus where the newest one sits
    // in the cycle. Both matter: the number has to be free (it's the order's
    // primary key), and after a wrap the highest number is no longer the latest.
    const taken = new Set<number>();
    let latestNumber: number | null = null;
    let latestCreatedAt = -1;

    for (const order of this.getOrders()) {
      const number = orderIdNumber(order.id);
      if (number === null) continue;
      taken.add(number);
      if (order.createdAt > latestCreatedAt) {
        latestCreatedAt = order.createdAt;
        latestNumber = number;
      }
    }

    // This counter lives in one browser's localStorage, so a phone scanning the
    // QR for the first time — or a device whose site data was cleared — restarts
    // it at the bottom of the range and proposes ids that stored orders already
    // hold. Skipping taken numbers below covers that; carrying on from the most
    // recent order keeps a fresh device from re-walking the whole cycle.
    const stored = parseInt(localStorage.getItem(STORAGE_KEYS.ORDER_SEQ) || '', 10);
    let candidate =
      Number.isFinite(stored) && stored >= ORDER_ID_MIN && stored <= ORDER_ID_MAX
        ? stored
        : ORDER_ID_MIN;

    if (taken.has(candidate) && latestNumber !== null) {
      candidate = nextOrderNumber(latestNumber);
    }
    for (let step = 0; step < ORDER_ID_RANGE && taken.has(candidate); step++) {
      candidate = nextOrderNumber(candidate);
    }

    localStorage.setItem(STORAGE_KEYS.ORDER_SEQ, String(nextOrderNumber(candidate)));
    return `ORD-${candidate}`;
  }

  public createOrder(
    orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { forceNewOrder?: boolean }
  ): Order {
    const orders = this.getOrders();
    const now = Date.now();
    const THIRTY_MINS_MS = 30 * 60 * 1000;

    // Check if there is an active order for the same table placed within 30 minutes
    const existingActiveOrder = !options?.forceNewOrder
      ? orders.find(
          (o) =>
            (o.tableId === orderData.tableId ||
              o.tableNumber.toLowerCase() === orderData.tableNumber.toLowerCase()) &&
            o.status !== 'served' &&
            o.status !== 'cancelled' &&
            now - o.createdAt <= THIRTY_MINS_MS
        )
      : null;

    if (existingActiveOrder) {
      const cafe = this.getCafe();

      // Backfill round 1 for orders created before per-round tracking existed
      if (!existingActiveOrder.rounds || existingActiveOrder.rounds.length === 0) {
        existingActiveOrder.rounds = [
          {
            roundNumber: 1,
            items: JSON.parse(JSON.stringify(existingActiveOrder.items)),
            placedAt: existingActiveOrder.createdAt,
            estimatedPrepTimeMin: existingActiveOrder.estimatedPrepTimeMin || 15,
            preparingStartedAt: existingActiveOrder.preparingStartedAt,
            readyAt: existingActiveOrder.readyAt,
            status: existingActiveOrder.status,
          },
        ];
      }

      // Record this addition as its own round with its own prep timer, so it
      // never mixes with an earlier round's countdown or elapsed time.
      const newRoundPrepTime = this.applyKitchenLoadSurcharge(
        this.calculateRoundPrepTime(orderData.items)
      );
      const newRound: OrderRound = {
        roundNumber: existingActiveOrder.rounds.length + 1,
        items: JSON.parse(JSON.stringify(orderData.items)),
        placedAt: now,
        estimatedPrepTimeMin: newRoundPrepTime,
        status: 'received', // kitchen must accept this round separately from earlier ones
      };
      existingActiveOrder.rounds.push(newRound);

      // Merge new items into existing order
      for (const newItem of orderData.items) {
        const existingIdx = existingActiveOrder.items.findIndex(
          (it) =>
            it.menuItemId === newItem.menuItemId &&
            JSON.stringify(it.selectedCustomizations) === JSON.stringify(newItem.selectedCustomizations) &&
            (it.specialInstructions || '') === (newItem.specialInstructions || '')
        );

        if (existingIdx >= 0) {
          existingActiveOrder.items[existingIdx].quantity += newItem.quantity;
          existingActiveOrder.items[existingIdx].itemTotal = Number(
            (existingActiveOrder.items[existingIdx].itemTotal + newItem.itemTotal).toFixed(2)
          );
        } else {
          existingActiveOrder.items.push({ ...newItem });
        }
      }

      // Recalculate bill
      const subtotal = Number(
        existingActiveOrder.items.reduce((sum, it) => sum + it.itemTotal, 0).toFixed(2)
      );
      const billingCafe = this.getCafe();
      const tax = Number(((subtotal * billingCafe.taxPercent) / 100).toFixed(2));
      const serviceCharge = Number(((subtotal * billingCafe.serviceChargePercent) / 100).toFixed(2));
      const total = Number((subtotal + tax + serviceCharge).toFixed(2));

      existingActiveOrder.subtotal = subtotal;
      existingActiveOrder.tax = tax;
      existingActiveOrder.serviceCharge = serviceCharge;
      existingActiveOrder.total = total;
      existingActiveOrder.updatedAt = now;
      existingActiveOrder.isMerged = true;
      existingActiveOrder.orderRounds = existingActiveOrder.rounds.length;

      // Recompute overall status from all rounds (this new round starts as "received",
      // so a table that was "ready" correctly drops back to "preparing" without touching
      // the earlier round's own prep timer).
      existingActiveOrder.status = this.computeAggregateOrderStatus(existingActiveOrder.rounds);

      // Customer info
      if (!existingActiveOrder.customerName && orderData.customerName) {
        existingActiveOrder.customerName = orderData.customerName;
      }
      if (!existingActiveOrder.customerPhone && orderData.customerPhone) {
        existingActiveOrder.customerPhone = orderData.customerPhone;
      }
      if (orderData.specialInstructions) {
        existingActiveOrder.specialInstructions = existingActiveOrder.specialInstructions
          ? `${existingActiveOrder.specialInstructions}; (Round ${existingActiveOrder.orderRounds}: ${orderData.specialInstructions})`
          : orderData.specialInstructions;
      }

      this.saveOrders(orders);
      this.addCustomerOrderId(existingActiveOrder.id);
      this.notify('NEW_ORDER', existingActiveOrder);
      this.notify('ORDERS_UPDATED', orders);

      // Persist merged order round to Neon
      // Send the prep time we just worked out (kitchen-backlog surcharge and
      // all) — otherwise the server stores its own flat default and the next
      // poll overwrites this round's timer with it.
      this.apiFetch<Order>(`/orders${options?.forceNewOrder ? '?force=true' : ''}`, {
        method: 'POST',
        body: JSON.stringify({ ...orderData, estimatedPrepTimeMin: newRoundPrepTime }),
      }).catch(() => {});

      return existingActiveOrder;
    }

    const id = this.getNextOrderNumber();

    // Determine estimated prep time based on items or default
    const calculatedPrepTime = this.applyKitchenLoadSurcharge(
      this.calculateRoundPrepTime(orderData.items)
    );

    const resolvedPrepTime = orderData.estimatedPrepTimeMin || calculatedPrepTime;
    const resolvedPreparingStartedAt = orderData.status === 'preparing' ? now : undefined;

    const newOrder: Order = {
      ...orderData,
      id,
      createdAt: now,
      updatedAt: now,
      estimatedPrepTimeMin: resolvedPrepTime,
      preparingStartedAt: resolvedPreparingStartedAt,
      orderRounds: 1,
      rounds: [
        {
          roundNumber: 1,
          items: JSON.parse(JSON.stringify(orderData.items)),
          placedAt: now,
          estimatedPrepTimeMin: resolvedPrepTime,
          preparingStartedAt: resolvedPreparingStartedAt,
          status: orderData.status,
        },
      ],
    };

    orders.unshift(newOrder); // add to top
    this.saveOrders(orders);

    // Update table status to occupied
    this.updateTable(newOrder.tableId, { status: 'occupied', activeOrderId: id });

    // Store for customer tracking persistence
    this.addCustomerOrderId(id);

    // Broadcast new order specifically
    this.notify('NEW_ORDER', newOrder);

    // Persist new order to Neon using the SAME id we already assigned
    // locally (the server accepts a client-supplied id) so the two never
    // diverge — if this request fails, the retry in pollOrdersAndTables()
    // reuses this same id too, instead of ever creating a mismatched
    // duplicate that lingers as an orphaned "local-only" order forever.
    // Held for the whole request so the poll's local-only retry can't fire a
    // second POST for this order while this one is still on its way — a slow
    // create would otherwise be re-sent and land as a duplicate round.
    this.ordersBeingSynced.add(id);
    this.apiFetch<Order>(`/orders${options?.forceNewOrder ? '?force=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify({ ...orderData, id, estimatedPrepTimeMin: resolvedPrepTime }),
    })
      .then((serverOrder) => {
        if (serverOrder) {
          const cur = this.getOrders();
          const idx = cur.findIndex((o) => o.id === id || o.id === serverOrder.id);
          if (idx >= 0) {
            cur[idx] = serverOrder;
            this.saveOrders(cur);
            this.addCustomerOrderId(serverOrder.id);
          }
        }
      })
      .catch(() => {})
      .finally(() => this.ordersBeingSynced.delete(id));

    return newOrder;
  }

  public combineOrders(orderIds: string[]): Order | null {
    if (!orderIds || orderIds.length < 2) return null;
    const orders = this.getOrders();
    const ordersToCombine = orders.filter((o) => orderIds.includes(o.id));
    if (ordersToCombine.length < 2) return null;

    // Earliest order is primary
    ordersToCombine.sort((a, b) => a.createdAt - b.createdAt);
    const primaryOrder = ordersToCombine[0];
    const secondaryOrders = ordersToCombine.slice(1);
    const cafe = this.getCafe();
    const now = Date.now();

    if (!primaryOrder.mergedOrderIds) {
      primaryOrder.mergedOrderIds = [];
    }

    // Merge items from secondary orders
    for (const secOrder of secondaryOrders) {
      if (!primaryOrder.mergedOrderIds.includes(secOrder.id)) {
        primaryOrder.mergedOrderIds.push(secOrder.id);
      }

      for (const secItem of secOrder.items) {
        const existingIdx = primaryOrder.items.findIndex(
          (it) =>
            it.menuItemId === secItem.menuItemId &&
            JSON.stringify(it.selectedCustomizations) === JSON.stringify(secItem.selectedCustomizations) &&
            (it.specialInstructions || '') === (secItem.specialInstructions || '')
        );
        if (existingIdx >= 0) {
          primaryOrder.items[existingIdx].quantity += secItem.quantity;
          primaryOrder.items[existingIdx].itemTotal = Number(
            (primaryOrder.items[existingIdx].itemTotal + secItem.itemTotal).toFixed(2)
          );
        } else {
          primaryOrder.items.push({ ...secItem });
        }
      }

      if (secOrder.specialInstructions) {
        primaryOrder.specialInstructions = primaryOrder.specialInstructions
          ? `${primaryOrder.specialInstructions}; (Merged #${secOrder.id}: ${secOrder.specialInstructions})`
          : secOrder.specialInstructions;
      }
    }

    // Recalculate bill
    const subtotal = Number(primaryOrder.items.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2));
    const mergeCafe = this.getCafe();
    const tax = Number(((subtotal * mergeCafe.taxPercent) / 100).toFixed(2));
    const serviceCharge = Number(((subtotal * mergeCafe.serviceChargePercent) / 100).toFixed(2));
    const total = Number((subtotal + tax + serviceCharge).toFixed(2));

    primaryOrder.subtotal = subtotal;
    primaryOrder.tax = tax;
    primaryOrder.serviceCharge = serviceCharge;
    primaryOrder.total = total;
    primaryOrder.updatedAt = now;
    primaryOrder.isMerged = true;
    primaryOrder.orderRounds = (primaryOrder.orderRounds || 1) + secondaryOrders.length;

    // Filter out secondary orders from active list
    const secondaryIds = new Set(secondaryOrders.map((o) => o.id));
    const remainingOrders = orders.filter((o) => !secondaryIds.has(o.id));

    // Update primary order in remainingOrders
    const pIdx = remainingOrders.findIndex((o) => o.id === primaryOrder.id);
    if (pIdx >= 0) {
      remainingOrders[pIdx] = primaryOrder;
    }

    this.saveOrders(remainingOrders);
    this.notify('ORDERS_UPDATED', remainingOrders);
    return primaryOrder;
  }

  public combineOrdersForTable(tableIdentifier: string): Order | null {
    const orders = this.getOrders();
    const tableOrders = orders.filter(
      (o) =>
        (o.tableId === tableIdentifier || o.tableNumber.toLowerCase() === tableIdentifier.toLowerCase()) &&
        o.status !== 'served' &&
        o.status !== 'cancelled'
    );
    if (tableOrders.length < 2) return null;
    return this.combineOrders(tableOrders.map((o) => o.id));
  }

  // A round's prep timer is the slowest dish's own time, plus 1 extra minute
  // per additional dish (kitchen needs a little longer to juggle more plates)
  // — never a flat default that overrides what a single fast dish actually needs.
  private calculateRoundPrepTime(items: { preparationTimeMin?: number }[]): number {
    if (!items || items.length === 0) return 15;
    const maxPrep = items.reduce((max, item) => Math.max(max, item.preparationTimeMin || 15), 0);
    return maxPrep + (items.length - 1);
  }

  // How many orders the kitchen is already working through — anything the
  // kitchen still has to cook ('received' = not accepted yet, 'preparing' =
  // on the pass). 'ready' is done cooking, so it no longer holds up a queue.
  private getKitchenQueueLoad(): number {
    return this.getOrders().filter((o) => o.status === 'received' || o.status === 'preparing')
      .length;
  }

  // Once the kitchen is holding more than KITCHEN_BUSY_THRESHOLD orders, every
  // further order (the 6th onwards) waits behind that backlog — so quote it
  // KITCHEN_BUSY_EXTRA_MIN minutes on top of its own cooking time instead of
  // promising a time only an empty kitchen could hit.
  private applyKitchenLoadSurcharge(basePrepTimeMin: number): number {
    return this.getKitchenQueueLoad() >= KITCHEN_BUSY_THRESHOLD
      ? basePrepTimeMin + KITCHEN_BUSY_EXTRA_MIN
      : basePrepTimeMin;
  }

  // Given each round's own status, works out the single status shown for the
  // whole order. A round newly added while earlier rounds are already cooking
  // keeps the order at "preparing" (it's flagged separately for the kitchen to
  // accept) instead of pretending nothing changed or restarting the whole order.
  private computeAggregateOrderStatus(rounds: OrderRound[]): OrderStatus {
    // Guard: if no round data exists yet (sync hasn't completed), keep the
    // order at 'received' rather than accidentally marking it 'served'.
    if (!rounds || rounds.length === 0) return 'received';

    if (rounds.every((r) => r.status === 'served')) return 'served';
    if (rounds.every((r) => r.status === 'cancelled')) return 'cancelled';

    const active = rounds.filter((r) => r.status !== 'cancelled' && r.status !== 'served');
    if (active.length === 0) return 'served';

    const hasPending = active.some((r) => r.status === 'received');
    const hasCooking = active.some((r) => r.status === 'preparing');
    const allReady = active.every((r) => r.status === 'ready');

    if (allReady) return 'ready';
    if (hasPending && !hasCooking && active.every((r) => r.status === 'received')) return 'received';
    return 'preparing';
  }

  public updateOrderStatus(orderId: string, status: OrderStatus): Order | null {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;

    const now = Date.now();

    if (order.rounds && order.rounds.length > 0) {
      if (status === 'preparing') {
        // Accept only the round(s) still awaiting acceptance; already-cooking
        // rounds keep their own preparingStartedAt/estimatedPrepTimeMin untouched.
        order.rounds.forEach((r) => {
          if (r.status === 'received') {
            r.status = 'preparing';
            r.preparingStartedAt = now;
          }
        });
        if (!order.preparingStartedAt) order.preparingStartedAt = now;
        if (!order.estimatedPrepTimeMin) order.estimatedPrepTimeMin = 15;
      } else if (status === 'ready') {
        order.rounds.forEach((r) => {
          if (r.status === 'preparing') {
            r.status = 'ready';
            r.readyAt = now;
          }
        });
        order.readyAt = now;
      } else if (status === 'served') {
        order.rounds.forEach((r) => {
          r.status = 'served';
        });
      } else if (status === 'cancelled') {
        order.rounds.forEach((r) => {
          r.status = 'cancelled';
        });
      }
      order.status = this.computeAggregateOrderStatus(order.rounds);
    } else {
      order.status = status;
      if (status === 'preparing') {
        if (!order.preparingStartedAt) {
          order.preparingStartedAt = now;
        }
        if (!order.estimatedPrepTimeMin) {
          order.estimatedPrepTimeMin = 15;
        }
      } else if (status === 'ready') {
        order.readyAt = now;
      }
    }

    order.updatedAt = now;

    if (status === 'served') {
      order.paymentStatus = 'paid';
      // Mark table available if no other active orders
      const remainingActive = orders.some((o) => o.tableId === order.tableId && o.id !== orderId && (o.status === 'received' || o.status === 'preparing' || o.status === 'ready'));
      if (!remainingActive) {
        this.updateTable(order.tableId, { status: 'available', activeOrderId: undefined });
      }
    } else if (status === 'cancelled') {
      const remainingActive = orders.some((o) => o.tableId === order.tableId && o.id !== orderId && (o.status === 'received' || o.status === 'preparing' || o.status === 'ready'));
      if (!remainingActive) {
        this.updateTable(order.tableId, { status: 'available', activeOrderId: undefined });
      }
    }

    this.saveOrders(orders);
    soundService.playStatusUpdateBlip();
    this.apiFetch(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    return order;
  }

  // Advances a single round independently of the others — used when a table
  // has multiple rounds and the kitchen/waiter needs to mark just one round
  // ready or served without touching a different round that's still cooking.
  public updateRoundStatus(orderId: string, roundNumber: number, status: OrderStatus): Order | null {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order || !order.rounds) return null;

    const round = order.rounds.find((r) => r.roundNumber === roundNumber);
    if (!round) return null;

    const now = Date.now();
    round.status = status;
    if (status === 'preparing' && !round.preparingStartedAt) {
      round.preparingStartedAt = now;
    } else if (status === 'ready') {
      round.readyAt = now;
    }

    const aggregateStatus = this.computeAggregateOrderStatus(order.rounds);
    order.status = aggregateStatus;
    order.updatedAt = now;

    if (aggregateStatus === 'ready' && !order.readyAt) {
      order.readyAt = now;
    }

    if (aggregateStatus === 'served') {
      order.paymentStatus = 'paid';
      const remainingActive = orders.some(
        (o) =>
          o.tableId === order.tableId &&
          o.id !== orderId &&
          (o.status === 'received' || o.status === 'preparing' || o.status === 'ready')
      );
      if (!remainingActive) {
        this.updateTable(order.tableId, { status: 'available', activeOrderId: undefined });
      }
    }

    this.saveOrders(orders);
    soundService.playStatusUpdateBlip();
    this.apiFetch(`/orders/${orderId}/rounds/${roundNumber}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return order;
  }

  public updateOrderPrepTime(
    orderId: string,
    additionalOrTotalMinutes: number,
    isAdjustment = false,
    roundNumber?: number
  ): Order | null {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;

    // When a specific round is targeted (or there's an actively-cooking round),
    // extend only that round's timer instead of every round in the order.
    if (order.rounds && order.rounds.length > 0) {
      const target =
        (roundNumber && order.rounds.find((r) => r.roundNumber === roundNumber)) ||
        order.rounds.find((r) => r.status === 'preparing') ||
        order.rounds[order.rounds.length - 1];

      if (target) {
        target.estimatedPrepTimeMin = isAdjustment
          ? Math.max(5, (target.estimatedPrepTimeMin || 15) + additionalOrTotalMinutes)
          : Math.max(5, additionalOrTotalMinutes);
      }
    }

    if (isAdjustment) {
      order.estimatedPrepTimeMin = Math.max(5, (order.estimatedPrepTimeMin || 15) + additionalOrTotalMinutes);
    } else {
      order.estimatedPrepTimeMin = Math.max(5, additionalOrTotalMinutes);
    }
    order.updatedAt = Date.now();

    this.saveOrders(orders);
    soundService.playStatusUpdateBlip();
    this.apiFetch(`/orders/${orderId}/prep-time`, {
      method: 'PATCH',
      body: JSON.stringify({ additionalOrTotalMinutes, isAdjustment, roundNumber }),
    });
    return order;
  }

  // Day-by-day takings for one calendar month (YYYY-MM). The server
  // recomputes these from the orders themselves and stores them in the
  // daily_revenue table, so the numbers here always match the order list.
  // The browser's own zone decides where a day starts, matching how the rest
  // of the dashboard reads "today".
  public async getDailyRevenue(month: string): Promise<DailyRevenueReport | null> {
    const timeZone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        return 'UTC';
      }
    })();
    return this.apiFetch<DailyRevenueReport>(
      `/revenue/daily?month=${encodeURIComponent(month)}&tz=${encodeURIComponent(timeZone)}`
    );
  }

  public getLastCustomerOrderId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER_ID);
  }

  public setLastCustomerOrderId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER_ID, id);
  }

  public getCustomerOrderIds(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMER_ORDER_IDS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore parse error
    }
    const single = this.getLastCustomerOrderId();
    return single ? [single] : [];
  }

  public addCustomerOrderId(id: string): void {
    const existing = this.getCustomerOrderIds();
    if (!existing.includes(id)) {
      const updated = [...existing, id];
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_ORDER_IDS, JSON.stringify(updated));
    }
    this.setLastCustomerOrderId(id);
    this.notify('ORDERS_UPDATED');
  }

  public clearCustomerOrderIds(): void {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_ORDER_IDS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER_ID);
    this.notify('ORDERS_UPDATED');
  }

  // --- RESET DEMO ---
  public resetToDemo(): void {
    localStorage.setItem(STORAGE_KEYS.CAFE, JSON.stringify(INITIAL_CAFE));
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(INITIAL_TABLES));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(INITIAL_MENU_ITEMS));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_SAMPLE_ORDERS));
    localStorage.setItem(STORAGE_KEYS.ORDER_SEQ, String(ORDER_ID_MIN));
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_ORDER_IDS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER_ID);
    this.notify('CAFE_UPDATED');
    this.notify('TABLES_UPDATED');
    this.notify('MENU_UPDATED');
    this.notify('ORDERS_UPDATED');
  }
}

export const storageService = new StorageService();
