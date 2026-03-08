import React, { useState, useRef } from "react";
import { getInitialInvoices, getInitialCustomers, getInitialSalesOrders, getInitialReceipts, getInitialInventory, type Invoice, type SalesOrder, type Receipt, type Customer, type InventoryItem, type Quotation } from "@/data/mockData";
import { useInvoicesCloud, useSalesOrdersCloud, useReceiptsCloud, useCustomersCloud, useInventoryCloud, useQuotationsCloud } from "@/hooks/useAppData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Trash2, Edit, Download, ShoppingCart, FileText, Receipt as ReceiptIcon, List, Upload, Maximize2, X, FileDown, CheckCircle, CreditCard, ChevronDown, ChevronUp, Printer, ClipboardList, ArrowRight } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoicePreview } from "@/components/InvoicePreview";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { ReceiptForm } from "@/components/ReceiptForm";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };

const invoiceStatusStyles: Record<string, string> = {
  paid: "bg-success/10 text-success hover:bg-success/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  overdue: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
};

const soStatusStyles: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary hover:bg-primary/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  approved: "bg-success/10 text-success hover:bg-success/20 border-0",
  shipped: "bg-success/10 text-success hover:bg-success/20 border-0",
  cancelled: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
};

const quotationStatusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground hover:bg-muted/80 border-0",
  sent: "bg-primary/10 text-primary hover:bg-primary/20 border-0",
  accepted: "bg-success/10 text-success hover:bg-success/20 border-0",
  rejected: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
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
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { moveToTrash } = useTrash();
  const { data: invoices, upsert: upsertInvoice, remove: removeInvoice, setData: setInvoices } = useInvoicesCloud();
  const { data: salesOrders, upsert: upsertSalesOrder, remove: removeSalesOrder, setData: setSalesOrders } = useSalesOrdersCloud();
  const { data: receipts, upsert: upsertReceipt, remove: removeReceipt, setData: setReceipts } = useReceiptsCloud();
  const { data: customers, upsert: upsertCustomer, setData: setCustomers } = useCustomersCloud();
  const { data: inventory, upsert: upsertInventory, setData: setInventory } = useInventoryCloud();
  const { data: quotations, upsert: upsertQuotation, remove: removeQuotation, setData: setQuotations } = useQuotationsCloud();
  const [ledger, setLedger] = useLocalStorage<LedgerEntry[]>("ledgerEntries", []);
  const [activeTab, setActiveTab] = useState("invoices");
  const [view, setView] = useState<"list" | "form" | "preview" | "form-receipt-for-invoice" | "so-preview" | "quotation-form">("list");
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewSO, setPreviewSO] = useState<{ order: SalesOrder; showPrices: boolean } | null>(null);
  const [receivePaymentInvoice, setReceivePaymentInvoice] = useState<Invoice | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Filters
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  const invoiceFileRef = useRef<HTMLInputElement>(null);
  const soFileRef = useRef<HTMLInputElement>(null);

  const goList = () => { setView("list"); setEditInvoice(null); setEditOrder(null); setEditReceipt(null); setEditQuotation(null); setPreviewInvoice(null); setPreviewSO(null); setReceivePaymentInvoice(null); };

  const handleAddCustomer = (c: Customer) => { upsertCustomer(c); };

  // --- Invoice handlers ---
  const handleSaveInvoice = async (invoice: Invoice, advanceAmount?: number, advanceMethod?: string, advanceRef?: string) => {
    await upsertInvoice(invoice);
    // Deduct inventory stock for newly created invoices (not edits)
    if (!editInvoice) {
      for (const item of invoice.items) {
        if (item.inventoryItemId) {
          const invItem = inventory.find((inv) => inv.id === item.inventoryItemId);
          if (invItem && invItem.productType !== "non-stock") {
            await upsertInventory({ ...invItem, qty: Math.max(0, invItem.qty - item.qty) });
          }
        }
      }
      // Create advance payment receipt if provided
      if (advanceAmount && advanceAmount > 0) {
        const advReceipt: Receipt = {
          id: crypto.randomUUID(),
          number: `RCP-${String(receipts.length + 1).padStart(3, "0")}`,
          customer: invoice.customer,
          date: invoice.date,
          invoiceNumber: invoice.number,
          amount: advanceAmount,
          paymentMethod: advanceMethod || "Cash on Hand",
          reference: advanceRef || "",
          notes: `Advance payment for ${invoice.number}`,
        };
        await upsertReceipt(advReceipt);
        // Auto-create ledger entry for advance payment
        createLedgerEntry(advReceipt);
      }
    }
    goList();
    await log(editInvoice ? "edit" : "create", "invoice", invoice.id, invoice.number, `Customer: ${invoice.customer}, Amount: ${invoice.amount}`);
    toast.success(editInvoice ? "Invoice updated" : "Invoice created");
  };
  const handleDeleteInvoice = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      await moveToTrash("invoice", id, inv);
      await log("delete", "invoice", id, inv.number, `Customer: ${inv.customer}`);
    }
    removeInvoice(id);
    toast.success("Invoice deleted");
  };

  // --- Sales Order handlers ---
  const handleSaveSO = async (order: SalesOrder) => {
    await upsertSalesOrder(order);
    goList();
    await log(editOrder ? "edit" : "create", "sales_order", order.id, order.number, `Customer: ${order.customer}, Amount: ${order.amount}`);
    toast.success(editOrder ? "Sales Order updated" : "Sales Order created");
  };
  const handleDeleteSO = async (id: string) => {
    const so = salesOrders.find(s => s.id === id);
    if (so) {
      await moveToTrash("sales_order", id, so);
      await log("delete", "sales_order", id, so.number, `Customer: ${so.customer}`);
    }
    removeSalesOrder(id);
    toast.success("Sales Order deleted");
  };

  // Approve Sales Order → Convert to Invoice + Deduct Inventory
  const handleApproveSO = async (so: SalesOrder) => {
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      number: `INV-${String(invoices.length + 1).padStart(3, "0")}`,
      projectName: so.projectName,
      customer: so.customer,
      date: new Date().toISOString().split("T")[0],
      dueDate: so.deliveryDate,
      amount: so.amount,
      status: "pending",
      items: so.items,
      notes: so.notes ? `From ${so.number}. ${so.notes}` : `Converted from ${so.number}`,
      tax: so.tax,
    };
    await upsertInvoice(newInvoice);
    for (const item of so.items) {
      if (item.inventoryItemId) {
        const invItem = inventory.find((inv) => inv.id === item.inventoryItemId);
        if (invItem) await upsertInventory({ ...invItem, qty: Math.max(0, invItem.qty - item.qty) });
      }
    }
    if (so.advancePayment && so.advancePayment > 0) {
      const newReceipt: Receipt = {
        id: crypto.randomUUID(),
        number: `RCP-${String(receipts.length + 1).padStart(3, "0")}`,
        customer: so.customer, date: so.date, invoiceNumber: newInvoice.number,
        amount: so.advancePayment, paymentMethod: so.advancePaymentMethod || "cash",
        reference: so.advancePaymentRef, notes: `Advance payment against ${so.number}`,
      };
      await upsertReceipt(newReceipt);
    }
    await upsertSalesOrder({ ...so, status: "approved" });
    await log("create", "invoice", newInvoice.id, newInvoice.number, `Converted from ${so.number}`);
    toast.success(`${so.number} approved → Invoice ${newInvoice.number} created`);
  };

  // --- Receipt handlers ---
  // Helper: create ledger entry for payment received
  const createLedgerEntry = (receipt: Receipt) => {
    const entry: LedgerEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      date: receipt.date,
      bank: receipt.paymentMethod || "Cash on Hand",
      type: "incoming",
      amount: receipt.amount,
      description: `Payment from ${receipt.customer} against ${receipt.invoiceNumber}`,
      reference: receipt.reference || receipt.number,
    };
    setLedger((prev: LedgerEntry[]) => [entry, ...prev]);
  };

  const handleSaveReceipt = async (receipt: Receipt) => {
    await upsertReceipt(receipt);
    // Auto-create ledger entry in accounts
    if (!editReceipt) {
      createLedgerEntry(receipt);
    }
    goList();
    await log(editReceipt ? "edit" : "create", "receipt", receipt.id, receipt.number, `Customer: ${receipt.customer}, Amount: ${receipt.amount}`);
    toast.success(editReceipt ? "Receipt updated" : "Receipt created");
  };
  const handleDeleteReceipt = async (id: string) => {
    const r = receipts.find(rc => rc.id === id);
    if (r) {
      await moveToTrash("receipt", id, r);
      await log("delete", "receipt", id, r.number, `Customer: ${r.customer}`);
    }
    removeReceipt(id);
    toast.success("Receipt deleted");
  };

  // --- Quotation handlers ---
  const handleSaveQuotation = async (quotation: Quotation) => {
    await upsertQuotation(quotation);
    goList();
    await log(editQuotation ? "edit" : "create", "quotation", quotation.id, quotation.number, `Customer: ${quotation.customer}, Amount: ${quotation.amount}`);
    toast.success(editQuotation ? "Quotation updated" : "Quotation created");
  };
  const handleDeleteQuotation = async (id: string) => {
    const q = quotations.find(qt => qt.id === id);
    if (q) {
      await moveToTrash("quotation", id, q);
      await log("delete", "quotation", id, q.number, `Customer: ${q.customer}`);
    }
    removeQuotation(id);
    toast.success("Quotation deleted");
  };
  const handleConvertQuotationToSO = async (q: Quotation) => {
    const newSO: SalesOrder = {
      id: crypto.randomUUID(),
      number: `SO-${String(salesOrders.length + 1).padStart(3, "0")}`,
      projectName: q.projectName,
      customer: q.customer,
      date: new Date().toISOString().split("T")[0],
      deliveryDate: q.dueDate,
      amount: q.amount,
      status: "pending",
      items: q.items,
      notes: q.notes ? `From ${q.number}. ${q.notes}` : `Converted from ${q.number}`,
      tax: q.tax,
    };
    await upsertSalesOrder(newSO);
    await upsertQuotation({ ...q, status: "accepted" });
    await log("create", "sales_order", newSO.id, newSO.number, `Converted from quotation ${q.number}`);
    toast.success(`${q.number} → Sales Order ${newSO.number} created`);
  };

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
        newInvoices.forEach((inv) => upsertInvoice(inv));
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
        newOrders.forEach((order) => upsertSalesOrder(order));
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
    ...quotations.map((q) => q.customer),
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
  if (view === "quotation-form") {
    return (
      <div className="max-w-4xl mx-auto">
        <SalesOrderForm customers={customers} inventory={inventory} onSave={(order) => {
          const q: Quotation = {
            id: editQuotation?.id || crypto.randomUUID(),
            number: editQuotation?.number || `QTN-${String(quotations.length + 1).padStart(3, "0")}`,
            projectName: order.projectName,
            documentNumber: (order as any).documentNumber,
            customer: order.customer,
            date: order.date,
            dueDate: order.deliveryDate,
            amount: order.amount,
            status: editQuotation?.status || "draft",
            items: order.items,
            notes: order.notes,
            tax: order.tax,
          };
          handleSaveQuotation(q);
        }} onCancel={goList} editOrder={editQuotation ? {
          id: editQuotation.id,
          number: editQuotation.number,
          projectName: editQuotation.projectName,
          customer: editQuotation.customer,
          date: editQuotation.date,
          deliveryDate: editQuotation.dueDate,
          amount: editQuotation.amount,
          status: "pending" as const,
          items: editQuotation.items,
          notes: editQuotation.notes,
          tax: editQuotation.tax,
        } : null} nextNumber={`QTN-${String(quotations.length + 1).padStart(3, "0")}`} onAddCustomer={handleAddCustomer} />
      </div>
    );
  }
  if (view === "form" || view === "form-receipt-for-invoice") {
    if (view === "form-receipt-for-invoice" && receivePaymentInvoice) {
      const prefillReceipt: Receipt = {
        id: "",
        number: `RCP-${String(receipts.length + 1).padStart(3, "0")}`,
        customer: receivePaymentInvoice.customer,
        date: new Date().toISOString().split("T")[0],
        invoiceNumber: receivePaymentInvoice.number,
        amount: 0,
        paymentMethod: "Cash",
      };
      return (
        <div className="max-w-4xl mx-auto">
          <ReceiptForm customers={customers} invoices={invoices} receipts={receipts} onSave={handleSaveReceipt} onCancel={goList} editReceipt={prefillReceipt} nextNumber={prefillReceipt.number} onAddCustomer={handleAddCustomer} />
        </div>
      );
    }
    if (activeTab === "sales-orders") {
      return (
        <div className="max-w-4xl mx-auto">
          <SalesOrderForm customers={customers} inventory={inventory} onSave={handleSaveSO} onCancel={goList} editOrder={editOrder} nextNumber={`SO-${String(salesOrders.length + 1).padStart(3, "0")}`} onAddCustomer={handleAddCustomer} />
        </div>
      );
    }
    if (activeTab === "receipts") {
      return (
        <div className="max-w-4xl mx-auto">
          <ReceiptForm customers={customers} invoices={invoices} receipts={receipts} onSave={handleSaveReceipt} onCancel={goList} editReceipt={editReceipt} nextNumber={`RCP-${String(receipts.length + 1).padStart(3, "0")}`} onAddCustomer={handleAddCustomer} />
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto">
        <InvoiceForm customers={customers} inventory={inventory} onSave={handleSaveInvoice} onCancel={goList} editInvoice={editInvoice} nextNumber={`INV-${String(invoices.length + 1).padStart(3, "0")}`} onAddCustomer={handleAddCustomer} />
      </div>
    );
  }

  if (view === "preview" && previewInvoice) {
    // Calculate customer account balance (sum of all unpaid invoices for this customer)
    const customerInvoices = invoices.filter((inv) => inv.customer === previewInvoice.customer);
    const customerOutstanding = customerInvoices.reduce((sum, inv) => {
      const paid = receipts.filter((r) => r.invoiceNumber === inv.number).reduce((s, r) => s + r.amount, 0);
      return sum + Math.max(0, inv.amount - paid);
    }, 0);
    const cust = customers.find((c) => c.name === previewInvoice.customer || `${c.name} [${c.company}]` === previewInvoice.customer);
    return (
      <div className="max-w-4xl mx-auto">
        <InvoicePreview invoice={previewInvoice} onClose={goList} receipts={receipts} customerOutstanding={customerOutstanding} customerPhone={cust?.phone} customerAddress={cust?.address} />
      </div>
    );
  }

  if (view === "so-preview" && previewSO) {
    return (
      <div className="max-w-4xl mx-auto">
        <SalesOrderPreview order={previewSO.order} onClose={goList} showPrices={previewSO.showPrices} customers={customers} />
      </div>
    );
  }

  // --- All Sales data combined ---
  const allSalesDataRaw = [
    ...invoices.map((inv) => ({ ...inv, type: "Invoice" as const, statusStyle: invoiceStatusStyles[inv.status] })),
    ...salesOrders.map((so) => ({ id: so.id, number: so.number, customer: so.customer, date: so.date, dueDate: so.deliveryDate, amount: so.amount, status: so.status, type: "Sales Order" as const, statusStyle: soStatusStyles[so.status] })),
    ...receipts.map((r) => ({ id: r.id, number: r.number, customer: r.customer, date: r.date, dueDate: r.invoiceNumber, amount: r.amount, status: r.paymentMethod, type: "Receipt" as const, statusStyle: "bg-primary/10 text-primary hover:bg-primary/20 border-0" })),
    ...quotations.map((q) => ({ id: q.id, number: q.number, customer: q.customer, date: q.date, dueDate: q.dueDate, amount: q.amount, status: q.status, type: "Quotation" as const, statusStyle: quotationStatusStyles[q.status] || "" })),
  ];
  const allSalesData = allSalesDataRaw
    .filter((item) => matchCustomer(item.customer) && isInDateRange(item.date) && matchStatus(item.status))
    .filter((item) => filterType === "all" || item.type === filterType)
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredQuotations = quotations.filter((q) => matchCustomer(q.customer) && isInDateRange(q.date) && matchStatus(q.status));

  const newButtonLabel = activeTab === "sales-orders" ? "New Sales Order" : activeTab === "receipts" ? "New Receipt" : activeTab === "quotations" ? "New Quotation" : "New Invoice";
  const handleNewClick = () => {
    setEditInvoice(null); setEditOrder(null); setEditReceipt(null); setEditQuotation(null);
    if (activeTab === "quotations") { setView("quotation-form"); }
    else { setView("form"); }
  };

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
              <SelectItem value="Quotation">Quotation</SelectItem>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="quotations" className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Quotations</TabsTrigger>
          <TabsTrigger value="sales-orders" className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Sales Orders</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2"><FileText className="w-4 h-4" />Invoices</TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2"><ReceiptIcon className="w-4 h-4" />Receipts</TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2"><List className="w-4 h-4" />All</TabsTrigger>
        </TabsList>

        {/* Quotations Tab */}
        <TabsContent value="quotations">
          <FilterBar />
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-xs text-muted-foreground">{filteredQuotations.length} quotation(s)</span>
          </div>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quotation #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Valid Until</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((q) => (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{q.number}</td>
                      <td className="px-4 py-3">{q.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.dueDate}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(q.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge className={quotationStatusStyles[q.status] || ""}>{q.status}</Badge></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {q.status !== "accepted" && q.status !== "rejected" && (
                            <button className="p-1.5 rounded hover:bg-success/10 transition-colors" title="Convert to Sales Order" onClick={() => handleConvertQuotationToSO(q)}>
                              <ArrowRight className="w-4 h-4 text-success" />
                            </button>
                          )}
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditQuotation(q); setView("quotation-form"); }}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                          <ConfirmDeleteDialog onConfirm={() => handleDeleteQuotation(q.id)} title="Delete Quotation?" description={`Delete quotation ${q.number}?`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotations.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No quotations found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

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
                          {so.status !== "approved" && so.status !== "cancelled" && (
                            <button className="p-1.5 rounded hover:bg-success/10 transition-colors" title="Approve → Convert to Invoice" onClick={() => handleApproveSO(so)}>
                              <CheckCircle className="w-4 h-4 text-success" />
                            </button>
                          )}
                          <button className="p-1.5 rounded hover:bg-primary/10 transition-colors" title="Print with Prices" onClick={() => { setPreviewSO({ order: so, showPrices: true }); setView("so-preview"); }}><Printer className="w-4 h-4 text-primary" /></button>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Delivery Challan (no prices)" onClick={() => { setPreviewSO({ order: so, showPrices: false }); setView("so-preview"); }}><Eye className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditOrder(so); setView("form"); }}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                          <ConfirmDeleteDialog onConfirm={() => handleDeleteSO(so.id)} title="Delete Sales Order?" description={`Delete sales order ${so.number}?`} />
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
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Remaining</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const invReceipts = receipts.filter((r) => r.invoiceNumber === inv.number);
                    const totalPaid = invReceipts.reduce((s, r) => s + r.amount, 0);
                    const remaining = Math.max(0, inv.amount - totalPaid);
                    const isExpanded = expandedInvoice === inv.id;
                    return (
                      <React.Fragment key={inv.id}>
                        <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{inv.number}</td>
                          <td className="px-4 py-3">{inv.customer}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.date}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.amount)}</td>
                          <td className="px-4 py-3 text-right text-success font-medium">{formatCurrency(totalPaid)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${remaining > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(remaining)}</td>
                          <td className="px-4 py-3 text-center"><Badge className={invoiceStatusStyles[inv.status]}>{inv.status}</Badge></td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View" onClick={() => { setPreviewInvoice(inv); setView("preview"); }}><Eye className="w-4 h-4 text-muted-foreground" /></button>
                              {remaining > 0 && (
                                <button className="p-1.5 rounded hover:bg-success/10 transition-colors" title="Receive Payment" onClick={() => { setReceivePaymentInvoice(inv); setView("form-receipt-for-invoice"); }}><CreditCard className="w-4 h-4 text-success" /></button>
                              )}
                              <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Payment History" onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                              </button>
                              <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditInvoice(inv); setView("form"); }}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                              <ConfirmDeleteDialog onConfirm={() => handleDeleteInvoice(inv.id)} title="Delete Invoice?" description={`Delete invoice ${inv.number}?`} />
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-4 py-2 bg-muted/20">
                              <div className="text-xs space-y-1">
                                <p className="font-semibold text-muted-foreground mb-1">Payment History for {inv.number}</p>
                                {invReceipts.length > 0 ? invReceipts.map((r) => (
                                  <div key={r.id} className="flex items-center justify-between py-1 border-b border-dashed last:border-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{r.number}</span>
                                      <span className="text-muted-foreground">{r.date}</span>
                                      <Badge variant="outline" className="text-[10px] h-4">{r.paymentMethod}</Badge>
                                    </div>
                                    <span className="font-medium text-success">{formatCurrency(r.amount)}</span>
                                  </div>
                                )) : <p className="text-muted-foreground py-1">No payments received yet</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredInvoices.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No invoices found.</td></tr>}
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
                          <ConfirmDeleteDialog onConfirm={() => handleDeleteReceipt(r.id)} title="Delete Receipt?" description={`Delete receipt ${r.number}?`} />
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
