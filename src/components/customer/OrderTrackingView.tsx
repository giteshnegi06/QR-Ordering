import React, { useState, useEffect } from 'react';
import { Order, OrderRound, CafeInfo, TableItem } from '../../types';
import { VegBadge } from '../common/VegBadge';
import { tableRequestService } from '../../services/tableRequests';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  BellRing,
  Utensils,
  ArrowLeft,
  MapPin,
  Check,
  Droplets,
  Loader2,
  Timer,
  Flame,
  Plus,
  Receipt,
  Layers,
  Sparkles,
} from 'lucide-react';

interface OrderTrackingViewProps {
  orders?: Order[];
  order?: Order;
  allSessionOrders?: Order[];
  selectedOrderId?: string;
  onSelectOrder?: (orderId: string) => void;
  cafe: CafeInfo;
  table: TableItem;
  onBackToMenu: () => void;
  currency: string;
}

interface SingleOrderCardProps {
  order: Order;
  cafe: CafeInfo;
  currency: string;
  now: number;
  isSingleCard?: boolean;
}

const formatCountdownStatic = (totalSecs: number) => {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const ROUND_STEPS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'received', label: 'Received', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: BellRing },
  { key: 'served', label: 'Served', icon: Utensils },
];

const getRoundStepIndex = (status: string): number => {
  switch (status) {
    case 'received':
      return 0;
    case 'preparing':
      return 1;
    case 'ready':
      return 2;
    case 'served':
      return 3;
    default:
      return 0;
  }
};

// Compact 4-step tracker for one round, mirroring the whole-order stepper
// above it but reflecting only this round's own status — so in a multi-round
// order, an already-served round and a still-cooking round each show where
// THEY stand instead of both being represented by one shared progress bar.
// The connector line fills smoothly as the round actually cooks (like the
// main progress bar), instead of only snapping between the 4 fixed stops.
const RoundStepper: React.FC<{ status: string; cookingPercent: number }> = ({ status, cookingPercent }) => {
  const stepIdx = getRoundStepIndex(status);

  const lineWidthPercent = (() => {
    switch (status) {
      case 'received':
        return 0;
      case 'preparing':
        return 33.33 + (Math.max(0, Math.min(100, cookingPercent)) / 100) * 33.33;
      case 'ready':
        return 66.66;
      case 'served':
        return 100;
      default:
        return 0;
    }
  })();

  return (
    <div className="relative pt-1 pb-1">
      <div className="absolute top-[13px] left-[13px] right-[13px] h-1 bg-stone-200 rounded-full overflow-hidden -z-0">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-1000 ease-out"
          style={{ width: `${lineWidthPercent}%` }}
        />
      </div>
      <div className="relative z-10 flex justify-between">
        {ROUND_STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = stepIdx > idx;
          const isCurrent = stepIdx === idx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 w-14">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-amber-600 text-white'
                    : isCurrent
                    ? stepIdx >= 2
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-200'
                      : 'bg-amber-500 text-white ring-2 ring-amber-200'
                    : 'bg-white text-stone-300 border border-stone-200'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-3" /> : <StepIcon className="w-3 h-3" />}
              </div>
              <span
                className={`text-[9px] font-bold text-center leading-tight ${
                  isCurrent ? 'text-amber-900' : isCompleted ? 'text-stone-600' : 'text-stone-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface RoundTrackingBlockProps {
  round: OrderRound;
  currency: string;
  now: number;
  isOnlyRound: boolean;
  isLatest: boolean;
}

// Shows one round's own countdown & item breakdown, independent of any other
// round's timer, so a fresh addition never inherits an older round's elapsed time.
const RoundTrackingBlock: React.FC<RoundTrackingBlockProps> = ({ round, currency, now, isOnlyRound, isLatest }) => {
  const isPending = round.status === 'received';
  const isCooking = round.status === 'preparing';
  const isDone = round.status === 'ready' || round.status === 'served';

  const prepTimeMinutes = round.estimatedPrepTimeMin || 15;
  const prepDurationMs = prepTimeMinutes * 60 * 1000;
  const prepStartTime = round.preparingStartedAt || round.placedAt;
  const targetReadyTime = prepStartTime + prepDurationMs;
  const isOverdue = isCooking && now > targetReadyTime;

  let progressPercent = 0;
  let remainingSeconds = 0;

  if (isDone) {
    progressPercent = 100;
  } else if (isCooking) {
    const elapsedMs = Math.max(0, now - prepStartTime);
    progressPercent = Math.min(96, Math.max(6, Math.round((elapsedMs / prepDurationMs) * 100)));
    remainingSeconds = Math.max(0, Math.ceil((targetReadyTime - now) / 1000));
  } else if (isPending) {
    progressPercent = 5;
    remainingSeconds = prepTimeMinutes * 60;
  }

  const itemsWithPrep = round.items.map((item) => ({
    ...item,
    prepTime:
      item.preparationTimeMin ||
      (item.name.toLowerCase().includes('coffee') || item.name.toLowerCase().includes('mojito') ? 6 : 15),
  }));

  return (
    <div className="p-4 sm:p-5 bg-stone-50 border border-stone-200/90 rounded-2xl space-y-3">
      {!isOnlyRound && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-stone-700 flex items-center gap-1.5">
            {round.roundNumber === 1 ? 'Original Order' : `Round ${round.roundNumber} • Added Items`}
            {isLatest && round.roundNumber > 1 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-purple-800 bg-purple-100 border border-purple-300 px-1.5 py-0.2 rounded-full">
                <Sparkles className="w-3 h-3" /> NEW
              </span>
            )}
          </span>
          <span className="text-[11px] font-bold text-stone-400">
            Placed {new Date(round.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {!isOnlyRound && <RoundStepper status={round.status} cookingPercent={progressPercent} />}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isDone ? 'bg-emerald-100 text-emerald-800' : isCooking ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300/60' : 'bg-stone-200 text-stone-700'
            }`}
          >
            {isDone ? <BellRing className="w-6 h-6 animate-pulse" /> : isCooking ? <Flame className="w-6 h-6 animate-pulse text-amber-600" /> : <ChefHat className="w-6 h-6" />}
          </div>

          <div>
            <div className="text-sm font-black text-stone-900 flex items-center gap-1.5">
              <span>
                {isPending && 'Kitchen Received This Round'}
                {isCooking && !isOverdue && 'Chef is Preparing This Round'}
                {isOverdue && 'Running a Little Behind'}
                {isDone && (round.status === 'served' ? 'Delivered ✓' : 'Ready to Serve!')}
              </span>
              {isCooking && !isOverdue && <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </div>

            <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-2">
              {isCooking && !isOverdue && (
                <>
                  <span>Target: ~{new Date(targetReadyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>•</span>
                  <span>{prepTimeMinutes} min total prep</span>
                </>
              )}
              {isOverdue && <span>Still cooking — the kitchen has your order</span>}
              {isPending && <span>Estimated prep: ~{prepTimeMinutes} minutes</span>}
              {isDone && <span>Prepared fresh in ~{prepTimeMinutes} minutes</span>}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 bg-white border border-stone-200 px-3.5 py-2 rounded-xl shadow-2xs">
          {isOverdue ? (
            <>
              <div className="font-mono text-sm font-black text-rose-700 tracking-tight leading-none">
                Almost there
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-stone-400 mt-1">Thanks for waiting</div>
            </>
          ) : isCooking ? (
            <>
              <div className="font-mono text-xl font-black text-amber-900 tracking-tight leading-none flex items-center justify-end gap-1">
                <Timer className="w-4 h-4 text-amber-600" />
                <span>{formatCountdownStatic(remainingSeconds)}</span>
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-stone-400 mt-1">Time Remaining</div>
            </>
          ) : isDone ? (
            <>
              <div className="text-xs font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-3" /> Ready
              </div>
              <div className="text-[9px] font-bold text-stone-400 mt-1">Plated & Fresh</div>
            </>
          ) : (
            <>
              <div className="font-mono text-base font-black text-stone-800">~{prepTimeMinutes}m</div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-stone-400">Est. Duration</div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="h-3.5 w-full bg-stone-200/70 rounded-full p-0.5 border border-stone-300/60 overflow-hidden relative shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
              isDone ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          >
            {isCooking && !isOverdue && <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 pt-1">
        {itemsWithPrep.map((item) => (
          <div
            key={item.itemId}
            className="p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs bg-white border-stone-200/70"
          >
            <div className="flex items-center gap-2 min-w-0">
              <VegBadge type={item.vegType} size="sm" />
              <span className="font-bold text-stone-900 truncate">
                {item.quantity}x {item.name}
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                isDone ? 'bg-emerald-100 text-emerald-800' : isCooking ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {isDone ? 'Ready' : isCooking ? 'Cooking' : 'Queued'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SingleOrderCard: React.FC<SingleOrderCardProps> = ({
  order,
  cafe,
  currency,
  now,
  isSingleCard = false,
}) => {
  const steps: { key: Order['status']; label: string; sub: string; icon: React.ElementType }[] = [
    { key: 'received', label: 'Order Received', sub: 'Sent to Kitchen', icon: CheckCircle2 },
    { key: 'preparing', label: 'Preparing', sub: 'Chef is cooking', icon: ChefHat },
    { key: 'ready', label: 'Ready', sub: 'Plated & Ready to serve', icon: BellRing },
    { key: 'served', label: 'Served', sub: 'Delivered to your table', icon: Utensils },
  ];

  const getStepIndex = (status: Order['status']) => {
    switch (status) {
      case 'received':
        return 0;
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'served':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isReceived = order.status === 'received';
  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';
  const isServed = order.status === 'served';

  // Preparation time (whole-order fallback, used only when there's no per-round data)
  const prepTimeMinutes = order.estimatedPrepTimeMin || 15;
  const prepStartTime = order.preparingStartedAt || order.createdAt;

  let prepProgressPercent = 0;
  if (isReady || isServed) {
    prepProgressPercent = 100;
  } else if (isPreparing) {
    const elapsedMs = Math.max(0, now - prepStartTime);
    // Advance progress bar from 6% to 96% while cooking, holding at 96% until kitchen marks ready
    prepProgressPercent = Math.min(96, Math.max(6, Math.round((elapsedMs / (prepTimeMinutes * 60 * 1000)) * 100)));
  } else if (isReceived) {
    prepProgressPercent = 5;
  }

  // Dynamic timeline line progress
  const timelineProgressWidth = (() => {
    if (isCancelled) return 0;
    if (isReceived) return 0;
    if (isPreparing) {
      return 33.33 + (prepProgressPercent / 100) * 33.33;
    }
    if (isReady) return 66.66;
    if (isServed) return 100;
    return 0;
  })();

  // Rounds: the original order plus anything added before the bill was settled,
  // each with its own independent prep timer so a new addition never mixes with
  // an earlier round's elapsed/remaining time. Falls back to a single synthetic
  // round for orders created before per-round tracking existed.
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

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-6">
      {/* Order Title and Details Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-amber-100/80 text-amber-900 border border-amber-300/60">
              #{order.id}
            </span>

            <span
              className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                isServed
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : isReady
                  ? 'bg-teal-50 text-teal-800 border-teal-300 animate-pulse'
                  : isPreparing
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-stone-100 text-stone-700 border-stone-300'
              }`}
            >
              {isServed && 'Served to Table ✓'}
              {isReady && 'Ready for Table 🛎️'}
              {isPreparing && 'Chef is Cooking 🍳'}
              {isReceived && 'Order Received'}
              {isCancelled && 'Cancelled'}
            </span>

            <span className="text-xs text-stone-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Placed at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {order.orderRounds && order.orderRounds > 1 && (
              <span className="text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                Consolidated Bill • Round {order.orderRounds}
              </span>
            )}

            {order.isMerged && (
              <span className="text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full">
                Combined Bill
              </span>
            )}
          </div>

          <div className="text-xs font-semibold text-stone-600 mt-1">
            {order.tableNumber} • {order.items.reduce((s, i) => s + i.quantity, 0)} items • {currency}{(order.subtotal + (order.serviceCharge || 0)).toFixed(2)}
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Kitchen Live Sync
          </div>
          <div className="text-xs font-bold text-amber-700 flex items-center sm:justify-end gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Active Display</span>
          </div>
        </div>
      </div>

      {/* 4-Step Timeline Stepper */}
      {isCancelled ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
          <div className="text-sm font-bold text-rose-800 mb-1">Order Cancelled</div>
          <p className="text-xs text-rose-600">
            This order was cancelled. Please speak to staff if you have any questions.
          </p>
        </div>
      ) : (
        <div className="relative pt-1 pb-2">
          {/* Progress Bar Line */}
          <div className="absolute top-6 left-6 right-6 h-1.5 bg-stone-100 rounded-full overflow-hidden -z-0">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 transition-all duration-700 ease-out"
              style={{
                width: `${timelineProgressWidth}%`,
              }}
            />
          </div>

          {/* Steps Icons */}
          <div className="relative z-10 flex justify-between items-start">
            {steps.map((step, idx) => {
              const isCompleted = currentStepIdx > idx;
              const isCurrent = currentStepIdx === idx;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex flex-col items-center text-center w-20">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-amber-600 text-white ring-4 ring-amber-100 shadow-xs'
                        : isCurrent
                        ? isReady || isServed
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 shadow-sm animate-pulse'
                          : 'bg-amber-500 text-white ring-4 ring-amber-200 shadow-sm animate-bounce'
                        : 'bg-white text-stone-300 border-2 border-stone-200'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5 stroke-3" /> : <StepIcon className="w-4 h-4" />}
                  </div>

                  <div className="mt-2">
                    <div
                      className={`text-[11px] font-bold leading-tight ${
                        isCurrent
                          ? 'text-amber-900'
                          : isCompleted
                          ? 'text-stone-900'
                          : 'text-stone-400'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[9px] text-stone-400 mt-0.5 hidden sm:block">
                      {step.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIVE TIME COUNTDOWN — one independent block per round, so an item added */}
      {/* mid-cook never mixes its timer with an earlier round's elapsed/remaining time */}
      {!isCancelled && (
        <div className="space-y-3">
          {hasMultipleRounds && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>{rounds.length} Rounds for this Order — Tracked Separately</span>
            </div>
          )}
          {rounds.map((round, rIdx) => (
            <RoundTrackingBlock
              key={round.roundNumber}
              round={round}
              currency={currency}
              now={now}
              isOnlyRound={!hasMultipleRounds}
              isLatest={rIdx === rounds.length - 1}
            />
          ))}
        </div>
      )}

      {/* Ordered Items Summary */}
      <div className="border border-stone-200 rounded-2xl p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-stone-400" />
            <span>Items in #{order.id} ({order.items.length})</span>
          </h4>
          <span className="text-xs font-extrabold text-stone-900">
            Total: {currency}{(order.subtotal + (order.serviceCharge || 0)).toFixed(2)}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {order.items.map((item) => (
            <div key={item.itemId} className="py-2 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                <VegBadge type={item.vegType} size="sm" />
                <div>
                  <span className="font-bold text-stone-900">
                    {item.quantity}x {item.name}
                  </span>
                  {item.selectedCustomizations.length > 0 && (
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      {item.selectedCustomizations.map((c) => c.optionName).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <span className="font-semibold text-stone-700 shrink-0">
                {currency}{item.itemTotal}
              </span>
            </div>
          ))}
        </div>

        {order.specialInstructions && (
          <div className="p-2.5 bg-amber-50/70 border border-amber-200/50 rounded-xl text-xs text-amber-900">
            <strong className="font-bold">Kitchen Note:</strong> {order.specialInstructions}
          </div>
        )}

        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <span>Payment ({order.paymentMethod.replace('counter_', '').toUpperCase()})</span>
          <span
            className={`font-bold px-2 py-0.5 rounded-md ${
              order.paymentStatus === 'paid'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {order.paymentStatus === 'paid' ? 'Paid ✓' : 'Pay at Counter'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  orders,
  order,
  allSessionOrders,
  selectedOrderId,
  onSelectOrder,
  cafe,
  table,
  onBackToMenu,
  currency,
}) => {
  const [assistanceMsg, setAssistanceMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<'water' | 'server' | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Aggregate orders list
  const allOrdersList: Order[] = React.useMemo(() => {
    if (orders && orders.length > 0) return orders;
    if (order) return [order];
    return [];
  }, [orders, order]);

  // Separate active unserved vs served
  const unservedOrders = React.useMemo(() => {
    return allOrdersList.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
  }, [allOrdersList]);

  const servedOrders = React.useMemo(() => {
    const fromAll = allSessionOrders || allOrdersList;
    return fromAll.filter((o) => o.status === 'served');
  }, [allSessionOrders, allOrdersList]);

  // Active Tab state: 'all' | orderId
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (selectedOrderId && allOrdersList.some((o) => o.id === selectedOrderId)) {
      return selectedOrderId;
    }
    if (unservedOrders.length > 1) {
      return 'all';
    }
    return unservedOrders[0]?.id || allOrdersList[0]?.id || 'all';
  });

  // Keep active tab in sync if selectedOrderId updates
  useEffect(() => {
    if (selectedOrderId) {
      setActiveTab(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Live second-by-second ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sends the request to the server, where it shows up on the Kitchen KDS,
  // Admin dashboard and Orders board until staff mark it done. If this table
  // already has the same request open, the server hands that one back
  // instead of paging the staff a second time.
  const handleCallStaff = async (type: 'water' | 'server') => {
    if (pendingRequest) return;
    setPendingRequest(type);
    const label = type === 'water' ? 'water' : 'a server';
    try {
      const { duplicate } = await tableRequestService.create(table.id, table.number, type);
      setAssistanceMsg({
        tone: 'ok',
        text: duplicate
          ? `Staff have already been asked for ${label} — they're on their way to ${table.number}.`
          : `Staff alerted — ${label} is on the way to ${table.number}.`,
      });
    } catch {
      setAssistanceMsg({
        tone: 'error',
        text: 'Could not reach the staff right now. Please try again or ask at the counter.',
      });
    } finally {
      setPendingRequest(null);
      setTimeout(() => setAssistanceMsg(null), 5000);
    }
  };

  const tableNumber = allOrdersList[0]?.tableNumber || 'Your Table';

  // Total amount across all unserved active orders
  const totalActiveAmount = unservedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalActiveItems = unservedOrders.reduce(
    (sum, o) => sum + o.items.reduce((sub, i) => sub + i.quantity, 0),
    0
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Top Sticky Header */}
      <div className="bg-white border-b border-stone-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-amber-700 transition-colors p-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu & Add Items</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-stone-900 text-stone-100 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
              <MapPin className="w-3 h-3 text-amber-400" />
              <span>{tableNumber}</span>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Live Kitchen
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Assistance Message Alert */}
        {assistanceMsg && (
          <div
            className={`p-4 border text-xs font-bold rounded-2xl text-center shadow-xs flex items-center justify-center gap-2 animate-in fade-in ${
              assistanceMsg.tone === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <Check className={`w-4 h-4 ${assistanceMsg.tone === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span>{assistanceMsg.text}</span>
          </div>
        )}

        {/* Hero Header & Active Orders Banner */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-xs font-black">
                <ChefHat className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-stone-900 tracking-tight">
                    Order Tracking • {tableNumber}
                  </h2>
                  {unservedOrders.length > 0 && (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/80">
                      {unservedOrders.length} Active {unservedOrders.length === 1 ? 'Order' : 'Orders'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-500 mt-1">
                  All orders placed for this table remain visible in real-time until served by our staff.
                </p>
              </div>
            </div>

            <button
              onClick={onBackToMenu}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>Add Another Order</span>
            </button>
          </div>

          {/* Combined Summary Bar when 2 or more orders */}
          {unservedOrders.length > 1 && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>
                  Table Summary: {unservedOrders.length} Ongoing Orders ({totalActiveItems} total items)
                </span>
              </div>
              <div className="font-extrabold text-amber-900">
                Combined Total: {currency}{totalActiveAmount.toFixed(2)}
              </div>
            </div>
          )}

          {/* Multi-Order Tabs Switcher */}
          {allOrdersList.length > 1 && (
            <div className="pt-2 border-t border-stone-100">
              <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Switch Order View</span>
                <span>{allOrdersList.length} Orders for this session</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => {
                    setActiveTab('all');
                    if (onSelectOrder) onSelectOrder('all');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200/80 border border-stone-200/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Active Orders ({unservedOrders.length})</span>
                </button>

                {allOrdersList.map((o) => {
                  const isSelected = activeTab === o.id;
                  const isReady = o.status === 'ready';
                  const isServed = o.status === 'served';
                  const isPrep = o.status === 'preparing';

                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        setActiveTab(o.id);
                        if (onSelectOrder) onSelectOrder(o.id);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200/80 border border-stone-200/60'
                      }`}
                    >
                      <span>#{o.id}</span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : isServed
                            ? 'bg-emerald-100 text-emerald-800'
                            : isReady
                            ? 'bg-teal-100 text-teal-800'
                            : isPrep
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {isServed ? 'Served' : isReady ? 'Ready' : isPrep ? 'Cooking' : 'Received'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ORDER CARDS SECTION */}
        {unservedOrders.length === 0 && servedOrders.length > 0 ? (
          /* All Orders Served Celebration Card */
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-3" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-stone-900">
                All Orders Have Been Served!
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Everything ordered for {tableNumber} has been delivered fresh to your table. Bon Appétit!
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onBackToMenu}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Order Dessert, Beverages, or More Food</span>
              </button>
            </div>

            {/* List of served orders */}
            <div className="pt-6 border-t border-stone-100 text-left space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Delivered Orders ({servedOrders.length})
              </h4>
              <div className="space-y-2">
                {servedOrders.map((sOrder) => (
                  <div
                    key={sOrder.id}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-black text-stone-900">#{sOrder.id}</span>
                      <span className="text-stone-500 ml-2">
                        {sOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </span>
                    </div>
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Served ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'all' ? (
          /* Render ALL Active Unserved Orders Stacked */
          <div className="space-y-6">
            {unservedOrders.map((ord) => (
              <SingleOrderCard
                key={ord.id}
                order={ord}
                cafe={cafe}
                currency={currency}
                now={now}
              />
            ))}

            {/* Recently Served Section if any */}
            {servedOrders.length > 0 && (
              <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Already Served to {tableNumber} ({servedOrders.length})</span>
                  </h4>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Delivered
                  </span>
                </div>

                <div className="space-y-2">
                  {servedOrders.map((sOrder) => (
                    <div
                      key={sOrder.id}
                      className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900">Order #{sOrder.id}</span>
                        <span className="text-stone-500 ml-2">
                          ({sOrder.items.reduce((sum, i) => sum + i.quantity, 0)} items • {currency}{sOrder.total.toFixed(2)})
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800">
                        Served at {new Date(sOrder.readyAt || sOrder.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Render Specific Selected Order */
          <div className="space-y-6">
            {allOrdersList
              .filter((o) => o.id === activeTab)
              .map((ord) => (
                <SingleOrderCard
                  key={ord.id}
                  order={ord}
                  cafe={cafe}
                  currency={currency}
                  now={now}
                  isSingleCard
                />
              ))}

            {/* Other orders quick peek cards */}
            {allOrdersList.filter((o) => o.id !== activeTab).length > 0 && (
              <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Other Orders For {tableNumber} ({allOrdersList.filter((o) => o.id !== activeTab).length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allOrdersList
                    .filter((o) => o.id !== activeTab)
                    .map((otherOrder) => {
                      const isReady = otherOrder.status === 'ready';
                      const isServed = otherOrder.status === 'served';
                      const isPrep = otherOrder.status === 'preparing';

                      return (
                        <button
                          key={otherOrder.id}
                          onClick={() => {
                            setActiveTab(otherOrder.id);
                            if (onSelectOrder) onSelectOrder(otherOrder.id);
                          }}
                          className="p-3 bg-stone-50 hover:bg-amber-50/50 border border-stone-200 hover:border-amber-300 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                              <span>Order #{otherOrder.id}</span>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                  isServed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isReady
                                    ? 'bg-teal-100 text-teal-800'
                                    : isPrep
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-stone-200 text-stone-700'
                                }`}
                              >
                                {isServed ? 'Served' : isReady ? 'Ready' : isPrep ? 'Cooking' : 'Received'}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500 mt-0.5">
                              {otherOrder.items.reduce((s, i) => s + i.quantity, 0)} items • {currency}{otherOrder.total.toFixed(2)}
                            </div>
                          </div>

                          <span className="text-xs font-bold text-amber-700 hover:underline shrink-0">
                            View →
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Table Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleCallStaff('water')}
            disabled={pendingRequest !== null}
            className="py-3 px-4 bg-white hover:bg-stone-50 disabled:opacity-60 disabled:cursor-wait border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {pendingRequest === 'water' ? (
              <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
            ) : (
              <Droplets className="w-4 h-4 text-sky-500" />
            )}
            <span>Need Water</span>
          </button>

          <button
            onClick={() => handleCallStaff('server')}
            disabled={pendingRequest !== null}
            className="py-3 px-4 bg-white hover:bg-stone-50 disabled:opacity-60 disabled:cursor-wait border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {pendingRequest === 'server' ? (
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
            ) : (
              <BellRing className="w-4 h-4 text-amber-600" />
            )}
            <span>Call Server</span>
          </button>
        </div>

        {/* Order More Items Button */}
        <button
          onClick={onBackToMenu}
          className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-sm shadow-md transition-all text-center block cursor-pointer"
        >
          Add More Items to This Table
        </button>
      </div>
    </div>
  );
};
