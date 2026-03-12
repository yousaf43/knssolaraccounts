export const kpiData = {
  totalSales: 0,
  totalExpenses: 0,
  netProfit: 0,
  outstandingReceivables: 0,
  outstandingPayables: 0,
  bankBalance: 0,
};

export const monthlySales: { month: string; sales: number; expenses: number }[] = [];

export type InvoiceItem = {
  description: string;
  qty: number;
  rate: number;
  amount: number;
  inventoryItemId?: string;
  discount?: number;
};

export type Invoice = {
  id: string;
  number: string;
  documentNumber?: string;
  projectName?: string;
  customer: string;
  date: string;
  dueDate: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "approved" | "returned";
  returnedFrom?: string;
  isReturn?: boolean;
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
  discount?: number;
  payments?: { date: string; amount: number; method: string; reference?: string }[];
};

export type SalesOrder = {
  id: string;
  number: string;
  projectName?: string;
  customer: string;
  date: string;
  deliveryDate: string;
  amount: number;
  status: "confirmed" | "pending" | "shipped" | "cancelled" | "approved";
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
  advancePayment?: number;
  advancePaymentMethod?: string;
  advancePaymentRef?: string;
};

export type Quotation = {
  id: string;
  number: string;
  documentNumber?: string;
  projectName?: string;
  customer: string;
  date: string;
  dueDate: string;
  amount: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
};

export type Receipt = {
  id: string;
  number: string;
  customer: string;
  date: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  totalBilled: number;
  outstanding: number;
};

export type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  totalPaid: number;
  outstanding: number;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  supplier: string;
  date: string;
  deliveryDate: string;
  amount: number;
  status: "confirmed" | "pending" | "received" | "cancelled";
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
};

export type Bill = {
  id: string;
  number: string;
  supplier: string;
  date: string;
  dueDate: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
};

export type PurchasePayment = {
  id: string;
  number: string;
  supplier: string;
  date: string;
  billNumber: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  nominalAccount?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  model?: string;
  uniqueCode?: string;
  qty: number;
  reorderLevel: number;
  price: number;
  category: string;
  date: string;
  costPrice: number;
  salePrice: number;
  unit: string;
  weight: number;
  stockAssetAccount: string;
  saleDiscount: number;
  purchaseDiscount: number;
  productType?: "stock" | "non-stock" | "bundle";
  bundleItems?: { itemId: string; qty: number }[];
};

export type StockAdjustment = {
  id: string;
  itemId: string;
  itemName: string;
  type: "increase" | "decrease";
  qty: number;
  reason: string;
  date: string;
  note?: string;
};

// All initial data returns empty arrays - fresh start
export function getInitialInvoices(): Invoice[] { return []; }
export function getInitialCustomers(): Customer[] { return []; }
export function getInitialSuppliers(): Supplier[] { return []; }
export function getInitialExpenses(): Expense[] { return []; }
export function getInitialInventory(): InventoryItem[] { return []; }
export function getInitialSalesOrders(): SalesOrder[] { return []; }
export function getInitialReceipts(): Receipt[] { return []; }
export function getInitialPurchaseOrders(): PurchaseOrder[] { return []; }
export function getInitialBills(): Bill[] { return []; }
export function getInitialPurchasePayments(): PurchasePayment[] { return []; }

// Keep backward compat exports
export const invoices: Invoice[] = [];
export const customers: Customer[] = [];
export const suppliers: Supplier[] = [];
export const expenses: Expense[] = [];

export const recentTransactions: { id: string; date: string; description: string; amount: number; type: "credit" | "debit" }[] = [];
