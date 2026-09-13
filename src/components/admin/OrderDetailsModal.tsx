import React from 'react';
import { CafeInfo, Order, OrderStatus } from '../../types';
import { Modal } from '../common/Modal';
import { VegBadge } from '../common/VegBadge';
import { Clock, User, Phone } from 'lucide-react';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  cafe: CafeInfo;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

// Read-only view of one order plus its status controls. Printing lives on
// the table bill (TableBillModal), not here. The header and the
// totals/status footer stay put; only the item list scrolls.
export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  cafe,
  onUpdateStatus,
}) => {
  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Order Details</span>
          <span className="text-sm font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
            #{order.id}
          </span>
        </div>
      }
      maxWidth="lg"
      scrollBody={false}
      footer={
        <div className="space-y-4">
          {/* Bill Breakdown */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Item Subtotal</span>
              <span>{cafe.currency}{order.subtotal.toFixed(2)}</span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>GST ({cafe.taxPercent}%)</span>
                <span>{cafe.currency}{order.tax.toFixed(2)}</span>
              </div>
            )}
            {order.serviceCharge > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Service Charge ({cafe.serviceChargePercent}%)</span>
                <span>{cafe.currency}{order.serviceCharge.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-black text-stone-900">
              <span>Grand Total</span>
              <span className="text-amber-800 text-base">
                {cafe.currency}{order.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Status Change Controls */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
              Change Order Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(['received', 'preparing', 'ready', 'served', 'cancelled'] as OrderStatus[]).map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => onUpdateStatus(order.id, st)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      order.status === st
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col min-h-0 flex-1 gap-4">
        {/* Header summary — pinned */}
        <div className="shrink-0 p-4 bg-stone-50 border border-stone-100 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-stone-900">{order.tableNumber}</span>
              <span className="text-xs text-stone-500">• {cafe.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(order.createdAt).toLocaleString()}</span>
              {order.orderRounds && order.orderRounds > 1 && (
                <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px]">
                  {order.orderRounds} Rounds (Consolidated Bill)
                </span>
              )}
              {order.isMerged && (
                <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded-full text-[10px]">
                  Combined Order
                </span>
              )}
            </div>
          </div>

          <span
            className={`text-xs font-black uppercase px-3 py-1.5 rounded-xl border ${
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
        </div>

        {/* Guest info if provided — pinned */}
        {(order.customerName || order.customerPhone) && (
          <div className="shrink-0 p-3 bg-stone-50/50 border border-stone-100 rounded-xl flex items-center gap-4 text-xs text-stone-600">
            {order.customerName && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-400" />
                <span>Guest: <strong>{order.customerName}</strong></span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                <span>{order.customerPhone}</span>
              </div>
            )}
          </div>
        )}

        {/* Items — the only part that scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar border border-stone-200 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {order.items.map((item, i) => (
                <tr key={i} className="hover:bg-stone-50/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <VegBadge type={item.vegType} size="sm" />
                      <span className="font-bold text-stone-900">{item.name}</span>
                    </div>
                    {item.selectedCustomizations.length > 0 && (
                      <div className="text-[11px] text-stone-500 pl-6 mt-0.5">
                        {item.selectedCustomizations.map((c) => c.optionName).join(', ')}
                      </div>
                    )}
                    {item.specialInstructions && (
                      <div className="text-[11px] text-amber-800 pl-6 italic">
                        Note: {item.specialInstructions}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center font-bold text-stone-900">{item.quantity}</td>
                  <td className="p-3 text-right text-stone-600">{cafe.currency}{item.price}</td>
                  <td className="p-3 text-right font-bold text-stone-900">
                    {cafe.currency}{item.itemTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Special Instructions Note */}
          {order.specialInstructions && (
            <div className="m-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <strong>Kitchen Instructions:</strong> {order.specialInstructions}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
