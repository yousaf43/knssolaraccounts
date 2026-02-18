import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Customer, Supplier, InventoryItem, Invoice, SalesOrder,
  Receipt, Expense, PurchaseOrder, Bill, PurchasePayment, StockAdjustment
} from "@/data/mockData";

// =================== MAPPERS ===================

// Customer
const customerFromDb = (r: Record<string, unknown>): Customer => ({
  id: r.id as string,
  name: r.name as string,
  email: (r.email as string) || "",
  phone: (r.phone as string) || "",
  company: (r.company as string) || "",
  address: (r.address as string) || "",
  totalBilled: Number(r.total_billed) || 0,
  outstanding: Number(r.outstanding) || 0,
});
const customerToDb = (c: Customer, userId: string) => ({
  id: c.id, user_id: userId, name: c.name, email: c.email, phone: c.phone,
  company: c.company, address: c.address, total_billed: c.totalBilled, outstanding: c.outstanding,
});

// Supplier
const supplierFromDb = (r: Record<string, unknown>): Supplier => ({
  id: r.id as string, name: r.name as string, email: (r.email as string) || "",
  phone: (r.phone as string) || "", company: (r.company as string) || "",
  address: (r.address as string) || "", totalPaid: Number(r.total_paid) || 0,
  outstanding: Number(r.outstanding) || 0,
});
const supplierToDb = (s: Supplier, userId: string) => ({
  id: s.id, user_id: userId, name: s.name, email: s.email, phone: s.phone,
  company: s.company, address: s.address, total_paid: s.totalPaid, outstanding: s.outstanding,
});

// Inventory
const inventoryFromDb = (r: Record<string, unknown>): InventoryItem => ({
  id: r.id as string, name: r.name as string, sku: (r.sku as string) || "",
  qty: Number(r.qty) || 0, reorderLevel: Number(r.reorder_level) || 5,
  price: Number(r.price) || 0, category: (r.category as string) || "",
  date: (r.date as string) || "", costPrice: Number(r.cost_price) || 0,
  salePrice: Number(r.sale_price) || 0, unit: (r.unit as string) || "pcs",
  weight: Number(r.weight) || 0, stockAssetAccount: (r.stock_asset_account as string) || "Inventory Asset",
  saleDiscount: Number(r.sale_discount) || 0, purchaseDiscount: Number(r.purchase_discount) || 0,
  productType: (r.product_type as InventoryItem["productType"]) || "stock",
  bundleItems: (r.bundle_items as InventoryItem["bundleItems"]) || [],
});
const inventoryToDb = (i: InventoryItem, userId: string) => ({
  id: i.id, user_id: userId, name: i.name, sku: i.sku, qty: i.qty, reorder_level: i.reorderLevel,
  price: i.price, category: i.category, date: i.date, cost_price: i.costPrice,
  sale_price: i.salePrice, unit: i.unit, weight: i.weight, stock_asset_account: i.stockAssetAccount,
  sale_discount: i.saleDiscount, purchase_discount: i.purchaseDiscount,
  product_type: i.productType || "stock", bundle_items: i.bundleItems || [],
});

// Invoice
const invoiceFromDb = (r: Record<string, unknown>): Invoice => ({
  id: r.id as string, number: (r.number as string) || "",
  documentNumber: (r.document_number as string) || undefined,
  projectName: (r.project_name as string) || undefined,
  customer: (r.customer as string) || "", date: (r.date as string) || "",
  dueDate: (r.due_date as string) || "", amount: Number(r.amount) || 0,
  status: (r.status as Invoice["status"]) || "pending",
  items: (r.items as Invoice["items"]) || [],
  notes: (r.notes as string) || "", tax: Number(r.tax) || 0,
  payments: (r.payments as Invoice["payments"]) || [],
});
const invoiceToDb = (i: Invoice, userId: string) => ({
  id: i.id, user_id: userId, number: i.number, document_number: i.documentNumber || "",
  project_name: i.projectName || "", customer: i.customer, date: i.date, due_date: i.dueDate,
  amount: i.amount, status: i.status, items: i.items || [], notes: i.notes || "",
  tax: i.tax || 0, payments: i.payments || [],
});

// SalesOrder
const salesOrderFromDb = (r: Record<string, unknown>): SalesOrder => ({
  id: r.id as string, number: (r.number as string) || "",
  projectName: (r.project_name as string) || undefined,
  customer: (r.customer as string) || "", date: (r.date as string) || "",
  deliveryDate: (r.delivery_date as string) || "", amount: Number(r.amount) || 0,
  status: (r.status as SalesOrder["status"]) || "pending",
  items: (r.items as SalesOrder["items"]) || [],
  notes: (r.notes as string) || "", tax: Number(r.tax) || 0,
  advancePayment: Number(r.advance_payment) || 0,
  advancePaymentMethod: (r.advance_payment_method as string) || undefined,
  advancePaymentRef: (r.advance_payment_ref as string) || undefined,
});
const salesOrderToDb = (s: SalesOrder, userId: string) => ({
  id: s.id, user_id: userId, number: s.number, project_name: s.projectName || "",
  customer: s.customer, date: s.date, delivery_date: s.deliveryDate,
  amount: s.amount, status: s.status, items: s.items || [], notes: s.notes || "",
  tax: s.tax || 0, advance_payment: s.advancePayment || 0,
  advance_payment_method: s.advancePaymentMethod || "",
  advance_payment_ref: s.advancePaymentRef || "",
});

// Receipt
const receiptFromDb = (r: Record<string, unknown>): Receipt => ({
  id: r.id as string, number: (r.number as string) || "", customer: (r.customer as string) || "",
  date: (r.date as string) || "", invoiceNumber: (r.invoice_number as string) || "",
  amount: Number(r.amount) || 0, paymentMethod: (r.payment_method as string) || "cash",
  reference: (r.reference as string) || "", notes: (r.notes as string) || "",
});
const receiptToDb = (r: Receipt, userId: string) => ({
  id: r.id, user_id: userId, number: r.number, customer: r.customer, date: r.date,
  invoice_number: r.invoiceNumber, amount: r.amount, payment_method: r.paymentMethod,
  reference: r.reference || "", notes: r.notes || "",
});

// Expense
const expenseFromDb = (r: Record<string, unknown>): Expense => ({
  id: r.id as string, date: (r.date as string) || "", category: (r.category as string) || "",
  description: (r.description as string) || "", amount: Number(r.amount) || 0,
  paymentMethod: (r.payment_method as string) || "",
});
const expenseToDb = (e: Expense, userId: string) => ({
  id: e.id, user_id: userId, date: e.date, category: e.category,
  description: e.description, amount: e.amount, payment_method: e.paymentMethod,
});

// PurchaseOrder
const purchaseOrderFromDb = (r: Record<string, unknown>): PurchaseOrder => ({
  id: r.id as string, number: (r.number as string) || "", supplier: (r.supplier as string) || "",
  date: (r.date as string) || "", deliveryDate: (r.delivery_date as string) || "",
  amount: Number(r.amount) || 0, status: (r.status as PurchaseOrder["status"]) || "pending",
  items: (r.items as PurchaseOrder["items"]) || [], notes: (r.notes as string) || "",
  tax: Number(r.tax) || 0,
});
const purchaseOrderToDb = (p: PurchaseOrder, userId: string) => ({
  id: p.id, user_id: userId, number: p.number, supplier: p.supplier, date: p.date,
  delivery_date: p.deliveryDate, amount: p.amount, status: p.status,
  items: p.items || [], notes: p.notes || "", tax: p.tax || 0,
});

// Bill
const billFromDb = (r: Record<string, unknown>): Bill => ({
  id: r.id as string, number: (r.number as string) || "", supplier: (r.supplier as string) || "",
  date: (r.date as string) || "", dueDate: (r.due_date as string) || "",
  amount: Number(r.amount) || 0, status: (r.status as Bill["status"]) || "pending",
  items: (r.items as Bill["items"]) || [], notes: (r.notes as string) || "",
  tax: Number(r.tax) || 0,
});
const billToDb = (b: Bill, userId: string) => ({
  id: b.id, user_id: userId, number: b.number, supplier: b.supplier, date: b.date,
  due_date: b.dueDate, amount: b.amount, status: b.status,
  items: b.items || [], notes: b.notes || "", tax: b.tax || 0,
});

// PurchasePayment
const purchasePaymentFromDb = (r: Record<string, unknown>): PurchasePayment => ({
  id: r.id as string, number: (r.number as string) || "", supplier: (r.supplier as string) || "",
  date: (r.date as string) || "", billNumber: (r.bill_number as string) || "",
  amount: Number(r.amount) || 0, paymentMethod: (r.payment_method as string) || "cash",
  reference: (r.reference as string) || "", notes: (r.notes as string) || "",
});
const purchasePaymentToDb = (p: PurchasePayment, userId: string) => ({
  id: p.id, user_id: userId, number: p.number, supplier: p.supplier, date: p.date,
  bill_number: p.billNumber, amount: p.amount, payment_method: p.paymentMethod,
  reference: p.reference || "", notes: p.notes || "",
});

// StockAdjustment
const stockAdjFromDb = (r: Record<string, unknown>): StockAdjustment => ({
  id: r.id as string, itemId: (r.item_id as string) || "", itemName: (r.item_name as string) || "",
  type: (r.type as "increase" | "decrease") || "increase", qty: Number(r.qty) || 0,
  reason: (r.reason as string) || "", date: (r.date as string) || "",
  note: (r.note as string) || "",
});
const stockAdjToDb = (s: StockAdjustment, userId: string) => ({
  id: s.id, user_id: userId, item_id: s.itemId, item_name: s.itemName,
  type: s.type, qty: s.qty, reason: s.reason, date: s.date, note: s.note || "",
});

// =================== GENERIC HOOK ===================

function useTable<T extends { id: string }>(
  tableName: string,
  fromDb: (r: Record<string, unknown>) => T,
  toDb: (item: T, userId: string) => Record<string, unknown>,
  orderCol: string = "created_at"
) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await supabase
      .from(tableName as never)
      .select("*")
      .eq("user_id", user.id)
      .order(orderCol, { ascending: false });
    if (rows) setData((rows as Record<string, unknown>[]).map(fromDb));
    setLoading(false);
  }, [user, tableName, orderCol]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = useCallback(async (item: T) => {
    if (!user) return;
    const row = toDb(item, user.id);
    await supabase.from(tableName as never).upsert(row as never, { onConflict: "id" });
    setData((prev) => {
      const exists = prev.find((d) => d.id === item.id);
      return exists ? prev.map((d) => d.id === item.id ? item : d) : [item, ...prev];
    });
  }, [user, tableName, toDb]);

  const remove = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from(tableName as never).delete().eq("id", id).eq("user_id", user.id);
    setData((prev) => prev.filter((d) => d.id !== id));
  }, [user, tableName]);

  // Replace all items (for bulk operations like inventory set)
  const replaceAll = useCallback(async (items: T[]) => {
    if (!user) return;
    await supabase.from(tableName as never).delete().eq("user_id", user.id);
    if (items.length > 0) {
      const rows = items.map((item) => toDb(item, user.id));
      await supabase.from(tableName as never).insert(rows as never);
    }
    setData(items);
  }, [user, tableName, toDb]);

  return { data, setData, loading, fetch, upsert, remove, replaceAll };
}

// =================== EXPORTS ===================

export const useCustomersCloud = () => useTable("customers", customerFromDb, customerToDb);
export const useSuppliersCloud = () => useTable("suppliers", supplierFromDb, supplierToDb);
export const useInventoryCloud = () => useTable("inventory", inventoryFromDb, inventoryToDb);
export const useInvoicesCloud = () => useTable("invoices", invoiceFromDb, invoiceToDb);
export const useSalesOrdersCloud = () => useTable("sales_orders", salesOrderFromDb, salesOrderToDb);
export const useReceiptsCloud = () => useTable("receipts", receiptFromDb, receiptToDb);
export const useExpensesCloud = () => useTable("expenses", expenseFromDb, expenseToDb);
export const usePurchaseOrdersCloud = () => useTable("purchase_orders", purchaseOrderFromDb, purchaseOrderToDb);
export const useBillsCloud = () => useTable("bills", billFromDb, billToDb);
export const usePurchasePaymentsCloud = () => useTable("purchase_payments", purchasePaymentFromDb, purchasePaymentToDb);
export const useStockAdjustmentsCloud = () => useTable("stock_adjustments", stockAdjFromDb, stockAdjToDb, "created_at");

// User Settings
export function useUserSettingsCloud() {
  const { user } = useAuth();
  const [customUnits, setCustomUnitsState] = useState<string[]>([]);
  const [customAccounts, setCustomAccountsState] = useState<string[]>([]);
  const [customCategories, setCustomCategoriesState] = useState<string[]>([]);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
    if (data) {
      setCustomUnitsState((data.custom_units as string[]) || []);
      setCustomAccountsState((data.custom_accounts as string[]) || []);
      setCustomCategoriesState((data.custom_categories as string[]) || []);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (units: string[], accounts: string[], categories: string[]) => {
    if (!user) return;
    await supabase.from("user_settings").upsert({
      user_id: user.id,
      custom_units: units,
      custom_accounts: accounts,
      custom_categories: categories,
    }, { onConflict: "user_id" });
  }, [user]);

  const setCustomUnits = useCallback(async (fn: string[] | ((prev: string[]) => string[])) => {
    setCustomUnitsState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      save(next, customAccounts, customCategories);
      return next;
    });
  }, [customAccounts, customCategories, save]);

  const setCustomAccounts = useCallback(async (fn: string[] | ((prev: string[]) => string[])) => {
    setCustomAccountsState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      save(customUnits, next, customCategories);
      return next;
    });
  }, [customUnits, customCategories, save]);

  const setCustomCategories = useCallback(async (fn: string[] | ((prev: string[]) => string[])) => {
    setCustomCategoriesState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      save(customUnits, customAccounts, next);
      return next;
    });
  }, [customUnits, customAccounts, save]);

  return { customUnits, customAccounts, customCategories, setCustomUnits, setCustomAccounts, setCustomCategories };
}
