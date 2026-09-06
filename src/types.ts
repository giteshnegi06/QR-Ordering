export type VegType = 'veg' | 'non-veg';

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface CafeInfo {
  id: string;
  name: string;
  tagline: string;
  logo: string;
  address: string;
  phone: string;
  currency: string;
  taxPercent: number; // e.g., 5%
  serviceChargePercent: number; // e.g., 2.5%
  isAcceptingOrders: boolean;
  upiId?: string;
}

export interface TableItem {
  id: string;
  number: string; // e.g. "Table 05"
  code: string; // e.g. "table-05"
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  activeOrderId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  displayOrder: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  price: number;
}

export interface CustomizationGroup {
  id: string;
  title: string;
  required: boolean;
  type: 'radio' | 'checkbox';
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  vegType: VegType;
  image: string;
  isAvailable: boolean;
  preparationTimeMin?: number;
  customizationGroups?: CustomizationGroup[];
}

export interface CartCustomization {
  groupTitle: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  itemId: string; // generated unique cart id
  menuItemId: string;
  name: string;
  price: number;
  vegType: VegType;
  image: string;
  quantity: number;
  selectedCustomizations: CartCustomization[];
  specialInstructions?: string;
  itemTotal: number;
  preparationTimeMin?: number;
}

export interface OrderRound {
  roundNumber: number;
  items: CartItem[];
  placedAt: number;
  estimatedPrepTimeMin: number;
  preparingStartedAt?: number;
  readyAt?: number;
  status: OrderStatus;
}

export interface Order {
  id: string; // e.g. "ORD-1025"
  cafeId: string;
  tableId: string;
  tableNumber: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  status: OrderStatus;
  customerName?: string;
  customerPhone?: string;
  specialInstructions?: string;
  paymentMethod: 'counter_cash' | 'counter_card' | 'counter_upi';
  paymentStatus: 'pending' | 'paid';
  createdAt: number;
  updatedAt: number;
  preparingStartedAt?: number;
  estimatedPrepTimeMin?: number;
  readyAt?: number;
  orderRounds?: number;
  mergedOrderIds?: string[];
  isMerged?: boolean;
  // Each round (initial order + any items added within the 30-min merge window)
  // tracks its own prep timer so a new addition never mixes with an older round's countdown.
  rounds?: OrderRound[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'kitchen' | 'staff';
}
