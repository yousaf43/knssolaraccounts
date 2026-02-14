import { useState } from "react";
import { getInitialInvoices, getInitialCustomers, type Invoice } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Download, Eye, Trash2, Edit } from "lucide-react";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoicePreview } from "@/components/InvoicePreview";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const statusStyles: Record<string, string> = {
  paid: "bg-success/10 text-success hover:bg-success/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  overdue: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
};

export default function Invoices() {
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>("cb-invoices", getInitialInvoices());
  const [customers] = useLocalStorage("cb-customers", getInitialCustomers());
  const [view, setView] = useState<"list" | "form" | "preview">("list");
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const nextNumber = `INV-${String(invoices.length + 1).padStart(3, "0")}`;

  const handleSave = (invoice: Invoice) => {
    setInvoices((prev) => {
      const exists = prev.find((i) => i.id === invoice.id);
      if (exists) return prev.map((i) => (i.id === invoice.id ? invoice : i));
      return [...prev, invoice];
    });
    setView("list");
    setEditInvoice(null);
    toast.success(editInvoice ? "Invoice updated" : "Invoice created");
  };

  const handleDelete = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    toast.success("Invoice deleted");
  };

  if (view === "form") {
    return (
      <div className="max-w-4xl mx-auto">
        <InvoiceForm
          customers={customers}
          onSave={handleSave}
          onCancel={() => { setView("list"); setEditInvoice(null); }}
          editInvoice={editInvoice}
          nextNumber={nextNumber}
        />
      </div>
    );
  }

  if (view === "preview" && previewInvoice) {
    return (
      <div className="max-w-4xl mx-auto">
        <InvoicePreview invoice={previewInvoice} onClose={() => { setView("list"); setPreviewInvoice(null); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">Manage your invoices and billing</p>
        </div>
        <Button onClick={() => { setEditInvoice(null); setView("form"); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
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
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{inv.number}</td>
                  <td className="px-4 py-3">{inv.customer}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.date}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={statusStyles[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View" onClick={() => { setPreviewInvoice(inv); setView("preview"); }}>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit" onClick={() => { setEditInvoice(inv); setView("form"); }}>
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Download PDF" onClick={() => { setPreviewInvoice(inv); setView("preview"); }}>
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Delete" onClick={() => handleDelete(inv.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No invoices yet. Create your first invoice!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
