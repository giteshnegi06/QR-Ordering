import React, { useState, useEffect } from 'react';
import { Order, OrderRound, OrderStatus } from '../../types';
import { VegBadge } from '../common/VegBadge';
import { Clock, ChefHat, Bell, CheckCheck, XCircle, AlertCircle, Timer, Flame, Plus, Sparkles } from 'lucide-react';
import { storageService } from '../../services/storage';

interface KitchenOrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onUpdateRoundStatus: (orderId: string, roundNumber: number, newStatus: OrderStatus) => void;
  currency: string;
}

interface RoundBlockProps {
  round: OrderRound;
  isOnlyRound: boolean;
  isLatest: boolean;
  now: number;
  onAddFiveMinutes: () => void;
  onMarkReady: () => void;
  onMarkServed: () => void;
}

const formatCountdownStatic = (totalSecs: number) => {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Renders one round's items with its own independent prep timer, so a fresh
// addition to a table never inherits or mixes with an earlier round's countdown.
const RoundBlock: React.FC<RoundBlockProps> = ({
  round,
  isOnlyRound,
  isLatest,
  now,
  onAddFiveMinutes,
  onMarkReady,
  onMarkServed,
}) => {
  const isPending = round.status === 'received';
  const isCooking = round.status === 'preparing';
  const isReadyToServe = round.status === 'ready';
  const isServed = round.status === 'served';
  const isReady = isReadyToServe || isServed;

  // Fall back to 15 rather than trusting the field blindly: a round stored
  // before per-round prep times existed has no value here, and NaN would
  // render the countdown as "NaN:NaN" and the progress bar at NaN%.
  const prepMinutes = round.estimatedPrepTimeMin || 15;
  const prepDurationMs = prepMinutes * 60 * 1000;
  const prepStart = round.preparingStartedAt || round.placedAt;
  const targetReadyTime = prepStart + prepDurationMs;
  const remainingSeconds = Math.max(0, Math.ceil((targetReadyTime - now) / 1000));
  const isOverdue = isCooking && now > targetReadyTime;

  const progressPercent = isReady
    ? 100
    : isCooking
    ? Math.min(100, Math.max(5, Math.round((Math.max(0, now - prepStart) / prepDurationMs) * 100)))
    : 0;

  return (
    <div className={`rounded-xl border ${isPending ? 'border-purple-300 bg-purple-50/50' : 'border-stone-100'} ${isOnlyRound ? '' : 'p-3'}`}>
      {!isOnlyRound && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1">
            {round.roundNumber === 1 ? 'Original Order' : `Round ${round.roundNumber} Added`}
            {isLatest && round.roundNumber > 1 && (
              <span className="text-[10px] font-extrabold text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded">NEW</span>
            )}
          </span>
          <span className="text-[10px] font-bold text-stone-400">
            {new Date(round.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      <div className="divide-y divide-stone-100">
        {round.items.map((item, idx) => (
          <div key={idx} className="p-2 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-md bg-stone-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                {item.quantity}x
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <VegBadge type={item.vegType} size="sm" />
                  <h4 className="text-sm font-bold text-stone-900 leading-snug">{item.name}</h4>
                </div>

                {item.selectedCustomizations.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.selectedCustomizations.map((c, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-semibold text-stone-700 bg-amber-50/80 border border-amber-200 px-1.5 py-0.5 rounded"
                      >
                        {c.optionName}
                      </span>
                    ))}
                  </div>
                )}

                {item.specialInstructions && (
                  <p className="text-xs text-amber-800 italic mt-0.5">Note: {item.specialInstructions}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isPending && !isOnlyRound && (
        <div className="mt-2 text-[11px] font-bold text-purple-800 flex items-center gap-1">
          Awaiting kitchen accept (~{prepMinutes}m)
        </div>
      )}

      {/* Once overdue, drop the animated countdown/progress bar entirely —
          it's no longer telling the kitchen anything useful, and constantly
          re-rendering it every second (spinning timer, pulsing flame, moving
          bar) is what caused cards to visibly jitter/shuffle. A delayed round
          just needs two flat actions: push the estimate out, or mark it done. */}
      {isCooking && isOverdue && (
        <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-rose-800">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Delayed by {Math.abs(Math.floor((now - targetReadyTime) / 60000))}m</span>
            </div>
            <button
              type="button"
              onClick={onAddFiveMinutes}
              className="px-2 py-0.5 bg-white hover:bg-rose-100 border border-rose-300 rounded text-[10px] font-bold text-rose-900 flex items-center gap-0.5 shadow-2xs transition-colors cursor-pointer"
              title="Add 5 minutes to this round's estimated time"
            >
              <Plus className="w-3 h-3" /> 5m
            </button>
          </div>

          {!isOnlyRound && (
            <button
              type="button"
              onClick={onMarkReady}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Mark This Round Ready</span>
            </button>
          )}
        </div>
      )}

      {isCooking && !isOverdue && (
        <div className="mt-2.5 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Flame className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Cooking: {progressPercent}%</span>
            </div>
            <div className="flex items-center gap-1 font-mono font-black text-xs text-blue-950">
              <Timer className="w-3.5 h-3.5 text-blue-600" />
              <span>{formatCountdownStatic(remainingSeconds)} left</span>
            </div>
          </div>

          <div className="h-2 w-full bg-blue-200/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-amber-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-blue-800">
            <span>
              Target: {new Date(targetReadyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (
              {prepMinutes}m total)
            </span>
            <button
              type="button"
              onClick={onAddFiveMinutes}
              className="px-2 py-0.5 bg-white hover:bg-blue-100 border border-blue-300 rounded text-[10px] font-bold text-blue-900 flex items-center gap-0.5 shadow-2xs transition-colors cursor-pointer"
              title="Add 5 minutes to this round's estimated time"
            >
              <Plus className="w-3 h-3" /> 5m
            </button>
          </div>

          {!isOnlyRound && (
            <button
              type="button"
              onClick={onMarkReady}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Mark This Round Ready</span>
            </button>
          )}
        </div>
      )}

      {isReadyToServe && !isOnlyRound && (
        <button
          type="button"
          onClick={onMarkServed}
          className="mt-2 w-full py-2 px-3 bg-stone-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mark This Round Delivered & Served</span>
        </button>
      )}

      {isServed && !isOnlyRound && (
        <div className="mt-2 text-[11px] font-bold text-stone-500 flex items-center gap-1">
          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> Served
        </div>
      )}
    </div>
  );
};

export const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({
  order,
  onUpdateStatus,
  onUpdateRoundStatus,
  currency,
}) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMinutes = Math.max(0, Math.floor((now - order.createdAt) / 60000));
  const isNew = order.status === 'received';
  const isPreparing = order.status === 'preparing';

  // Whole-order prep time fallback, used only when the order has no per-round data yet
  const prepTimeMinutes = order.estimatedPrepTimeMin || 15;
  const prepStartTime = order.preparingStartedAt || order.createdAt;
  const targetReadyTime = prepStartTime + prepTimeMinutes * 60 * 1000;
  const isOverdue = isPreparing && now > targetReadyTime;
  const isUrgent = (isOverdue || elapsedMinutes >= 15) && order.status !== 'served' && order.status !== 'cancelled';

  const handleAddFiveMinutes = (roundNumber?: number) => {
    storageService.updateOrderPrepTime(order.id, 5, true, roundNumber);
  };

  // Rounds: the original order plus anything added before the bill was settled,
  // each carrying its own independent prep timer. Fall back to a
  // single synthetic round for orders created before this tracking existed.
  const rounds: OrderRound[] =
    order.rounds && order.rounds.length > 0
      ? order.rounds
      : [
          {
            roundNumber: 1,
            items: order.items,
            placedAt: order.createdAt,
            estimatedPrepTimeMin: prepTimeMinutes,
            preparingStartedAt: order.preparingStartedAt,
            readyAt: order.readyAt,
            status: order.status,
          },
        ];
  const hasMultipleRounds = rounds.length > 1;
  const pendingRounds = rounds.filter((r) => r.status === 'received');
  const cookingRounds = rounds.filter((r) => r.status === 'preparing');
  const allRoundsReady = rounds.length > 0 && rounds.every((r) => r.status === 'ready' || r.status === 'served');
  const hasNewAddition = hasMultipleRounds && pendingRounds.length > 0 && (cookingRounds.length > 0 || rounds.some((r) => r.status === 'ready'));

  // Status visual configurations
  const statusStyles: Record<
    OrderStatus,
    { badgeBg: string; text: string; label: string; border: string }
  > = {
    received: {
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      text: 'text-amber-800',
      label: 'NEW ORDER',
      border: 'border-amber-400 ring-2 ring-amber-300/50 shadow-md',
    },
    preparing: {
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      text: 'text-blue-800',
      label: 'PREPARING',
      border: 'border-blue-300 shadow-xs',
    },
    ready: {
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      text: 'text-emerald-800',
      label: 'READY',
      border: 'border-emerald-400 ring-2 ring-emerald-300/40 shadow-sm',
    },
    served: {
      badgeBg: 'bg-stone-100 text-stone-700 border-stone-200',
      text: 'text-stone-500',
      label: 'SERVED',
      border: 'border-stone-200 opacity-75',
    },
    cancelled: {
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
      text: 'text-rose-600',
      label: 'CANCELLED',
      border: 'border-rose-200 opacity-60',
    },
  };

  const style = statusStyles[order.status];

  return (
    <div
      id={`kitchen-card-${order.id}`}
      className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
        style.border
      } ${isNew ? 'animate-in fade-in-50 zoom-in-95 duration-200' : ''}`}
    >
      {/* Card Header: Table Number & Status */}
      {/* Nothing in this header is allowed to break mid-label. When a narrow
          column can't fit the status badge beside the table name, the badge
          drops to its own line instead of splitting the label in two. */}
      <div className="p-4 bg-stone-50 border-b border-stone-100 flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl lg:text-base font-black text-stone-950 tracking-tight whitespace-nowrap">
              {order.tableNumber.toUpperCase()}
            </span>
            <span className="text-xs lg:text-[10px] font-bold text-stone-500 bg-stone-200/80 px-2 py-0.5 rounded-md whitespace-nowrap">
              #{order.id}
            </span>
          </div>
          {/* Placed-at time and age stay on a single line — a wrapped
              "(19m ago)" makes the card taller than its neighbours and
              shuffles the whole board. */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className={isUrgent ? 'text-rose-600 font-bold' : ''}>
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' '}({elapsedMinutes}m ago)
            </span>
          </div>
          {order.customerName && (
            <div className="text-[11px] text-stone-500 font-medium truncate mt-0.5">
              Guest: {order.customerName}
            </div>
          )}
        </div>

        {/* Status column: the badge, then the delay flag stacked underneath it,
            both hugging the right edge. Only badge-width content lives here —
            anything wider (the guest name) belongs in the left column, or this
            column gets wide enough to wrap onto its own row. */}
        <div className="shrink-0 ml-auto flex flex-col items-end gap-1 text-right">
          <span
            className={`inline-block px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border whitespace-nowrap ${style.badgeBg}`}
          >
            {style.label}
          </span>
          {isUrgent && (
            <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 whitespace-nowrap">
              <AlertCircle className="w-3 h-3" /> Delay
            </span>
          )}
        </div>
      </div>

      {/* New Round Alert Banner */}
      {hasNewAddition && (
        <div className="mx-4 mt-3 p-2.5 bg-purple-50 border border-purple-300 rounded-xl flex items-center gap-2 animate-pulse">
          {/* <Sparkles className="w-4 h-4 text-purple-700 shrink-0" /> */}
          <span className="text-xs font-black text-purple-900">
            New items just added to #{order.id} — needs separate accept below
          </span>
        </div>
      )}

      {/* Items Section */}
      <div className="p-4 flex-1 space-y-4">
        {rounds.map((round, rIdx) => (
          <RoundBlock
            key={round.roundNumber}
            round={round}
            isOnlyRound={!hasMultipleRounds}
            isLatest={rIdx === rounds.length - 1}
            now={now}
            onAddFiveMinutes={() => handleAddFiveMinutes(round.roundNumber)}
            onMarkReady={() => onUpdateRoundStatus(order.id, round.roundNumber, 'ready')}
            onMarkServed={() => onUpdateRoundStatus(order.id, round.roundNumber, 'served')}
          />
        ))}

        {/* Global Special Instructions */}
        {order.specialInstructions && (
          <div className="pt-3">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                ⚠️ Special Kitchen Instruction:
              </div>
              <p className="text-xs font-bold text-amber-900 mt-0.5">
                "{order.specialInstructions}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Total & Action Buttons */}
      <div className="p-3.5 bg-stone-50 border-t border-stone-100 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Total ({order.items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
          <span className="font-extrabold text-stone-900">
            {currency}{order.total.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          {pendingRounds.length > 0 && (
            <button
              onClick={() => onUpdateStatus(order.id, 'preparing')}
              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ChefHat className="w-4 h-4" />
              <span>
                {hasNewAddition
                  ? `Accept New Round (~${pendingRounds[0].estimatedPrepTimeMin || 15}m)`
                  : `Accept & Start Preparing (~${pendingRounds[0].estimatedPrepTimeMin || 15}m)`}
              </span>
            </button>
          )}

          {/* With multiple rounds, each round above carries its own Ready/Served
              button so marking one round doesn't force-complete another that's
              still cooking — these whole-order buttons only make sense when
              there's just a single round to track. */}
          {!hasMultipleRounds && pendingRounds.length === 0 && cookingRounds.length > 0 && (
            <button
              onClick={() => onUpdateStatus(order.id, 'ready')}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>Mark Ready for Server</span>
            </button>
          )}

          {!hasMultipleRounds && pendingRounds.length === 0 && cookingRounds.length === 0 && allRoundsReady && (
            <button
              onClick={() => onUpdateStatus(order.id, 'served')}
              className="w-full py-2.5 px-3 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Mark Delivered & Served</span>
            </button>
          )}

          {order.status !== 'served' && order.status !== 'cancelled' && (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to cancel order #${order.id} for ${order.tableNumber}?`)) {
                  onUpdateStatus(order.id, 'cancelled');
                }
              }}
              className="w-full py-1 text-[11px] font-semibold text-stone-400 hover:text-rose-600 transition-colors flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Order</span>
            </button>
          )}

          {order.status === 'served' && (
            <div className="text-center py-1 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
              <CheckCheck className="w-4 h-4" /> Served to {order.tableNumber}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
