import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { kpiData, monthlySales, recentTransactions } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const kpis = [
  { label: "Total Sales", value: kpiData.totalSales, icon: DollarSign, trend: "+12.5%", up: true, color: "text-primary" },
  { label: "Net Profit", value: kpiData.netProfit, icon: TrendingUp, trend: "+8.2%", up: true, color: "text-success" },
  { label: "Expenses", value: kpiData.totalExpenses, icon: TrendingDown, trend: "+3.1%", up: false, color: "text-destructive" },
  { label: "Receivables", value: kpiData.outstandingReceivables, icon: CreditCard, trend: "-5.4%", up: true, color: "text-warning" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Financial overview for your business</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{kpi.label}</span>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpi.value)}</p>
            <div className="flex items-center gap-1 mt-1">
              {kpi.up ? (
                <ArrowUpRight className="w-3 h-3 text-success" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-destructive" />
              )}
              <span className={`text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
                {kpi.trend}
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue vs Expenses</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Sales" />
              <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expenses" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
          <div className="space-y-4">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    tx.type === "credit" ? "text-success" : "text-destructive"
                  }`}
                >
                  {tx.type === "credit" ? "+" : ""}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground mb-1">Bank Balance</p>
          <p className="text-xl font-bold">{formatCurrency(kpiData.bankBalance)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground mb-1">Outstanding Payables</p>
          <p className="text-xl font-bold">{formatCurrency(kpiData.outstandingPayables)}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground mb-1">Invoice Status</p>
          </div>
          <div className="flex gap-2 mt-1">
            <Badge className="bg-success/10 text-success hover:bg-success/20 border-0">2 Paid</Badge>
            <Badge className="bg-warning/10 text-warning hover:bg-warning/20 border-0">2 Pending</Badge>
            <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-0">2 Overdue</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
