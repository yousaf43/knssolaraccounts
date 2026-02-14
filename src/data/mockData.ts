export const kpiData = {
  totalSales: 284500,
  totalExpenses: 142300,
  netProfit: 142200,
  outstandingReceivables: 45600,
  outstandingPayables: 32100,
  bankBalance: 198400,
};

export const monthlySales = [
  { month: "Jan", sales: 18500, expenses: 12000 },
  { month: "Feb", sales: 22000, expenses: 11500 },
  { month: "Mar", sales: 19800, expenses: 13200 },
  { month: "Apr", sales: 24500, expenses: 14000 },
  { month: "May", sales: 28000, expenses: 12800 },
  { month: "Jun", sales: 31200, expenses: 15600 },
  { month: "Jul", sales: 26800, expenses: 13400 },
  { month: "Aug", sales: 29500, expenses: 14200 },
  { month: "Sep", sales: 27300, expenses: 11900 },
  { month: "Oct", sales: 32100, expenses: 16800 },
  { month: "Nov", sales: 35000, expenses: 15200 },
  { month: "Dec", sales: 38200, expenses: 17400 },
];

export type InvoiceItem = {
  description: string;
  qty: number;
  rate: number;
  amount: number;
};

export type Invoice = {
  id: string;
  number: string;
  customer: string;
  date: string;
  dueDate: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  items: InvoiceItem[];
  notes?: string;
  tax?: number;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  totalBilled: number;
  outstanding: number;
};

export type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  totalPaid: number;
  outstanding: number;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  qty: number;
  reorderLevel: number;
  price: number;
  category: string;
};

// Initial data generators
export function getInitialInvoices(): Invoice[] {
  return [
    { id: "1", number: "INV-001", customer: "Acme Corp", date: "2025-01-15", dueDate: "2025-02-15", amount: 12500, status: "paid", items: [{ description: "Web Development", qty: 1, rate: 12500, amount: 12500 }], tax: 10 },
    { id: "2", number: "INV-002", customer: "TechStart Inc", date: "2025-01-20", dueDate: "2025-02-20", amount: 8750, status: "pending", items: [{ description: "UI Design", qty: 1, rate: 8750, amount: 8750 }], tax: 10 },
    { id: "3", number: "INV-003", customer: "Global Solutions", date: "2025-01-25", dueDate: "2025-02-10", amount: 15200, status: "overdue", items: [{ description: "Consulting", qty: 40, rate: 380, amount: 15200 }], tax: 10 },
    { id: "4", number: "INV-004", customer: "BlueSky Ltd", date: "2025-02-01", dueDate: "2025-03-01", amount: 6300, status: "paid", items: [{ description: "Maintenance", qty: 1, rate: 6300, amount: 6300 }], tax: 10 },
    { id: "5", number: "INV-005", customer: "Pinnacle Group", date: "2025-02-05", dueDate: "2025-03-05", amount: 22000, status: "pending", items: [{ description: "Software License", qty: 10, rate: 2200, amount: 22000 }], tax: 10 },
    { id: "6", number: "INV-006", customer: "Vertex Media", date: "2025-02-08", dueDate: "2025-02-22", amount: 4800, status: "overdue", items: [{ description: "Marketing Assets", qty: 1, rate: 4800, amount: 4800 }], tax: 10 },
  ];
}

export function getInitialCustomers(): Customer[] {
  return [
    { id: "1", name: "John Smith", email: "john@acmecorp.com", phone: "+1 555-0101", company: "Acme Corp", totalBilled: 45000, outstanding: 0 },
    { id: "2", name: "Sarah Johnson", email: "sarah@techstart.io", phone: "+1 555-0102", company: "TechStart Inc", totalBilled: 28750, outstanding: 8750 },
    { id: "3", name: "Michael Chen", email: "m.chen@globalsol.com", phone: "+1 555-0103", company: "Global Solutions", totalBilled: 62000, outstanding: 15200 },
    { id: "4", name: "Emily Davis", email: "emily@bluesky.co", phone: "+1 555-0104", company: "BlueSky Ltd", totalBilled: 18900, outstanding: 0 },
    { id: "5", name: "Robert Wilson", email: "r.wilson@pinnacle.com", phone: "+1 555-0105", company: "Pinnacle Group", totalBilled: 55000, outstanding: 22000 },
    { id: "6", name: "Lisa Anderson", email: "lisa@vertex.media", phone: "+1 555-0106", company: "Vertex Media", totalBilled: 14400, outstanding: 4800 },
  ];
}

export function getInitialSuppliers(): Supplier[] {
  return [
    { id: "1", name: "AWS Cloud Services", email: "billing@aws.com", phone: "+1 555-0201", company: "Amazon Web Services", totalPaid: 24000, outstanding: 3200 },
    { id: "2", name: "Office Supplies Co", email: "orders@officesupplies.com", phone: "+1 555-0202", company: "Office Supplies Co", totalPaid: 4800, outstanding: 0 },
    { id: "3", name: "Digital Marketing Pro", email: "contact@dmpro.com", phone: "+1 555-0203", company: "DM Pro Agency", totalPaid: 18000, outstanding: 6000 },
    { id: "4", name: "CloudHost Inc", email: "support@cloudhost.com", phone: "+1 555-0204", company: "CloudHost Inc", totalPaid: 9600, outstanding: 1600 },
  ];
}

export function getInitialExpenses(): Expense[] {
  return [
    { id: "1", date: "2025-02-12", category: "Software", description: "SaaS subscriptions", amount: 2400, paymentMethod: "Credit Card" },
    { id: "2", date: "2025-02-10", category: "Office", description: "Office rent - February", amount: 5500, paymentMethod: "Bank Transfer" },
    { id: "3", date: "2025-02-08", category: "Marketing", description: "Google Ads campaign", amount: 3200, paymentMethod: "Credit Card" },
    { id: "4", date: "2025-02-06", category: "Utilities", description: "Internet & phone", amount: 450, paymentMethod: "Auto-debit" },
    { id: "5", date: "2025-02-04", category: "Travel", description: "Client meeting travel", amount: 1800, paymentMethod: "Credit Card" },
    { id: "6", date: "2025-02-02", category: "Payroll", description: "Staff salaries", amount: 42000, paymentMethod: "Bank Transfer" },
    { id: "7", date: "2025-01-30", category: "Insurance", description: "Business insurance", amount: 1200, paymentMethod: "Bank Transfer" },
  ];
}

export function getInitialInventory(): InventoryItem[] {
  return [
    { id: "1", name: "Laptop - Dell XPS 15", sku: "LAP-001", qty: 12, reorderLevel: 5, price: 1299, category: "Electronics" },
    { id: "2", name: "Wireless Mouse", sku: "ACC-002", qty: 45, reorderLevel: 20, price: 29, category: "Accessories" },
    { id: "3", name: "USB-C Hub", sku: "ACC-003", qty: 3, reorderLevel: 10, price: 59, category: "Accessories" },
    { id: "4", name: "Monitor - LG 27\"", sku: "MON-001", qty: 8, reorderLevel: 5, price: 449, category: "Electronics" },
    { id: "5", name: "Keyboard Mechanical", sku: "ACC-004", qty: 2, reorderLevel: 10, price: 89, category: "Accessories" },
    { id: "6", name: "Office Chair", sku: "FUR-001", qty: 15, reorderLevel: 5, price: 350, category: "Furniture" },
  ];
}

// Keep backward compat exports
export const invoices = getInitialInvoices();
export const customers = getInitialCustomers();
export const suppliers = getInitialSuppliers();
export const expenses = getInitialExpenses();

export const recentTransactions = [
  { id: "1", date: "2025-02-13", description: "Payment from Acme Corp", amount: 12500, type: "credit" as const },
  { id: "2", date: "2025-02-12", description: "SaaS subscriptions", amount: -2400, type: "debit" as const },
  { id: "3", date: "2025-02-11", description: "Payment from BlueSky Ltd", amount: 6300, type: "credit" as const },
  { id: "4", date: "2025-02-10", description: "Office rent", amount: -5500, type: "debit" as const },
  { id: "5", date: "2025-02-09", description: "Google Ads", amount: -3200, type: "debit" as const },
];
