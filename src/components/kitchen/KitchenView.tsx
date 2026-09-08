import React, { useState, useEffect, useMemo } from 'react';
import { CafeInfo, Order, OrderStatus } from '../../types';
import { storageService } from '../../services/storage';
import { soundService } from '../../services/sound';
import { KitchenOrderCard } from './KitchenOrderCard';
import {
  ChefHat,
  Volume2,
  VolumeX,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Flame,
} from 'lucide-react';

interface KitchenViewProps {
  onSwitchToCustomer?: (tableId: string) => void;
  onSwitchToAdmin?: () => void;
}

export const KitchenView: React.FC<KitchenViewProps> = () => {
  const [orders, setOrders] = useState<Order[]>(() => storageService.getOrders());
  const [cafe, setCafe] = useState<CafeInfo>(() => storageService.getCafe());
  const [activeTab, setActiveTab] = useState<'active' | 'received' | 'preparing' | 'ready' | 'served'>('active');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundService.isSoundEnabled());
  const [lastOrderPing, setLastOrderPing] = useState<string | null>(null);

  // Subscribe to real-time storage events
  useEffect(() => {
    const unsubscribe = storageService.subscribe((type, payload) => {
      if (type === 'ORDERS_UPDATED' || type === 'NEW_ORDER') {
        const freshOrders = storageService.getOrders();
        setOrders(freshOrders);

        if (type === 'NEW_ORDER' && payload) {
          const ord = payload as Order;
          setLastOrderPing(`New Order #${ord.id} received for ${ord.tableNumber}!`);
          setTimeout(() => setLastOrderPing(null), 5000);
          // Play the chime here (not where the order was created) so the
          // kitchen's own device always hears it — including when the order
          // was placed from a different tab/device via the customer menu.
          soundService.playNewOrderChime();
        }
      } else if (type === 'CAFE_UPDATED') {
        setCafe(storageService.getCafe());
      }
    });

    return unsubscribe;
  }, []);

  // Audio unlocking is handled at the app root (App.tsx) — it must run from
  // the very first paint since the nav click that switches INTO this view is
  // itself the first user gesture, and it fires before this component mounts.

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
    if (next) {
      soundService.playNewOrderChime();
    }
  };

  const handleUpdateStatus = (orderId: string, newStatus: OrderStatus) => {
    storageService.updateOrderStatus(orderId, newStatus);
  };

  const handleUpdateRoundStatus = (orderId: string, roundNumber: number, newStatus: OrderStatus) => {
    storageService.updateRoundStatus(orderId, roundNumber, newStatus);
  };

  // Counts
  const counts = useMemo(() => {
    const received = orders.filter((o) => o.status === 'received').length;
    const preparing = orders.filter((o) => o.status === 'preparing').length;
    const ready = orders.filter((o) => o.status === 'ready').length;
    const active = received + preparing + ready;
    const served = orders.filter((o) => o.status === 'served').length;

    return { received, preparing, ready, active, served };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return orders.filter(
          (o) => o.status === 'received' || o.status === 'preparing' || o.status === 'ready'
        );
      case 'received':
        return orders.filter((o) => o.status === 'received');
      case 'preparing':
        return orders.filter((o) => o.status === 'preparing');
      case 'ready':
        return orders.filter((o) => o.status === 'ready');
      case 'served':
        return orders.filter((o) => o.status === 'served');
      default:
        return orders;
    }
  }, [orders, activeTab]);

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 pb-16">
      {/* Top KDS Header */}
      <header className="bg-stone-950 border-b border-stone-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-xs">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-xl tracking-tight text-white">
                  KITCHEN DISPLAY SYSTEM
                </h1>
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {cafe.name} • Real-Time Order Stream
              </p>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                soundEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
              }`}
              title={soundEnabled ? 'Kitchen chime enabled' : 'Kitchen chime muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
              <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
            </button>

            {/* Test Sound Button */}
            <button
              onClick={() => soundService.playNewOrderChime()}
              className="p-1.5 rounded-xl text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors"
              title="Test Kitchen Bell"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="bg-stone-900 border-t border-stone-800/80 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'active'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>All Active</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  activeTab === 'active' ? 'bg-stone-950 text-amber-400' : 'bg-stone-700 text-stone-200'
                }`}
              >
                {counts.active}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('received')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'received'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <span>New Orders</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  activeTab === 'received' ? 'bg-stone-950 text-amber-400' : 'bg-amber-900/60 text-amber-300'
                }`}
              >
                {counts.received}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('preparing')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'preparing'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <span>Preparing</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  activeTab === 'preparing' ? 'bg-stone-950 text-blue-300' : 'bg-blue-900/60 text-blue-300'
                }`}
              >
                {counts.preparing}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ready')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'ready'
                  ? 'bg-emerald-500 text-stone-950 shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <span>Ready to Serve</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  activeTab === 'ready' ? 'bg-stone-950 text-emerald-400' : 'bg-emerald-900/60 text-emerald-300'
                }`}
              >
                {counts.ready}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('served')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'served'
                  ? 'bg-stone-700 text-white shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Served ({counts.served})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Live Ping Notification Banner */}
      {lastOrderPing && (
        <div className="bg-amber-500 text-stone-950 px-4 py-2 text-center text-xs font-black tracking-wide shadow-lg flex items-center justify-center gap-2 animate-bounce">
          {/* <Sparkles className="w-4 h-4" /> */}
          <span>{lastOrderPing}</span>
        </div>
      )}

      {/* Orders Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {filteredOrders.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-800 text-stone-600 flex items-center justify-center mx-auto mb-3">
              <ChefHat className="w-8 h-8" />
            </div>
            <h3 className="font-black text-stone-300 text-lg mb-1">
              No orders in this queue
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              New customer orders from table QR codes will appear here in real-time with sound alerts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onUpdateRoundStatus={handleUpdateRoundStatus}
                currency={cafe.currency}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
