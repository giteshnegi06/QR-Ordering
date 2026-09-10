import React from 'react';
import { CafeInfo, Order, OrderStatus } from '../../types';
import { Modal } from '../common/Modal';
import { VegBadge } from '../common/VegBadge';
import { Printer, CheckCircle2, Clock, User, Phone, Receipt } from 'lucide-react';

interface TableBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  cafe: CafeInfo;
  tableNumber: string;
  orders: Order[];
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
}

export const TableBillModal: React.FC<TableBillModalProps> = ({
  isOpen,
  onClose,
  cafe,
  tableNumber,
  orders,
  onUpdateStatus,
}) => {
  if (!isOpen || orders.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  // Consolidate all items across all orders for this table
  const consolidatedItems = orders.flatMap((o) => o.items);
  const totalSubtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalTax = Number(orders.reduce((sum, o) => sum + o.tax, 0).toFixed(2));
  const totalServiceCharge = Number(orders.reduce((sum, o) => sum + o.serviceCharge, 0).toFixed(2));
  const grandTotal = Number((totalSubtotal + totalTax + totalServiceCharge).toFixed(2));

  const orderIdsList = orders.map((o) => `#${o.id}`).join(', ');
  const primaryOrder = orders[0];
  const hasMultipleOrders = orders.length > 1;

  // Guest details if any
  const guestName = orders.find((o) => o.customerName)?.customerName;
  const guestPhone = orders.find((o) => o.customerPhone)?.customerPhone;

  // Earliest created at
  const earliestTimestamp = Math.min(...orders.map((o) => o.createdAt));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-600" />
          <span>Single Consolidated Table Bill</span>
          <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
            {tableNumber}
          </span>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Actions Header (Not printed) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50 border border-stone-200 rounded-2xl">
          <div className="text-xs text-stone-600">
            {hasMultipleOrders ? (
              <span className="font-semibold text-amber-900">
                Consolidating {orders.length} orders ({orderIdsList}) into 1 single bill
              </span>
            ) : (
              <span>Official customer billing receipt for {tableNumber}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Single Bill</span>
            </button>
          </div>
        </div>

        {/* The Printable Bill Document */}
        <div
          id="printable-single-bill"
          className="bg-white border-2 border-stone-200 rounded-2xl p-6 sm:p-8 font-mono text-stone-900 space-y-4 shadow-xs"
        >
          {/* Header */}
          <div className="text-center pb-4 border-b-2 border-dashed border-stone-300 space-y-1">
            <h2 className="text-xl font-black uppercase tracking-wider font-sans text-stone-950">
              {cafe.name}
            </h2>
            <p className="text-xs text-stone-500 font-sans">{cafe.address}</p>
            <p className="text-xs text-stone-500 font-sans">Phone: {cafe.phone}</p>
            {cafe.taxPercent > 0 && (
              <p className="text-[10px] text-stone-400 font-sans">GST / Tax Reg: GSTIN-CAFE-01928</p>
            )}
            <div className="pt-2">
              <span className="inline-block px-3 py-0.5 bg-stone-100 text-stone-800 text-xs font-bold font-sans rounded-md uppercase tracking-wider">
                TABLE INVOICE
              </span>
            </div>
          </div>

          {/* Table & Order Metadata */}
          <div className="grid grid-cols-2 text-xs py-2 border-b border-dashed border-stone-300 gap-y-1">
            <div>
              <span className="text-stone-500">Table:</span>{' '}
              <strong className="text-sm font-sans">{tableNumber}</strong>
            </div>
            <div className="text-right">
              <span className="text-stone-500">Date:</span>{' '}
              <span>{new Date(earliestTimestamp).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-stone-500">Bill Order Ref:</span>{' '}
              <strong className="text-stone-900">{orderIdsList}</strong>
            </div>
            <div className="text-right">
              <span className="text-stone-500">Time:</span>{' '}
              <span>
                {new Date(earliestTimestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {guestName && (
              <div>
                <span className="text-stone-500">Guest:</span> <strong>{guestName}</strong>
              </div>
            )}
            {guestPhone && (
              <div className="text-right">
                <span className="text-stone-500">Phone:</span> <span>{guestPhone}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-2">
            <table className="w-full text-xs">
              <thead className="border-b border-stone-300 font-sans font-bold text-stone-600">
                <tr>
                  <th className="text-left py-1.5">Item Description</th>
                  <th className="text-center py-1.5 w-12">Qty</th>
                  <th className="text-right py-1.5 w-16">Rate</th>
                  <th className="text-right py-1.5 w-20">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {consolidatedItems.map((item, idx) => (
                  <tr key={idx} className="py-1.5">
                    <td className="py-2 pr-2">
                      <div className="font-semibold text-stone-900">{item.name}</div>
                      {item.selectedCustomizations && item.selectedCustomizations.length > 0 && (
                        <div className="text-[10px] text-stone-500">
                          {item.selectedCustomizations.map((c) => c.optionName).join(', ')}
                        </div>
                      )}
                      {item.specialInstructions && (
                        <div className="text-[10px] text-stone-500 italic">
                          Note: {item.specialInstructions}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 text-right text-stone-600">
                      {cafe.currency}
                      {item.price.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-bold text-stone-900">
                      {cafe.currency}
                      {item.itemTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Subtotal, Taxes, Grand Total */}
          <div className="pt-3 border-t-2 border-dashed border-stone-300 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Item Subtotal ({consolidatedItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span>
                {cafe.currency}
                {totalSubtotal.toFixed(2)}
              </span>
            </div>

            {totalTax > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>GST / Tax ({cafe.taxPercent}%)</span>
                <span>
                  {cafe.currency}
                  {totalTax.toFixed(2)}
                </span>
              </div>
            )}
            {totalServiceCharge > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Service Charge ({cafe.serviceChargePercent}%)</span>
                <span>
                  {cafe.currency}
                  {totalServiceCharge.toFixed(2)}
                </span>
              </div>
            )}

            <div className="pt-2 border-t-2 border-stone-950 flex justify-between text-base font-black font-sans text-stone-950">
              <span>GRAND TOTAL</span>
              <span className="text-lg">
                {cafe.currency}
                {grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Footer note & UPI payment barcode placeholder */}
          <div className="pt-4 border-t border-dashed border-stone-300 text-center text-xs space-y-1 text-stone-500 font-sans">
            <p className="font-bold text-stone-800">Thank you for dining with us at {cafe.name}!</p>
            <p className="text-[11px]">Please pay at the cashier counter or scan our UPI QR code</p>
            {cafe.upiId && (
              <p className="text-[10px] font-mono font-bold text-stone-700 mt-1">UPI ID: {cafe.upiId}</p>
            )}
            <p className="text-[10px] text-stone-400 mt-2">
              Printed on {new Date().toLocaleString()} • {tableNumber} Single Bill
            </p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="no-print pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {onUpdateStatus && (
              <button
                type="button"
                onClick={() => {
                  orders.forEach((o) => onUpdateStatus(o.id, 'served'));
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark All as Served</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
