import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { CafeInfo, CartCustomization, CartItem, Category, MenuItem, Order, TableItem } from '../../types';
import { storageService } from '../../services/storage';
import { MenuHeader } from './MenuHeader';
import { CategoryList } from './CategoryList';
import { MenuItemCard } from './MenuItemCard';
import { CustomizationModal } from './CustomizationModal';
import { CartDrawer } from './CartDrawer';
import { OrderTrackingView } from './OrderTrackingView';
import { ShoppingBag, AlertTriangle, RefreshCw, ChefHat, Timer, Layers } from 'lucide-react';

interface CustomerViewProps {
  tableId: string;
}

export const CustomerView: React.FC<CustomerViewProps> = ({ tableId }) => {
  // State
  const [cafe, setCafe] = useState<CafeInfo>(() => storageService.getCafe());
  const [tables, setTables] = useState<TableItem[]>(() => storageService.getTables());
  const [categories, setCategories] = useState<Category[]>(() => storageService.getCategories());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => storageService.getMenuItems());
  const [orders, setOrders] = useState<Order[]>(() => storageService.getOrders());

  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vegOnlyFilter, setVegOnlyFilter] = useState<boolean>(false);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Customization modal state
  const [selectedCustomizingItem, setSelectedCustomizingItem] = useState<MenuItem | null>(null);

  // Tracking state: Active order ID and view toggle. Deliberately NOT seeded
  // from any cross-table/global "last order" — a table's QR must only ever
  // surface orders placed for that exact table, never another table's order.
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isViewingTracking, setIsViewingTracking] = useState<boolean>(false);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = storageService.subscribe((type) => {
      if (type === 'ORDERS_UPDATED' || type === 'NEW_ORDER') {
        setOrders(storageService.getOrders());
      } else if (type === 'MENU_UPDATED') {
        setCategories(storageService.getCategories());
        setMenuItems(storageService.getMenuItems());
      } else if (type === 'TABLES_UPDATED') {
        setTables(storageService.getTables());
      } else if (type === 'CAFE_UPDATED') {
        setCafe(storageService.getCafe());
      }
    });
    return unsubscribe;
  }, []);

  // Determine current table
  const currentTable = useMemo(() => {
    const found = tables.find((t) => t.id === tableId || t.code === tableId);
    if (found) return found;
    // Fallback if table not found
    return {
      id: tableId || 'table-05',
      number: tableId ? `Table ${tableId.replace(/[^0-9]/g, '')}` : 'Table 05',
      code: tableId || 'table-05',
      capacity: 4,
      status: 'occupied' as const,
    };
  }, [tables, tableId]);

  // Ids of the orders THIS device actually placed. Recorded by the storage
  // service as each order is created, and re-read on every order update so a
  // freshly placed order shows up immediately.
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() =>
    storageService.getCustomerOrderIds()
  );

  useEffect(() => {
    const unsubscribe = storageService.subscribe((type) => {
      if (type === 'ORDERS_UPDATED' || type === 'NEW_ORDER') {
        setMyOrderIds(storageService.getCustomerOrderIds());
      }
    });
    return unsubscribe;
  }, []);

  // A diner may only ever see their own orders. Two conditions, both required:
  // the order was placed from this device, AND it belongs to the table whose QR
  // is open. Table alone would show whoever sat here earlier today their
  // predecessor's food and bill; the id list alone would follow a diner to
  // another table's QR.
  const ordersForTable = useMemo(() => {
    const mine = new Set(myOrderIds);
    return orders.filter(
      (o) =>
        mine.has(o.id) && (o.tableId === currentTable.id || o.tableNumber === currentTable.number)
    );
  }, [orders, currentTable, myOrderIds]);

  const activeOrdersForTable = useMemo(() => {
    return ordersForTable.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
  }, [ordersForTable]);

  // This diner's orders for this table, served ones included.
  const allOrdersForTable = ordersForTable;

  // Reset tracking view whenever the active table changes (e.g. switching the
  // simulated table QR), so one table's tracking screen never bleeds into another's.
  useEffect(() => {
    setIsViewingTracking(false);
    setSelectedOrderId(null);
  }, [currentTable.id]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category filter
      if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) {
        return false;
      }
      // Veg filter
      if (vegOnlyFilter && item.vegType !== 'veg') {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [menuItems, activeCategoryId, vegOnlyFilter, searchQuery]);

  // Group items by category if "all" is selected
  const groupedSections = useMemo(() => {
    if (activeCategoryId !== 'all') {
      const cat = categories.find((c) => c.id === activeCategoryId);
      return [{ category: cat || { id: activeCategoryId, name: 'Menu', icon: 'Utensils', displayOrder: 1 }, items: filteredItems }];
    }

    // "All" selected
    const sections: { category: Category; items: MenuItem[] }[] = [];
    categories.forEach((cat) => {
      const itemsInCat = filteredItems.filter((item) => item.categoryId === cat.id);
      if (itemsInCat.length > 0) {
        sections.push({ category: cat, items: itemsInCat });
      }
    });

    // Any items without recognized category
    const leftover = filteredItems.filter(
      (item) => !categories.some((c) => c.id === item.categoryId)
    );
    if (leftover.length > 0) {
      sections.push({
        category: { id: 'other', name: 'More Dishes', icon: 'Utensils', displayOrder: 99 },
        items: leftover,
      });
    }

    return sections;
  }, [categories, filteredItems, activeCategoryId]);

  // Cart operations
  const cartTotalQuantity = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const cartTotalAmount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.itemTotal, 0);
  }, [cartItems]);

  const handleAddItemClick = (item: MenuItem) => {
    if (!item.isAvailable) return;

    if (item.customizationGroups && item.customizationGroups.length > 0) {
      // Open customization modal
      setSelectedCustomizingItem(item);
    } else {
      // Direct add
      handleAddDirect(item);
    }
  };

  const handleAddDirect = (item: MenuItem) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.menuItemId === item.id && ci.selectedCustomizations.length === 0
      );
      if (existingIdx !== -1) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = current.quantity + 1;
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          itemTotal: newQty * item.price,
        };
        return updated;
      }

      const newCartItem: CartItem = {
        itemId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        vegType: item.vegType,
        image: item.image,
        quantity: 1,
        selectedCustomizations: [],
        itemTotal: item.price,
        preparationTimeMin: item.preparationTimeMin || 15,
      };
      return [...prev, newCartItem];
    });
  };

  const handleAddCustomized = (
    item: MenuItem,
    quantity: number,
    customizations: CartCustomization[],
    instructions?: string
  ) => {
    const extraPrice = customizations.reduce((sum, c) => sum + c.price, 0);
    const unitPrice = item.price + extraPrice;

    const newCartItem: CartItem = {
      itemId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: item.id,
      name: item.name,
      price: unitPrice,
      vegType: item.vegType,
      image: item.image,
      quantity,
      selectedCustomizations: customizations,
      specialInstructions: instructions,
      itemTotal: unitPrice * quantity,
      preparationTimeMin: item.preparationTimeMin || 15,
    };

    setCartItems((prev) => [...prev, newCartItem]);
  };

  const handleIncrementCart = (cartId: string) => {
    setCartItems((prev) =>
      prev.map((ci) => {
        if (ci.itemId === cartId) {
          const newQty = ci.quantity + 1;
          return {
            ...ci,
            quantity: newQty,
            itemTotal: newQty * ci.price,
          };
        }
        return ci;
      })
    );
  };

  const handleDecrementCart = (cartId: string) => {
    setCartItems((prev) => {
      return prev
        .map((ci) => {
          if (ci.itemId === cartId) {
            const newQty = ci.quantity - 1;
            return {
              ...ci,
              quantity: newQty,
              itemTotal: newQty * ci.price,
            };
          }
          return ci;
        })
        .filter((ci) => ci.quantity > 0);
    });
  };

  const handleRemoveItem = (cartId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.itemId !== cartId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Place Order submission
  const handlePlaceOrder = async (details: {
    customerName?: string;
    customerPhone?: string;
    specialInstructions?: string;
    paymentMethod: 'counter_cash' | 'counter_card' | 'counter_upi';
  }) => {
    if (cartItems.length === 0) return;

    const subtotal = cartTotalAmount;
    const tax = Number(((subtotal * cafe.taxPercent) / 100).toFixed(2));
    const serviceCharge = Number(((subtotal * cafe.serviceChargePercent) / 100).toFixed(2));
    const total = Number((subtotal + tax + serviceCharge).toFixed(2));

    const newOrder = storageService.createOrder({
      cafeId: cafe.id,
      tableId: currentTable.id,
      tableNumber: currentTable.number,
      items: cartItems,
      subtotal,
      tax,
      serviceCharge,
      total,
      status: 'received',
      customerName: details.customerName,
      customerPhone: details.customerPhone,
      specialInstructions: details.specialInstructions,
      paymentMethod: details.paymentMethod,
      paymentStatus: 'pending',
    });

    // Clear cart
    setCartItems([]);
    setIsCartOpen(false);

    // Set active tracked order and open tracking view
    setSelectedOrderId(newOrder.id);
    setIsViewingTracking(true);

    // Confetti celebration!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6'],
      });
    } catch {
      // Confetti fallback
    }
  };

  // If tracking screen is active, show all active orders (visible until served)
  if (isViewingTracking && (activeOrdersForTable.length > 0 || allOrdersForTable.length > 0)) {
    return (
      <OrderTrackingView
        orders={activeOrdersForTable.length > 0 ? activeOrdersForTable : allOrdersForTable}
        allSessionOrders={allOrdersForTable}
        selectedOrderId={selectedOrderId || activeOrdersForTable[0]?.id || allOrdersForTable[0]?.id}
        onSelectOrder={(id) => setSelectedOrderId(id)}
        cafe={cafe}
        onBackToMenu={() => setIsViewingTracking(false)}
        currency={cafe.currency}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Header */}
      <MenuHeader
        cafe={cafe}
        table={currentTable}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        vegOnlyFilter={vegOnlyFilter}
        onToggleVegOnly={() => setVegOnlyFilter((v) => !v)}
        activeOrderCount={activeOrdersForTable.length}
        onViewActiveOrder={() => {
          if (activeOrdersForTable.length > 0 || allOrdersForTable.length > 0) {
            setSelectedOrderId(activeOrdersForTable[0]?.id || allOrdersForTable[0]?.id || null);
            setIsViewingTracking(true);
          }
        }}
      />

      {/* Ongoing Table Orders Banner - visible whenever customer returns to menu */}
      {activeOrdersForTable.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3">
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border border-amber-300/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-xs font-black">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-amber-950 flex items-center gap-2">
                  <span>
                    {activeOrdersForTable.length} {activeOrdersForTable.length === 1 ? 'Order' : 'Orders'} in Kitchen for {currentTable.number}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                <p className="text-[11px] text-amber-900/80 mt-0.5">
                  {activeOrdersForTable.map((o) => `#${o.id} (${o.status})`).join(' • ')} — All orders shown until served!
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedOrderId(activeOrdersForTable[0].id);
                setIsViewingTracking(true);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Track Live Orders ({activeOrdersForTable.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Categories Horizontal Bar */}
      <CategoryList
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setActiveCategoryId}
      />

      {/* Main Menu Grid */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-stone-800 text-base mb-1">No items found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
              We couldn't find any dishes matching your filters or search. Try clearing your query or switching categories.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setVegOnlyFilter(false);
                setActiveCategoryId('all');
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-amber-700 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
          groupedSections.map((section) => (
            <section key={section.category.id} className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                <h2 className="text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>{section.category.name}</span>
                  <span className="text-xs font-normal text-stone-400">
                    ({section.items.length})
                  </span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item) => {
                  const cartItem = cartItems.find((ci) => ci.menuItemId === item.id);
                  const cartQty = cartItem ? cartItem.quantity : 0;

                  return (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      currency={cafe.currency}
                      cartQuantity={cartQty}
                      onAddClick={() => handleAddItemClick(item)}
                      onIncrement={() => cartItem && handleIncrementCart(cartItem.itemId)}
                      onDecrement={() => cartItem && handleDecrementCart(cartItem.itemId)}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Floating Sticky Cart Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 sm:px-6">
          <div className="max-w-xl mx-auto">
            <button
              id="view-cart-sticky-bar"
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-stone-900 hover:bg-black text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between transition-transform active:scale-[0.99] border border-stone-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-sm shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    {cartTotalQuantity} {cartTotalQuantity === 1 ? 'item' : 'items'} in cart
                  </div>
                  <div className="text-base font-extrabold text-white">
                    {cafe.currency}{cartTotalAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-amber-400 bg-stone-800/80 px-4 py-2 rounded-xl">
                <span>View Cart & Order</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Customization Modal */}
      <CustomizationModal
        item={selectedCustomizingItem}
        isOpen={!!selectedCustomizingItem}
        onClose={() => setSelectedCustomizingItem(null)}
        onAddToCart={handleAddCustomized}
        currency={cafe.currency}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cafe={cafe}
        table={currentTable}
        cartItems={cartItems}
        onIncrementItem={handleIncrementCart}
        onDecrementItem={handleDecrementCart}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onPlaceOrder={handlePlaceOrder}
        currency={cafe.currency}
        existingOrderCount={activeOrdersForTable.length}
      />
    </div>
  );
};
