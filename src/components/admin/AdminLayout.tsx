import React, { useState } from 'react';
import { CafeInfo, Category, MenuItem, Order, TableItem } from '../../types';
import { AdminDashboard } from './AdminDashboard';
import { AdminOrders } from './AdminOrders';
import { AdminMenu } from './AdminMenu';
import { AdminCategories } from './AdminCategories';
import { AdminTables } from './AdminTables';
import { AdminQRCodes } from './AdminQRCodes';
import { AdminSettings } from './AdminSettings';
import { AdminStaff } from './AdminStaff';
import { OrderDetailsModal } from './OrderDetailsModal';
import { storageService } from '../../services/storage';
import {
  LayoutDashboard,
  ShoppingBag,
  ChefHat,
  UtensilsCrossed,
  FolderTree,
  Table as TableIcon,
  QrCode,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Store,
  Users,
} from 'lucide-react';

interface AdminLayoutProps {
  cafe: CafeInfo;
  currentUser: { email: string; role: 'admin' | 'kitchen' | 'staff' };
  orders: Order[];
  tables: TableItem[];
  categories: Category[];
  menuItems: MenuItem[];
  onUpdateCafe: (updated: CafeInfo) => void;
  onUpdateOrderStatus: (orderId: string, status: any) => void;
  onAddMenuItem: (item: any) => void;
  onUpdateMenuItem: (id: string, updates: any) => void;
  onDeleteMenuItem: (id: string) => void;
  onToggleMenuItemAvailability: (id: string) => void;
  onAddCategory: (name: string) => void;
  onUpdateCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddTable: (table: any) => void;
  onUpdateTable: (id: string, updates: any) => void;
  onDeleteTable: (id: string) => void;
  onOpenCustomerMenu: (tableId?: string) => void;
  onOpenKitchen: () => void;
  onLogout: () => void;
}

type NavSection =
  | 'dashboard'
  | 'orders'
  | 'kitchen'
  | 'menu'
  | 'categories'
  | 'tables'
  | 'qrcodes'
  | 'staff'
  | 'settings';

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  cafe,
  currentUser,
  orders,
  tables,
  categories,
  menuItems,
  onUpdateCafe,
  onUpdateOrderStatus,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onToggleMenuItemAvailability,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  onOpenCustomerMenu,
  onOpenKitchen,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  // Floor staff (role 'staff') share this console for day-to-day service —
  // orders, tables, table requests — but the sections that shape the
  // business (menu, staff accounts, settings) stay admin-only.
  const isAdmin = currentUser.role === 'admin';
  type NavItem = { id: NavSection; label: string; icon: React.FC<{ className?: string }>; adminOnly?: boolean };
  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    // { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
    { id: 'menu', label: 'Menu Items', icon: UtensilsCrossed, adminOnly: true },
    { id: 'categories', label: 'Categories', icon: FolderTree, adminOnly: true },
    { id: 'tables', label: 'Tables', icon: TableIcon },
    { id: 'qrcodes', label: 'QR Codes', icon: QrCode },
    { id: 'staff', label: 'Staff', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ];
  const navItems = allNavItems.filter((item) => isAdmin || !item.adminOnly);

  const handleNavClick = (sectionId: NavSection) => {
    if (sectionId === 'kitchen') {
      onOpenKitchen();
      return;
    }
    setActiveSection(sectionId);
    setIsMobileMenuOpen(false);
  };

  // Count active orders for badge
  const activeOrdersCount = orders.filter(
    (o) => o.status === 'received' || o.status === 'preparing' || o.status === 'ready'
  ).length;

  // Calculate items per category
  const itemCountByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = menuItems.filter((i) => i.categoryId === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col lg:flex-row">
      {/* Sidebar for Desktop — sticky to the viewport so it stays in place
          while the main content area scrolls; scrolls its own nav list
          independently if the window is too short to fit everything.
          Offset by 55px (the height of App.tsx's own sticky top nav bar
          above this layout) — sticking to top-0 would tuck the sidebar's
          top edge behind that bar once scrolled, cutting off the brand
          header. */}
      <aside className="hidden lg:flex flex-col w-64 h-[calc(100vh-55px)] sticky top-[55px] bg-stone-900 text-stone-200 border-r border-stone-800 p-4 shrink-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="relative flex items-center gap-3 px-3 py-3 mb-4 border-b border-stone-800">
          <div className="w-10 h-10 rounded-4xl bg-amber-500 text-stone-950 flex items-center justify-center font-black overflow-hidden shrink-0">
            {cafe.logo ? (
              <img src={cafe.logo} alt={`${cafe.name} logo`} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-5 h-5" />
            )}
          </div>
          <div className="relative min-w-0 flex-1">
            <h1 className="font-black text-lg text-white tracking-tight leading-tight truncate">
              {cafe.name}
            </h1>
            <span className="absolute -top-3 right-5 translate-x-full text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded border border-amber-400/20 whitespace-nowrap">
              {isAdmin ? 'Admin' : 'Staff'}
            </span>
          </div>
        </div>

        {/* Nav list */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>

                {item.id === 'orders' && activeOrdersCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      isActive ? 'bg-stone-950 text-amber-400' : 'bg-amber-500 text-stone-950'
                    }`}
                  >
                    {activeOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer shortcuts */}
        <div className="pt-4 border-t border-stone-800 space-y-2 text-xs">
          <button
            onClick={() => onOpenCustomerMenu()}
            className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold transition-colors flex items-center justify-between cursor-pointer"
            title="Open customer digital menu in this tab"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Customer View</span>
            </span>
            <span className="text-[10px] text-stone-400">Live</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2 px-3 text-stone-400 hover:text-rose-400 hover:bg-stone-800/60 rounded-xl font-bold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile / tablet Top Header. Same sticky offset story as the sidebar:
          App.tsx's nav bar sits above this at 53px (phone) / 57px (sm+), so
          sticking to top-0 would slide this bar — and its menu button —
          underneath it. */}
      <div className="lg:hidden bg-stone-900 text-white p-4 flex items-center justify-between border-b border-stone-800 sticky top-[53px] sm:top-[57px] z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-4xl bg-amber-500 text-stone-950 flex items-center justify-center font-black overflow-hidden shrink-0">
            {cafe.logo ? (
              <img src={cafe.logo} alt={`${cafe.name} logo`} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-4 h-4" />
            )}
          </div>
          <span className="relative font-black text-lg tracking-tight min-w-0">
            {cafe.name}
            <sup className="ml-0.5 text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded border border-amber-400/20 align-super">
              {isAdmin ? 'Admin' : 'Staff'}
            </sup>
          </span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl bg-stone-800 text-stone-300"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer — fixed/out-of-flow rather than a normal sibling of the
          sticky header above. Inserting it into the document flow used to
          push the header's box around the instant it opened, and mobile
          Safari/Chrome "helpfully" re-snaps a `position: sticky` element
          when its surrounding layout shifts like that — which is what was
          scrolling the page up on open. Fixed positioning removes it from
          the flow entirely, so opening/closing no longer moves anything
          else on the page, and it stays pinned under the header — not
          covering the rest of the screen — so the page behind it keeps
          scrolling normally. z-20 keeps it under the header (z-30) so the
          header — and its own close button — stays visible on top. */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed top-[126px] sm:top-[130px] left-0 right-0 z-20 bg-stone-900 border-b border-stone-800 max-h-[calc(100vh-126px)] sm:max-h-[calc(100vh-130px)] overflow-y-auto p-4 space-y-1 text-xs shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold ${
                  isActive ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-300 hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.id === 'orders' && activeOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-stone-950 font-bold">
                    {activeOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
          <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
            <button
              onClick={() => onOpenCustomerMenu()}
              className="text-amber-400 font-bold py-2 flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" /> Customer View
            </button>
            <button
              onClick={onLogout}
              className="text-rose-400 font-bold py-2 flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {activeSection === 'dashboard' && (
          <AdminDashboard
            cafe={cafe}
            orders={orders}
            tables={tables}
            menuItems={menuItems}
            onNavigateSection={(sec) => handleNavClick(sec as NavSection)}
            onOpenOrder={(order) => setSelectedOrderForModal(order)}
            onUpdateTable={onUpdateTable}
          />
        )}

        {activeSection === 'orders' && (
          <AdminOrders
            cafe={cafe}
            orders={orders}
            tables={tables}
            onOpenOrder={(order) => setSelectedOrderForModal(order)}
            onUpdateStatus={onUpdateOrderStatus}
            onSettleTable={(tableId, tableNumber) =>
              storageService.settleTable(tableId, tableNumber)
            }
            onOpenCustomerMenu={onOpenCustomerMenu}
          />
        )}

        {activeSection === 'menu' && (
          <AdminMenu
            cafe={cafe}
            categories={categories}
            menuItems={menuItems}
            onAddMenuItem={onAddMenuItem}
            onUpdateMenuItem={onUpdateMenuItem}
            onDeleteMenuItem={onDeleteMenuItem}
            onToggleAvailability={onToggleMenuItemAvailability}
          />
        )}

        {activeSection === 'categories' && (
          <AdminCategories
            categories={categories}
            itemCountByCategory={itemCountByCategory}
            onAddCategory={onAddCategory}
            onUpdateCategory={onUpdateCategory}
            onDeleteCategory={onDeleteCategory}
          />
        )}

        {activeSection === 'tables' && (
          <AdminTables
            cafe={cafe}
            tables={tables}
            onAddTable={onAddTable}
            onUpdateTable={onUpdateTable}
            onDeleteTable={onDeleteTable}
            onOpenCustomerMenu={onOpenCustomerMenu}
          />
        )}

        {activeSection === 'qrcodes' && (
          <AdminQRCodes
            cafe={cafe}
            tables={tables}
            onOpenCustomerMenu={onOpenCustomerMenu}
          />
        )}

        {activeSection === 'staff' && <AdminStaff />}

        {activeSection === 'settings' && (
          <AdminSettings cafe={cafe} onUpdateCafe={onUpdateCafe} />
        )}
      </main>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        cafe={cafe}
        onUpdateStatus={(orderId, status) => {
          onUpdateOrderStatus(orderId, status);
          if (selectedOrderForModal && selectedOrderForModal.id === orderId) {
            setSelectedOrderForModal({ ...selectedOrderForModal, status });
          }
        }}
      />
    </div>
  );
};
