import { useState, useRef, useEffect, useMemo } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import {
  type PurchaseOrder, type Bill, type PurchasePayment, type Supplier, type InvoiceItem, type InventoryItem,
} from "@/data/mockData";
import { usePurchaseOrdersCloud, useBillsCloud, usePurchasePaymentsCloud, useSuppliersCloud, useInventoryCloud } from "@/hooks/useAppData";
import { ProductCombobox } from "@/components/ProductCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, X, Upload, Download, UserPlus, ShoppingBag, FileText, CreditCard, List, Users } from "lucide-react";
import { StickyPageHeader } from "@/components/StickyPageHeader";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";

function isInDateRange(dateStr: string, range: string, from: string, to: string) {
  if (range === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (range === "today") return d.toDateString() === now.toDateString();
  if (range === "7") return d >= new Date(now.getTime() - 7 * 86400000);
  if (range === "30") return d >= new Date(now.getTime() - 30 * 86400000);
  if (range === "90") return d >= new Date(now.getTime() - 90 * 86400000);
  if (range === "year") return d.getFullYear() === now.getFullYear();
  if (range === "custom") {
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to)) return false;
    return true;
  }
  return true;
}

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  confirmed: "bg-blue-100 text-blue-700",
  received: "bg-emerald-100 text-emerald-700",
  shipped: "bg-indigo-100 text-indigo-700",
  cancelled: "bg-muted text-muted-foreground",
};

const emptyItem = (): InvoiceItem => ({ description: "", qty: 1, rate: 0, amount: 0 });
const today = () => new Date().toISOString().split("T")[0];

export default function Purchases() {
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { moveToTrash } = useTrash();
  const [tab, setTab] = useState("purchase-orders");

  // Data
  const { data: purchaseOrders, upsert: upsertPO, remove: removePO, setData: setPurchaseOrders } = usePurchaseOrdersCloud();
  const { data: bills, upsert: upsertBill, remove: removeBill, setData: setBills } = useBillsCloud();
  const { data: payments, upsert: upsertPayment, remove: removePayment, setData: setPayments } = usePurchasePaymentsCloud();
  const { data: suppliers, upsert: upsertSupplier, remove: removeSupplier, setData: setSuppliers } = useSuppliersCloud();
  const { data: inventoryAll, upsert: upsertInventory } = useInventoryCloud();

  // Main-only inventory (deduped by SKU/uniqueCode/name) for product picker
  const mainInventory = useMemo(() => {
    const mains = inventoryAll.filter(i => (i.location || "main") === "main");
    const seen = new Set<string>();
    return mains.filter(i => {
      const key = (i.uniqueCode || i.sku || i.name).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [inventoryAll]);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  // PO Form
  const [showPOForm, setShowPOForm] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [poForm, setPOForm] = useState({ supplier: "", date: today(), deliveryDate: "", status: "pending" as PurchaseOrder["status"], notes: "", tax: 10 });
  const [poItems, setPOItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [showPOQuickSupplier, setShowPOQuickSupplier] = useState(false);
  const [poQuickSupplier, setPOQuickSupplier] = useState({ name: "", company: "", email: "", phone: "" });

  // Bill Form
  const [showBillForm, setShowBillForm] = useState(false);
  const [billForm, setBillForm] = useState({ supplier: "", date: today(), dueDate: "", status: "pending" as Bill["status"], notes: "", tax: 10 });
  const [billItems, setBillItems] = useState<InvoiceItem[]>([emptyItem()]);

  // Payment Form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ supplier: "", date: today(), billNumber: "", amount: 0, paymentMethod: "Bank Transfer", reference: "", notes: "" });

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ name: "", email: "", phone: "", company: "", address: "", totalPaid: 0, outstanding: 0 });

  // Import refs
  const poFileRef = useRef<HTMLInputElement>(null);
  const billFileRef = useRef<HTMLInputElement>(null);

  // Unique suppliers for filter
  const allSupplierNames = Array.from(new Set([
    ...purchaseOrders.map(p => p.supplier),
    ...bills.map(b => b.supplier),
    ...payments.map(p => p.supplier),
    ...suppliers.map(s => s.company),
  ]));

  const allStatuses = Array.from(new Set([
    ...purchaseOrders.map(p => p.status),
    ...bills.map(b => b.status),
  ]));

  const clearFilters = () => {
    setFilterSupplier("all"); setFilterStatus("all"); setFilterDateRange("all");
    setCustomDateFrom(""); setCustomDateTo("");
  };
  const hasFilters = filterSupplier !== "all" || filterStatus !== "all" || filterDateRange !== "all";

  // Filtered data
  const filteredPO = purchaseOrders.filter(p =>
    (filterSupplier === "all" || p.supplier === filterSupplier) &&
    (filterStatus === "all" || p.status === filterStatus) &&
    isInDateRange(p.date, filterDateRange, customDateFrom, customDateTo)
  );
  const filteredBills = bills.filter(b =>
    (filterSupplier === "all" || b.supplier === filterSupplier) &&
    (filterStatus === "all" || b.status === filterStatus) &&
    isInDateRange(b.date, filterDateRange, customDateFrom, customDateTo)
  );
  const filteredPayments = payments.filter(p =>
    (filterSupplier === "all" || p.supplier === filterSupplier) &&
    isInDateRange(p.date, filterDateRange, customDateFrom, customDateTo)
  );

  const allPurchasesData = [
    ...filteredPO.map(p => ({ ...p, type: "Purchase Order" as const })),
    ...filteredBills.map(b => ({ ...b, type: "Bill" as const })),
    ...filteredPayments.map(p => ({ ...p, type: "Payment" as const, status: "paid" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Pagination
  const pgPO = usePagination(filteredPO);
  const pgBills = usePagination(filteredBills);
  const pgPayments = usePagination(filteredPayments);
  const pgAllPurchases = usePagination(allPurchasesData);
  const pgSuppliers = usePagination(suppliers);

  useEffect(() => { pgPO.resetPage(); pgBills.resetPage(); pgPayments.resetPage(); pgAllPurchases.resetPage(); }, [filterSupplier, filterStatus, filterDateRange]);

  const handleExport = () => {
    let csv = "";
    if (tab === "purchase-orders") {
      csv = "Number,Supplier,Date,Delivery Date,Amount,Status\n" + filteredPO.map(p => `${p.number},${p.supplier},${p.date},${p.deliveryDate},${p.amount},${p.status}`).join("\n");
    } else if (tab === "bills") {
      csv = "Number,Supplier,Date,Due Date,Amount,Status\n" + filteredBills.map(b => `${b.number},${b.supplier},${b.date},${b.dueDate},${b.amount},${b.status}`).join("\n");
    } else if (tab === "payments") {
      csv = "Number,Supplier,Date,Bill,Amount,Method\n" + filteredPayments.map(p => `${p.number},${p.supplier},${p.date},${p.billNumber},${p.amount},${p.paymentMethod}`).join("\n");
    } else if (tab === "purchases-all") {
      csv = "Type,Date,Number,Supplier,Amount,Status\n" + allPurchasesData.map(p => `${p.type},${p.date},${"number" in p ? p.number : ""},${p.supplier},${p.amount},${"status" in p ? p.status : ""}`).join("\n");
    }
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tab}-export.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // Import CSV
  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(",");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = vals[i]?.trim() || ""));
      return obj;
    });
  };

  const handleImportPO = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      const newItems: PurchaseOrder[] = rows.map((r, i) => ({
        id: crypto.randomUUID(), number: r.number || `PO-IMP-${i + 1}`, supplier: r.supplier || "",
        date: r.date || today(), deliveryDate: r["delivery date"] || r.deliverydate || "",
        amount: parseFloat(r.amount) || 0, status: (r.status as PurchaseOrder["status"]) || "pending",
        items: [{ description: "Imported item", qty: parseFloat(r.quantity || r.qty || "1"), rate: parseFloat(r.price || r.rate || "0"), amount: parseFloat(r.amount) || 0 }],
      }));
      newItems.forEach(item => upsertPO(item));
      setPurchaseOrders(prev => [...prev, ...newItems]);
      toast.success(`${newItems.length} purchase orders imported`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportBills = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      const newItems: Bill[] = rows.map((r, i) => ({
        id: crypto.randomUUID(), number: r.number || `BILL-IMP-${i + 1}`, supplier: r.supplier || "",
        date: r.date || today(), dueDate: r["due date"] || r.duedate || "",
        amount: parseFloat(r.amount) || 0, status: (r.status as Bill["status"]) || "pending",
        items: [{ description: "Imported item", qty: parseFloat(r.quantity || r.qty || "1"), rate: parseFloat(r.price || r.rate || "0"), amount: parseFloat(r.amount) || 0 }],
      }));
      newItems.forEach(item => upsertBill(item));
      setBills(prev => [...prev, ...newItems]);
      toast.success(`${newItems.length} bills imported`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---- Line items helpers ----
  const updateItem = (items: InvoiceItem[], setItems: (v: InvoiceItem[]) => void, idx: number, field: keyof InvoiceItem, val: string) => {
    const updated = [...items];
    if (field === "description" || field === "inventoryItemId") {
      (updated[idx] as any)[field] = val;
    } else {
      (updated[idx] as any)[field] = parseFloat(val) || 0;
      updated[idx].amount = updated[idx].qty * updated[idx].rate;
    }
    setItems(updated);
  };

  const selectProductForItem = (items: InvoiceItem[], setItems: (v: InvoiceItem[]) => void, idx: number, inventoryItemId: string) => {
    const inv = mainInventory.find(i => i.id === inventoryItemId);
    if (!inv) return;
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      inventoryItemId: inv.id,
      description: inv.name,
      rate: updated[idx].rate || inv.costPrice || 0,
      qty: updated[idx].qty || 1,
    };
    updated[idx].amount = updated[idx].qty * updated[idx].rate;
    setItems(updated);
  };

  const calcTotal = (items: InvoiceItem[], tax: number) => {
    const sub = items.reduce((s, i) => s + i.amount, 0);
    return sub + sub * (tax / 100);
  };

  const applyPurchaseToInventory = async (items: InvoiceItem[]) => {
    // Only quantity is updated on PO save. Cost/Sale prices stay user-controlled in Inventory.
    for (const it of items) {
      if (!it.inventoryItemId || it.qty <= 0) continue;
      const main = inventoryAll.find(i => i.id === it.inventoryItemId);
      if (!main) continue;
      const addQty = it.qty;

      await upsertInventory({
        ...main,
        qty: (main.qty || 0) + addQty,
      } as InventoryItem);

      // Mirror qty to store inventory (match by uniqueCode/sku/name)
      const key = (main.uniqueCode || main.sku || main.name).trim().toLowerCase();
      const storeMirror = inventoryAll.find(i => (i.location === "store") && (
        (i.uniqueCode || i.sku || i.name).trim().toLowerCase() === key
      ));
      if (storeMirror) {
        await upsertInventory({
          ...storeMirror,
          qty: (storeMirror.qty || 0) + addQty,
        } as InventoryItem);
      }
    }
  };

  // ---- PO CRUD ----
  const openNewPO = () => {
    setEditingPO(null);
    setPOForm({ supplier: "", date: today(), deliveryDate: "", status: "pending", notes: "", tax: 10 });
    setPOItems([emptyItem()]);
    setShowPOForm(true);
  };
  const openEditPO = (po: PurchaseOrder) => {
    setEditingPO(po);
    setPOForm({
      supplier: po.supplier,
      date: po.date,
      deliveryDate: po.deliveryDate || "",
      status: po.status,
      notes: po.notes || "",
      tax: po.tax ?? 0,
    });
    setPOItems(po.items && po.items.length ? po.items.map(it => ({ ...it })) : [emptyItem()]);
    setShowPOForm(true);
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplier) return;
    const total = calcTotal(poItems, poForm.tax);
    if (editingPO) {
      // Compute qty diff per inventory item and apply to stock
      const oldMap = new Map<string, number>();
      (editingPO.items || []).forEach(it => {
        if (it.inventoryItemId) oldMap.set(it.inventoryItemId, (oldMap.get(it.inventoryItemId) || 0) + (it.qty || 0));
      });
      const newMap = new Map<string, number>();
      poItems.forEach(it => {
        if (it.inventoryItemId) newMap.set(it.inventoryItemId, (newMap.get(it.inventoryItemId) || 0) + (it.qty || 0));
      });
      const diffItems: InvoiceItem[] = [];
      const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
      ids.forEach(id => {
        const diff = (newMap.get(id) || 0) - (oldMap.get(id) || 0);
        if (diff !== 0) diffItems.push({ description: "", qty: diff, rate: 0, amount: 0, inventoryItemId: id });
      });
      const updated: PurchaseOrder = { ...editingPO, supplier: poForm.supplier, date: poForm.date, deliveryDate: poForm.deliveryDate, amount: total, status: poForm.status, items: poItems, notes: poForm.notes, tax: poForm.tax };
      upsertPO(updated);
      setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (diffItems.length) await applyPurchaseToInventory(diffItems);
      await log("update", "purchase_order", updated.id, updated.number, `Supplier: ${poForm.supplier}, Amount: ${total}`);
      toast.success("Purchase Order updated");
    } else {
      const num = `PO-${String(purchaseOrders.length + 1).padStart(3, "0")}`;
      const newPO = { id: crypto.randomUUID(), number: num, supplier: poForm.supplier, date: poForm.date, deliveryDate: poForm.deliveryDate, amount: total, status: poForm.status, items: poItems, notes: poForm.notes, tax: poForm.tax };
      upsertPO(newPO);
      setPurchaseOrders(prev => [...prev, newPO]);
      await applyPurchaseToInventory(poItems);
      await log("create", "purchase_order", newPO.id, num, `Supplier: ${poForm.supplier}, Amount: ${total}`);
      toast.success("Purchase Order created");
    }
    setShowPOForm(false);
    setEditingPO(null);
    setPOItems([emptyItem()]);
    setPOForm({ supplier: "", date: today(), deliveryDate: "", status: "pending", notes: "", tax: 10 });
  };

  // ---- Bill CRUD ----
  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billForm.supplier) return;
    const total = calcTotal(billItems, billForm.tax);
    const num = `BILL-${String(bills.length + 1).padStart(3, "0")}`;
    const newBill = { id: crypto.randomUUID(), number: num, supplier: billForm.supplier, date: billForm.date, dueDate: billForm.dueDate, amount: total, status: billForm.status, items: billItems, notes: billForm.notes, tax: billForm.tax };
    upsertBill(newBill);
    setBills(prev => [...prev, newBill]);
    setShowBillForm(false);
    setBillItems([emptyItem()]);
    setBillForm({ supplier: "", date: today(), dueDate: "", status: "pending", notes: "", tax: 10 });
    await log("create", "bill", newBill.id, num, `Supplier: ${billForm.supplier}, Amount: ${total}`);
    toast.success("Bill created");
  };

  // ---- Payment CRUD ----
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.supplier || !paymentForm.amount) return;
    const num = `PP-${String(payments.length + 1).padStart(3, "0")}`;
    const newPayment = { id: crypto.randomUUID(), number: num, supplier: paymentForm.supplier, date: paymentForm.date, billNumber: paymentForm.billNumber, amount: paymentForm.amount, paymentMethod: paymentForm.paymentMethod, reference: paymentForm.reference, notes: paymentForm.notes };
    upsertPayment(newPayment);
    setPayments(prev => [...prev, newPayment]);
    setShowPaymentForm(false);
    setPaymentForm({ supplier: "", date: today(), billNumber: "", amount: 0, paymentMethod: "Bank Transfer", reference: "", notes: "" });
    await log("create", "purchase_payment", newPayment.id, num, `Supplier: ${paymentForm.supplier}, Amount: ${paymentForm.amount}`);
    toast.success("Payment recorded");
  };

  // Supplier CRUD
  const openAddSupplier = () => { setEditingSupplier(null); setSupplierForm({ name: "", email: "", phone: "", company: "", address: "", totalPaid: 0, outstanding: 0 }); setShowSupplierForm(true); };
  const openEditSupplier = (s: Supplier) => { setEditingSupplier(s); setSupplierForm(s); setShowSupplierForm(true); };
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name?.trim() || !supplierForm.email?.trim() || !supplierForm.company?.trim()) return;
    if (editingSupplier) {
      upsertSupplier({ ...editingSupplier, ...supplierForm } as Supplier);
      toast.success("Supplier updated");
    } else {
      upsertSupplier({ ...supplierForm, id: crypto.randomUUID(), totalPaid: 0, outstanding: 0 } as Supplier);
      toast.success("Supplier added");
    }
    setShowSupplierForm(false);
  };
  const handleDeleteSupplier = (id: string) => { removeSupplier(id); toast.success("Supplier deleted"); };

  // Delete handlers
  const handleDeletePO = async (id: string) => {
    const po = purchaseOrders.find(p => p.id === id);
    if (po) { await moveToTrash("purchase_order", id, po); await log("delete", "purchase_order", id, po.number, `Supplier: ${po.supplier}`); }
    removePO(id); toast.success("Purchase order deleted");
  };
  const handleDeleteBill = async (id: string) => {
    const b = bills.find(bl => bl.id === id);
    if (b) { await moveToTrash("bill", id, b); await log("delete", "bill", id, b.number, `Supplier: ${b.supplier}`); }
    removeBill(id); toast.success("Bill deleted");
  };
  const handleDeletePayment = async (id: string) => {
    const p = payments.find(pm => pm.id === id);
    if (p) { await moveToTrash("purchase_payment", id, p); await log("delete", "purchase_payment", id, p.number, `Supplier: ${p.supplier}`); }
    removePayment(id); toast.success("Payment deleted");
  };

  // Reusable Line Items Editor
  const LineItemsEditor = ({ items, setItems }: { items: InvoiceItem[]; setItems: (v: InvoiceItem[]) => void }) => (
    <div className="space-y-2">
      <Label className="font-semibold">Line Items</Label>
      <div className="grid grid-cols-[220px_1fr_80px_100px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
        <span>Product</span><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span />
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[220px_1fr_80px_100px_100px_40px] gap-2 items-start">
          <ProductCombobox
            inventory={mainInventory}
            selectedItemId={item.inventoryItemId}
            onSelect={(id) => selectProductForItem(items, setItems, i, id)}
          />
          <Input value={item.description} onChange={e => updateItem(items, setItems, i, "description", e.target.value)} placeholder="Item description" className="h-8 text-sm" />
          <Input type="number" value={item.qty} onChange={e => updateItem(items, setItems, i, "qty", e.target.value)} className="h-8 text-sm" min={1} />
          <Input type="number" value={item.rate} onChange={e => updateItem(items, setItems, i, "rate", e.target.value)} className="h-8 text-sm" min={0} />
          <Input value={formatCurrency(item.amount)} className="h-8 text-sm bg-muted" readOnly />
          <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/10" disabled={items.length === 1}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, emptyItem()])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
      </Button>
    </div>
  );

  // Filter bar
  const FilterBar = () => (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-card border rounded-lg">
      <div>
        <Label className="text-xs text-muted-foreground">Order Status</Label>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {allStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Suppliers</Label>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {allSupplierNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Date Range</Label>
        <Select value={filterDateRange} onValueChange={setFilterDateRange}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filterDateRange === "custom" && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} className="w-36 h-8 text-xs" />
          </div>
        </>
      )}
      {hasFilters && <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">Clear</Button>}
    </div>
  );

  // Add button per tab
  const getAddButton = () => {
    if (tab === "purchase-orders") return <Button size="sm" onClick={openNewPO}><Plus className="w-4 h-4 mr-1" /> New PO</Button>;
    if (tab === "bills") return <Button size="sm" onClick={() => setShowBillForm(true)}><Plus className="w-4 h-4 mr-1" /> New Bill</Button>;
    if (tab === "payments") return <Button size="sm" onClick={() => setShowPaymentForm(true)}><Plus className="w-4 h-4 mr-1" /> New Payment</Button>;
    return null;
  };

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <StickyPageHeader
          icon={ShoppingBag}
          title="Purchases"
          subtitle="Manage purchase orders, bills, payments & suppliers"
          actionsFull={
            <>
              {getAddButton()}
              {(tab === "purchase-orders" || tab === "bills") && (
                <>
                  <input type="file" accept=".csv" ref={tab === "purchase-orders" ? poFileRef : billFileRef} className="hidden" onChange={tab === "purchase-orders" ? handleImportPO : handleImportBills} />
                  <Button variant="outline" size="sm" onClick={() => (tab === "purchase-orders" ? poFileRef : billFileRef).current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> Import
                  </Button>
                </>
              )}
              {tab !== "suppliers" && (
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" /> Export
                </Button>
              )}
            </>
          }
          actionsCompact={
            <>
              {(tab === "purchase-orders" || tab === "bills") && (
                <Button variant="outline" size="sm" className="h-7 px-2.5 rounded-full text-xs" onClick={() => (tab === "purchase-orders" ? poFileRef : billFileRef).current?.click()}>
                  <Upload className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              )}
              {tab !== "suppliers" && (
                <Button variant="outline" size="sm" className="h-7 px-2.5 rounded-full text-xs" onClick={handleExport}>
                  <Download className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              )}
              {(tab === "purchase-orders" || tab === "bills" || tab === "payments") && (
                <Button size="sm" className="h-7 px-2.5 text-xs rounded-full shadow-sm" onClick={() => {
                  if (tab === "purchase-orders") setShowPOForm(true);
                  else if (tab === "bills") setShowBillForm(true);
                  else if (tab === "payments") setShowPaymentForm(true);
                }}>
                  <Plus className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              )}
            </>
          }
          tabsFull={
            <TabsList>
              <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
              <TabsTrigger value="bills">Bills</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="purchases-all">Purchases All</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>
          }
          tabsCompact={
            <TabsList className="h-7 bg-muted/60 rounded-full p-0.5 gap-0.5 inline-flex w-auto flex-shrink-0">
              <TabsTrigger value="purchase-orders" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Purchase Orders"><ShoppingBag className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="bills" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Bills"><FileText className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="payments" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Payments"><CreditCard className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="purchases-all" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Purchases All"><List className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="suppliers" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Suppliers"><Users className="w-3.5 h-3.5" /></TabsTrigger>
            </TabsList>
          }
        />


        {/* Purchase Orders */}
        <TabsContent value="purchase-orders">
          {showPOForm && (
            <div className="bg-card rounded-lg border p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Create Purchase Order</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowPOForm(false)}><X className="w-4 h-4" /></Button>
              </div>
              <form onSubmit={handleSavePO} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Supplier *</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={poForm.supplier} onValueChange={v => setPOForm({ ...poForm, supplier: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" title="Quick add supplier" onClick={() => setShowPOQuickSupplier(!showPOQuickSupplier)}>
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                    {showPOQuickSupplier && (
                      <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Quick Add Supplier</p>
                        <Input value={poQuickSupplier.name} onChange={e => setPOQuickSupplier({ ...poQuickSupplier, name: e.target.value })} placeholder="Contact Name *" className="h-8" />
                        <Input value={poQuickSupplier.company} onChange={e => setPOQuickSupplier({ ...poQuickSupplier, company: e.target.value })} placeholder="Company *" className="h-8" />
                        <Input value={poQuickSupplier.email} onChange={e => setPOQuickSupplier({ ...poQuickSupplier, email: e.target.value })} placeholder="Email" className="h-8" />
                        <Input value={poQuickSupplier.phone} onChange={e => setPOQuickSupplier({ ...poQuickSupplier, phone: e.target.value })} placeholder="Phone" className="h-8" />
                        <div className="flex gap-2 justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPOQuickSupplier(false)}>Cancel</Button>
                          <Button type="button" size="sm" onClick={() => {
                            if (!poQuickSupplier.name.trim() || !poQuickSupplier.company.trim()) return;
                            const newS: Supplier = { id: crypto.randomUUID(), name: poQuickSupplier.name.trim(), company: poQuickSupplier.company.trim(), email: poQuickSupplier.email.trim(), phone: poQuickSupplier.phone.trim(), address: "", totalPaid: 0, outstanding: 0 };
                            upsertSupplier(newS);
                            setPOForm({ ...poForm, supplier: newS.company });
                            setShowPOQuickSupplier(false);
                            setPOQuickSupplier({ name: "", company: "", email: "", phone: "" });
                          }}>Add</Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div><Label>Date</Label><Input type="date" value={poForm.date} onChange={e => setPOForm({ ...poForm, date: e.target.value })} className="mt-1" /></div>
                  <div><Label>Delivery Date</Label><Input type="date" value={poForm.deliveryDate} onChange={e => setPOForm({ ...poForm, deliveryDate: e.target.value })} className="mt-1" /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={poForm.status} onValueChange={v => setPOForm({ ...poForm, status: v as PurchaseOrder["status"] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Tax %</Label><Input type="number" value={poForm.tax} onChange={e => setPOForm({ ...poForm, tax: parseFloat(e.target.value) || 0 })} className="mt-1" min={0} /></div>
                </div>
                <LineItemsEditor items={poItems} setItems={setPOItems} />
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold">Total: {formatCurrency(calcTotal(poItems, poForm.tax))}</div>
                  <div className="flex gap-3">
                    <Textarea placeholder="Notes (optional)" value={poForm.notes} onChange={e => setPOForm({ ...poForm, notes: e.target.value })} className="w-64 h-16 text-sm" />
                    <div className="flex gap-2 items-end">
                      <Button type="button" variant="outline" onClick={() => setShowPOForm(false)}>Cancel</Button>
                      <Button type="submit">Create PO</Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}
          {FilterBar()}
          <p className="text-xs text-muted-foreground mb-2">{filteredPO.length} purchase order(s)</p>
          <div className="bg-card rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Delivery Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {pgPO.paginatedItems.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.number}</td>
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3">{p.supplier}</td>
                    <td className="px-4 py-3">{p.deliveryDate}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-center"><ConfirmDeleteDialog onConfirm={() => handleDeletePO(p.id)} title="Delete Purchase Order?" description={`Delete PO ${p.number}?`} /></td>
                  </tr>
                ))}
                {filteredPO.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders found.</td></tr>}
              </tbody>
            </table>
            <TablePagination currentPage={pgPO.currentPage} totalPages={pgPO.totalPages} totalItems={pgPO.totalItems} onPageChange={pgPO.goToPage} itemLabel="order" />
          </div>
        </TabsContent>

        {/* Bills */}
        <TabsContent value="bills">
          {showBillForm && (
            <div className="bg-card rounded-lg border p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Create Bill</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowBillForm(false)}><X className="w-4 h-4" /></Button>
              </div>
              <form onSubmit={handleSaveBill} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={billForm.supplier} onValueChange={v => setBillForm({ ...billForm, supplier: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bill Date</Label><Input type="date" value={billForm.date} onChange={e => setBillForm({ ...billForm, date: e.target.value })} className="mt-1" /></div>
                  <div><Label>Due Date</Label><Input type="date" value={billForm.dueDate} onChange={e => setBillForm({ ...billForm, dueDate: e.target.value })} className="mt-1" /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={billForm.status} onValueChange={v => setBillForm({ ...billForm, status: v as Bill["status"] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Tax %</Label><Input type="number" value={billForm.tax} onChange={e => setBillForm({ ...billForm, tax: parseFloat(e.target.value) || 0 })} className="mt-1" min={0} /></div>
                </div>
                <LineItemsEditor items={billItems} setItems={setBillItems} />
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold">Total: {formatCurrency(calcTotal(billItems, billForm.tax))}</div>
                  <div className="flex gap-3">
                    <Textarea placeholder="Notes (optional)" value={billForm.notes} onChange={e => setBillForm({ ...billForm, notes: e.target.value })} className="w-64 h-16 text-sm" />
                    <div className="flex gap-2 items-end">
                      <Button type="button" variant="outline" onClick={() => setShowBillForm(false)}>Cancel</Button>
                      <Button type="submit">Create Bill</Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}
          {FilterBar()}
          <p className="text-xs text-muted-foreground mb-2">{filteredBills.length} bill(s)</p>
          <div className="bg-card rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {pgBills.paginatedItems.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{b.number}</td>
                    <td className="px-4 py-3">{b.date}</td>
                    <td className="px-4 py-3">{b.supplier}</td>
                    <td className="px-4 py-3">{b.dueDate}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(b.amount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[b.status]}`}>{b.status}</span></td>
                    <td className="px-4 py-3 text-center"><ConfirmDeleteDialog onConfirm={() => handleDeleteBill(b.id)} title="Delete Bill?" description={`Delete bill ${b.number}?`} /></td>
                  </tr>
                ))}
                {filteredBills.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No bills found.</td></tr>}
              </tbody>
            </table>
            <TablePagination currentPage={pgBills.currentPage} totalPages={pgBills.totalPages} totalItems={pgBills.totalItems} onPageChange={pgBills.goToPage} itemLabel="bill" />
          </div>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          {showPaymentForm && (
            <div className="bg-card rounded-lg border p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Record Payment</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowPaymentForm(false)}><X className="w-4 h-4" /></Button>
              </div>
              <form onSubmit={handleSavePayment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={paymentForm.supplier} onValueChange={v => setPaymentForm({ ...paymentForm, supplier: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} className="mt-1" /></div>
                  <div>
                    <Label>Bill Number</Label>
                    <Select value={paymentForm.billNumber} onValueChange={v => setPaymentForm({ ...paymentForm, billNumber: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select bill" /></SelectTrigger>
                      <SelectContent>
                        {bills.filter(b => !paymentForm.supplier || b.supplier === paymentForm.supplier).map(b => (
                          <SelectItem key={b.id} value={b.number}>{b.number} - {formatCurrency(b.amount)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount *</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })} className="mt-1" min={0} required /></div>
                  <div>
                    <Label>Payment Method</Label>
                    <Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Reference</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="mt-1" placeholder="Transaction reference" /></div>
                </div>
                <Textarea placeholder="Notes (optional)" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="h-16 text-sm" />
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                  <Button type="submit">Record Payment</Button>
                </div>
              </form>
            </div>
          )}
          {FilterBar()}
          <p className="text-xs text-muted-foreground mb-2">{filteredPayments.length} payment(s)</p>
          <div className="bg-card rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {pgPayments.paginatedItems.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.number}</td>
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3">{p.supplier}</td>
                    <td className="px-4 py-3">{p.billNumber}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">{p.paymentMethod}</td>
                    <td className="px-4 py-3 text-center"><ConfirmDeleteDialog onConfirm={() => handleDeletePayment(p.id)} title="Delete Payment?" description={`Delete payment ${p.number}?`} /></td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No payments found.</td></tr>}
              </tbody>
            </table>
            <TablePagination currentPage={pgPayments.currentPage} totalPages={pgPayments.totalPages} totalItems={pgPayments.totalItems} onPageChange={pgPayments.goToPage} itemLabel="payment" />
          </div>
        </TabsContent>

        {/* Purchases All */}
        <TabsContent value="purchases-all">
          {FilterBar()}
          <p className="text-xs text-muted-foreground mb-2">{allPurchasesData.length} record(s)</p>
          <div className="bg-card rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {pgAllPurchases.paginatedItems.map((p, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">{p.type}</span></td>
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3 font-medium">{"number" in p ? p.number : ""}</td>
                    <td className="px-4 py-3">{p.supplier}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-center">{"status" in p && <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || ""}`}>{p.status}</span>}</td>
                  </tr>
                ))}
                {allPurchasesData.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No records found.</td></tr>}
              </tbody>
            </table>
            <TablePagination currentPage={pgAllPurchases.currentPage} totalPages={pgAllPurchases.totalPages} totalItems={pgAllPurchases.totalItems} onPageChange={pgAllPurchases.goToPage} itemLabel="record" />
          </div>
        </TabsContent>

        {/* Suppliers */}
        <TabsContent value="suppliers">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-foreground">{suppliers.length} supplier(s)</p>
            <Button size="sm" onClick={openAddSupplier}><Plus className="w-4 h-4 mr-1" /> Add Supplier</Button>
          </div>

          {showSupplierForm && (
            <div className="bg-card rounded-lg border p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowSupplierForm(false)}><X className="w-4 h-4" /></Button>
              </div>
              <form onSubmit={handleSaveSupplier} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Contact Name *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="mt-1" required /></div>
                <div><Label>Company *</Label><Input value={supplierForm.company} onChange={e => setSupplierForm({ ...supplierForm, company: e.target.value })} className="mt-1" required /></div>
                <div><Label>Email *</Label><Input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="mt-1" required /></div>
                <div><Label>Phone</Label><Input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="mt-1" /></div>
                <div className="md:col-span-2"><Label>Address</Label><Textarea value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} className="mt-1 h-16" placeholder="Full address" /></div>
                <div className="md:col-span-2 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowSupplierForm(false)}>Cancel</Button>
                  <Button type="submit">{editingSupplier ? "Update" : "Add"}</Button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Address</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {pgSuppliers.paginatedItems.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{s.company}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.address || "—"}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(s.totalPaid)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${s.outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatCurrency(s.outstanding)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEditSupplier(s)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                        <ConfirmDeleteDialog onConfirm={() => handleDeleteSupplier(s.id)} title="Delete Supplier?" description={`Delete supplier "${s.name}"?`} />
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No suppliers yet.</td></tr>}
              </tbody>
            </table>
            <TablePagination currentPage={pgSuppliers.currentPage} totalPages={pgSuppliers.totalPages} totalItems={pgSuppliers.totalItems} onPageChange={pgSuppliers.goToPage} itemLabel="supplier" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
