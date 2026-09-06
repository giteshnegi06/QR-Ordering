import React, { useState } from 'react';
import { CafeInfo, CartItem, TableItem } from '../../types';
import { VegBadge } from '../common/VegBadge';
import { X, Plus, Minus, Trash2, MapPin, Receipt, ShieldCheck, CreditCard, ChevronRight, Loader2 } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cafe: CafeInfo;
  table: TableItem;
  cartItems: CartItem[];
  onIncrementItem: (cartId: string) => void;
  onDecrementItem: (cartId: string) => void;
  onRemoveItem: (cartId: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (details: {
    customerName?: string;
    customerPhone?: string;
    specialInstructions?: string;
    paymentMethod: 'counter_cash' | 'counter_card' | 'counter_upi';
  }) => Promise<void>;
  currency: string;
  existingOrderCount?: number;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cafe,
  table,
  cartItems,
  onIncrementItem,
  onDecrementItem,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  currency,
  existingOrderCount = 0,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'counter_cash' | 'counter_card' | 'counter_upi'>('counter_cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((sum, item) => sum + item.itemTotal, 0);
  // Tax & Serving charges removed from billing
  const tax = 0;
  const serviceCharge = 0;
  const grandTotal = subtotal;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setErrorMsg('Your cart is empty. Please add items to place an order.');
      return;
    }
    if (isSubmitting) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await onPlaceOrder({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        specialInstructions: specialInstructions.trim() || undefined,
        paymentMethod,
      });
      // Drawer will be closed by parent on success
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between overflow-hidden">
          {/* Top Header */}
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="text-base font-bold text-stone-900 leading-tight">Your Order Cart</h2>
                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="w-3 h-3 text-amber-500" />
                  <span className="font-semibold text-stone-800">{table.number}</span>
                  <span>• {cafe.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cartItems.length > 0 && (
                <button
                  onClick={onClearCart}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                  title="Clear all items"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Table confirmation card */}
            <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-sm">
                  {table.number.replace(/[^0-9]/g, '') || '01'}
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-900">Direct Kitchen Delivery</div>
                  <div className="text-[11px] text-amber-700">Orders are prepared specifically for {table.number}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-amber-200/70 text-amber-900 rounded-md">
                Verified
              </span>
            </div>

            {/* Notice for additional order */}
            {existingOrderCount > 0 && (
              <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                  <span>Adding another round for {table.number}</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  You have {existingOrderCount} active {existingOrderCount === 1 ? 'order' : 'orders'} in the kitchen. If ordered within 30 minutes, items automatically join your single table bill and order ID!
                </p>
              </div>
            )}

            {/* Error banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* Cart Items List */}
            {cartItems.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-stone-800 text-base mb-1">Your cart is empty</h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto mb-4">
                  Explore our artisanal menu and tap ADD on any item to begin your order.
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Selected Items ({cartItems.length})
                </h3>

                <div className="divide-y divide-stone-100 border border-stone-100 rounded-2xl bg-white shadow-2xs overflow-hidden">
                  {cartItems.map((item) => (
                    <div key={item.itemId} className="p-3.5 flex items-start gap-3">
                      <div className="pt-0.5">
                        <VegBadge type={item.vegType} size="sm" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-stone-900 leading-snug">
                            {item.name}
                          </h4>
                          <span className="text-xs font-extrabold text-stone-900 shrink-0">
                            {currency}{item.itemTotal}
                          </span>
                        </div>

                        {/* Customizations summary */}
                        {item.selectedCustomizations.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.selectedCustomizations.map((c, i) => (
                              <span
                                key={i}
                                className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200/60"
                              >
                                {c.optionName} {c.price > 0 && `(+${currency}${c.price})`}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.specialInstructions && (
                          <p className="text-[11px] text-amber-800 italic mt-1">
                            Note: {item.specialInstructions}
                          </p>
                        )}

                        {/* Quantity and Price */}
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">
                            {currency}{item.price} each
                          </span>

                          <div className="flex items-center gap-2 border border-stone-200 rounded-lg p-0.5 bg-stone-50">
                            <button
                              onClick={() => onDecrementItem(item.itemId)}
                              className="w-6 h-6 flex items-center justify-center rounded text-stone-600 hover:bg-white transition-colors"
                              aria-label="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-black text-stone-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onIncrementItem(item.itemId)}
                              className="w-6 h-6 flex items-center justify-center rounded text-stone-600 hover:bg-white transition-colors"
                              aria-label="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            {cartItems.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Special Kitchen Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Less spicy, no onions, extra cutlery..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full text-xs p-3 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-stone-50/50"
                />
              </div>
            )}

            {/* Optional Customer Details */}
            {cartItems.length > 0 && (
              <div className="space-y-3 p-3.5 border border-stone-100 rounded-2xl bg-stone-50/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Customer Details
                  </label>
                  <span className="text-[10px] font-semibold text-stone-400 bg-stone-200/60 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Your Name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-200 rounded-xl bg-white focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile (for SMS updates)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-200 rounded-xl bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Payment Method */}
            {cartItems.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('counter_cash')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      paymentMethod === 'counter_cash'
                        ? 'border-amber-500 bg-amber-50/60 text-amber-900 font-bold'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 text-xs'
                    }`}
                  >
                    <div className="text-xs font-bold">Cash</div>
                    <div className="text-[10px] text-stone-400">At Counter</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('counter_upi')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      paymentMethod === 'counter_upi'
                        ? 'border-amber-500 bg-amber-50/60 text-amber-900 font-bold'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 text-xs'
                    }`}
                  >
                    <div className="text-xs font-bold">UPI / QR</div>
                    <div className="text-[10px] text-stone-400">At Counter</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('counter_card')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      paymentMethod === 'counter_card'
                        ? 'border-amber-500 bg-amber-50/60 text-amber-900 font-bold'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 text-xs'
                    }`}
                  >
                    <div className="text-xs font-bold">Card</div>
                    <div className="text-[10px] text-stone-400">At Counter</div>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 px-1">
                  <CreditCard className="w-3 h-3 text-amber-500" />
                  <span>No upfront online charge required. Pay at the counter when served.</span>
                </div>
              </div>
            )}

            {/* Bill Summary */}
            {cartItems.length > 0 && (
              <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                  Bill Details
                </h4>
                <div className="flex justify-between text-xs text-stone-600">
                  <span>Item Subtotal</span>
                  <span>{currency}{subtotal.toFixed(2)}</span>
                </div>
                {/* Tax commented out in the bill for now
                <div className="flex justify-between text-xs text-stone-600">
                  <span>GST ({cafe.taxPercent}%)</span>
                  <span>{currency}{tax.toFixed(2)}</span>
                </div>
                */}
                <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-black text-stone-900">
                  <span>Grand Total</span>
                  <span className="text-amber-800 text-base">{currency}{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Fixed Action */}
          {cartItems.length > 0 && (
            <div className="p-4 border-t border-stone-100 bg-white shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500 px-1">
                <span>Ordering for: <strong className="text-stone-900">{table.number}</strong></span>
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Instant Kitchen Dispatch
                </span>
              </div>

              <button
                id="place-order-btn"
                onClick={handleOrderSubmit}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-between active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-full flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending to Kitchen...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-left">
                      <div className="text-[10px] uppercase font-semibold text-amber-200">
                        {cartItems.reduce((acc, i) => acc + i.quantity, 0)} Items
                      </div>
                      <div className="font-extrabold text-base">
                        {currency}{grandTotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-black">
                      <span>Place Order</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
