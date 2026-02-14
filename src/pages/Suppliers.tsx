import { suppliers } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone } from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export default function Suppliers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage your supplier contacts</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.company}</td>
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(s.totalPaid)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${s.outstanding > 0 ? "text-warning" : "text-success"}`}>
                  {formatCurrency(s.outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
