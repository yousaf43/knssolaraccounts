import { useState, useMemo } from "react";
import { BarChart3, Star, ArrowLeft, Download, Filter } from "lucide-react";
import { monthlySales, kpiData } from "@/data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

type Report = {
  code: string;
  title: string;
  category: string;
  section: "general" | "analytical";
  favorite?: boolean;
};

const allReports: Report[] = [
  // General Reports - Sales
  { code: "028", title: "Sale Invoices/Credits (By Date)", category: "Sales", section: "general", favorite: true },
  { code: "029", title: "Sale Invoices/Credits (By Customer)", category: "Sales", section: "general", favorite: true },
  { code: "034", title: "Customer Statement", category: "Sales", section: "general", favorite: true },
  { code: "037", title: "Unpaid Sale Invoices/Credits (By Customer)", category: "Sales", section: "general", favorite: true },
  { code: "084", title: "Product Sale Detail (By Date)", category: "Sales", section: "general", favorite: true },
  { code: "085", title: "Product Sale Detail (By Product)", category: "Sales", section: "general", favorite: true },
  { code: "088", title: "Product Sale Summary", category: "Sales", section: "general", favorite: true },
  { code: "235", title: "Category Sale Summary", category: "Sales", section: "general", favorite: true },

  // General Reports - Purchases
  { code: "040", title: "Purchase Invoices (By Date)", category: "Purchases", section: "general" },
  { code: "041", title: "Purchase Invoices (By Supplier)", category: "Purchases", section: "general" },
  { code: "042", title: "Supplier Statement", category: "Purchases", section: "general" },
  { code: "043", title: "Unpaid Purchase Invoices (By Supplier)", category: "Purchases", section: "general" },
  { code: "090", title: "Product Purchase Detail (By Date)", category: "Purchases", section: "general" },
  { code: "091", title: "Product Purchase Summary", category: "Purchases", section: "general" },

  // General Reports - Combined Statements
  { code: "050", title: "Trial Balance", category: "Combined Statements", section: "general" },
  { code: "051", title: "General Ledger", category: "Combined Statements", section: "general" },
  { code: "052", title: "Day Book", category: "Combined Statements", section: "general" },

  // General Reports - Cash & Bank
  { code: "060", title: "Cash Book", category: "Cash & Bank", section: "general" },
  { code: "061", title: "Bank Book", category: "Cash & Bank", section: "general" },
  { code: "062", title: "Bank Reconciliation", category: "Cash & Bank", section: "general" },
  { code: "063", title: "Payment Receipts Summary", category: "Cash & Bank", section: "general" },

  // General Reports - Inventory
  { code: "078", title: "Products List", category: "Inventory", section: "general", favorite: true },
  { code: "080", title: "Stock Quantity", category: "Inventory", section: "general", favorite: true },
  { code: "082", title: "Out of Stock", category: "Inventory", section: "general", favorite: true },
  { code: "083", title: "Low Stock", category: "Inventory", section: "general", favorite: true },
  { code: "148", title: "Stock Valuation", category: "Inventory", section: "general", favorite: true },
  { code: "173", title: "Opening Stock", category: "Inventory", section: "general" },
  { code: "180", title: "Stock Adjustment Detail (By Date)", category: "Inventory", section: "general", favorite: true },
  { code: "366", title: "Inventory Transactions Summary By Product", category: "Inventory", section: "general" },

  // General Reports - Taxation
  { code: "100", title: "Sales Tax Report", category: "Taxation", section: "general" },
  { code: "101", title: "Purchase Tax Report", category: "Taxation", section: "general" },
  { code: "102", title: "Tax Summary", category: "Taxation", section: "general" },

  // General Reports - Management
  { code: "121", title: "Profit & Loss Account", category: "Management", section: "general", favorite: true },
  { code: "123", title: "Profit & Loss Account Summary", category: "Management", section: "general", favorite: true },
  { code: "125", title: "Profit & Loss Account Detailed", category: "Management", section: "general", favorite: true },
  { code: "127", title: "Income Statement", category: "Management", section: "general", favorite: true },
  { code: "129", title: "Balance Sheet", category: "Management", section: "general", favorite: true },
  { code: "135", title: "Nominal Activities", category: "Management", section: "general", favorite: true },
  { code: "244", title: "Product Transaction Detail", category: "Management", section: "general" },
  { code: "258", title: "Expenses Nominal Summary", category: "Management", section: "general", favorite: true },
  { code: "307", title: "Budget Income Statement", category: "Management", section: "general", favorite: true },
  { code: "381", title: "Depreciation Details", category: "Management", section: "general", favorite: true },
  { code: "383", title: "Fixed Assets Details", category: "Management", section: "general", favorite: true },

  // Analytical Reports - Sales
  { code: "200", title: "Sales Trend Analysis", category: "Sales", section: "analytical" },
  { code: "201", title: "Customer Revenue Analysis", category: "Sales", section: "analytical" },
  { code: "202", title: "Sales Growth Report", category: "Sales", section: "analytical" },
  { code: "203", title: "Top Selling Products", category: "Sales", section: "analytical" },

  // Analytical Reports - Purchases
  { code: "210", title: "Purchase Trend Analysis", category: "Purchases", section: "analytical" },
  { code: "211", title: "Supplier Spending Analysis", category: "Purchases", section: "analytical" },
  { code: "272", title: "Bills Data", category: "Purchases", section: "analytical", favorite: true },

  // Analytical Reports - Cash & Bank
  { code: "220", title: "Cash Flow Analysis", category: "Cash & Bank", section: "analytical" },
  { code: "221", title: "Bank Balance Trend", category: "Cash & Bank", section: "analytical" },

  // Analytical Reports - Inventory
  { code: "230", title: "Inventory Aging Report", category: "Inventory", section: "analytical" },
  { code: "231", title: "Stock Movement Analysis", category: "Inventory", section: "analytical" },
  { code: "232", title: "Dead Stock Report", category: "Inventory", section: "analytical" },

  // Analytical Reports - Management
  { code: "240", title: "Profitability Analysis", category: "Management", section: "analytical" },
  { code: "241", title: "Expense Trend Analysis", category: "Management", section: "analytical" },
  { code: "242", title: "Revenue vs Expense Comparison", category: "Management", section: "analytical" },
];

const generalCategories = ["Favourites", "Sales", "Purchases", "Combined Statements", "Cash & Bank", "Inventory", "Taxation", "Management"];
const analyticalCategories = ["Favourites", "Sales", "Purchases", "Cash & Bank", "Inventory", "Management"];

const expenseBreakdown = [
  { name: "Payroll", value: 42000, color: "hsl(0, 72%, 51%)" },
  { name: "Office", value: 5500, color: "hsl(217, 71%, 45%)" },
  { name: "Marketing", value: 3200, color: "hsl(38, 92%, 50%)" },
  { name: "Software", value: 2400, color: "hsl(142, 71%, 45%)" },
  { name: "Travel", value: 1800, color: "hsl(270, 60%, 50%)" },
  { name: "Other", value: 1650, color: "hsl(215, 16%, 47%)" },
];

function ReportList({ reports, onSelect }: { reports: Report[]; onSelect: (r: Report) => void }) {
  // Split into two columns
  const mid = Math.ceil(reports.length / 2);
  const col1 = reports.slice(0, mid);
  const col2 = reports.slice(mid);

  if (reports.length === 0) {
    return <p className="text-muted-foreground text-sm py-6 text-center">No reports in this category</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
      {[col1, col2].map((col, ci) => (
        <div key={ci}>
          {col.map((r) => (
            <button
              key={r.code}
              onClick={() => onSelect(r)}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors group"
            >
              <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">{r.code}</span>
              <span className="text-sm text-primary font-medium group-hover:underline flex-1">{r.title}</span>
              <Star className={`w-4 h-4 shrink-0 ${r.favorite ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReportDetail({ report, onBack }: { report: Report; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-1 text-primary hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </button>
        <h1 className="text-xl font-bold">{report.code} - {report.title}</h1>
      </div>

      {/* P&L Reports */}
      {["121", "123", "125"].includes(report.code) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-primary">{formatCurrency(kpiData.totalSales)}</p></div>
            <div className="bg-card border rounded-lg p-4"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-bold text-destructive">{formatCurrency(kpiData.totalExpenses)}</p></div>
            <div className="bg-card border rounded-lg p-4"><p className="text-sm text-muted-foreground">Net Profit</p><p className="text-2xl font-bold text-success">{formatCurrency(kpiData.netProfit)}</p></div>
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

      {/* Cash Flow */}
      {["220", "060", "061"].includes(report.code) && (
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
      )}

      {/* Income Statement / Balance Sheet / Overview */}
      {["127", "129", "240", "307"].includes(report.code) && (
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
              { label: "Outstanding Receivables", value: kpiData.outstandingReceivables, color: "text-amber-500" },
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

      {/* Sales Reports */}
      {["028", "029", "034", "037", "084", "085", "088", "235", "200", "201", "202", "203"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Sales Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Sales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Purchase Reports */}
      {["040", "041", "042", "043", "090", "091", "210", "211", "272"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Purchases Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Purchases" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Inventory Reports */}
      {["078", "080", "082", "083", "148", "173", "180", "366", "230", "231", "232"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Stock Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlySales.map(m => ({ month: m.month, stock: Math.round(m.sales / 100) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="stock" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Stock Units" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tax & Other */}
      {["100", "101", "102", "050", "051", "052", "062", "063", "135", "244", "258", "381", "383", "241", "242"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [generalTab, setGeneralTab] = useState("Favourites");
  const [analyticalTab, setAnalyticalTab] = useState("Favourites");

  const generalFiltered = useMemo(() => {
    if (generalTab === "Favourites") return allReports.filter(r => r.section === "general" && r.favorite);
    return allReports.filter(r => r.section === "general" && r.category === generalTab);
  }, [generalTab]);

  const analyticalFiltered = useMemo(() => {
    if (analyticalTab === "Favourites") return allReports.filter(r => r.section === "analytical" && r.favorite);
    return allReports.filter(r => r.section === "analytical" && r.category === analyticalTab);
  }, [analyticalTab]);

  if (activeReport) {
    return <ReportDetail report={activeReport} onBack={() => setActiveReport(null)} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Financial reports and analytics</p>
      </div>

      {/* General Reports */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">General Reports</h2>
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="border-b px-1 pt-1">
            <div className="flex flex-wrap gap-0">
              {generalCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGeneralTab(cat)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    generalTab === cat
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <ReportList reports={generalFiltered} onSelect={setActiveReport} />
          </div>
        </div>
      </div>

      {/* Analytical Reports */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">Analytical Reports</h2>
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="border-b px-1 pt-1">
            <div className="flex flex-wrap gap-0">
              {analyticalCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAnalyticalTab(cat)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    analyticalTab === cat
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <ReportList reports={analyticalFiltered} onSelect={setActiveReport} />
          </div>
        </div>
      </div>
    </div>
  );
}
