import { useState, useMemo, useCallback } from "react";
import { Star, ArrowLeft, Download, FileText, CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { type Invoice, type Expense, type InventoryItem, type Bill, type Customer, type Receipt, type SalesOrder } from "@/data/mockData";
import { type CompanyAsset } from "@/pages/Assets";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import {
  useInvoicesCloud, useExpensesCloud, useBillsCloud, useInventoryCloud,
  useCustomersCloud, useReceiptsCloud, useSalesOrdersCloud,
  useAccountsCloud, useLedgerEntriesCloud,
} from "@/hooks/useAppData";
import { Badge } from "@/components/ui/badge";

type Account = { id: string; name: string; accountTitle: string; code: string; reconcileDate: string; currency: string; fxBalance: number; balance: number };
type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };

type Report = {
  code: string;
  title: string;
  category: string;
  section: "general" | "analytical";
};

const allReports: Report[] = [
  // General Reports - Sales
  { code: "028", title: "Sale Invoices/Credits (By Date)", category: "Sales", section: "general" },
  { code: "029", title: "Sale Invoices/Credits (By Customer)", category: "Sales", section: "general" },
  { code: "034", title: "Customer Statement", category: "Sales", section: "general" },
  { code: "037", title: "Unpaid Sale Invoices/Credits (By Customer)", category: "Sales", section: "general" },
  { code: "084", title: "Product Sale Detail (By Date)", category: "Sales", section: "general" },
  { code: "085", title: "Product Sale Detail (By Product)", category: "Sales", section: "general" },
  { code: "088", title: "Product Sale Summary", category: "Sales", section: "general" },
  { code: "235", title: "Category Sale Summary", category: "Sales", section: "general" },
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
  { code: "078", title: "Products List", category: "Inventory", section: "general" },
  { code: "080", title: "Stock Quantity", category: "Inventory", section: "general" },
  { code: "082", title: "Out of Stock", category: "Inventory", section: "general" },
  { code: "083", title: "Low Stock", category: "Inventory", section: "general" },
  { code: "148", title: "Stock Valuation", category: "Inventory", section: "general" },
  { code: "173", title: "Opening Stock", category: "Inventory", section: "general" },
  { code: "180", title: "Stock Adjustment Detail (By Date)", category: "Inventory", section: "general" },
  { code: "366", title: "Inventory Transactions Summary By Product", category: "Inventory", section: "general" },
  // General Reports - Taxation
  { code: "100", title: "Sales Tax Report", category: "Taxation", section: "general" },
  { code: "101", title: "Purchase Tax Report", category: "Taxation", section: "general" },
  { code: "102", title: "Tax Summary", category: "Taxation", section: "general" },
  // General Reports - Management
  { code: "121", title: "Profit & Loss Account", category: "Management", section: "general" },
  { code: "123", title: "Profit & Loss Account Summary", category: "Management", section: "general" },
  { code: "125", title: "Profit & Loss Account Detailed", category: "Management", section: "general" },
  { code: "127", title: "Income Statement", category: "Management", section: "general" },
  { code: "129", title: "Balance Sheet", category: "Management", section: "general" },
  { code: "135", title: "Nominal Activities", category: "Management", section: "general" },
  { code: "244", title: "Product Transaction Detail", category: "Management", section: "general" },
  { code: "258", title: "Expenses Nominal Summary", category: "Management", section: "general" },
  { code: "307", title: "Budget Income Statement", category: "Management", section: "general" },
  { code: "381", title: "Depreciation Details", category: "Management", section: "general" },
  { code: "383", title: "Fixed Assets Details", category: "Management", section: "general" },
  // General Reports - Assets
  { code: "A01", title: "Assets List", category: "Assets", section: "general" },
  { code: "A02", title: "Assets by Category", category: "Assets", section: "general" },
  { code: "A03", title: "Assets Valuation Summary", category: "Assets", section: "general" },
  // Analytical Reports
  { code: "200", title: "Sales Trend Analysis", category: "Sales", section: "analytical" },
  { code: "201", title: "Customer Revenue Analysis", category: "Sales", section: "analytical" },
  { code: "202", title: "Sales Growth Report", category: "Sales", section: "analytical" },
  { code: "203", title: "Top Selling Products", category: "Sales", section: "analytical" },
  { code: "210", title: "Purchase Trend Analysis", category: "Purchases", section: "analytical" },
  { code: "211", title: "Supplier Spending Analysis", category: "Purchases", section: "analytical" },
  { code: "272", title: "Bills Data", category: "Purchases", section: "analytical" },
  { code: "220", title: "Cash Flow Analysis", category: "Cash & Bank", section: "analytical" },
  { code: "221", title: "Bank Balance Trend", category: "Cash & Bank", section: "analytical" },
  { code: "230", title: "Inventory Aging Report", category: "Inventory", section: "analytical" },
  { code: "231", title: "Stock Movement Analysis", category: "Inventory", section: "analytical" },
  { code: "232", title: "Dead Stock Report", category: "Inventory", section: "analytical" },
  { code: "240", title: "Profitability Analysis", category: "Management", section: "analytical" },
  { code: "241", title: "Expense Trend Analysis", category: "Management", section: "analytical" },
  { code: "242", title: "Revenue vs Expense Comparison", category: "Management", section: "analytical" },
];

const generalCategories = ["Favourites", "Sales", "Purchases", "Combined Statements", "Cash & Bank", "Inventory", "Taxation", "Management", "Assets"];
const analyticalCategories = ["Favourites", "Sales", "Purchases", "Cash & Bank", "Inventory", "Management"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Build monthly data from real invoices/expenses/bills
function buildMonthlyData(invoices: Invoice[], expenses: Expense[], bills: Bill[]) {
  const salesByMonth: Record<string, number> = {};
  const expensesByMonth: Record<string, number> = {};
  MONTHS.forEach(m => { salesByMonth[m] = 0; expensesByMonth[m] = 0; });

  invoices.forEach(inv => {
    const d = new Date(inv.date);
    const m = MONTHS[d.getMonth()];
    if (m) salesByMonth[m] += inv.amount;
  });

  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const m = MONTHS[d.getMonth()];
    if (m) expensesByMonth[m] += exp.amount;
  });

  bills.forEach(bill => {
    const d = new Date(bill.date);
    const m = MONTHS[d.getMonth()];
    if (m) expensesByMonth[m] += bill.amount;
  });

  return MONTHS.map(month => ({
    month,
    sales: salesByMonth[month],
    expenses: expensesByMonth[month],
  })).filter(m => m.sales > 0 || m.expenses > 0);
}

// --- Date Picker ---
function DateRangePicker({ from, to, onFromChange, onToChange }: {
  from: Date | undefined; to: Date | undefined;
  onFromChange: (d: Date | undefined) => void; onToChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal text-xs", !from && "text-muted-foreground")}>
            <CalendarIcon className="w-3.5 h-3.5 mr-1" />
            {from ? format(from, "dd MMM yyyy") : "From date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={from} onSelect={onFromChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <span className="text-muted-foreground text-xs">to</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal text-xs", !to && "text-muted-foreground")}>
            <CalendarIcon className="w-3.5 h-3.5 mr-1" />
            {to ? format(to, "dd MMM yyyy") : "To date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={to} onSelect={onToChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// --- Export helpers ---
function exportTablePrint(title: string, dateRange: string, tableHtml: string, companyName: string) {
  const content = `<html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #222; font-size: 12px; }
      .header { text-align: center; margin-bottom: 20px; }
      .header h1 { font-size: 22px; font-weight: bold; margin: 0; }
      .header h2 { font-size: 16px; font-weight: normal; margin: 6px 0; color: #333; }
      .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; border: 1px solid #ddd; }
      td { padding: 5px 8px; font-size: 11px; border: 1px solid #eee; }
      .text-right { text-align: right; }
      tfoot td { font-weight: bold; border-top: 2px solid #333; background: #f9f9f9; }
      .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="header"><h1>${companyName}</h1><h2>${title}</h2></div>
    <div class="meta">Period: ${dateRange} | Generated: ${new Date().toLocaleString()}</div>
    ${tableHtml}
    <div class="footer">Generated by K&S Solar Accounts</div>
    </body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(content); win.document.close(); setTimeout(() => win.print(), 500); }
}

function exportCSV(report: Report, data: { month: string; sales: number; expenses: number }[], dateRange: string) {
  const header = "Month,Sales,Expenses,Net\n";
  const rows = data.map(d => `${d.month},${d.sales},${d.expenses},${d.sales - d.expenses}`).join("\n");
  const csv = `Report: ${report.code} - ${report.title}\nPeriod: ${dateRange}\n\n${header}${rows}`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.code}_${report.title.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(report: Report, data: { month: string; sales: number; expenses: number }[], dateRange: string) {
  const content = `
    <html><head><title>${report.code} - ${report.title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
      h1 { color: #1a56db; font-size: 22px; margin-bottom: 4px; }
      .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 13px; border-bottom: 2px solid #e5e7eb; }
      td { padding: 10px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
      .text-right { text-align: right; }
      .positive { color: #16a34a; }
      .negative { color: #dc2626; }
      .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    </style></head><body>
    <h1>${report.code} - ${report.title}</h1>
    <div class="subtitle">Period: ${dateRange} | Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}</div>
    <table>
      <thead><tr><th>Month</th><th class="text-right">Sales</th><th class="text-right">Expenses</th><th class="text-right">Net</th></tr></thead>
      <tbody>
        ${data.map(d => `<tr><td>${d.month}</td><td class="text-right">${d.sales.toLocaleString()}</td><td class="text-right">${d.expenses.toLocaleString()}</td><td class="text-right ${d.sales - d.expenses >= 0 ? 'positive' : 'negative'}">${(d.sales - d.expenses).toLocaleString()}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="footer">CloudBooks Reports — Auto-generated</div>
    </body></html>
  `;
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(content);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }
}

// --- Report List ---
function ReportList({ reports, onSelect, favorites, onToggleFav }: {
  reports: Report[]; onSelect: (r: Report) => void;
  favorites: string[]; onToggleFav: (code: string) => void;
}) {
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
            <div key={r.code} className="flex items-center gap-3 w-full px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors group">
              <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">{r.code}</span>
              <button onClick={() => onSelect(r)} className="text-sm text-primary font-medium group-hover:underline flex-1 text-left">
                {r.title}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onToggleFav(r.code); }} className="shrink-0">
                <Star className={`w-4 h-4 transition-colors ${favorites.includes(r.code) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30 hover:text-amber-400"}`} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Report Detail ---
function ReportDetail({ report, onBack, monthlySales, kpiData, expenseBreakdown, inventory, assets, invoices, customers, receipts, salesOrders }: {
  report: Report; onBack: () => void;
  monthlySales: { month: string; sales: number; expenses: number }[];
  kpiData: { totalSales: number; totalExpenses: number; netProfit: number; outstandingReceivables: number; outstandingPayables: number; bankBalance: number };
  expenseBreakdown: { name: string; value: number; color: string }[];
  inventory: InventoryItem[];
  assets: CompanyAsset[];
  invoices: Invoice[];
  customers: Customer[];
  receipts: Receipt[];
  salesOrders: SalesOrder[];
}) {
  const { formatCurrency, settings } = useSettings();
  const companyName = settings?.companyName || "K & S Solar";
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const dateRange = useMemo(() => {
    if (fromDate && toDate) return `${format(fromDate, "dd MMM yyyy")} - ${format(toDate, "dd MMM yyyy")}`;
    if (fromDate) return `From ${format(fromDate, "dd MMM yyyy")}`;
    if (toDate) return `To ${format(toDate, "dd MMM yyyy")}`;
    return "All Time";
  }, [fromDate, toDate]);

  const monthIndex: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const filteredData = useMemo(() => {
    return monthlySales.filter(m => {
      const mi = monthIndex[m.month];
      if (fromDate && mi < fromDate.getMonth()) return false;
      if (toDate && mi > toDate.getMonth()) return false;
      return true;
    });
  }, [fromDate, toDate, monthlySales]);

  // Inventory-specific data tables
  const inventoryTableData = useMemo(() => {
    if (report.code === "078") return inventory; // Products List
    if (report.code === "080") return inventory; // Stock Quantity
    if (report.code === "082") return inventory.filter(i => i.qty === 0); // Out of Stock
    if (report.code === "083") return inventory.filter(i => i.qty > 0 && i.qty <= i.reorderLevel); // Low Stock
    if (report.code === "148") return inventory; // Stock Valuation
    return null;
  }, [report.code, inventory]);

  const showInventoryTable = ["078", "080", "082", "083", "148"].includes(report.code);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-primary hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </button>
        <h1 className="text-xl font-bold">{report.code} - {report.title}</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-card border rounded-lg p-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
        {(fromDate || toDate) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
            Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => exportCSV(report, filteredData, dateRange)}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => exportPDF(report, filteredData, dateRange)}>
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
            const tableEl = document.getElementById("report-print-table");
            if (tableEl) {
              exportTablePrint(report.title, dateRange, tableEl.outerHTML, companyName);
            } else {
              exportPDF(report, filteredData, dateRange);
            }
          }}>
            <FileText className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Inventory Table Reports */}
      {showInventoryTable && inventoryTableData && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{report.title} ({inventoryTableData.length} items)</h2>
          {inventoryTableData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No items found for this report.</p>
          ) : (
            <div className="overflow-x-auto">
              <table id="report-print-table" className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost Price</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sale Price</th>
                    {report.code === "148" && <th className="text-right px-3 py-2 font-medium text-muted-foreground">Avg Price</th>}
                    {report.code === "148" && <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock Value</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventoryTableData.map(item => {
                    const avgPrice = item.costPrice > 0 && item.salePrice > 0
                      ? (item.costPrice + item.salePrice) / 2
                      : item.costPrice || item.salePrice;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.sku}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.model || "—"}</td>
                        <td className="px-3 py-2">{item.category}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${item.qty <= item.reorderLevel ? "text-destructive" : ""}`}>{item.qty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.costPrice)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.salePrice)}</td>
                        {report.code === "148" && <td className="px-3 py-2 text-right text-primary font-medium">{formatCurrency(avgPrice)}</td>}
                        {report.code === "148" && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.qty * item.costPrice)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                {report.code === "148" && (
                  <tfoot>
                     <tr className="border-t-2 font-bold">
                       <td className="px-3 py-2" colSpan={8}>Total Stock Valuation</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(inventoryTableData.reduce((s, i) => s + i.qty * i.costPrice, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* P&L Reports */}
      {["121", "123", "125"].includes(report.code) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-primary">{formatCurrency(filteredData.reduce((s, d) => s + d.sales, 0))}</p></div>
            <div className="bg-card border rounded-lg p-4"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-bold text-destructive">{formatCurrency(filteredData.reduce((s, d) => s + d.expenses, 0))}</p></div>
            <div className="bg-card border rounded-lg p-4"><p className="text-sm text-muted-foreground">Net Profit</p><p className="text-2xl font-bold text-success">{formatCurrency(filteredData.reduce((s, d) => s + d.sales - d.expenses, 0))}</p></div>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Monthly Revenue vs Expenses</h2>
            {filteredData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data available. Add invoices and expenses to see reports.</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Legend />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expenses" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Cash Flow */}
      {["220", "060", "061"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Cash Flow Trend</h2>
          {filteredData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={filteredData.map((m) => ({ ...m, net: m.sales - m.expenses }))}>
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
          )}
        </div>
      )}

      {/* Income Statement / Balance Sheet / Overview */}
      {["127", "129", "240", "307"].includes(report.code) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Expense Breakdown</h2>
            {expenseBreakdown.every(e => e.value === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-8">No expenses recorded yet.</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseBreakdown.filter(e => e.value > 0)} dataKey="value" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                        {expenseBreakdown.filter(e => e.value > 0).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {expenseBreakdown.filter(e => e.value > 0).map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium ml-auto">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Key Metrics</h2>
            {[
              { label: "Bank Balance", value: kpiData.bankBalance, color: "text-primary" },
              { label: "Outstanding Receivables", value: kpiData.outstandingReceivables, color: "text-amber-500" },
              { label: "Outstanding Payables", value: kpiData.outstandingPayables, color: "text-destructive" },
              { label: "Profit Margin", value: kpiData.totalSales > 0 ? `${((kpiData.netProfit / kpiData.totalSales) * 100).toFixed(1)}%` : "0.0%", color: "text-success", raw: true },
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
        <div className="space-y-6">
          {/* Sales Trend Chart */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Monthly Sales Trend</h2>
            {filteredData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No sales data. Add invoices to see trends.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Invoice Data Table (028, 037) */}
          {["028", "037"].includes(report.code) && (() => {
            const invList = report.code === "037" ? invoices.filter(i => i.status !== "paid") : invoices;
            const filtered = invList.filter(inv => {
              if (!inv.date) return true;
              const d = new Date(inv.date);
              if (fromDate && d < fromDate) return false;
              if (toDate && d > toDate) return false;
              return true;
            });
            const today = new Date();

            return (
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {report.code === "037" ? "Unpaid Sale Invoices/Credits" : "Sale Invoices/Credits"} (By Date) — {filtered.length} records
                </h2>
                <div className="overflow-x-auto">
                  <table id="report-print-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Doc No.</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sub Total</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Tax</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Age Days</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Contact</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mobile</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(inv => {
                        const paid = receipts.filter(r => r.invoiceNumber === inv.number).reduce((s, r) => s + r.amount, 0);
                        const balance = Math.max(0, inv.amount - paid);
                        const invDate = new Date(inv.date);
                        const ageDays = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                        const cust = customers.find(c => c.name === inv.customer);
                        const subTotal = inv.items?.reduce((s: number, it: any) => s + (it.amount || 0), 0) || inv.amount;
                        const tax = inv.tax || 0;
                        return (
                          <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{inv.number}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{inv.date}</td>
                            <td className="px-3 py-2 font-medium">{inv.customer}</td>
                            <td className="px-3 py-2">{inv.documentNumber || "—"}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(subTotal)}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(tax)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(inv.amount)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${balance > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(balance)}</td>
                            <td className="px-3 py-2 text-center">{ageDays}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{cust ? `Mr ${cust.name}` : inv.customer}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{cust?.phone || "—"}</td>
                            <td className="px-3 py-2 text-center"><Badge variant="outline" className="text-xs">{inv.status}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="px-3 py-2" colSpan={3}>Total ({filtered.length} invoices)</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(filtered.reduce((s, i) => s + (i.items?.reduce((ss: number, it: any) => ss + (it.amount || 0), 0) || i.amount), 0))}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(filtered.reduce((s, i) => s + (i.tax || 0), 0))}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(filtered.reduce((s, i) => s + i.amount, 0))}</td>
                        <td className="px-3 py-2 text-right text-destructive">{formatCurrency(filtered.reduce((s, inv) => {
                          const paid = receipts.filter(r => r.invoiceNumber === inv.number).reduce((ss, r) => ss + r.amount, 0);
                          return s + Math.max(0, inv.amount - paid);
                        }, 0))}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Customer-wise Summary (029, 034, 201) */}
          {["029", "034", "201"].includes(report.code) && (() => {
            const custData = customers.map(cust => {
              const custInv = invoices.filter(i => i.customer === cust.name);
              const custRec = receipts.filter(r => r.customer === cust.name);
              const totalBilled = custInv.reduce((s, i) => s + i.amount, 0);
              const totalPaid = custRec.reduce((s, r) => s + r.amount, 0);
              const outstanding = Math.max(0, totalBilled - totalPaid);
              return { ...cust, invoiceCount: custInv.length, totalBilled, totalPaid, outstanding, invoices: custInv, receipts: custRec };
            }).filter(c => c.totalBilled > 0);

            return (
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {report.code === "034" ? "Customer Statement" : "Sale Invoices/Credits (By Customer)"} — {custData.length} customers
                </h2>
                <div className="overflow-x-auto">
                  <table id="report-print-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Company</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Invoices</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Billed</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Paid</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custData.map(cust => (
                        <tr key={cust.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{cust.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{cust.company || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{cust.phone || "—"}</td>
                          <td className="px-3 py-2 text-right">{cust.invoiceCount}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(cust.totalBilled)}</td>
                          <td className="px-3 py-2 text-right text-success">{formatCurrency(cust.totalPaid)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${cust.outstanding > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(cust.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="px-3 py-2" colSpan={4}>Total</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(custData.reduce((s, c) => s + c.totalBilled, 0))}</td>
                        <td className="px-3 py-2 text-right text-success">{formatCurrency(custData.reduce((s, c) => s + c.totalPaid, 0))}</td>
                        <td className="px-3 py-2 text-right text-destructive">{formatCurrency(custData.reduce((s, c) => s + c.outstanding, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Detailed Customer Statement - show each customer's invoices */}
                {report.code === "034" && custData.map(cust => (
                  <div key={cust.id} className="mt-6 border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-1">{cust.name} {cust.company && `— ${cust.company}`}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{cust.phone || ""} {cust.email ? `| ${cust.email}` : ""}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-2 py-1.5">Date</th>
                          <th className="text-left px-2 py-1.5">Invoice #</th>
                          <th className="text-left px-2 py-1.5">Project</th>
                          <th className="text-right px-2 py-1.5">Amount</th>
                          <th className="text-right px-2 py-1.5">Paid</th>
                          <th className="text-right px-2 py-1.5">Balance</th>
                          <th className="text-center px-2 py-1.5">Age Days</th>
                          <th className="text-center px-2 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cust.invoices.map(inv => {
                          const paid = cust.receipts.filter(r => r.invoiceNumber === inv.number).reduce((s, r) => s + r.amount, 0);
                          const balance = Math.max(0, inv.amount - paid);
                          const ageDays = Math.floor((new Date().getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <tr key={inv.id} className="border-b last:border-0">
                              <td className="px-2 py-1.5">{inv.date}</td>
                              <td className="px-2 py-1.5">{inv.number}</td>
                              <td className="px-2 py-1.5">{inv.projectName || "—"}</td>
                              <td className="px-2 py-1.5 text-right">{formatCurrency(inv.amount)}</td>
                              <td className="px-2 py-1.5 text-right text-success">{formatCurrency(paid)}</td>
                              <td className={`px-2 py-1.5 text-right ${balance > 0 ? "text-destructive font-medium" : ""}`}>{formatCurrency(balance)}</td>
                              <td className="px-2 py-1.5 text-center">{ageDays}</td>
                              <td className="px-2 py-1.5 text-center"><Badge variant="outline" className="text-[10px] px-1.5 py-0">{inv.status}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t">
                          <td className="px-2 py-1.5" colSpan={3}>Sub Total</td>
                          <td className="px-2 py-1.5 text-right">{formatCurrency(cust.totalBilled)}</td>
                          <td className="px-2 py-1.5 text-right text-success">{formatCurrency(cust.totalPaid)}</td>
                          <td className="px-2 py-1.5 text-right text-destructive">{formatCurrency(cust.outstanding)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Product Sale Detail (084, 085, 088, 235, 203) */}
          {["084", "085", "088", "235", "203"].includes(report.code) && (() => {
            const productMap: Record<string, { name: string; qty: number; revenue: number; count: number }> = {};
            invoices.forEach(inv => {
              inv.items.forEach(item => {
                const key = item.description || "Unknown";
                if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0, count: 0 };
                productMap[key].qty += item.qty;
                productMap[key].revenue += item.amount;
                productMap[key].count += 1;
              });
            });
            const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
            return (
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">Product Sale Summary ({products.length} products)</h2>
                <div className="overflow-x-auto">
                  <table id="report-print-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Times Sold</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.name} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{p.name}</td>
                          <td className="px-3 py-2 text-right">{p.count}</td>
                          <td className="px-3 py-2 text-right">{p.qty}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{products.reduce((s, p) => s + p.count, 0)}</td>
                        <td className="px-3 py-2 text-right">{products.reduce((s, p) => s + p.qty, 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(products.reduce((s, p) => s + p.revenue, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Payment Receipts Summary (063) */}
          {report.code === "063" && (
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">Payment Receipts ({receipts.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Receipt #</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Account</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map(r => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{r.number}</td>
                        <td className="px-3 py-2">{r.customer}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.invoiceNumber}</td>
                        <td className="px-3 py-2">{r.paymentMethod}</td>
                        <td className="px-3 py-2 text-right font-semibold text-success">{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="px-3 py-2" colSpan={5}>Total Received</td>
                      <td className="px-3 py-2 text-right text-success">{formatCurrency(receipts.reduce((s, r) => s + r.amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Purchase Reports */}
      {["040", "041", "042", "043", "090", "091", "210", "211", "272"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Purchases Trend</h2>
          {filteredData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No purchase data. Add bills to see trends.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Purchases" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Inventory chart Reports - Category-wise stock data */}
      {["173", "180", "366", "230", "231", "232"].includes(report.code) && (() => {
        // Build category-wise stock data from actual inventory
        const categoryData: Record<string, { qty: number; value: number; items: number }> = {};
        inventory.forEach(item => {
          const cat = item.category || "Uncategorized";
          if (!categoryData[cat]) categoryData[cat] = { qty: 0, value: 0, items: 0 };
          categoryData[cat].qty += item.qty;
          categoryData[cat].value += item.qty * item.costPrice;
          categoryData[cat].items += 1;
        });
        const chartData = Object.entries(categoryData).map(([name, d]) => ({ name, qty: d.qty, value: d.value, items: d.items }));
        const totalQty = inventory.reduce((s, i) => s + i.qty, 0);
        const totalValue = inventory.reduce((s, i) => s + i.qty * i.costPrice, 0);

        return (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-card border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{inventory.length}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Stock Qty</p>
                <p className="text-2xl font-bold">{totalQty}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Stock Value</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalValue)}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{chartData.length}</p>
              </div>
            </div>

            {/* Category Chart */}
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">Stock by Category</h2>
              {chartData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No inventory data. Add products to see stock reports.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Legend />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Quantity" />
                    <Bar dataKey="items" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} name="Products" opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category Table */}
            {chartData.length > 0 && (
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">Category-wise Stock Detail</h2>
                <div className="overflow-x-auto">
                  <table id="report-print-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Products</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map(cat => (
                        <tr key={cat.name} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{cat.name}</td>
                          <td className="px-3 py-2 text-right">{cat.items}</td>
                          <td className="px-3 py-2 text-right font-semibold">{cat.qty}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(cat.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{inventory.length}</td>
                        <td className="px-3 py-2 text-right">{totalQty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(totalValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tax & Other */}
      {["100", "101", "102", "050", "051", "052", "062", "063", "135", "244", "258", "381", "383", "241", "242"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          {filteredData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} name="Expenses" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Assets Reports */}
      {["A01", "A02", "A03"].includes(report.code) && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{report.title} ({assets.length} assets)</h2>
          {assets.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No assets recorded. Add assets from the Assets page.</p>
          ) : report.code === "A03" ? (
            // Valuation Summary by category
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/30 border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{assets.length}</p>
                </div>
                <div className="bg-muted/30 border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(assets.reduce((s, a) => s + a.value, 0))}</p>
                </div>
                <div className="bg-muted/30 border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <p className="text-2xl font-bold">{new Set(assets.map(a => a.category)).size}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Count</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Value</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(assets.map(a => a.category))).map(cat => {
                    const catAssets = assets.filter(a => a.category === cat);
                    const total = catAssets.reduce((s, a) => s + a.value, 0);
                    return (
                      <tr key={cat} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{cat}</td>
                        <td className="px-3 py-2 text-right">{catAssets.length}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(total)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(total / catAssets.length)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{assets.length}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(assets.reduce((s, a) => s + a.value, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : report.code === "A02" ? (
            // By Category grouping
            <div className="space-y-4">
              {Array.from(new Set(assets.map(a => a.category))).map(cat => (
                <div key={cat}>
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">{cat}</h3>
                  <table className="w-full text-sm mb-2">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Condition</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Purchase Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.filter(a => a.category === cat).map(a => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{a.name}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(a.value)}</td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{a.condition}</td>
                          <td className="px-3 py-2 text-muted-foreground">{a.purchaseDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            // A01 - Full Assets List
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Condition</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Purchased From</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Serial No.</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.category}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(a.value)}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{a.condition}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.purchaseFrom || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.purchaseDate}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.serialNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="px-3 py-2" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(assets.reduce((s, a) => s + a.value, 0))}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Reports Page ---
export default function Reports() {
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [generalTab, setGeneralTab] = useState("Favourites");
  const [analyticalTab, setAnalyticalTab] = useState("Favourites");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([
    "028", "029", "034", "037", "084", "085", "088", "235",
    "078", "080", "082", "083", "148", "180",
    "121", "123", "125", "127", "129", "135", "258", "307", "381", "383",
    "272",
  ]);

  // Read real data from cloud
  const { data: invoices } = useInvoicesCloud();
  const { data: expenses } = useExpensesCloud();
  const { data: bills } = useBillsCloud();
  const { data: inventory } = useInventoryCloud();
  const { data: accounts } = useAccountsCloud();
  const { data: ledger } = useLedgerEntriesCloud();
  const [assets] = useState<CompanyAsset[]>([]);

  // Read additional data
  const { data: customers } = useCustomersCloud();
  const { data: receipts } = useReceiptsCloud();
  const { data: salesOrders } = useSalesOrdersCloud();

  // Build monthly data from real data
  const monthlySales = useMemo(() => buildMonthlyData(invoices, expenses, bills), [invoices, expenses, bills]);

  // Build expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    const colors = ["hsl(0, 72%, 51%)", "hsl(217, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(270, 60%, 50%)", "hsl(215, 16%, 47%)", "hsl(160, 60%, 45%)"];
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    return Object.entries(catMap).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [expenses]);

  // Build KPI data
  const kpiData = useMemo(() => {
    const totalSales = invoices.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + bills.reduce((s, b) => s + b.amount, 0);
    const outstandingReceivables = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
    const outstandingPayables = bills.filter(b => b.status !== "paid").reduce((s, b) => s + b.amount, 0);

    // Bank balance from accounts + ledger
    let bankBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const incoming = ledger.filter(e => e.type === "incoming").reduce((s, e) => s + e.amount, 0);
    const outgoing = ledger.filter(e => e.type === "outgoing").reduce((s, e) => s + e.amount, 0);
    bankBalance += incoming - outgoing;

    return { totalSales, totalExpenses, netProfit: totalSales - totalExpenses, outstandingReceivables, outstandingPayables, bankBalance };
  }, [invoices, expenses, bills, accounts, ledger]);

  const toggleFav = useCallback((code: string) => {
    setFavorites(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }, [setFavorites]);

  // Search across all reports
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allReports.filter(r => r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [searchQuery]);

  const generalFiltered = useMemo(() => {
    if (generalTab === "Favourites") return allReports.filter(r => r.section === "general" && favorites.includes(r.code));
    return allReports.filter(r => r.section === "general" && r.category === generalTab);
  }, [generalTab, favorites]);

  const analyticalFiltered = useMemo(() => {
    if (analyticalTab === "Favourites") return allReports.filter(r => r.section === "analytical" && favorites.includes(r.code));
    return allReports.filter(r => r.section === "analytical" && r.category === analyticalTab);
  }, [analyticalTab, favorites]);

  if (activeReport) {
    return <ReportDetail report={activeReport} onBack={() => setActiveReport(null)} monthlySales={monthlySales} kpiData={kpiData} expenseBreakdown={expenseBreakdown} inventory={inventory} assets={assets} invoices={invoices} customers={customers} receipts={receipts} salesOrders={salesOrders} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Financial reports and analytics</p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search reports by name, code, or category..."
          className="w-full md:max-w-md h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {/* Search Results */}
      {searchResults !== null && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h2 className="font-semibold text-sm">Search Results ({searchResults.length})</h2>
          </div>
          <div className="p-4">
            <ReportList reports={searchResults} onSelect={setActiveReport} favorites={favorites} onToggleFav={toggleFav} />
          </div>
        </div>
      )}

      {/* General Reports */}
      {!searchResults && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">General Reports</h2>
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="border-b px-1 pt-1">
              <div className="flex flex-wrap gap-0">
                {generalCategories.map((cat) => (
                  <button key={cat} onClick={() => setGeneralTab(cat)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${generalTab === cat ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <ReportList reports={generalFiltered} onSelect={setActiveReport} favorites={favorites} onToggleFav={toggleFav} />
            </div>
          </div>
        </div>
      )}

      {/* Analytical Reports */}
      {!searchResults && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">Analytical Reports</h2>
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="border-b px-1 pt-1">
              <div className="flex flex-wrap gap-0">
                {analyticalCategories.map((cat) => (
                  <button key={cat} onClick={() => setAnalyticalTab(cat)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${analyticalTab === cat ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <ReportList reports={analyticalFiltered} onSelect={setActiveReport} favorites={favorites} onToggleFav={toggleFav} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

