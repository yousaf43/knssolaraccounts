import { invoices } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Download, Eye } from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const statusStyles: Record<string, string> = {
  paid: "bg-success/10 text-success hover:bg-success/20 border-0",
  pending: "bg-warning/10 text-warning hover:bg-warning/20 border-0",
  overdue: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0",
};

export default function Invoices() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">Manage your invoices and billing</p>
        </div>
        <Button>
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
                      <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Download PDF">
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
