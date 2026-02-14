import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { monthlySales, kpiData } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const reports = [
  { key: "pnl", title: "Profit & Loss", desc: "Revenue, expenses, and net profit summary" },
  { key: "cashflow", title: "Cash Flow", desc: "Cash inflows and outflows analysis" },
  { key: "overview", title: "Overview", desc: "Key financial metrics at a glance" },
];

const expenseBreakdown = [
  { name: "Payroll", value: 42000, color: "hsl(0, 72%, 51%)" },
  { name: "Office", value: 5500, color: "hsl(217, 71%, 45%)" },
  { name: "Marketing", value: 3200, color: "hsl(38, 92%, 50%)" },
  { name: "Software", value: 2400, color: "hsl(142, 71%, 45%)" },
  { name: "Travel", value: 1800, color: "hsl(270, 60%, 50%)" },
  { name: "Other", value: 1650, color: "hsl(215, 16%, 47%)" },
];

export default function Reports() {
  const [active, setActive] = useState<string | null>(null);

  if (!active) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">Financial reports and analytics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => (
            <button key={r.key} onClick={() => setActive(r.key)} className="bg-card rounded-lg border p-6 text-left hover:shadow-md hover:border-primary/30 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold">{r.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setActive(null)} className="text-primary hover:underline text-sm">← Back to Reports</button>
        <h1 className="text-2xl font-bold">{reports.find((r) => r.key === active)?.title}</h1>
      </div>

      {active === "pnl" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="kpi-card"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-primary">{formatCurrency(kpiData.totalSales)}</p></div>
            <div className="kpi-card"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-bold text-destructive">{formatCurrency(kpiData.totalExpenses)}</p></div>
            <div className="kpi-card"><p className="text-sm text-muted-foreground">Net Profit</p><p className="text-2xl font-bold text-success">{formatCurrency(kpiData.netProfit)}</p></div>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Monthly Revenue vs Expenses</h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expenses" opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {active === "cashflow" && (
        <>
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Cash Flow Trend</h2>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={monthlySales.map((m) => ({ ...m, net: m.sales - m.expenses }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} name="Inflow" />
                <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} name="Outflow" />
                <Line type="monotone" dataKey="net" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="5 5" name="Net Cash Flow" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {active === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Expense Breakdown</h2>
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseBreakdown} dataKey="value" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                      {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {expenseBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium ml-auto">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Key Metrics</h2>
            {[
              { label: "Bank Balance", value: kpiData.bankBalance, color: "text-primary" },
              { label: "Outstanding Receivables", value: kpiData.outstandingReceivables, color: "text-warning" },
              { label: "Outstanding Payables", value: kpiData.outstandingPayables, color: "text-destructive" },
              { label: "Profit Margin", value: `${((kpiData.netProfit / kpiData.totalSales) * 100).toFixed(1)}%`, color: "text-success", raw: true },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <span className={`font-semibold ${m.color}`}>{(m as any).raw ? m.value : formatCurrency(m.value as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
