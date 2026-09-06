import React, { useState, useEffect } from 'react';
import { CafeInfo, Category, MenuItem, Order, TableItem } from './types';
import { storageService } from './services/storage';
import { CustomerView } from './components/customer/CustomerView';
import { KitchenView } from './components/kitchen/KitchenView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import {
  Smartphone,
  ChefHat,
  ShieldAlert,
  Store,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

type AppView = 'customer' | 'kitchen' | 'admin';

export const App: React.FC = () => {
  // State from Storage Service
  const [cafe, setCafe] = useState<CafeInfo>(() => storageService.getCafe());
  const [categories, setCategories] = useState<Category[]>(() => storageService.getCategories());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => storageService.getMenuItems());
  const [tables, setTables] = useState<TableItem[]>(() => storageService.getTables());
  const [orders, setOrders] = useState<Order[]>(() => storageService.getOrders());

  // Current Route / View
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();

    if (path.includes('/kitchen') || hash.includes('kitchen') || search.includes('view=kitchen')) {
      return 'kitchen';
    }
    if (path.includes('/admin') || hash.includes('admin') || search.includes('view=admin')) {
      return 'admin';
    }
    return 'customer';
  });

  // Current active table (for customer menu)
  const [activeTableId, setActiveTableId] = useState<string>(() => {
    // Check path for /menu/{cafeId}/{tableId}
    const path = window.location.pathname;
    const match = path.match(/\/menu\/[^/]+\/([^/]+)/);
    if (match && match[1]) {
      return match[1];
    }
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) return tableParam;

    return 'table-05'; // Default demo table: Table 05
  });

  // Admin authentication state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('cafe_admin_logged_in') === 'true';
  });

  // Keep state synchronized with storageService events
  useEffect(() => {
    const unsubscribe = storageService.subscribe((type) => {
      if (type === 'CAFE_UPDATED') setCafe(storageService.getCafe());
      if (type === 'CATEGORIES_UPDATED') setCategories(storageService.getCategories());
      if (type === 'MENU_UPDATED') setMenuItems(storageService.getMenuItems());
      if (type === 'TABLES_UPDATED') setTables(storageService.getTables());
      if (type === 'ORDERS_UPDATED' || type === 'NEW_ORDER') setOrders(storageService.getOrders());
    });

    return unsubscribe;
  }, []);

  // Update browser URL / history when view changes
  const navigateToView = (view: AppView, tableId?: string) => {
    setCurrentView(view);
    if (tableId) {
      setActiveTableId(tableId);
    }

    let newUrl = window.location.pathname;
    if (view === 'customer') {
      const tid = tableId || activeTableId;
      newUrl = `/menu/${cafe.id}/${tid}`;
    } else if (view === 'kitchen') {
      newUrl = '/kitchen';
    } else if (view === 'admin') {
      newUrl = '/admin';
    }

    try {
      window.history.pushState({}, '', newUrl);
    } catch (e) {
      // In restricted iframe environments, history API might be sandboxed
    }
  };

  // Find active table details
  const currentTable = tables.find(
    (t) => t.code === activeTableId || t.id === activeTableId || t.number.toLowerCase() === activeTableId.toLowerCase()
  ) || tables[0] || {
    id: 'table-05',
    number: 'Table 05',
    capacity: 4,
    status: 'occupied',
    code: 'table-05',
  };

  // Admin handlers
  const handleAdminLogin = (email: string, role: 'admin' | 'kitchen') => {
    if (role === 'kitchen') {
      navigateToView('kitchen');
    } else {
      setIsAdminLoggedIn(true);
      sessionStorage.setItem('cafe_admin_logged_in', 'true');
      navigateToView('admin');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem('cafe_admin_logged_in');
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans">
      {/* Top Universal System Navigation Bar
          Enables quick testing and switching between the 3 core requirements:
          1. Customer QR Menu, 2. Kitchen KDS, 3. Cafe Admin */}
      <nav className="bg-stone-950 text-white border-b border-stone-800 sticky top-0 z-50 text-xs px-3 sm:px-6 py-2 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Logo / Cafe badge */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{cafe.name}</span>
              <span className="text-[10px] text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                QR SYSTEM
              </span>
            </span>
          </div>

          {/* Interface Switcher Tabs */}
          <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => navigateToView('customer')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'customer'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Customer Menu</span>
            </button>

            <button
              onClick={() => navigateToView('kitchen')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'kitchen'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen KDS</span>
              {orders.filter((o) => o.status === 'received' || o.status === 'preparing').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-0.5" />
              )}
            </button>

            <button
              onClick={() => navigateToView('admin')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Cafe Admin</span>
            </button>
          </div>

          {/* Table Selector (Simulates scanning different table QR codes) */}
          {currentView === 'customer' && (
            <div className="flex items-center gap-1.5 text-stone-400">
              <span className="text-[11px] hidden sm:inline">Simulated Table QR:</span>
              <select
                value={activeTableId}
                onChange={(e) => navigateToView('customer', e.target.value)}
                className="bg-stone-800 text-amber-300 text-xs font-black py-1 px-2.5 rounded-lg border border-stone-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.code || t.id}>
                    {t.number}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </nav>

      {/* View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'customer' && (
          <CustomerView tableId={currentTable.code || currentTable.id} />
        )}

        {currentView === 'kitchen' && (
          <KitchenView
            onSwitchToCustomer={(tableId) => navigateToView('customer', tableId)}
            onSwitchToAdmin={() => navigateToView('admin')}
          />
        )}

        {currentView === 'admin' &&
          (isAdminLoggedIn ? (
            <AdminLayout
              cafe={cafe}
              orders={orders}
              tables={tables}
              categories={categories}
              menuItems={menuItems}
              onUpdateCafe={(updated) => storageService.updateCafe(updated)}
              onUpdateOrderStatus={(orderId, status) => storageService.updateOrderStatus(orderId, status)}
              onAddMenuItem={(item) => storageService.addMenuItem(item)}
              onUpdateMenuItem={(id, updates) => storageService.updateMenuItem(id, updates)}
              onDeleteMenuItem={(id) => storageService.deleteMenuItem(id)}
              onToggleMenuItemAvailability={(id) => storageService.toggleMenuItemAvailability(id)}
              onAddCategory={(name) => storageService.addCategory(name)}
              onUpdateCategory={(id, name) => storageService.updateCategory(id, name)}
              onDeleteCategory={(id) => storageService.deleteCategory(id)}
              onAddTable={(table) => storageService.addTable(table)}
              onUpdateTable={(id, updates) => storageService.updateTable(id, updates)}
              onDeleteTable={(id) => storageService.deleteTable(id)}
              onOpenCustomerMenu={(tId) => navigateToView('customer', tId || activeTableId)}
              onOpenKitchen={() => navigateToView('kitchen')}
              onLogout={handleAdminLogout}
            />
          ) : (
            <AdminLogin cafe={cafe} onLoginSuccess={handleAdminLogin} />
          ))}
      </div>
    </div>
  );
};
export default App;
