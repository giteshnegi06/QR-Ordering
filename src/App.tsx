import React, { useState, useEffect } from 'react';
import { CafeInfo, Category, MenuItem, Order, TableItem } from './types';
import { storageService } from './services/storage';
import { CustomerView } from './components/customer/CustomerView';
import { KitchenView } from './components/kitchen/KitchenView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import { soundService } from './services/sound';
import {
  ChefHat,
  Store,
} from 'lucide-react';

// Detect if the current URL is a customer QR menu URL: /menu/{cafeId}/{tableId}
function getQRMenuTableId(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/menu\/[^/]+\/([^/]+)/);
  if (match && match[1]) return match[1];
  // Also support ?table=xxx as a fallback (for manual/dev links)
  const params = new URLSearchParams(window.location.search);
  const tableParam = params.get('table');
  if (tableParam) return tableParam;
  return null;
}

// Staff-side routes. The login page is /cafe-login; a successful sign-in
// lands an admin on /cafe-admin and kitchen/staff accounts on /cafe-staff.
// The old /admin and /kitchen URLs still work — they're mapped onto these.
type StaffView = 'kitchen' | 'admin';

const STAFF_ROUTES: Record<StaffView, string> = {
  admin: '/cafe-admin',
  kitchen: '/cafe-staff',
};
const LOGIN_ROUTE = '/cafe-login';

// What the login page hands back: enough to know who is signed in and
// which portal they may open.
interface StaffSession {
  email: string;
  role: 'admin' | 'kitchen' | 'staff';
}

function staffViewFromUrl(): StaffView | null {
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  if (path === '/cafe-staff' || path === '/kitchen' || hash.includes('kitchen') || search.includes('view=kitchen')) {
    return 'kitchen';
  }
  if (path === '/cafe-admin' || path === '/admin') return 'admin';
  return null;
}

// Where an account belongs: admins and floor staff work from the cafe
// console; kitchen accounts get the kitchen display.
function homeViewFor(session: StaffSession): StaffView {
  return session.role === 'kitchen' ? 'kitchen' : 'admin';
}

// Whether an account is allowed into the cafe console at all.
function canOpenConsole(session: StaffSession | null): boolean {
  return !!session && session.role !== 'kitchen';
}

function setUrl(path: string, replace = false) {
  try {
    if (replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
  } catch {
    // In restricted iframe environments, history API might be sandboxed
  }
}

export const App: React.FC = () => {
  // State from Storage Service
  const [cafe, setCafe] = useState<CafeInfo>(() => storageService.getCafe());
  const [categories, setCategories] = useState<Category[]>(() => storageService.getCategories());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => storageService.getMenuItems());
  const [tables, setTables] = useState<TableItem[]>(() => storageService.getTables());
  const [orders, setOrders] = useState<Order[]>(() => storageService.getOrders());

  // Detect if this is a QR-scanned customer session
  const [qrTableId] = useState<string | null>(() => getQRMenuTableId());

  // Staff authentication state, kept for the session. Both the admin console
  // and the kitchen display sit behind this login.
  const [staffUser, setStaffUser] = useState<StaffSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('cafe_staff_user');
      return raw ? (JSON.parse(raw) as StaffSession) : null;
    } catch {
      return null;
    }
  });

  // Staff view state (only relevant when NOT in customer QR mode). Resolved
  // from the URL, but a non-admin can never land in the admin console and
  // an unknown path goes to the account's own home.
  const [staffView, setStaffView] = useState<StaffView>(() => {
    const fromUrl = staffViewFromUrl();
    if (!staffUser) return fromUrl ?? 'admin';
    if (fromUrl === 'admin' && !canOpenConsole(staffUser)) return 'kitchen';
    return fromUrl ?? homeViewFor(staffUser);
  });

  // Keep the address bar honest: /cafe-login while signed out, and the
  // route of whichever portal is showing once signed in.
  useEffect(() => {
    if (qrTableId !== null) return;
    const wanted = staffUser ? STAFF_ROUTES[staffView] : LOGIN_ROUTE;
    if (window.location.pathname.replace(/\/$/, '') !== wanted) setUrl(wanted, true);
  }, [staffUser, staffView, qrTableId]);

  // Keep state synchronized with storageService events
  useEffect(() => {
    const unsubscribe = storageService.subscribe((type) => {
      if (type === 'CAFE_UPDATED') setCafe(storageService.getCafe());
      if (type === 'CATEGORIES_UPDATED') setCategories(storageService.getCategories());
      if (type === 'MENU_UPDATED') setMenuItems(storageService.getMenuItems());
      if (type === 'TABLES_UPDATED') setTables(storageService.getTables());
      if (type === 'ORDERS_UPDATED' || type === 'NEW_ORDER') setOrders(storageService.getOrders());
    });

    return unsubscribe;
  }, []);

  // Keep the browser tab title in sync with the cafe name the admin sets
  // in Settings, so a rename shows up immediately without a page reload.
  useEffect(() => {
    document.title = cafe.name ? `${cafe.name} - QR Ordering & Kitchen System` : 'QR Ordering & Kitchen System';
  }, [cafe.name]);

  // Browsers block audio until a real user gesture happens on the page. This
  // must live at the app root (not inside KitchenView) because the very
  // first click a kitchen user makes is the nav click that switches INTO the
  // Kitchen KDS view — by the time KitchenView mounts and adds its own
  // listener, that click has already fired and is gone, leaving audio
  // locked until a second, unrelated click happens later. Listening here
  // from the first paint means that very first nav click is what unlocks it.
  useEffect(() => {
    const unlock = () => soundService.unlock();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  // Navigate between staff views and update URL. Kitchen accounts can't open
  // the console; asking for it keeps them on the kitchen display.
  const navigateToStaffView = (view: StaffView) => {
    const allowed = view === 'admin' && !canOpenConsole(staffUser) ? 'kitchen' : view;
    setStaffView(allowed);
    setUrl(STAFF_ROUTES[allowed]);
  };

  // Login / logout
  const handleStaffLogin = (email: string, role: 'admin' | 'kitchen' | 'staff') => {
    const session: StaffSession = { email, role };
    setStaffUser(session);
    sessionStorage.setItem('cafe_staff_user', JSON.stringify(session));
    const home = homeViewFor(session);
    setStaffView(home);
    setUrl(STAFF_ROUTES[home]);
  };

  const handleStaffLogout = () => {
    setStaffUser(null);
    sessionStorage.removeItem('cafe_staff_user');
    setStaffView('admin');
    setUrl(LOGIN_ROUTE);
  };

  // ─── CUSTOMER QR MENU ROUTE ───────────────────────────────────────────────
  // If the URL is /menu/{cafeId}/{tableId}, render ONLY the customer view.
  // No nav bar, no staff controls — the customer only sees the menu.
  if (qrTableId !== null) {
    return <CustomerView tableId={qrTableId} />;
  }

  // ─── STAFF INTERFACE ──────────────────────────────────────────────────────
  // Kitchen & Admin views. The customer menu is NOT accessible from here —
  // customers must scan a QR code to access the menu.
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans">
      {/* Staff Navigation Bar */}
      <nav className="bg-stone-950 text-white border-b border-stone-800 sticky top-0 z-50 text-xs px-3 sm:px-6 py-2 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center">
            {/* Wordmark, served straight from public/ so it needs no import.
                Intrinsic width/height are declared so the browser reserves the
                right space before the file loads and the nav doesn't jump. */}
            <img
              src="/assets/logo.png"
              alt={cafe.name}
              width={1735}
              height={906}
              className="h-9 sm:h-10 w-auto shrink-0"
            />
          </div>

          {/* Staff Interface Switcher — only once signed in. Kitchen accounts
              only get the kitchen, so they see no console button at all. */}
          {staffUser && (
            <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
                <button
                  onClick={() => navigateToStaffView('kitchen')}
                  className={`px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    staffView === 'kitchen'
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>Kitchen</span>
                  {orders.filter((o) => o.status === 'received' || o.status === 'preparing').length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-0.5" />
                  )}
                </button>

                {canOpenConsole(staffUser) && (
                  <button
                    onClick={() => navigateToStaffView('admin')}
                    className={`px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      staffView === 'admin'
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Cafe</span>
                  </button>
                )}
            </div>
          )}

          {/* QR scan hint */}
          {/* <div className="hidden sm:flex items-center gap-1.5 text-stone-500 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <span>Customer menu accessible via QR scan only</span>
          </div> */}
        </div>
      </nav>

      {/* Staff View Router — everything here is behind the staff login */}
      <div className="flex-1 flex flex-col">
        {!staffUser ? (
          <AdminLogin cafe={cafe} onLoginSuccess={handleStaffLogin} />
        ) : staffView === 'kitchen' ? (
          <KitchenView
            onSwitchToCustomer={() => {}}
            onSwitchToAdmin={() => navigateToStaffView('admin')}
            onLogout={handleStaffLogout}
          />
        ) : (
            <AdminLayout
              cafe={cafe}
              currentUser={staffUser}
              orders={orders}
              tables={tables}
              categories={categories}
              menuItems={menuItems}
              onUpdateCafe={(updated) => storageService.updateCafe(updated)}
              onUpdateOrderStatus={(orderId, status) => storageService.updateOrderStatus(orderId, status)}
              onAddMenuItem={(item) => storageService.addMenuItem(item)}
              onUpdateMenuItem={(id, updates) => storageService.updateMenuItem(id, updates)}
              onDeleteMenuItem={(id) => storageService.deleteMenuItem(id)}
              onToggleMenuItemAvailability={(id) => storageService.toggleMenuItemAvailability(id)}
              onAddCategory={(name) => storageService.addCategory(name)}
              onUpdateCategory={(id, name) => storageService.updateCategory(id, name)}
              onDeleteCategory={(id) => storageService.deleteCategory(id)}
              onAddTable={(table) => storageService.addTable(table)}
              onUpdateTable={(id, updates) => storageService.updateTable(id, updates)}
              onDeleteTable={(id) => storageService.deleteTable(id)}
              onOpenCustomerMenu={(tableId) => {
                // Customer menu is QR-only — open in a new tab for admin preview
                const tid = tableId || tables[0]?.code || tables[0]?.id || 'table-01';
                window.open(`/menu/${cafe.id}/${tid}`, '_blank');
              }}
              onOpenKitchen={() => navigateToStaffView('kitchen')}
              onLogout={handleStaffLogout}
            />
        )}
      </div>
    </div>
  );
};
export default App;
