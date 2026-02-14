import { Landmark, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { recentTransactions } from "@/data/mockData";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const accounts = [
  { name: "Business Checking", bank: "Chase Bank", balance: 148200, number: "****4521" },
  { name: "Savings Account", bank: "Chase Bank", balance: 50200, number: "****7833" },
];

export default function Banking() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banking</h1>
        <p className="text-muted-foreground text-sm">Bank accounts and transaction records</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div key={acc.number} className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Landmark className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{acc.name}</p>
                <p className="text-xs text-muted-foreground">{acc.bank} · {acc.number}</p>
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(acc.balance)}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  tx.type === "credit" ? "bg-success/10" : "bg-destructive/10"
                }`}>
                  {tx.type === "credit" ? (
                    <ArrowUpRight className="w-4 h-4 text-success" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${tx.type === "credit" ? "text-success" : "text-destructive"}`}>
                {tx.type === "credit" ? "+" : ""}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
