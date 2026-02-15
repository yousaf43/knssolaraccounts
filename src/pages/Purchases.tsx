import { useState, useRef } from "react";
import {
  getInitialPurchaseOrders, getInitialBills, getInitialPurchasePayments, getInitialSuppliers,
  type PurchaseOrder, type Bill, type PurchasePayment, type Supplier,
} from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, X, Upload, Download } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(a: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(a);
}

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

export default function Purchases() {
  const [tab, setTab] = useState("purchase-orders");

  // Data
  const [purchaseOrders, setPurchaseOrders] = useLocalStorage<PurchaseOrder[]>("cb-purchase-orders", getInitialPurchaseOrders());
  const [bills, setBills] = useLocalStorage<Bill[]>("cb-bills", getInitialBills());
  const [payments, setPayments] = useLocalStorage<PurchasePayment[]>("cb-purchase-payments", getInitialPurchasePayments());
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>("cb-suppliers", getInitialSuppliers());

  // Filters
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ name: "", email: "", phone: "", company: "", totalPaid: 0, outstanding: 0 });

  // Import refs
  const poFileRef = useRef<HTMLInputElement>(null);
  const billFileRef = useRef<HTMLInputElement>(null);

  // Unique suppliers for filter
  const allSupplierNames = Array.from(new Set([
    ...purchaseOrders.map(p => p.supplier),
    ...bills.map(b => b.supplier),
    ...payments.map(p => p.supplier),
  ]));

  // All statuses
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

  // Purchases All
  const allPurchasesData = [
    ...filteredPO.map(p => ({ ...p, type: "Purchase Order" as const })),
    ...filteredBills.map(b => ({ ...b, type: "Bill" as const })),
    ...filteredPayments.map(p => ({ ...p, type: "Payment" as const, status: "paid" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Export
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
        date: r.date || new Date().toISOString().split("T")[0], deliveryDate: r["delivery date"] || r.deliverydate || "",
        amount: parseFloat(r.amount) || 0, status: (r.status as PurchaseOrder["status"]) || "pending",
        items: [{ description: "Imported item", qty: parseFloat(r.quantity || r.qty || "1"), rate: parseFloat(r.price || r.rate || "0"), amount: parseFloat(r.amount) || 0 }],
      }));
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
        date: r.date || new Date().toISOString().split("T")[0], dueDate: r["due date"] || r.duedate || "",
        amount: parseFloat(r.amount) || 0, status: (r.status as Bill["status"]) || "pending",
        items: [{ description: "Imported item", qty: parseFloat(r.quantity || r.qty || "1"), rate: parseFloat(r.price || r.rate || "0"), amount: parseFloat(r.amount) || 0 }],
      }));
      setBills(prev => [...prev, ...newItems]);
      toast.success(`${newItems.length} bills imported`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Supplier CRUD
  const openAddSupplier = () => { setEditingSupplier(null); setSupplierForm({ name: "", email: "", phone: "", company: "", totalPaid: 0, outstanding: 0 }); setShowSupplierForm(true); };
  const openEditSupplier = (s: Supplier) => { setEditingSupplier(s); setSupplierForm(s); setShowSupplierForm(true); };
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name?.trim() || !supplierForm.email?.trim() || !supplierForm.company?.trim()) return;
    if (editingSupplier) {
      setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? { ...s, ...supplierForm } as Supplier : s));
      toast.success("Supplier updated");
    } else {
      setSuppliers(prev => [...prev, { ...supplierForm, id: crypto.randomUUID(), totalPaid: 0, outstanding: 0 } as Supplier]);
      toast.success("Supplier added");
    }
    setShowSupplierForm(false);
  };
  const handleDeleteSupplier = (id: string) => { setSuppliers(prev => prev.filter(s => s.id !== id)); toast.success("Supplier deleted"); };

  // Delete handlers
  const handleDeletePO = (id: string) => { setPurchaseOrders(prev => prev.filter(p => p.id !== id)); toast.success("Purchase order deleted"); };
  const handleDeleteBill = (id: string) => { setBills(prev => prev.filter(b => b.id !== id)); toast.success("Bill deleted"); };
  const handleDeletePayment = (id: string) => { setPayments(prev => prev.filter(p => p.id !== id)); toast.success("Payment deleted"); };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-muted-foreground text-sm">Manage purchase orders, bills, payments & suppliers</p>
        </div>
        <div className="flex gap-2">
          {(tab === "purchase-orders" || tab === "bills") && (
            <>
              <input type="file" accept=".csv" ref={tab === "purchase-orders" ? poFileRef : billFileRef} className="hidden" onChange={tab === "purchase-orders" ? handleImportPO : handleImportBills} />
              <Button variant="outline" size="sm" onClick={() => (tab === "purchase-orders" ? poFileRef : billFileRef).current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Import CSV
              </Button>
            </>
          )}
          {tab !== "suppliers" && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="purchases-all">Purchases All</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        {/* Purchase Orders */}
        <TabsContent value="purchase-orders">
          <FilterBar />
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
                {filteredPO.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.number}</td>
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3">{p.supplier}</td>
                    <td className="px-4 py-3">{p.deliveryDate}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-center"><button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDeletePO(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                  </tr>
                ))}
                {filteredPO.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders found.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Bills */}
        <TabsContent value="bills">
          <FilterBar />
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
                {filteredBills.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{b.number}</td>
                    <td className="px-4 py-3">{b.date}</td>
                    <td className="px-4 py-3">{b.supplier}</td>
                    <td className="px-4 py-3">{b.dueDate}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(b.amount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[b.status]}`}>{b.status}</span></td>
                    <td className="px-4 py-3 text-center"><button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDeleteBill(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                  </tr>
                ))}
                {filteredBills.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No bills found.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <FilterBar />
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
                {filteredPayments.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.number}</td>
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3">{p.supplier}</td>
                    <td className="px-4 py-3">{p.billNumber}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">{p.paymentMethod}</td>
                    <td className="px-4 py-3 text-center"><button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDeletePayment(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No payments found.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Purchases All */}
        <TabsContent value="purchases-all">
          <FilterBar />
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
                {allPurchasesData.map((p, i) => (
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
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{s.company}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(s.totalPaid)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${s.outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatCurrency(s.outstanding)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEditSupplier(s)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                        <button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDeleteSupplier(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}