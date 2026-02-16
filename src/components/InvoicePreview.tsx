import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import type { Invoice } from "@/data/mockData";
import { useSettings } from "@/contexts/SettingsContext";

type Props = {
  invoice: Invoice;
  onClose: () => void;
};

export function InvoicePreview({ invoice, onClose }: Props) {
  const { formatCurrency } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const subtotal = invoice.items.reduce((s, i) => s + i.amount, 0);
  const taxRate = invoice.tax ?? 10;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice ${invoice.number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; }
        .text-right { text-align: right; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company { font-size: 24px; font-weight: bold; color: #1e40af; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .badge-paid { background: #dcfce7; color: #16a34a; }
        .badge-pending { background: #fef3c7; color: #d97706; }
        .badge-overdue { background: #fee2e2; color: #dc2626; }
        .totals { margin-left: auto; width: 250px; }
        .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
        .total-row { border-top: 2px solid #1e40af; font-weight: bold; font-size: 16px; padding-top: 10px; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleDownloadPDF = () => {
    // Use print-to-PDF via browser
    handlePrint();
  };

  const statusClass = {
    paid: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    overdue: "bg-destructive/10 text-destructive",
  }[invoice.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Invoice Preview</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-1" /> Download PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div ref={printRef} className="bg-card border rounded-lg p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">CloudBooks</h1>
            <p className="text-sm text-muted-foreground mt-1">123 Business Ave, Suite 100</p>
            <p className="text-sm text-muted-foreground">New York, NY 10001</p>
            <p className="text-sm text-muted-foreground">admin@cloudbooks.com</p>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-muted-foreground/50">INVOICE</h2>
            <p className="text-sm font-semibold mt-2">{invoice.number}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold uppercase ${statusClass}`}>
              {invoice.status}
            </span>
          </div>
        </div>

        {/* Bill To + Dates */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Bill To</p>
            <p className="font-semibold">{invoice.customer}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice Date:</span>
              <span>{invoice.date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date:</span>
              <span>{invoice.dueDate}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-primary/20">
              <th className="text-left py-3 text-xs uppercase text-muted-foreground font-semibold">Description</th>
              <th className="text-right py-3 text-xs uppercase text-muted-foreground font-semibold">Qty</th>
              <th className="text-right py-3 text-xs uppercase text-muted-foreground font-semibold">Rate</th>
              <th className="text-right py-3 text-xs uppercase text-muted-foreground font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-3">{item.description}</td>
                <td className="py-3 text-right">{item.qty}</td>
                <td className="py-3 text-right">{formatCurrency(item.rate)}</td>
                <td className="py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-primary pt-2 text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 pt-6 border-t">
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">Thank you for your business!</p>
        </div>
      </div>
    </div>
  );
}
