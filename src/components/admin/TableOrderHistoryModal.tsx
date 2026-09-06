import React from 'react';
import { CafeInfo, Order } from '../../types';
import { Modal } from '../common/Modal';
import { VegBadge } from '../common/VegBadge';
import { Clock, User, Receipt, ChefHat, Eye, Layers } from 'lucide-react';

interface TableOrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cafe: CafeInfo;
  tableNumber: string;
  orders: Order[];
  onOpenOrder: (order: Order) => void;
}

const statusStyles: Record<string, string> = {
  received: 'bg-amber-100 text-amber-900 border-amber-300',
  preparing: 'bg-blue-100 text-blue-900 border-blue-300',
  ready: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  served: 'bg-stone-100 text-stone-700 border-stone-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
};

// Shows every order ever placed for this table today, not just the ones
// currently active — so the admin can review the table's full day activity
// (past served/cancelled orders included) from one place.
export const TableOrderHistoryModal: React.FC<TableOrderHistoryModalProps> = ({
  isOpen,
  onClose,
  cafe,
  tableNumber,
  orders,
  onOpenOrder,
}) => {
  if (!isOpen) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysOrders = orders
    .filter((o) => o.createdAt >= todayStart.getTime())
    .sort((a, b) => b.createdAt - a.createdAt);

  const totalOrders = todaysOrders.length;
  const totalRevenue = todaysOrders.reduce(
    (sum, o) => sum + (o.subtotal + (o.serviceCharge || 0)),
    0
  );
  const totalItems = todaysOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-600" />
          <span>Today's Orders</span>
          <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
            {tableNumber}
          </span>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Day Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-center">
            <div className="text-lg font-black text-stone-900">{totalOrders}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Orders Today
            </div>
          </div>
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-center">
            <div className="text-lg font-black text-stone-900">{totalItems}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Items Ordered
            </div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <div className="text-lg font-black text-amber-900">
              {cafe.currency}
              {totalRevenue.toFixed(2)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Day Total
            </div>
          </div>
        </div>

        {/* Orders List */}
        {todaysOrders.length === 0 ? (
          <div className="py-10 text-center text-stone-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-stone-300" />
            <p className="text-sm font-bold text-stone-600">No orders yet today for {tableNumber}.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {todaysOrders.map((order) => (
              <div
                key={order.id}
                className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/60"
              >
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-stone-200/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-black text-stone-900">#{order.id}</span>
                    {order.orderRounds && order.orderRounds > 1 && (
                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded flex items-center gap-0.5">
                        <ChefHat className="w-3 h-3" /> {order.orderRounds} Rounds
                      </span>
                    )}
                    {order.isMerged && (
                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-bold rounded flex items-center gap-0.5">
                        <Layers className="w-3 h-3" /> Combined
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border ${
                        statusStyles[order.status] || statusStyles.received
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-stone-700">
                      <div className="flex items-center gap-1.5 truncate max-w-[220px]">
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

                {order.customerName && (
                  <div className="text-[11px] text-stone-500 mt-1.5 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Guest: {order.customerName}</span>
                  </div>
                )}

                {order.specialInstructions && (
                  <div className="text-[10px] text-amber-800 italic mt-1 truncate">
                    "{order.specialInstructions}"
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-stone-200/50 flex items-center justify-between text-xs">
                  <div className="font-black text-stone-900">
                    Total: {cafe.currency}
                    {(order.subtotal + (order.serviceCharge || 0)).toFixed(2)}
                  </div>
                  <button
                    onClick={() => onOpenOrder(order)}
                    className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-md transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex justify-end border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
