import React, { useMemo, useRef, useState } from 'react';
import { CafeInfo, MenuItem, Order, TableItem } from '../../types';
import { MonthRevenueModal } from './MonthRevenueModal';
import {
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Table as TableIcon,
  ChefHat,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CalendarRange,
  ArrowRight,
  Lock,
  Info,
  BookmarkPlus,
} from 'lucide-react';

// "Table 05" -> "T5" for the compact status grid; falls back to the raw
// number for tables that aren't named with a plain digit (e.g. "Patio A").
const getTableShortLabel = (tableNumber: string): string => {
  const match = tableNumber.match(/\d+/);
  return match ? `T${parseInt(match[0], 10)}` : tableNumber;
};

interface AdminDashboardProps {
  cafe: CafeInfo;
  orders: Order[];
  tables: TableItem[];
  menuItems: MenuItem[];
  onNavigateSection: (section: string) => void;
  onOpenOrder: (order: Order) => void;
  onUpdateTable: (id: string, updates: Partial<TableItem>) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  cafe,
  orders,
  tables,
  menuItems,
  onNavigateSection,
  onOpenOrder,
  onUpdateTable,
}) => {
  const [isMonthBreakdownOpen, setIsMonthBreakdownOpen] = useState(false);
  const [tableNotice, setTableNotice] = useState<string | null>(null);
  const tableNoticeTimeoutRef = useRef<number | null>(null);
  const [reserveMode, setReserveMode] = useState(false);

  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    [tables]
  );

  const showTableNotice = (msg: string) => {
    setTableNotice(msg);
    if (tableNoticeTimeoutRef.current) window.clearTimeout(tableNoticeTimeoutRef.current);
    tableNoticeTimeoutRef.current = window.setTimeout(() => setTableNotice(null), 4000);
  };

  // Admin can mark an available table occupied (seating a walk-in) or, with
  // Reserve Mode on, reserved instead (holding it for a booking). A reserved
  // table has no order attached, so it can freely go back to available —
  // unlike an occupied table, which is intentionally NOT freeable from here.
  // A table only becomes available again after its bill is actually settled
  // (order marked served), so occupied status can't drift out of sync with reality.
  const handleTableClick = (table: TableItem) => {
    if (table.status === 'occupied') {
      showTableNotice(
        `${table.number} is occupied — it frees up automatically once the order is served and the bill is paid.`
      );
      return;
    }

    if (table.status === 'reserved') {
      if (reserveMode) {
        onUpdateTable(table.id, { status: 'available' });
        showTableNotice(`${table.number} reservation cancelled — back to available.`);
      } else {
        onUpdateTable(table.id, { status: 'occupied' });
      }
      return;
    }

    // Available table
    if (reserveMode) {
      onUpdateTable(table.id, { status: 'reserved' });
    } else {
      onUpdateTable(table.id, { status: 'occupied' });
    }
  };

  // Metric Calculations
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const todayOrders = orders.filter((o) => o.createdAt >= todayTimestamp);
    const todaySales = todayOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.subtotal + (o.serviceCharge || 0)), 0);

    // Revenue is what the cafe keeps: the food total plus service charge.
    // Tax is collected on behalf of the government, so it is not counted here
    // — same basis as Today's Sales above, so the two figures agree.
    const earnedBy = (o: Order) => o.subtotal + (o.serviceCharge || 0);
    const isBillable = (o: Order) => o.status !== 'cancelled';

    // Calendar month, not a rolling 30 days — "this month" on a dashboard means
    // the month you are standing in. Month -1 rolls the year back on its own.
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();

    const monthOrders = orders.filter((o) => o.createdAt >= monthStart && isBillable(o));
    const monthRevenue = monthOrders.reduce((sum, o) => sum + earnedBy(o), 0);

    const prevMonthRevenue = orders
      .filter((o) => o.createdAt >= prevMonthStart && o.createdAt < monthStart && isBillable(o))
      .reduce((sum, o) => sum + earnedBy(o), 0);

    // Only meaningful with something to compare against — a first month of
    // trading would otherwise read as an infinite increase.
    const monthChangePercent =
      prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : null;

    const activeOrders = orders.filter(
      (o) => o.status === 'received' || o.status === 'preparing' || o.status === 'ready'
    );
    const completedOrders = orders.filter((o) => o.status === 'served');

    const availableItems = menuItems.filter((i) => i.isAvailable).length;
    const unavailableItems = menuItems.filter((i) => !i.isAvailable).length;

    const occupiedTables = tables.filter((t) => t.status === 'occupied').length;

    return {
      todayOrdersCount: todayOrders.length,
      todaySales,
      monthRevenue,
      monthOrdersCount: monthOrders.length,
      monthLabel: today.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      monthKey: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      monthChangePercent,
      activeOrdersCount: activeOrders.length,
      completedOrdersCount: completedOrders.length,
      totalTables: tables.length,
      occupiedTables,
      availableItems,
      unavailableItems,
    };
  }, [orders, tables, menuItems]);

  const recentOrders = useMemo(() => {
    return [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 rounded-3xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              Live Cafe Command Center
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">{cafe.name} Overview</h2>
          <p className="text-xs text-stone-300 mt-0.5">
            QR Ordering, Kitchen Dispatch, and Sales Telemetry
          </p>
        </div>

        {/* <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateSection('kitchen')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <ChefHat className="w-4 h-4" />
            <span>Open Kitchen</span>
          </button>
          <button
            onClick={() => onNavigateSection('qrcodes')}
            className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Print Table QRs
          </button>
        </div> */}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Today's Sales</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {cafe.currency}{metrics.todaySales.toFixed(2)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{metrics.todayOrdersCount} orders placed</span>
          </div>
        </div>

        {/* This Month's Revenue — opens the day-by-day breakdown */}
        <button
          type="button"
          onClick={() => setIsMonthBreakdownOpen(true)}
          title="See what each day earned this month"
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Month Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarRange className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {cafe.currency}
            {metrics.monthRevenue.toFixed(2)}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] mt-1">
            <span className="text-stone-500">
              {metrics.monthLabel} • {metrics.monthOrdersCount} orders
            </span>
            {metrics.monthChangePercent !== null && (
              <span
                className={`inline-flex items-center gap-0.5 font-bold ${
                  metrics.monthChangePercent >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {metrics.monthChangePercent >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(metrics.monthChangePercent).toFixed(0)}% vs last month
              </span>
            )}
          </div>
          <div className="text-[11px] font-bold text-indigo-600 mt-1.5">View daily earnings →</div>
        </button>

        {/* Active Orders */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Active Orders</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {metrics.activeOrdersCount}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            In kitchen or ready to serve
          </div>
        </div>

        {/* Completed Orders */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Completed Orders</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {metrics.completedOrdersCount}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Successfully served to guests
          </div>
        </div>

        {/* Tables Occupancy */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Tables</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TableIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {metrics.occupiedTables} / {metrics.totalTables}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Tables currently dining
          </div>
        </div>
      </div>

      {/* Table Status Grid — at-a-glance occupancy, click to seat a walk-in */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center space-y-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Table Status</h3>
            <p className="text-xs text-stone-500">
              {reserveMode
                ? 'Reserve Mode: click an available table to hold it, or a reserved table to release it'
                : 'Click an available table to seat a walk-in guest'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setReserveMode((v) => !v)}
              className={`self-start px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border shrink-0 ${
                reserveMode
                  ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-purple-300 hover:text-purple-700'
              }`}
              title="Toggle Reserve Mode to hold/release tables for bookings"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Reserve Mode {reserveMode ? 'ON' : 'OFF'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
                Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500 shrink-0" />
                Occupied
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-purple-500 shrink-0" />
                Reserved
              </span>
            </div>
          </div>
        </div>

        {tableNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-semibold text-amber-900 flex items-center gap-2 animate-in fade-in">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>{tableNotice}</span>
          </div>
        )}

        {sortedTables.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-400">
            No tables configured yet. Add tables from the Tables section.
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
            {sortedTables.map((table) => {
              const isOccupied = table.status === 'occupied';
              const isReserved = table.status === 'reserved';

              return (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  title={
                    isOccupied
                      ? `${table.number} is occupied — clears automatically when the bill is paid`
                      : isReserved
                      ? reserveMode
                        ? `${table.number} is reserved — click to release it`
                        : `${table.number} is reserved — click to mark occupied`
                      : reserveMode
                      ? `${table.number} is available — click to reserve it`
                      : `${table.number} is available — click to seat a walk-in`
                  }
                  className={`aspect-square rounded-lg borde font-bold text-base tracking-widest flex items-center justify-center transition-all cursor-pointer ${
                    isOccupied
                      ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                      : isReserved
                      ? 'bg-purple-500 border-purple-500 text-white hover:bg-purple-600'
                      : 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {getTableShortLabel(table.number)}
                </button>
              );
            })}
          </div>
        )}

        {/* <div className="flex items-start gap-1.5 text-[10px] text-stone-400 pt-1">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Turn on Reserve Mode to hold a table for a booking or release a reservation. Occupied
            tables can only be cleared by serving the order — this prevents marking a table
            available while its bill is still unpaid.
          </span>
        </div> */}
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Menu Items Availability */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
              Menu Items Inventory
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-lg font-extrabold text-stone-900">
                {menuItems.length} Total Dishes
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {metrics.availableItems} Available
              </span>
              {metrics.unavailableItems > 0 && (
                <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                  {metrics.unavailableItems} Unavailable
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateSection('menu')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            <span>Manage Menu</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick QR Generator action */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
              Table QR System
            </h4>
            <div className="text-sm font-extrabold text-stone-900">
              {tables.length} Active Tables Ready
            </div>
            <p className="text-[11px] text-stone-500">
              Download QR stickers or printable table stands
            </p>
          </div>

          <button
            onClick={() => onNavigateSection('qrcodes')}
            className="px-3.5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
          >
            View All QRs
          </button>
        </div>
      </div>


      {/* Recent Orders List */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900">Recent Customer Orders</h3>
            <p className="text-xs text-stone-500">Live feed from table QR scans</p>
          </div>

          <button
            onClick={() => onNavigateSection('orders')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-stone-100">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => onOpenOrder(order)}
              className="p-4 hover:bg-stone-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 font-bold text-xs flex items-center justify-center shrink-0">
                  {order.tableNumber.replace(/[^0-9]/g, '') || '01'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-stone-900">
                      #{order.id}
                    </span>
                    {order.orderRounds && order.orderRounds > 1 && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                        Round {order.orderRounds}
                      </span>
                    )}
                    {order.isMerged && (
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                        Combined
                      </span>
                    )}
                    <span className="text-xs font-bold text-stone-600">
                      {order.tableNumber}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 truncate mt-0.5">
                    {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-black text-stone-900">
                    {cafe.currency}{(order.subtotal + (order.serviceCharge || 0)).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                    order.status === 'received'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : order.status === 'preparing'
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : order.status === 'ready'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : order.status === 'served'
                      ? 'bg-stone-100 text-stone-700 border-stone-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MonthRevenueModal
        isOpen={isMonthBreakdownOpen}
        onClose={() => setIsMonthBreakdownOpen(false)}
        cafe={cafe}
        month={metrics.monthKey}
        monthLabel={metrics.monthLabel}
      />
    </div>
  );
};
