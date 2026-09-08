import React, { useState, useMemo } from 'react';
import { CafeInfo, Order, OrderStatus, TableItem } from '../../types';
import { TableBillModal } from './TableBillModal';
import { TableOrderHistoryModal } from './TableOrderHistoryModal';
import {
  Search,
  Clock,
  Eye,
  Printer,
  Layers,
  Sparkles,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  User,
  LayoutGrid,
  List,
  Check,
  ChevronRight,
  Receipt,
  Utensils,
} from 'lucide-react';
import { VegBadge } from '../common/VegBadge';

interface AdminOrdersProps {
  cafe: CafeInfo;
  orders: Order[];
  tables: TableItem[];
  onOpenOrder: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onCombineOrders?: (orderIds: string[]) => void;
  onOpenCustomerMenu?: (tableId: string) => void;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({
  cafe,
  orders,
  tables,
  onOpenOrder,
  onUpdateStatus,
  onCombineOrders,
  onOpenCustomerMenu,
}) => {
  const [viewMode, setViewMode] = useState<'tables' | 'list'>('tables');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | OrderStatus>('all');

  // Single Bill Modal state
  const [selectedTableForBill, setSelectedTableForBill] = useState<{
    tableNumber: string;
    orders: Order[];
  } | null>(null);

  // Table Day-History Modal state — shows every order placed today for a table
  const [selectedTableForHistory, setSelectedTableForHistory] = useState<{
    tableNumber: string;
    orders: Order[];
  } | null>(null);

  // Success message toast for actions like combining
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Group orders by Table Number
  const tableCardsData = useMemo(() => {
    // Collect all table representations
    const tableMap = new Map<
      string,
      {
        tableNumber: string;
        tableId?: string;
        capacity?: number;
        tableItem?: TableItem;
        allOrders: Order[];
        activeOrders: Order[];
        newestActiveTimestamp: number;
        latestTimestamp: number;
      }
    >();

    // First seed with configured tables
    tables.forEach((t) => {
      tableMap.set(t.number.toLowerCase(), {
        tableNumber: t.number,
        tableId: t.code || t.id,
        capacity: t.capacity,
        tableItem: t,
        allOrders: [],
        activeOrders: [],
        newestActiveTimestamp: 0,
        latestTimestamp: 0,
      });
    });

    // Populate orders into table groups
    orders.forEach((o) => {
      const key = o.tableNumber.toLowerCase();
      let group = tableMap.get(key);
      if (!group) {
        group = {
          tableNumber: o.tableNumber,
          tableId: o.tableId,
          capacity: 4,
          allOrders: [],
          activeOrders: [],
          newestActiveTimestamp: 0,
          latestTimestamp: 0,
        };
        tableMap.set(key, group);
      }

      group.allOrders.push(o);

      const isActive = o.status !== 'served' && o.status !== 'cancelled';
      if (isActive) {
        group.activeOrders.push(o);
        if (o.createdAt > group.newestActiveTimestamp) {
          group.newestActiveTimestamp = o.createdAt;
        }
      }

      if (o.createdAt > group.latestTimestamp) {
        group.latestTimestamp = o.createdAt;
      }
    });

    const groups = Array.from(tableMap.values());

    // Sort table cards so that:
    // 1. Tables with ACTIVE orders come FIRST
    // 2. Among tables with active orders, NEWEST active order shows first
    // 3. Tables with recent orders next, then idle tables
    groups.sort((a, b) => {
      const aActive = a.activeOrders.length > 0 ? 1 : 0;
      const bActive = b.activeOrders.length > 0 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      // If both have active orders, sort by newest active order timestamp descending (NEW ACTIVE ORDER FIRST)
      if (aActive && bActive) {
        return b.newestActiveTimestamp - a.newestActiveTimestamp;
      }

      // If neither has active orders, sort by latest past order timestamp
      if (a.latestTimestamp !== b.latestTimestamp) {
        return b.latestTimestamp - a.latestTimestamp;
      }

      return a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true });
    });

    return groups;
  }, [tables, orders]);

  // Filtered Table Cards
  const filteredTableCards = useMemo(() => {
    return tableCardsData.filter((card) => {
      // Status filter
      if (statusFilter === 'active') {
        if (card.activeOrders.length === 0) return false;
      } else if (statusFilter !== 'all') {
        const matchesStatus = card.allOrders.some((o) => o.status === statusFilter);
        if (!matchesStatus) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTable = card.tableNumber.toLowerCase().includes(q);
        const matchesOrder = card.allOrders.some(
          (o) =>
            o.id.toLowerCase().includes(q) ||
            o.customerName?.toLowerCase().includes(q) ||
            o.items.some((i) => i.name.toLowerCase().includes(q))
        );
        if (!matchesTable && !matchesOrder) return false;
      }

      return true;
    });
  }, [tableCardsData, statusFilter, searchQuery]);

  // Filtered flat orders for List view
  const filteredOrdersList = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter === 'active') {
        if (order.status === 'served' || order.status === 'cancelled') return false;
      } else if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesTable = order.tableNumber.toLowerCase().includes(q);
        const matchesCustomer = order.customerName?.toLowerCase().includes(q);
        const matchesItem = order.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesId && !matchesTable && !matchesCustomer && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Handle manual combine for a table
  const handleCombineTableOrders = (orderIds: string[], tableNum: string) => {
    if (!onCombineOrders) return;
    if (orderIds.length < 2) return;
    if (
      window.confirm(
        `Combine ${orderIds.length} orders for ${tableNum} into a single bill & order ID?`
      )
    ) {
      onCombineOrders(orderIds);
      showNotice(`Successfully combined orders for ${tableNum} into a single bill!`);
    }
  };

  const totalActiveOrders = orders.filter(
    (o) => o.status === 'received' || o.status === 'preparing' || o.status === 'ready'
  ).length;

  const totalNewOrders = orders.filter((o) => o.status === 'received').length;

  const availableTablesCount = tables.filter((t) => t.status === 'available').length;
  const occupiedTablesCount = tables.filter((t) => t.status === 'occupied').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-900 tracking-tight">Order Management</h2>
            {totalNewOrders > 0 && (
              <span className="px-2.5 py-0.5 bg-amber-500 text-stone-950 font-black text-xs rounded-full animate-bounce">
                {totalNewOrders} New Order{totalNewOrders > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Orders grouped by Table Number • New active orders shown first with single-bill printing
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-stone-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('tables')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'tables'
                  ? 'bg-white text-stone-950 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>By Table No</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-stone-950 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>All Orders List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-md text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Table NO, Order #, Guest name, or dish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {(
            [
              { key: 'all', label: 'All Tables' },
              { key: 'active', label: `Active (${totalActiveOrders})` },
              { key: 'received', label: `New (${totalNewOrders})` },
              { key: 'preparing', label: 'Cooking' },
              { key: 'ready', label: 'Ready' },
              { key: 'served', label: 'Served' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW 1: TABLE CARDS (Sorted by New Active Orders First) */}
      {viewMode === 'tables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span>
              Showing <strong>{filteredTableCards.length}</strong> Tables • Available: <strong>{availableTablesCount}</strong> • Occupied: <strong>{occupiedTablesCount}</strong>
            </span>
            
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTableCards.length === 0 ? (
              <div className="col-span-full p-12 bg-white rounded-3xl border border-stone-200 text-center text-stone-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-bold text-stone-600">No tables match your filter criteria.</p>
                <p className="text-xs text-stone-400 mt-1">Try resetting the status filter or search query.</p>
              </div>
            ) : (
              filteredTableCards.map((card) => {
                const hasActive = card.activeOrders.length > 0;
                const hasNewOrder = card.activeOrders.some((o) => o.status === 'received');
                const hasPreparing = card.activeOrders.some((o) => o.status === 'preparing');
                const hasReady = card.activeOrders.some((o) => o.status === 'ready');
                const hasMultipleOrders = card.activeOrders.length > 1;

                // Total active amount (without tax)
                const activeTotal = card.activeOrders.reduce(
                  (sum, o) => sum + (o.subtotal + (o.serviceCharge || 0)),
                  0
                );
                const activeItemsCount = card.activeOrders.reduce(
                  (sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0),
                  0
                );

                // Check 30-min window for auto-combining
                const earliestActive = card.activeOrders[0];
                const isWithin30Mins =
                  earliestActive && Date.now() - earliestActive.createdAt <= 30 * 60 * 1000;

                return (
                  <div
                    key={card.tableNumber}
                    className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-2xs ${
                      hasNewOrder
                        ? 'border-amber-400 ring-2 ring-amber-300/80 bg-amber-50/20'
                        : hasPreparing
                        ? 'border-blue-300 ring-1 ring-blue-100'
                        : hasReady
                        ? 'border-emerald-300 ring-1 ring-emerald-100'
                        : hasActive
                        ? 'border-stone-300'
                        : 'border-stone-200 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-stone-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setSelectedTableForHistory({
                                  tableNumber: card.tableNumber,
                                  orders: card.allOrders,
                                })
                              }
                              className="text-lg font-black text-stone-900 tracking-tight hover:text-amber-700 hover:underline decoration-2 underline-offset-2 transition-colors cursor-pointer"
                              title="View all of today's orders for this table"
                            >
                              {card.tableNumber}
                            </button>

                            {hasNewOrder && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500 text-stone-950 rounded-full flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-950 animate-ping" />
                                <span>NEW ORDER</span>
                              </span>
                            )}

                            {hasPreparing && !hasNewOrder && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 rounded-full flex items-center gap-1">
                                <ChefHat className="w-3 h-3" />
                                <span>COOKING</span>
                              </span>
                            )}

                            {hasReady && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 rounded-full">
                                READY TO SERVE
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-stone-400" />
                              <span>{card.capacity} Guests</span>
                            </span>
                            <span>•</span>
                            <span
                              className={`font-semibold ${
                                hasActive ? 'text-amber-800' : 'text-stone-400'
                              }`}
                            >
                              {hasActive
                                ? `${card.activeOrders.length} Active Order${
                                    card.activeOrders.length > 1 ? 's' : ''
                                  }`
                                : 'No Active Orders'}
                            </span>
                          </div>
                        </div>

                        {/* Direct Single Bill Print Button */}
                        {hasActive ? (
                          <button
                            onClick={() =>
                              setSelectedTableForBill({
                                tableNumber: card.tableNumber,
                                orders: card.activeOrders,
                              })
                            }
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Print Single Consolidated Bill for Table"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Bill</span>
                          </button>
                        ) : card.allOrders.length > 0 ? (
                          <button
                            onClick={() =>
                              setSelectedTableForBill({
                                tableNumber: card.tableNumber,
                                orders: [card.allOrders[0]],
                              })
                            }
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                            title="Print Past Receipt"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Past Bill</span>
                          </button>
                        ) : null}
                      </div>

                      {/* 30-min window banner */}
                      {isWithin30Mins && hasActive && (
                        <div className="mt-2.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>30-min single bill window active</span>
                          </span>
                          <span className="text-[10px] text-amber-700">
                            Orders count in #{earliestActive.id}
                          </span>
                        </div>
                      )}

                      {/* Multi-Order Combining option banner */}
                      {hasMultipleOrders && (
                        <div className="mt-2.5 p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                          <div className="text-[11px] text-blue-900 font-medium">
                            <strong>{card.activeOrders.length} separate orders</strong> for this
                            table ({card.activeOrders.map((o) => `#${o.id}`).join(', ')})
                          </div>
                          {onCombineOrders && (
                            <button
                              onClick={() =>
                                handleCombineTableOrders(
                                  card.activeOrders.map((o) => o.id),
                                  card.tableNumber
                                )
                              }
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg shadow-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Merge into a single order ID and bill"
                            >
                              <Layers className="w-3 h-3" />
                              <span>Combine Orders</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Orders Body */}
                    <div className="p-4 flex-1 space-y-3">
                      {card.allOrders.length === 0 ? (
                        <div className="py-6 text-center text-xs text-stone-400">
                          Table is available. No orders placed yet.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {/* List active orders first, then past orders */}
                          {(hasActive ? card.activeOrders : card.allOrders.slice(0, 2)).map(
                            (order) => {
                              const isOrderActive =
                                order.status !== 'served' && order.status !== 'cancelled';

                              return (
                                <div
                                  key={order.id}
                                  className={`p-3 rounded-2xl border transition-colors ${
                                    isOrderActive
                                      ? 'bg-stone-50 border-stone-200/80 hover:border-amber-300'
                                      : 'bg-stone-50/40 border-stone-100 opacity-75'
                                  }`}
                                >
                                  {/* Order Header */}
                                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-stone-200/60">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-black text-stone-900">
                                        #{order.id}
                                      </span>
                                      {order.orderRounds && order.orderRounds > 1 && (
                                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                                          Round {order.orderRounds}
                                        </span>
                                      )}
                                      {order.isMerged && (
                                        <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                                          Combined
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                                          order.status === 'received'
                                            ? 'bg-amber-100 text-amber-900'
                                            : order.status === 'preparing'
                                            ? 'bg-blue-100 text-blue-900'
                                            : order.status === 'ready'
                                            ? 'bg-emerald-100 text-emerald-900'
                                            : order.status === 'served'
                                            ? 'bg-stone-200 text-stone-700'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {order.status}
                                      </span>

                                      <span className="text-[11px] text-stone-400">
                                        {new Date(order.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Items Summary */}
                                  <div className="space-y-1">
                                    {order.items.map((it, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between text-xs text-stone-700"
                                      >
                                        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                          <VegBadge type={it.vegType} size="sm" />
                                          <span className="font-medium truncate">
                                            {it.quantity}x {it.name}
                                          </span>
                                        </div>
                                        <span className="font-bold text-stone-900 shrink-0">
                                          {cafe.currency}
                                          {it.itemTotal.toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Guest & Notes */}
                                  {order.customerName && (
                                    <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>Guest: {order.customerName}</span>
                                    </div>
                                  )}

                                  {order.specialInstructions && (
                                    <div className="text-[10px] text-amber-800 italic mt-1 truncate">
                                      "{order.specialInstructions}"
                                    </div>
                                  )}

                                  {/* Action links */}
                                  <div className="mt-2 pt-2 border-t border-stone-200/50 flex items-center justify-between text-xs">
                                    <div className="text-xs font-black text-stone-900">
                                      Total: {cafe.currency}
                                      {(order.subtotal + (order.serviceCharge || 0)).toFixed(2)}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => onOpenOrder(order)}
                                        className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-md transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Details</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Bottom: Consolidated Table Total & Quick Actions */}
                    <div className="p-4 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          {hasActive ? 'Active Table Bill' : 'Table Status'}
                        </div>
                        <div className="text-base font-black text-stone-900">
                          {hasActive ? `${cafe.currency}${activeTotal.toFixed(2)}` : 'Available'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasActive && (
                          <>
                            {/* Quick status button */}
                            {hasNewOrder ? (
                              <button
                                onClick={() => {
                                  card.activeOrders.forEach((o) => {
                                    if (o.status === 'received') onUpdateStatus(o.id, 'preparing');
                                  });
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <ChefHat className="w-3.5 h-3.5" />
                                <span>Cook</span>
                              </button>
                            ) : hasPreparing ? (
                              <button
                                onClick={() => {
                                  card.activeOrders.forEach((o) => {
                                    if (o.status === 'preparing') onUpdateStatus(o.id, 'ready');
                                  });
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Ready</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  card.activeOrders.forEach((o) => onUpdateStatus(o.id, 'served'));
                                }}
                                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Served</span>
                              </button>
                            )}
                          </>
                        )}

                        {card.tableId && onOpenCustomerMenu && (
                          <button
                            onClick={() => onOpenCustomerMenu(card.tableId!)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Open Customer QR Menu for this table"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ALL ORDERS LIST */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Order #</th>
                  <th className="p-4">Table No</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Items Summary</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-stone-400">
                      No orders match your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrdersList.map((order) => (
                    <tr key={order.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="p-4 font-black text-stone-900">
                        <div className="flex items-center gap-1.5">
                          <span>#{order.id}</span>
                          {order.orderRounds && order.orderRounds > 1 && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                              R{order.orderRounds}
                            </span>
                          )}
                          {order.isMerged && (
                            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                              Merged
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-md">
                          {order.tableNumber}
                        </span>
                      </td>

                      <td className="p-4 text-stone-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="p-4 max-w-xs">
                        <div className="truncate font-medium text-stone-700">
                          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </div>
                        {order.specialInstructions && (
                          <div className="text-[10px] text-amber-700 italic truncate">
                            "{order.specialInstructions}"
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right font-black text-stone-900 text-sm">
                        {cafe.currency}
                        {(order.subtotal + (order.serviceCharge || 0)).toFixed(2)}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border ${
                            order.status === 'received'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : order.status === 'preparing'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : order.status === 'ready'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : order.status === 'served'
                              ? 'bg-stone-100 text-stone-700 border-stone-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-1">
                        <button
                          onClick={() =>
                            setSelectedTableForBill({
                              tableNumber: order.tableNumber,
                              orders: [order],
                            })
                          }
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-xs cursor-pointer"
                          title="Print Single Bill"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Bill</span>
                        </button>

                        <button
                          onClick={() => onOpenOrder(order)}
                          className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Consolidated Bill Modal */}
      <TableBillModal
        isOpen={!!selectedTableForBill}
        onClose={() => setSelectedTableForBill(null)}
        cafe={cafe}
        tableNumber={selectedTableForBill?.tableNumber || ''}
        orders={selectedTableForBill?.orders || []}
        onUpdateStatus={onUpdateStatus}
        onCombineOrders={(orderIds) => {
          if (onCombineOrders) {
            onCombineOrders(orderIds);
            setSelectedTableForBill(null);
            showNotice('Orders successfully combined into single bill!');
          }
        }}
      />

      {/* Table Day-History Modal */}
      <TableOrderHistoryModal
        isOpen={!!selectedTableForHistory}
        onClose={() => setSelectedTableForHistory(null)}
        cafe={cafe}
        tableNumber={selectedTableForHistory?.tableNumber || ''}
        orders={selectedTableForHistory?.orders || []}
        onOpenOrder={onOpenOrder}
      />
    </div>
  );
};
