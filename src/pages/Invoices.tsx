import { useState, useRef } from "react";
import { getInitialInvoices, getInitialCustomers, getInitialSalesOrders, getInitialReceipts, type Invoice, type SalesOrder, type Receipt } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Trash2, Edit, Download, ShoppingCart, FileText, Receipt as ReceiptIcon, List, Upload, Maximize2, X, FileDown } from "lucide-react";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoicePreview } from "@/components/InvoicePreview";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { ReceiptForm } from "@/components/ReceiptForm";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const invoiceStatusStyles: Record<string, string> = {
  paid: "bg-success/10 text-success hover:bg-success/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  overdue: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
};

const soStatusStyles: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary hover:bg-primary/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  shipped: "bg-success/10 text-success hover:bg-success/20 border-0",
  cancelled: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

export default function Invoices() {
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>("cb-invoices", getInitialInvoices());
  const [salesOrders, setSalesOrders] = useLocalStorage<SalesOrder[]>("cb-sales-orders", getInitialSalesOrders());
  const [receipts, setReceipts] = useLocalStorage<Receipt[]>("cb-receipts", getInitialReceipts());
  const [customers] = useLocalStorage("cb-customers", getInitialCustomers());

  const [activeTab, setActiveTab] = useState("invoices");
  const [view, setView] = useState<"list" | "form" | "preview">("list");
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Filters
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  const invoiceFileRef = useRef<HTMLInputElement>(null);
  const soFileRef = useRef<HTMLInputElement>(null);

  const goList = () => { setView("list"); setEditInvoice(null); setEditOrder(null); setEditReceipt(null); setPreviewInvoice(null); };

  // --- Invoice handlers ---
  const handleSaveInvoice = (invoice: Invoice) => {
    setInvoices((prev) => { const exists = prev.find((i) => i.id === invoice.id); return exists ? prev.map((i) => (i.id === invoice.id ? invoice : i)) : [...prev, invoice]; });
    goList();
    toast.success(editInvoice ? "Invoice updated" : "Invoice created");
  };
  const handleDeleteInvoice = (id: string) => { setInvoices((prev) => prev.filter((i) => i.id !== id)); toast.success("Invoice deleted"); };

  // --- Sales Order handlers ---
  const handleSaveSO = (order: SalesOrder) => {
    setSalesOrders((prev) => { const exists = prev.find((i) => i.id === order.id); return exists ? prev.map((i) => (i.id === order.id ? order : i)) : [...prev, order]; });
    goList();
    toast.success(editOrder ? "Sales Order updated" : "Sales Order created");
  };
  const handleDeleteSO = (id: string) => { setSalesOrders((prev) => prev.filter((i) => i.id !== id)); toast.success("Sales Order deleted"); };

  // --- Receipt handlers ---
  const handleSaveReceipt = (receipt: Receipt) => {
    setReceipts((prev) => { const exists = prev.find((i) => i.id === receipt.id); return exists ? prev.map((i) => (i.id === receipt.id ? receipt : i)) : [...prev, receipt]; });
    goList();
    toast.success(editReceipt ? "Receipt updated" : "Receipt created");
  };
  const handleDeleteReceipt = (id: string) => { setReceipts((prev) => prev.filter((i) => i.id !== id)); toast.success("Receipt deleted"); };

  // --- Import handlers ---
  const handleImportInvoices = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string);
        const newInvoices: Invoice[] = rows.map((r, i) => ({
          id: `imp-inv-${Date.now()}-${i}`,
          number: r.number || `INV-IMP-${i + 1}`,
          customer: r.customer || "Unknown",
          date: r.date || new Date().toISOString().slice(0, 10),
          dueDate: r.duedate || r["due date"] || r.due_date || new Date().toISOString().slice(0, 10),
          amount: parseFloat(r.amount) || 0,
          status: (r.status as Invoice["status"]) || "pending",
          items: [{ description: r.description || "Imported item", qty: parseFloat(r.quantity) || 1, rate: parseFloat(r.price || r.amount) || 0, amount: parseFloat(r.amount) || 0 }],
          tax: parseFloat(r.tax) || 0,
          notes: r.notes || "Imported via CSV",
        }));
        setInvoices((prev) => [...prev, ...newInvoices]);
        toast.success(`${newInvoices.length} invoice(s) imported`);
      } catch { toast.error("Failed to parse CSV file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportSalesOrders = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string);
        const newOrders: SalesOrder[] = rows.map((r, i) => ({
          id: `imp-so-${Date.now()}-${i}`,
          number: r.number || `SO-IMP-${i + 1}`,
          customer: r.customer || "Unknown",
          date: r.date || new Date().toISOString().slice(0, 10),
          deliveryDate: r.deliverydate || r["delivery date"] || r.delivery_date || new Date().toISOString().slice(0, 10),
          amount: parseFloat(r.amount) || 0,
          status: (r.status as SalesOrder["status"]) || "pending",
          items: [{ description: r.description || "Imported item", qty: parseFloat(r.quantity) || 1, rate: parseFloat(r.price || r.amount) || 0, amount: parseFloat(r.amount) || 0 }],
          notes: r.notes || "Imported via CSV",
        }));
        setSalesOrders((prev) => [...prev, ...newOrders]);
        toast.success(`${newOrders.length} sales order(s) imported`);
      } catch { toast.error("Failed to parse CSV file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Unique customer names for filter dropdowns
  const uniqueCustomers = Array.from(new Set([
    ...invoices.map((i) => i.customer),
    ...salesOrders.map((s) => s.customer),
    ...receipts.map((r) => r.customer),
  ])).sort();

  // Date range filter helper
  const isInDateRange = (dateStr: string) => {
    if (filterDateRange === "all") return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (filterDateRange === "today") return d.toDateString() === now.toDateString();
    if (filterDateRange === "7days") return d >= new Date(now.getTime() - 7 * 86400000);
    if (filterDateRange === "30days") return d >= new Date(now.getTime() - 30 * 86400000);
    if (filterDateRange === "90days") return d >= new Date(now.getTime() - 90 * 86400000);
    if (filterDateRange === "thisyear") return d.getFullYear() === now.getFullYear();
    if (filterDateRange === "custom") {
      if (customDateFrom && d < new Date(customDateFrom)) return false;
      if (customDateTo && d > new Date(customDateTo + "T23:59:59")) return false;
      return true;
    }
    return true;
  };
  const matchCustomer = (customer: string) => filterCustomer === "all" || customer === filterCustomer;
  const matchStatus = (status: string) => filterStatus === "all" || status === filterStatus;

  // Unique statuses
  const uniqueStatuses = Array.from(new Set([
    ...invoices.map((i) => i.status),
    ...salesOrders.map((s) => s.status),
    ...receipts.map((r) => r.paymentMethod),
  ])).sort();

  // --- Filtered data ---
  const filteredInvoices = invoices.filter((i) => matchCustomer(i.customer) && isInDateRange(i.date) && matchStatus(i.status));
  const filteredSO = salesOrders.filter((s) => matchCustomer(s.customer) && isInDateRange(s.date) && matchStatus(s.status));
  const filteredReceipts = receipts.filter((r) => matchCustomer(r.customer) && isInDateRange(r.date) && matchStatus(r.paymentMethod));

  const clearFilters = () => { setFilterCustomer("all"); setFilterType("all"); setFilterDateRange("all"); setFilterStatus("all"); setCustomDateFrom(""); setCustomDateTo(""); };
  const hasActiveFilters = filterCustomer !== "all" || filterType !== "all" || filterDateRange !== "all" || filterStatus !== "all";

  // --- Export CSV ---
  const exportCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row(s)`);
  };

  const handleExport = () => {
    if (activeTab === "invoices") {
      exportCSV(["Number", "Customer", "Date", "Due Date", "Amount", "Status"],
        filteredInvoices.map((i) => [i.number, i.customer, i.date, i.dueDate, String(i.amount), i.status]), "invoices.csv");
    } else if (activeTab === "sales-orders") {
      exportCSV(["Number", "Customer", "Date", "Delivery Date", "Amount", "Status"],
        filteredSO.map((s) => [s.number, s.customer, s.date, s.deliveryDate, String(s.amount), s.status]), "sales-orders.csv");
    } else if (activeTab === "receipts") {
      exportCSV(["Number", "Customer", "Date", "Invoice", "Amount", "Payment Method"],
        filteredReceipts.map((r) => [r.number, r.customer, r.date, r.invoiceNumber, String(r.amount), r.paymentMethod]), "receipts.csv");
    } else {
      exportCSV(["Type", "Number", "Customer", "Date", "Amount", "Status"],
        allSalesData.map((i) => [i.type, i.number, i.customer, i.date, String(i.amount), i.status]), "sales-all.csv");
    }
  };

  // --- Form views ---
  if (view === "form") {
    if (activeTab === "sales-orders") {
      return (
        <div className="max-w-4xl mx-auto">
          <SalesOrderForm customers={customers} onSave={handleSaveSO} onCancel={goList} editOrder={editOrder} nextNumber={`SO-${String(salesOrders.length + 1).padStart(3, "0")}`} />
        </div>
      );
    }
    if (activeTab === "receipts") {
      return (
        <div className="max-w-4xl mx-auto">
          <ReceiptForm customers={customers} invoices={invoices} onSave={handleSaveReceipt} onCancel={goList} editReceipt={editReceipt} nextNumber={`RCP-${String(receipts.length + 1).padStart(3, "0")}`} />
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto">
        <InvoiceForm customers={customers} onSave={handleSaveInvoice} onCancel={goList} editInvoice={editInvoice} nextNumber={`INV-${String(invoices.length + 1).padStart(3, "0")}`} />
      </div>
    );
  }

  if (view === "preview" && previewInvoice) {
    return (
      <div className="max-w-4xl mx-auto">
        <InvoicePreview invoice={previewInvoice} onClose={goList} />
      </div>
    );
  }

  // --- All Sales data combined ---
  const allSalesDataRaw = [
    ...invoices.map((inv) => ({ ...inv, type: "Invoice" as const, statusStyle: invoiceStatusStyles[inv.status] })),
    ...salesOrders.map((so) => ({ id: so.id, number: so.number, customer: so.customer, date: so.date, dueDate: so.deliveryDate, amount: so.amount, status: so.status, type: "Sales Order" as const, statusStyle: soStatusStyles[so.status] })),
    ...receipts.map((r) => ({ id: r.id, number: r.number, customer: r.customer, date: r.date, dueDate: r.invoiceNumber, amount: r.amount, status: r.paymentMethod, type: "Receipt" as const, statusStyle: "bg-primary/10 text-primary hover:bg-primary/20 border-0" })),
  ];
  const allSalesData = allSalesDataRaw
    .filter((item) => matchCustomer(item.customer) && isInDateRange(item.date) && matchStatus(item.status))
    .filter((item) => filterType === "all" || item.type === filterType)
    .sort((a, b) => b.date.localeCompare(a.date));

  const newButtonLabel = activeTab === "sales-orders" ? "New Sales Order" : activeTab === "receipts" ? "New Receipt" : "New Invoice";
  const handleNewClick = () => { setEditInvoice(null); setEditOrder(null); setEditReceipt(null); setView("form"); };

  // Hidden file inputs
  const hiddenInputs = (
    <>
      <input type="file" accept=".csv" ref={invoiceFileRef} className="hidden" onChange={handleImportInvoices} />
      <input type="file" accept=".csv" ref={soFileRef} className="hidden" onChange={handleImportSalesOrders} />
    </>
  );

  // Filter bar component matching reference design
  const FilterBar = ({ showType }: { showType?: boolean }) => (
    <div className="flex flex-wrap items-end gap-3 py-3 px-4 border-b bg-muted/30">
      {showType && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px] h-8 text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Invoice">Invoice</SelectItem>
              <SelectItem value="Sales Order">Sales Order</SelectItem>
              <SelectItem value="Receipt">Receipt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Customers</span>
        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {uniqueCustomers.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {uniqueStatuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Date Range</span>
        <Select value={filterDateRange} onValueChange={setFilterDateRange}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="All Dates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="90days">Last 90 Days</SelectItem>
            <SelectItem value="thisyear">This Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filterDateRange === "custom" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input type="date" className="w-[140px] h-8 text-sm" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input type="date" className="w-[140px] h-8 text-sm" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} />
          </div>
        </>
      )}
      <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
        <FileDown className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" className="h-8" onClick={clearFilters}>
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {hiddenInputs}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm">Manage sales orders, invoices, receipts and more</p>
        </div>
        <div className="flex items-center gap-2">
          {(activeTab === "invoices" || activeTab === "sales-orders") && (
            <Button variant="outline" size="sm" onClick={() => activeTab === "invoices" ? invoiceFileRef.current?.click() : soFileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          )}
          {activeTab !== "all" && (
            <Button onClick={handleNewClick}>
              <Plus className="w-4 h-4 mr-2" />
              {newButtonLabel}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); goList(); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales-orders" className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Sales Orders</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2"><FileText className="w-4 h-4" />Invoices</TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2"><ReceiptIcon className="w-4 h-4" />Receipts</TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2"><List className="w-4 h-4" />Sales All</TabsTrigger>
        </TabsList>

        {/* Sales Orders Tab */}
        <TabsContent value="sales-orders">
          <FilterBar />
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-xs text-muted-foreground">{filteredSO.length} order(s)</span>
          </div>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Delivery Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSO.map((so) => (
                    <tr key={so.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{so.number}</td>
                      <td className="px-4 py-3">{so.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{so.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{so.deliveryDate}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(so.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge className={soStatusStyles[so.status]}>{so.status}</Badge></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditOrder(so); setView("form"); }}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Delete" onClick={() => handleDeleteSO(so.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSO.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No sales orders found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <FilterBar />
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-xs text-muted-foreground">{filteredInvoices.length} invoice(s)</span>
          </div>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{inv.number}</td>
                      <td className="px-4 py-3">{inv.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge className={invoiceStatusStyles[inv.status]}>{inv.status}</Badge></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View" onClick={() => { setPreviewInvoice(inv); setView("preview"); }}><Eye className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditInvoice(inv); setView("form"); }}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Download PDF" onClick={() => { setPreviewInvoice(inv); setView("preview"); }}><Download className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Delete" onClick={() => handleDeleteInvoice(inv.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No invoices found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts">
          <FilterBar />
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-xs text-muted-foreground">{filteredReceipts.length} receipt(s)</span>
          </div>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.number}</td>
                      <td className="px-4 py-3">{r.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.invoiceNumber}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">{r.paymentMethod}</Badge></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditReceipt(r); setView("form"); }}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Delete" onClick={() => handleDeleteReceipt(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredReceipts.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No receipts found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Sales All Tab */}
        <TabsContent value="all">
          <FilterBar showType />
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-xs text-muted-foreground">{allSalesData.length} record(s)</span>
          </div>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allSalesData.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{item.number}</td>
                      <td className="px-4 py-3">{item.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.date}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge className={item.statusStyle}>{item.status}</Badge></td>
                    </tr>
                  ))}
                  {allSalesData.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No sales data found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
