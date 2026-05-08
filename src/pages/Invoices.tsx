import React, { useState, useRef, useEffect } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { getInitialInvoices, getInitialCustomers, getInitialSalesOrders, getInitialReceipts, getInitialInventory, type Invoice, type SalesOrder, type Receipt, type Customer, type InventoryItem, type Quotation } from "@/data/mockData";
import { useInvoicesCloud, useSalesOrdersCloud, useReceiptsCloud, useCustomersCloud, useInventoryCloud, useQuotationsCloud, useLedgerEntriesCloud, useAccountsCloud } from "@/hooks/useAppData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Trash2, Edit, Download, ShoppingCart, FileText, Receipt as ReceiptIcon, List, Upload, Maximize2, X, FileDown, CheckCircle, CreditCard, ChevronDown, ChevronUp, Printer, ClipboardList, ArrowRight, RotateCcw, ArrowLeftRight } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoicePreview } from "@/components/InvoicePreview";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { ReceiptForm } from "@/components/ReceiptForm";
import { toast } from "sonner";
import { ReturnInvoiceForm } from "@/components/ReturnInvoiceForm";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";
import { getInvoicePaymentSummary } from "@/utils/invoicePayments";

type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };

const invoiceStatusStyles: Record<string, string> = {
  paid: "bg-success/10 text-success hover:bg-success/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  overdue: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
  approved: "bg-primary/10 text-primary hover:bg-primary/20 border-0",
  returned: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-0",
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
  const { data: ledger, setData: setLedger, upsert: upsertLedger } = useLedgerEntriesCloud();
  const { data: cloudAccounts } = useAccountsCloud();
  const [activeTab, setActiveTab] = useState("invoices");
  const [view, setView] = useState<"list" | "form" | "preview" | "form-receipt-for-invoice" | "so-preview" | "quotation-form" | "return-form">("list");
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewSO, setPreviewSO] = useState<{ order: SalesOrder; showPrices: boolean } | null>(null);
  const [receivePaymentInvoice, setReceivePaymentInvoice] = useState<Invoice | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [confirmApproveSO, setConfirmApproveSO] = useState<SalesOrder | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
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
    // Do NOT deduct inventory on creation — stock deducts only on Approve
    if (!editInvoice) {
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

  // Approve Invoice → Deduct inventory stock
  const handleApproveInvoice = async (inv: Invoice) => {
    for (const item of inv.items) {
      if (item.inventoryItemId) {
        const invItem = inventory.find((i) => i.id === item.inventoryItemId);
        if (invItem && invItem.productType !== "non-stock") {
          await upsertInventory({ ...invItem, qty: Math.max(0, invItem.qty - item.qty) });
        }
      }
    }
    await upsertInvoice({ ...inv, status: "approved" });
    await log("edit", "invoice", inv.id, inv.number, `Approved — inventory deducted`);
    toast.success(`${inv.number} approved — stock deducted`);
  };

  // Return Sale Invoice → Restore inventory stock + create return invoice
  const handleReturnInvoice = async (inv: Invoice) => {
    // Restore inventory stock
    for (const item of inv.items) {
      if (item.inventoryItemId) {
        const invItem = inventory.find((i) => i.id === item.inventoryItemId);
        if (invItem && invItem.productType !== "non-stock") {
          await upsertInventory({ ...invItem, qty: invItem.qty + item.qty });
        }
      }
    }
    // Create return credit note
    const returnInvoice: Invoice = {
      id: crypto.randomUUID(),
      number: `RET-${String(invoices.filter(i => i.isReturn).length + 1).padStart(3, "0")}`,
      customer: inv.customer,
      date: new Date().toISOString().split("T")[0],
      dueDate: inv.dueDate,
      amount: -inv.amount,
      status: "paid",
      items: inv.items.map(item => ({ ...item, amount: -item.amount })),
      notes: `Return against ${inv.number}`,
      tax: inv.tax,
      returnedFrom: inv.number,
      isReturn: true,
      projectName: inv.projectName,
    };
    await upsertInvoice(returnInvoice);
    // Mark original as returned
    await upsertInvoice({ ...inv, status: "returned" });
    // Create outgoing ledger entry for refund
    const refundEntry: LedgerEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      date: returnInvoice.date,
      bank: "Cash on Hand",
      type: "outgoing",
      amount: inv.amount,
      description: `Return refund to ${inv.customer} against ${inv.number}`,
      reference: returnInvoice.number,
    };
    setLedger((prev: LedgerEntry[]) => [refundEntry, ...prev]);
    await log("create", "invoice", returnInvoice.id, returnInvoice.number, `Return against ${inv.number} — stock restored`);
    toast.success(`${inv.number} returned → ${returnInvoice.number} created, stock restored`);
  };

  // Handle Return/Exchange from the dedicated form
  const handleProcessReturn = async (data: {
    originalInvoice: Invoice;
    returnType: "return" | "exchange";
    returnItems: (import("@/data/mockData").InvoiceItem & { returnQty: number })[];
    exchangeItems: import("@/data/mockData").InvoiceItem[];
    refundAmount: number;
    refundMethod: string;
    notes: string;
  }) => {
    const { originalInvoice, returnType, returnItems: retItems, exchangeItems: exchItems, refundAmount, refundMethod, notes: retNotes } = data;
    const retNumber = `RET-${String(invoices.filter(i => i.isReturn).length + 1).padStart(3, "0")}`;

    // 1. Restore stock for returned items
    for (const item of retItems) {
      if (item.inventoryItemId) {
        const invItem = inventory.find((i) => i.id === item.inventoryItemId);
        if (invItem && invItem.productType !== "non-stock") {
          await upsertInventory({ ...invItem, qty: invItem.qty + item.returnQty });
        }
      }
    }

    // Calculate return value
    const returnValue = retItems.reduce((s, ri) => s + ri.returnQty * ri.rate, 0);

    // 2. Create return credit note
    const returnInvoice: Invoice = {
      id: crypto.randomUUID(),
      number: retNumber,
      customer: originalInvoice.customer,
      date: new Date().toISOString().split("T")[0],
      dueDate: originalInvoice.dueDate,
      amount: -returnValue,
      status: "paid",
      items: retItems.map((item) => ({
        description: item.description,
        qty: item.returnQty,
        rate: item.rate,
        amount: -(item.returnQty * item.rate),
        inventoryItemId: item.inventoryItemId,
      })),
      notes: retNotes || `${returnType === "exchange" ? "Exchange" : "Return"} against ${originalInvoice.number}`,
      tax: originalInvoice.tax,
      returnedFrom: originalInvoice.number,
      isReturn: true,
      projectName: originalInvoice.projectName,
    };
    await upsertInvoice(returnInvoice);

    // 3. Check if all items are fully returned → mark original as returned
    const allItemsReturned = originalInvoice.items.every((origItem, idx) => {
      const retItem = retItems.find((ri) => ri.description === origItem.description && ri.inventoryItemId === origItem.inventoryItemId);
      return retItem && retItem.returnQty >= origItem.qty;
    });
    if (allItemsReturned) {
      await upsertInvoice({ ...originalInvoice, status: "returned" });
    }

    // 4. If exchange: create a new invoice for exchange items + deduct stock
    if (returnType === "exchange" && exchItems.length > 0) {
      const exchTotal = exchItems.reduce((s, i) => s + i.amount, 0);
      const exchInvoice: Invoice = {
        id: crypto.randomUUID(),
        number: `INV-${String(invoices.length + 2).padStart(3, "0")}`,
        customer: originalInvoice.customer,
        date: new Date().toISOString().split("T")[0],
        dueDate: originalInvoice.dueDate,
        amount: exchTotal,
        status: "approved",
        items: exchItems,
        notes: `Exchange against ${originalInvoice.number} (${retNumber})`,
        projectName: originalInvoice.projectName,
      };
      // Deduct stock for exchange items
      for (const item of exchItems) {
        if (item.inventoryItemId) {
          const invItem = inventory.find((i) => i.id === item.inventoryItemId);
          if (invItem && invItem.productType !== "non-stock") {
            await upsertInventory({ ...invItem, qty: Math.max(0, invItem.qty - item.qty) });
          }
        }
      }
      await upsertInvoice(exchInvoice);
      await log("create", "invoice", exchInvoice.id, exchInvoice.number, `Exchange invoice from ${originalInvoice.number}`);
    }

    // 5. Create refund ledger entry if there's a refund
    if (refundAmount > 0) {
      const refundEntry: LedgerEntry = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        date: returnInvoice.date,
        bank: refundMethod,
        type: "outgoing",
        amount: refundAmount,
        description: `${returnType === "exchange" ? "Exchange" : "Return"} refund to ${originalInvoice.customer} against ${originalInvoice.number}`,
        reference: retNumber,
      };
      setLedger((prev: LedgerEntry[]) => [refundEntry, ...prev]);
    }

    goList();
    await log("create", "invoice", returnInvoice.id, retNumber, `${returnType === "exchange" ? "Exchange" : "Return"} against ${originalInvoice.number} — stock restored`);
    toast.success(
      returnType === "exchange"
        ? `Exchange processed → ${retNumber} created, new invoice issued`
        : `Return processed → ${retNumber} created, stock restored`
    );
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
      id: crypto.randomUUID(),
      date: receipt.date,
      bank: receipt.paymentMethod || "Cash on Hand",
      type: "incoming",
      amount: receipt.amount,
      description: `Payment from ${receipt.customer} against ${receipt.invoiceNumber}`,
      reference: receipt.reference || receipt.number,
    };
    upsertLedger(entry);
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

  const handleSaveBulkReceipts = async (newReceipts: Receipt[]) => {
    for (const r of newReceipts) {
      await upsertReceipt(r);
      await log("create", "receipt", r.id, r.number, `Customer: ${r.customer}, Amount: ${r.amount} (bulk)`);
    }
    // Single consolidated ledger entry for the whole bulk receipt
    if (newReceipts.length > 0) {
      const total = newReceipts.reduce((s, r) => s + r.amount, 0);
      const first = newReceipts[0];
      const invoiceList = newReceipts.map((r) => `${r.invoiceNumber}:${r.amount.toFixed(2)}`).join(", ");
      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        date: first.date,
        bank: first.paymentMethod || "Cash on Hand",
        type: "incoming",
        amount: total,
        description: `Bulk payment from ${first.customer} (${newReceipts.length} invoices) — ${invoiceList}`,
        reference: first.reference || first.number,
      };
      upsertLedger(entry);
    }
    goList();
    const total = newReceipts.reduce((s, r) => s + r.amount, 0);
    toast.success(`Receipt ${newReceipts[0]?.number} created • Total ${total.toLocaleString()} across ${newReceipts.length} invoice(s)`);
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

  // --- Search helper ---
  const matchSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };
  const matchSearchFields = (...fields: string[]) => fields.some(f => matchSearch(f));

  // --- Filtered data ---
  const filteredInvoices = invoices.filter((i) => !i.isReturn && matchCustomer(i.customer) && isInDateRange(i.date) && matchStatus(i.status) && matchSearchFields(i.number, i.customer, i.notes || "", i.projectName || "", i.documentNumber || ""));
  const filteredSO = salesOrders.filter((s) => matchCustomer(s.customer) && isInDateRange(s.date) && matchStatus(s.status) && matchSearchFields(s.number, s.customer, s.notes || "", s.projectName || ""));
  const filteredReceiptsRaw = receipts.filter((r) => matchCustomer(r.customer) && isInDateRange(r.date) && matchStatus(r.paymentMethod) && matchSearchFields(r.number, r.customer, r.invoiceNumber, r.reference || ""));
  // Group rows that share the same receipt number (bulk allocations) into one display row
  const filteredReceipts = React.useMemo(() => {
    const groups = new Map<string, { rows: Receipt[]; total: number }>();
    for (const r of filteredReceiptsRaw) {
      const key = `${r.number}||${r.customer}||${r.date}`;
      const g = groups.get(key) || { rows: [], total: 0 };
      g.rows.push(r);
      g.total += Number(r.amount) || 0;
      groups.set(key, g);
    }
    return Array.from(groups.values()).map(({ rows, total }) => {
      const first = rows[0];
      const isBulk = rows.length > 1;
      return {
        ...first,
        amount: total,
        invoiceNumber: isBulk
          ? rows.map(x => `${x.invoiceNumber}: ${formatCurrency(Number(x.amount) || 0)}`).join(" • ")
          : first.invoiceNumber,
        _isBulk: isBulk,
        _allocations: rows,
      } as Receipt & { _isBulk: boolean; _allocations: Receipt[] };
    });
  }, [filteredReceiptsRaw, formatCurrency]);

  const filteredQuotations = quotations.filter((q) => matchCustomer(q.customer) && isInDateRange(q.date) && matchStatus(q.status) && matchSearchFields(q.number, q.customer, q.notes || "", q.projectName || ""));

  // --- All Sales data combined ---
  const allSalesDataRaw = [
    ...invoices.map((inv) => ({ ...inv, type: "Invoice" as const, statusStyle: invoiceStatusStyles[inv.status] })),
    ...salesOrders.map((so) => ({ id: so.id, number: so.number, customer: so.customer, date: so.date, dueDate: so.deliveryDate, amount: so.amount, status: so.status, type: "Sales Order" as const, statusStyle: soStatusStyles[so.status] })),
    ...receipts.map((r) => ({ id: r.id, number: r.number, customer: r.customer, date: r.date, dueDate: r.invoiceNumber, amount: r.amount, status: r.paymentMethod, type: "Receipt" as const, statusStyle: "bg-primary/10 text-primary hover:bg-primary/20 border-0" })),
    ...quotations.map((q) => ({ id: q.id, number: q.number, customer: q.customer, date: q.date, dueDate: q.dueDate, amount: q.amount, status: q.status, type: "Quotation" as const, statusStyle: quotationStatusStyles[q.status] || "" })),
  ];
  const allSalesData = allSalesDataRaw
    .filter((item) => matchCustomer(item.customer) && isInDateRange(item.date) && matchStatus(item.status) && matchSearchFields(item.number, item.customer))
    .filter((item) => filterType === "all" || item.type === filterType)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Pagination hooks - MUST be before any early returns
  const pgInvoices = usePagination(filteredInvoices);
  const pgSO = usePagination(filteredSO);
  const pgReceipts = usePagination(filteredReceipts);
  const pgQuotations = usePagination(filteredQuotations);
  const pgAll = usePagination(allSalesData);

  // Reset pages when tab or filters change
  useEffect(() => { pgInvoices.resetPage(); pgSO.resetPage(); pgReceipts.resetPage(); pgQuotations.resetPage(); pgAll.resetPage(); }, [searchQuery, filterCustomer, filterType, filterDateRange, filterStatus, activeTab]);

  const clearFilters = () => { setSearchQuery(""); setFilterCustomer("all"); setFilterType("all"); setFilterDateRange("all"); setFilterStatus("all"); setCustomDateFrom(""); setCustomDateTo(""); };
  const hasActiveFilters = searchQuery.trim() !== "" || filterCustomer !== "all" || filterType !== "all" || filterDateRange !== "all" || filterStatus !== "all";

  // ========== EARLY RETURNS FOR FORM / PREVIEW VIEWS ==========
  if (view === "preview" && previewInvoice) {
    return <InvoicePreview invoice={previewInvoice} onClose={goList} receipts={receipts} />;
  }
  if (view === "so-preview" && previewSO) {
    return <SalesOrderPreview order={previewSO.order} onClose={goList} showPrices={previewSO.showPrices} />;
  }
  if (view === "return-form") {
    return <ReturnInvoiceForm invoices={invoices.filter(i => !i.isReturn)} inventory={inventory} onSaveReturn={handleProcessReturn} onCancel={goList} nextReturnNumber={`RET-${String(invoices.filter(i => i.isReturn).length + 1).padStart(3, "0")}`} accounts={cloudAccounts as any} />;
  }
  if (view === "form-receipt-for-invoice" && receivePaymentInvoice) {
    return <ReceiptForm onSave={handleSaveReceipt} onSaveBulk={handleSaveBulkReceipts} onCancel={goList} customers={customers} invoices={invoices} receipts={receipts} editReceipt={null} nextNumber={`RCP-${String(receipts.length + 1).padStart(3, "0")}`} accounts={cloudAccounts as any} prefillInvoice={receivePaymentInvoice} />;
  }
  if (view === "quotation-form") {
    return <InvoiceForm onSave={(inv) => handleSaveQuotation(inv as unknown as Quotation)} onCancel={goList} customers={customers} inventory={inventory} editInvoice={editQuotation as unknown as Invoice | null} onAddCustomer={handleAddCustomer} nextNumber={editQuotation ? editQuotation.number : `QTN-${String(quotations.length + 1).padStart(3, "0")}`} />;
  }
  if (view === "form") {
    if (activeTab === "sales-orders" || editOrder) {
      return <SalesOrderForm onSave={handleSaveSO} onCancel={goList} customers={customers} inventory={inventory} editOrder={editOrder} onAddCustomer={handleAddCustomer} nextNumber={editOrder ? editOrder.number : `SO-${String(salesOrders.length + 1).padStart(3, "0")}`} />;
    }
    if (activeTab === "receipts" || editReceipt) {
      return <ReceiptForm onSave={handleSaveReceipt} onSaveBulk={handleSaveBulkReceipts} onCancel={goList} customers={customers} invoices={invoices} receipts={receipts} editReceipt={editReceipt} nextNumber={editReceipt ? editReceipt.number : `RCP-${String(receipts.length + 1).padStart(3, "0")}`} accounts={cloudAccounts as any} />;
    }
    return <InvoiceForm onSave={handleSaveInvoice} onCancel={goList} customers={customers} inventory={inventory} editInvoice={editInvoice} onAddCustomer={handleAddCustomer} nextNumber={editInvoice ? editInvoice.number : `INV-${String(invoices.length + 1).padStart(3, "0")}`} receipts={receipts} />;
  }

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

  const newButtonLabel = activeTab === "sales-orders" ? "New Sales Order" : activeTab === "receipts" ? "New Receipt" : activeTab === "quotations" ? "New Quotation" : activeTab === "returns" ? "New Return" : "New Invoice";
  const handleNewClick = () => {
    setEditInvoice(null); setEditOrder(null); setEditReceipt(null); setEditQuotation(null);
    if (activeTab === "quotations") { setView("quotation-form"); }
    else if (activeTab === "returns") { setView("return-form"); }
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
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Search</span>
        <Input placeholder="Search by number, customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-[200px] h-8 text-sm" />
      </div>
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="quotations" className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Quotations</TabsTrigger>
          <TabsTrigger value="sales-orders" className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Sales Orders</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2"><FileText className="w-4 h-4" />Invoices</TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2"><RotateCcw className="w-4 h-4" />Returns</TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2"><ReceiptIcon className="w-4 h-4" />Receipts</TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2"><List className="w-4 h-4" />All</TabsTrigger>
        </TabsList>

        {/* Quotations Tab */}
        <TabsContent value="quotations">
          {FilterBar({})}
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
                  {pgQuotations.paginatedItems.map((q) => (
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
            <TablePagination currentPage={pgQuotations.currentPage} totalPages={pgQuotations.totalPages} totalItems={pgQuotations.totalItems} onPageChange={pgQuotations.goToPage} itemLabel="quotation" />
          </div>
        </TabsContent>

        {/* Sales Orders Tab */}
        <TabsContent value="sales-orders">
          {FilterBar({})}
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
                  {pgSO.paginatedItems.map((so) => (
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
                            <button className="p-1.5 rounded hover:bg-success/10 transition-colors" title="Approve → Convert to Invoice" onClick={() => setConfirmApproveSO(so)}>
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
            <TablePagination currentPage={pgSO.currentPage} totalPages={pgSO.totalPages} totalItems={pgSO.totalItems} onPageChange={pgSO.goToPage} itemLabel="order" />
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          {FilterBar({})}
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-xs text-muted-foreground">{filteredInvoices.length} invoice(s)</span>
          </div>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                     <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                     <th className="text-left px-4 py-3 font-medium text-muted-foreground">Doc No.</th>
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
                  {pgInvoices.paginatedItems.map((inv) => {
                    const { invoiceReceipts: invReceipts, totalPaid, remaining } = getInvoicePaymentSummary(inv, receipts);
                    const isExpanded = expandedInvoice === inv.id;
                    return (
                      <React.Fragment key={inv.id}>
                        <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{inv.number}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{inv.documentNumber || "—"}</td>
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
                              {inv.status !== "approved" && inv.status !== "paid" && (
                                <button className="p-1.5 rounded hover:bg-success/10 transition-colors" title="Approve — Deduct Stock" onClick={() => handleApproveInvoice(inv)}><CheckCircle className="w-4 h-4 text-success" /></button>
                              )}
                              <button className="p-1.5 rounded hover:bg-success/10 transition-colors" title="Receive Payment" onClick={() => { setReceivePaymentInvoice(inv); setView("form-receipt-for-invoice"); }}><CreditCard className="w-4 h-4 text-primary" /></button>
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
                            <td colSpan={10} className="px-4 py-2 bg-muted/20">
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
                  {filteredInvoices.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No invoices found.</td></tr>}
                </tbody>
              </table>
            </div>
            <TablePagination currentPage={pgInvoices.currentPage} totalPages={pgInvoices.totalPages} totalItems={pgInvoices.totalItems} onPageChange={pgInvoices.goToPage} itemLabel="invoice" />
          </div>
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns">
          {FilterBar({})}
          {(() => {
            const returnInvoices = invoices.filter((inv) => inv.isReturn);
            const filteredReturns = returnInvoices.filter((i) => matchCustomer(i.customer) && isInDateRange(i.date) && matchSearchFields(i.number, i.customer, i.returnedFrom || "", i.notes || ""));
            return (
              <>
                <div className="flex items-center justify-end px-4 py-2">
                  <span className="text-xs text-muted-foreground">{filteredReturns.length} return(s)</span>
                </div>
                <div className="bg-card rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Return #</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Original Invoice</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Type</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Items</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReturns.map((ret) => {
                          const isExchange = ret.notes?.toLowerCase().includes("exchange");
                          return (
                            <tr key={ret.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{ret.number}</td>
                              <td className="px-4 py-3 text-muted-foreground">{ret.returnedFrom || "—"}</td>
                              <td className="px-4 py-3">{ret.customer}</td>
                              <td className="px-4 py-3 text-muted-foreground">{ret.date}</td>
                              <td className="px-4 py-3 text-right font-semibold text-destructive">{formatCurrency(ret.amount)}</td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant="outline" className={isExchange ? "border-primary text-primary" : "border-destructive text-destructive"}>
                                  {isExchange ? <><ArrowLeftRight className="w-3 h-3 mr-1 inline" />Exchange</> : <><RotateCcw className="w-3 h-3 mr-1 inline" />Return</>}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                                {ret.items.map((i) => `${i.description} x${Math.abs(i.qty)}`).join(", ")}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View" onClick={() => { setPreviewInvoice(ret); setView("preview"); }}>
                                    <Eye className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                  <ConfirmDeleteDialog onConfirm={() => handleDeleteInvoice(ret.id)} title="Delete Return?" description={`Delete return ${ret.number}?`} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredReturns.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No returns found. Click "New Return" to process a return or exchange.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="receipts">
          {FilterBar({})}
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
                  {pgReceipts.paginatedItems.map((r) => (
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
            <TablePagination currentPage={pgReceipts.currentPage} totalPages={pgReceipts.totalPages} totalItems={pgReceipts.totalItems} onPageChange={pgReceipts.goToPage} itemLabel="receipt" />
          </div>
        </TabsContent>

        {/* Sales All Tab */}
        <TabsContent value="all">
          {FilterBar({ showType: true })}
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
                  {pgAll.paginatedItems.map((item) => (
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
            <TablePagination currentPage={pgAll.currentPage} totalPages={pgAll.totalPages} totalItems={pgAll.totalItems} onPageChange={pgAll.goToPage} itemLabel="record" />
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog for SO → Invoice */}
      <AlertDialog open={!!confirmApproveSO} onOpenChange={(open) => { if (!open) setConfirmApproveSO(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <strong>{confirmApproveSO?.number}</strong> and convert it to an Invoice? 
              This will deduct inventory stock and create a new invoice for <strong>{confirmApproveSO?.customer}</strong>.
              {confirmApproveSO?.advancePayment && confirmApproveSO.advancePayment > 0 && (
                <> A receipt of <strong>{formatCurrency(confirmApproveSO.advancePayment)}</strong> (advance payment) will also be created.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmApproveSO) { handleApproveSO(confirmApproveSO); setConfirmApproveSO(null); } }}>
              Yes, Convert to Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
