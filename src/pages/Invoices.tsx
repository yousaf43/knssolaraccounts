import { useState } from "react";
import { getInitialInvoices, getInitialCustomers, getInitialSalesOrders, getInitialReceipts, type Invoice, type SalesOrder, type Receipt } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Eye, Trash2, Edit, Download, ShoppingCart, FileText, Receipt as ReceiptIcon, List } from "lucide-react";
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
  const allSalesData = [
    ...invoices.map((inv) => ({ ...inv, type: "Invoice" as const, statusStyle: invoiceStatusStyles[inv.status] })),
    ...salesOrders.map((so) => ({ id: so.id, number: so.number, customer: so.customer, date: so.date, dueDate: so.deliveryDate, amount: so.amount, status: so.status, type: "Sales Order" as const, statusStyle: soStatusStyles[so.status] })),
    ...receipts.map((r) => ({ id: r.id, number: r.number, customer: r.customer, date: r.date, dueDate: r.invoiceNumber, amount: r.amount, status: r.paymentMethod, type: "Receipt" as const, statusStyle: "bg-primary/10 text-primary hover:bg-primary/20 border-0" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const newButtonLabel = activeTab === "sales-orders" ? "New Sales Order" : activeTab === "receipts" ? "New Receipt" : "New Invoice";
  const handleNewClick = () => { setEditInvoice(null); setEditOrder(null); setEditReceipt(null); setView("form"); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm">Manage sales orders, invoices, receipts and more</p>
        </div>
        {activeTab !== "all" && (
          <Button onClick={handleNewClick}>
            <Plus className="w-4 h-4 mr-2" />
            {newButtonLabel}
          </Button>
        )}
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
                  {salesOrders.map((so) => (
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
                  {salesOrders.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No sales orders yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
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
                  {invoices.map((inv) => (
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
                  {invoices.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No invoices yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts">
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
                  {receipts.map((r) => (
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
                  {receipts.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No receipts yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Sales All Tab */}
        <TabsContent value="all">
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
                  {allSalesData.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No sales data yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
