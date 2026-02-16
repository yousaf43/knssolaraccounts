import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useSettings } from "@/contexts/SettingsContext";

// Aging data for receivables
const receivableAging = [
  { name: "Older", value: 15200, color: "hsl(0, 72%, 51%)" },
  { name: "Current", value: 12500, color: "hsl(217, 71%, 45%)" },
  { name: "1-7 Days", value: 8750, color: "hsl(142, 71%, 45%)" },
  { name: "8-14 Days", value: 4800, color: "hsl(38, 92%, 50%)" },
  { name: "15-21 Days", value: 2200, color: "hsl(270, 60%, 50%)" },
  { name: "22-28 Days", value: 1500, color: "hsl(215, 16%, 47%)" },
  { name: "Future", value: 650, color: "hsl(160, 60%, 45%)" },
];

// Aging data for payables
const payableAging = [
  { name: "Older", value: 6000, color: "hsl(0, 72%, 51%)" },
  { name: "Current", value: 9800, color: "hsl(217, 71%, 45%)" },
  { name: "1-7 Days", value: 5200, color: "hsl(142, 71%, 45%)" },
  { name: "8-14 Days", value: 3400, color: "hsl(38, 92%, 50%)" },
  { name: "15-21 Days", value: 4100, color: "hsl(270, 60%, 50%)" },
  { name: "22-28 Days", value: 2200, color: "hsl(215, 16%, 47%)" },
  { name: "Future", value: 1400, color: "hsl(160, 60%, 45%)" },
];

const bankAccounts = [
  { name: "Cash on hand", code: "230901", balance: 45200 },
  { name: "Current account 1", code: "230902", balance: 82400 },
  { name: "Current account 2", code: "230903", balance: 38600 },
  { name: "Savings account 1", code: "230904", balance: 25000 },
  { name: "Savings account 2", code: "230905", balance: 7200 },
];

const productStats = [
  { label: "Low Stock", value: 3, color: "text-warning" },
  { label: "Out of Stock", value: 1, color: "text-destructive" },
  { label: "Oversold", value: 0, color: "text-destructive" },
  { label: "In Stock", value: 24, color: "text-primary" },
];

function AgingChart({ data }: { data: typeof receivableAging }) {
  const { formatCurrency } = useSettings();
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2} strokeWidth={0}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingTable({ data, title, totalLabel }: { data: typeof receivableAging; title: string; totalLabel: string }) {
  const { formatCurrency } = useSettings();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{totalLabel}</h3>
        <span className="font-semibold text-sm">{formatCurrency(total)}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1.5 text-muted-foreground font-medium">{title}</th>
            <th className="text-right py-1.5 text-muted-foreground font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.name} className="border-b border-border/50">
              <td className="py-1.5">{item.name}</td>
              <td className="py-1.5 text-right">{formatCurrency(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 text-center">
        <Link to="/reports" className="text-xs text-primary hover:underline font-medium">
          View Report
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { formatCurrency } = useSettings();
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <p className="text-muted-foreground text-sm">Welcome</p>
        <h1 className="text-2xl font-bold">Admin User</h1>
      </div>

      {/* Top Row: Receivable Summary | Payable Summary | Bank + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Receivable Summary */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4 text-foreground">Account Receivable Summary</h2>
          <AgingChart data={receivableAging} />
        </div>

        {/* Account Payable Summary */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4 text-foreground">Account Payable Summary</h2>
          <AgingChart data={payableAging} />
        </div>

        {/* Right Column: Bank Balances + Products */}
        <div className="space-y-6">
          {/* Bank Balances */}
          <div className="bg-card rounded-lg border p-5">
            <h2 className="text-sm font-semibold mb-3 text-foreground">Bank Balances</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Bank</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.map((acc) => (
                  <tr key={acc.code} className="border-b border-border/50">
                    <td className="py-1.5">
                      <Link to="/banking" className="text-primary hover:underline">
                        {acc.name} - ({acc.code})
                      </Link>
                    </td>
                    <td className="py-1.5 text-right">{formatCurrency(acc.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Products */}
          <div className="bg-card rounded-lg border p-5">
            <h2 className="text-sm font-semibold mb-3 text-foreground">Products</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((stat) => (
                  <tr key={stat.label} className="border-b border-border/50">
                    <td className="py-2">{stat.label}</td>
                    <td className={`py-2 text-right font-semibold ${stat.color}`}>{stat.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Row: Receivable Table | Payable Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-5">
          <AgingTable data={receivableAging} title="Unpaid Invoices" totalLabel="Total Receivable" />
        </div>
        <div className="bg-card rounded-lg border p-5">
          <AgingTable data={payableAging} title="Unpaid Bills" totalLabel="Total Payable" />
        </div>
      </div>
    </div>
  );
}
