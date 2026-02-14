import { customers } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone } from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export default function Customers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer contacts</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div key={c.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {c.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.name}</p>
                <p className="text-sm text-muted-foreground truncate">{c.company}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{c.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{c.phone}</span>
              </div>
            </div>
            <div className="flex justify-between mt-4 pt-4 border-t text-sm">
              <div>
                <p className="text-muted-foreground">Total Billed</p>
                <p className="font-semibold">{formatCurrency(c.totalBilled)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Outstanding</p>
                <p className={`font-semibold ${c.outstanding > 0 ? "text-warning" : "text-success"}`}>
                  {formatCurrency(c.outstanding)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
