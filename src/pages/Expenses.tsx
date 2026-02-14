import { expenses } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const categoryColors: Record<string, string> = {
  Software: "bg-primary/10 text-primary",
  Office: "bg-accent/10 text-accent",
  Marketing: "bg-warning/10 text-warning",
  Utilities: "bg-muted text-muted-foreground",
  Travel: "bg-success/10 text-success",
  Payroll: "bg-destructive/10 text-destructive",
  Insurance: "bg-secondary text-secondary-foreground",
};

export default function Expenses() {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track and manage business expenses</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <div className="kpi-card">
        <p className="text-sm text-muted-foreground">Total Expenses (This Period)</p>
        <p className="text-2xl font-bold">{formatCurrency(total)}</p>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                <td className="px-4 py-3">
                  <Badge className={`${categoryColors[e.category] || "bg-muted text-muted-foreground"} border-0`}>
                    {e.category}
                  </Badge>
                </td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
