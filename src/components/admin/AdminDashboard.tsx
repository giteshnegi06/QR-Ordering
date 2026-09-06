import React, { useMemo } from 'react';
import { CafeInfo, MenuItem, Order, TableItem } from '../../types';
import {
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Table as TableIcon,
  ChefHat,
  AlertCircle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

interface AdminDashboardProps {
  cafe: CafeInfo;
  orders: Order[];
  tables: TableItem[];
  menuItems: MenuItem[];
  onNavigateSection: (section: string) => void;
  onOpenOrder: (order: Order) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  cafe,
  orders,
  tables,
  menuItems,
  onNavigateSection,
  onOpenOrder,
}) => {
  // Metric Calculations
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const todayOrders = orders.filter((o) => o.createdAt >= todayTimestamp);
    const todaySales = todayOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.subtotal + (o.serviceCharge || 0)), 0);

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateSection('kitchen')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <ChefHat className="w-4 h-4" />
            <span>Open Kitchen KDS</span>
          </button>
          <button
            onClick={() => onNavigateSection('qrcodes')}
            className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Print Table QRs
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  );
};
