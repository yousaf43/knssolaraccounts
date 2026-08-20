import { useState, useMemo, useCallback, useRef } from "react";
import { useSortableTables } from "@/hooks/useSortableTables";
import { Star, ArrowLeft, Download, FileText, CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { type Invoice, type Expense, type InventoryItem, type Bill, type Customer, type Receipt, type SalesOrder, type PurchaseOrder, type PurchasePayment, type StockAdjustment } from "@/data/mockData";
import { type CompanyAsset } from "@/pages/Assets";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { tokenize, matchesTokens } from "@/lib/search";
import { HighlightText } from "@/components/HighlightText";
import { useSettings } from "@/contexts/SettingsContext";
import {
  useInvoicesCloud, useExpensesCloud, useBillsCloud, useInventoryCloud,
  useCustomersCloud, useReceiptsCloud, useSalesOrdersCloud, usePurchaseOrdersCloud,
  useAccountsCloud, useLedgerEntriesCloud, usePurchasePaymentsCloud,
  useStockAdjustmentsCloud,
} from "@/hooks/useAppData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getInvoicePaymentSummary } from "@/utils/invoicePayments";
import { countsAsSale } from "@/lib/salesStatus";
import { saleAmount, oldBalanceAmount } from "@/lib/oldBalance";
import { amountToWords, formatCompactAmount } from "@/lib/amountWords";

const normName = (v?: string | null) => (v ?? "").trim().toLowerCase();

const uniqueInvoicesById = (items: Invoice[]) =>
  Array.from(new Map(items.map(item => [item.id, item])).values());

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
  { code: "236", title: "Product Sale Detail (By Category)", category: "Sales", section: "general" },
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

type MonthlyReportRow = { month: string; monthStart: string; sales: number; expenses: number };

// Build monthly data from real invoices/expenses/bills. The year is part of the
// key so January 2025 and January 2026 can never be combined accidentally.
function buildMonthlyData(invoices: Invoice[], expenses: Expense[], bills: Bill[], inventory: InventoryItem[] = []) {
  const rows = new Map<string, MonthlyReportRow>();
  const rowFor = (dateValue: string) => {
    const date = parseDateSafe(dateValue);
    if (!date) return null;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = rows.get(key) || {
      month: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
      monthStart: `${key}-01`, sales: 0, expenses: 0,
    };
    rows.set(key, existing);
    return existing;
  };

  invoices.filter(countsAsSale).forEach(inv => {
    const row = rowFor(inv.date);
    if (row) row.sales += saleAmount(inv, inventory);
  });

  expenses.forEach(exp => {
    const row = rowFor(exp.date);
    if (row) row.expenses += exp.amount;
  });

  bills.forEach(bill => {
    const row = rowFor(bill.date);
    if (row) row.expenses += bill.amount;
  });

  return Array.from(rows.values()).sort((a, b) => a.monthStart.localeCompare(b.monthStart));
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
  // Remove interactive elements (checkboxes/buttons) so nothing spills outside the page
  const cleanHtml = tableHtml
    .replace(/<input[^>]*>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");
  // Panel reports (e.g. Income Statement) ship their own header + cards markup.
  const isPanel = !cleanHtml.trim().toLowerCase().startsWith("<table");
  const content = `<html><head><title>${title}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: Arial, sans-serif; padding: ${isPanel ? "0" : "16px"}; color: #222; font-size: 12px; margin: 0; }
      .header { text-align: center; margin-bottom: 20px; }
      .header h1 { font-size: 22px; font-weight: bold; margin: 0; }
      .header h2 { font-size: 16px; font-weight: normal; margin: 6px 0; color: #333; }
      .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
      table { width: 100%; max-width: 100%; border-collapse: collapse; ${isPanel ? "" : "table-layout: fixed;"} }
      th, td { overflow-wrap: break-word; word-break: break-word; }
      ${isPanel ? "" : `
      th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; border: 1px solid #ddd; }
      td { padding: 5px 8px; font-size: 11px; border: 1px solid #eee; }
      th:first-child, td:first-child { width: 34px; text-align: center; padding-left: 2px; padding-right: 2px; }
      `}
      .text-right { text-align: right; }
      tfoot td { font-weight: bold; border-top: 2px solid #333; background: #f9f9f9; }
      .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
      ${isPanel ? `
      /* Professional A4 treatment for structured financial statements */
      #report-print-table {
        border: 1px solid #d7deea;
        border-radius: 0;
        overflow: hidden;
        background: #fff;
      }
      #report-print-table > div:first-child {
        padding: 15px 18px !important;
        background: #173f83 !important;
        border-bottom: 4px solid #d7a62f;
        text-align: center !important;
      }
      #report-print-table > div:first-child h2 { font-size: 17px !important; letter-spacing: .04em; text-align: center !important; }
      #report-print-table > div:first-child p { text-align: center !important; }
      #report-print-table [style*="display: grid"] {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 7px !important;
        padding: 10px 12px !important;
        background: #f4f7fb;
        border-bottom: 1px solid #d7deea;
      }
      #report-print-table [style*="display: grid"] > div {
        min-height: 68px;
        padding: 7px 9px !important;
        border: 1px solid #d7deea !important;
        border-left: 3px solid #1d4ed8 !important;
        border-radius: 3px !important;
        background: #fff !important;
        break-inside: avoid;
      }
      #report-print-table [style*="display: grid"] > div > div:nth-child(2) { font-size: 14px !important; }
      #report-print-table .overflow-x-auto { overflow: visible !important; }
      #report-print-table table { table-layout: fixed; }
      #report-print-table th {
        padding: 6px 9px !important;
        color: #27364d !important;
        background: #e9eef6 !important;
        border-color: #cbd5e1 !important;
        font-size: 9.5px !important;
      }
      #report-print-table td {
        padding-top: 5px !important;
        padding-bottom: 5px !important;
        font-size: 10px !important;
      }
      #report-print-table th:nth-child(1) { width: auto !important; }
      #report-print-table th:nth-child(2) { width: 32mm !important; }
      #report-print-table th:nth-child(3) { width: 36mm !important; }
      #report-print-table th:nth-child(4) { width: 19mm !important; }
      #report-print-table td, #report-print-table th { white-space: normal !important; }
      #report-print-table td:nth-child(n+2) { white-space: nowrap !important; }
      #report-print-table tbody tr { break-inside: avoid; }
      #report-print-table > div:last-child {
        padding: 8px 12px !important;
        background: #f8fafc;
        font-size: 8.5px !important;
        line-height: 1.45;
      }
      .footer { margin-top: 8px; color: #64748b; }
      ` : ""}
      @media print { body { padding: 0; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
    </style></head><body>
    ${isPanel ? "" : `<div class="header"><h1>${companyName}</h1><h2>${title}</h2></div>
    <div class="meta">Period: ${dateRange} | Generated: ${new Date().toLocaleString()}</div>`}
    ${cleanHtml}
    <div class="footer">Generated by K&S Solar Accounts</div>
    </body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(content); win.document.close(); setTimeout(() => win.print(), 500); }
}


function exportCSV(report: Report, data: MonthlyReportRow[], dateRange: string) {
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

function exportVisibleTableCSV(report: Report, dateRange: string) {
  const table = document.getElementById("report-print-table");
  if (!(table instanceof HTMLTableElement)) return false;
  const rows = Array.from(table.querySelectorAll("tr")).map(row =>
    Array.from(row.querySelectorAll("th,td")).map(cell => {
      const value = (cell.textContent || "").replace(/\s+/g, " ").trim();
      return `"${value.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const blob = new Blob([`Report,${report.code} - ${report.title}\nPeriod,${dateRange}\n\n${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.code}_${report.title.replace(/\s+/g, "_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function exportPDF(report: Report, data: MonthlyReportRow[], dateRange: string) {
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

// --- Income Statement (Profit & Loss) ---
// All operating expenses are shown under a single "Operating expenses" section.
function classifyExpenseCategory(_category: string): "administrative" {
  return "administrative";
}


function parseDateSafe(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(value: string | undefined, from?: Date, to?: Date) {
  const d = parseDateSafe(value);
  if (!d) return !from && !to; // undated rows only in "All Time"
  if (from && d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
  if (to && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)) return false;
  return true;
}

type StatementRow = {
  key: string;
  label: string;
  indent: 0 | 1 | 2 | 3;
  /** Small grey helper text under the label */
  note?: string;
  /** Value shown in the inner (detail) column */
  detail?: number;
  /** Value shown in the outer (total) column */
  total?: number;
  bold?: boolean;
  /** Section heading style (tinted background) */
  heading?: boolean;
  /** Highlighted result row */
  highlight?: boolean;
  /** Draw a top border above the numeric cell (sub-total rule) */
  ruleDetail?: boolean;
  ruleTotal?: boolean;
  /** Double underline (final figure) */
  doubleRule?: boolean;
  /** % of net sales shown in its own column */
  pct?: number;
  /** Colour negative values red / positive green */
  signed?: boolean;
};

function IncomeStatement({
  report, invoices, expenses, bills, inventory, getAvgCost, fromDate, toDate, dateRange, companyName,
  salesTaxRate = 0, incomeTaxRate = 0,
}: {
  report: Report;
  invoices: Invoice[];
  expenses: Expense[];
  bills: Bill[];
  inventory: InventoryItem[];
  getAvgCost: (item: InventoryItem) => number;
  fromDate?: Date;
  toDate?: Date;
  dateRange: string;
  companyName: string;
  /** % of gross sales treated as sales tax and excluded from revenue */
  salesTaxRate?: number;
  /** % income tax applied on profit before tax */
  incomeTaxRate?: number;
}) {
  const { formatCurrency } = useSettings();
  const detailed = report.code === "125";
  const summaryOnly = report.code === "123";

  const statement = useMemo(() => {
    const invById = new Map(inventory.map(i => [i.id, i]));
    const invByName = new Map(inventory.map(i => [normName(i.name), i]));

    const costOfInventoryId = (id?: string, description?: string) => {
      const item = (id && invById.get(id)) || (description ? invByName.get(normName(description)) : undefined);
      if (!item) return 0;
      // Cost of goods = main inventory cost price (fallback to avg purchase cost)
      const cp = Number(item.costPrice) || 0;
      return cp > 0 ? cp : getAvgCost(item);
    };


    const lineCost = (line: Invoice["items"][number]) => {
      if (line.adhocLines && line.adhocLines.length > 0) {
        const perBundle = line.adhocLines.reduce(
          (s, l) => s + (l.qty || 0) * costOfInventoryId(l.itemId),
          0
        );
        return perBundle * (line.qty || 1);
      }
      return (line.qty || 0) * costOfInventoryId(line.inventoryItemId, line.description);
    };

    const periodInvoices = uniqueInvoicesById(invoices.filter(i => inRange(i.date, fromDate, toDate)));
    const sales = periodInvoices.filter(i => !i.isReturn && i.status !== "returned" && countsAsSale(i));
    const returns = periodInvoices.filter(i => i.isReturn || i.status === "returned");

    const grossSalesRaw = sales.reduce((s, i) => s + saleAmount(i, inventory), 0);
    const salesReturnsRaw = returns.reduce((s, i) => s + Math.abs(saleAmount(i, inventory)), 0);
    // Sales tax is treated as included in invoice amounts; exclude it to get net (tax-exclusive) revenue.
    const stRate = Math.max(0, salesTaxRate) / 100;
    const grossSales = stRate > 0 ? grossSalesRaw / (1 + stRate) : grossSalesRaw;
    const salesReturns = stRate > 0 ? salesReturnsRaw / (1 + stRate) : salesReturnsRaw;
    const salesTaxExcluded = (grossSalesRaw - salesReturnsRaw) - (grossSales - salesReturns);
    const netSales = grossSales - salesReturns;
    const carriedOldBalance = [...sales, ...returns].reduce((s, i) => s + oldBalanceAmount(i, inventory), 0);

    const cogsSales = sales.reduce((s, i) => s + (i.items || []).reduce((t, l) => t + lineCost(l), 0), 0);
    const cogsReturns = returns.reduce((s, i) => s + (i.items || []).reduce((t, l) => t + Math.abs(lineCost(l)), 0), 0);
    let costOfSales = cogsSales - cogsReturns;

    // Purchases are not interchangeable with COGS: bills may include assets,
    // services, or stock that remains unsold. Keep zero cost visible rather
    // than fabricating cost of sales from all purchases.
    const periodBills = bills.filter(b => inRange(b.date, fromDate, toDate));
    const purchasesTotal = periodBills.reduce((s, b) => s + (b.amount || 0), 0);
    const usedPurchasesFallback = false;

    const grossIncome = netSales - costOfSales;

    const periodExpenses = expenses.filter(e => inRange(e.date, fromDate, toDate));
    const groups: Record<"administrative", Map<string, { total: number; lines: Expense[] }>> = {
      administrative: new Map(),
    };
    for (const e of periodExpenses) {
      const group = classifyExpenseCategory(e.category);
      const key = e.category?.trim() || "Uncategorised";
      const bucket = groups[group].get(key) || { total: 0, lines: [] };
      bucket.total += e.amount || 0;
      bucket.lines.push(e);
      groups[group].set(key, bucket);
    }

    const administrativeTotal = Array.from(groups.administrative.values()).reduce((s, g) => s + g.total, 0);
    const operatingExpenses = administrativeTotal;

    const operatingIncome = grossIncome - operatingExpenses;
    const profitBeforeTax = operatingIncome;
    const itRate = Math.max(0, incomeTaxRate) / 100;
    const incomeTax = profitBeforeTax > 0 ? profitBeforeTax * itRate : 0;
    const netIncome = profitBeforeTax - incomeTax;

    return {
      grossSalesRaw, salesReturnsRaw, salesTaxExcluded, salesTaxRate, incomeTaxRate,
      profitBeforeTax, incomeTax,
      grossSales, salesReturns, netSales, costOfSales, grossIncome,
      groups, administrativeTotal, operatingExpenses,
      operatingIncome, netIncome, usedPurchasesFallback, carriedOldBalance,
      salesCount: sales.length, returnsCount: returns.length,
      expenseCount: periodExpenses.length, billCount: periodBills.length,
      grossMargin: netSales !== 0 ? (grossIncome / netSales) * 100 : 0,
      netMargin: netSales !== 0 ? (netIncome / netSales) * 100 : 0,
      opexRatio: netSales !== 0 ? (operatingExpenses / netSales) * 100 : 0,
      hasData: periodInvoices.length > 0 || periodExpenses.length > 0 || periodBills.length > 0,
    };
  }, [invoices, expenses, bills, inventory, getAvgCost, fromDate, toDate, salesTaxRate, incomeTaxRate]);

  const pctOf = (v: number) => (statement.netSales !== 0 ? (v / statement.netSales) * 100 : undefined);

  const rows = useMemo<StatementRow[]>(() => {
    const out: StatementRow[] = [];

    out.push({ key: "rev-head", label: "Revenue", indent: 0, heading: true });
    out.push({
      key: "gross-sales",
      label: "Gross sales",
      note: `${statement.salesCount} approved invoice${statement.salesCount === 1 ? "" : "s"}`,
      indent: 1,
      detail: statement.grossSales,
    });
    if (statement.salesReturns > 0) {
      out.push({
        key: "returns",
        label: "Less: Sales returns",
        note: `${statement.returnsCount} return document${statement.returnsCount === 1 ? "" : "s"}`,
        indent: 1,
        detail: -(statement.salesTaxExcluded > 0 ? statement.salesReturnsRaw : statement.salesReturns),
      });
    }
    if (statement.salesTaxExcluded > 0) {
      out.push({
        key: "sales-tax",
        label: `Less: Sales tax @ ${statement.salesTaxRate}% (excluded)`,
        note: "Tax portion removed from invoice amounts",
        indent: 1,
        detail: -statement.salesTaxExcluded,
      });
    }
    if (statement.carriedOldBalance > 0) {
      out.push({
        key: "old-balance",
        label: "Carried-forward old balance (not revenue)",
        note: "Receivable only — excluded from sales",
        indent: 1,
        detail: 0,
      });
    }
    out.push({ key: "net-sales", label: "Net sales", indent: 0, total: statement.netSales, bold: true, ruleTotal: true, pct: 100 });

    out.push({ key: "cost-head", label: "Cost of sales", indent: 0, heading: true });
    out.push({
      key: "cos",
      label: statement.usedPurchasesFallback ? "Cost of goods sold (from purchase bills)" : "Cost of goods sold",
      note: statement.usedPurchasesFallback
        ? `${statement.billCount} purchase bill${statement.billCount === 1 ? "" : "s"} in period`
        : "Inventory cost price of items sold",
      indent: 1,
      detail: statement.costOfSales,
    });
    out.push({ key: "total-cos", label: "Total cost of sales", indent: 0, total: statement.costOfSales, ruleTotal: true, pct: pctOf(statement.costOfSales) });
    out.push({
      key: "gross-income",
      label: "Gross income",
      note: `Gross margin ${statement.grossMargin.toFixed(1)}%`,
      indent: 0,
      total: statement.grossIncome,
      bold: true,
      highlight: true,
      ruleTotal: true,
      signed: true,
      pct: pctOf(statement.grossIncome),
    });

    out.push({ key: "opex", label: "Operating expenses", indent: 0, heading: true });

    const section = (
      title: string,
      map: Map<string, { total: number; lines: Expense[] }>,
      total: number,
      totalLabel: string,
      keyPrefix: string
    ) => {
      if (map.size === 0) return;
      if (summaryOnly) {
        out.push({ key: `${keyPrefix}-total`, label: totalLabel, indent: 1, total, pct: pctOf(total) });
        return;
      }
      out.push({ key: `${keyPrefix}-title`, label: title, indent: 1, bold: true });
      const entries = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
      entries.forEach(([category, bucket]) => {
        out.push({
          key: `${keyPrefix}-${category}`,
          label: category,
          note: `${bucket.lines.length} entr${bucket.lines.length === 1 ? "y" : "ies"}`,
          indent: 2,
          detail: bucket.total,
          pct: pctOf(bucket.total),
        });
        if (detailed) {
          bucket.lines
            .slice()
            .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
            .forEach((line, idx) => {
              out.push({
                key: `${keyPrefix}-${category}-${line.id || idx}`,
                label: `${line.date ? `${line.date} — ` : ""}${line.description || "Expense"}`,
                note: line.paymentMethod || undefined,
                indent: 3,
                detail: line.amount,
              });
            });
        }
      });
      out.push({ key: `${keyPrefix}-total`, label: totalLabel, indent: 1, total, bold: true, ruleTotal: true, pct: pctOf(total) });
    };

    section("Operating expenses", statement.groups.administrative, statement.administrativeTotal, "Sub-total", "admin");

    if (statement.groups.administrative.size === 0) {

      out.push({ key: "no-opex", label: "No operating expenses recorded", indent: 1, total: 0 });
    } else {
      out.push({
        key: "opex-total",
        label: "Total operating expenses",
        note: `${statement.expenseCount} expense entr${statement.expenseCount === 1 ? "y" : "ies"}`,
        indent: 0,
        total: statement.operatingExpenses,
        bold: true,
        ruleTotal: true,
        pct: pctOf(statement.operatingExpenses),
      });
    }

    out.push({
      key: "op-income",
      label: "Operating income",
      indent: 0,
      total: statement.operatingIncome,
      bold: true,
      highlight: true,
      ruleTotal: true,
      signed: true,
      pct: pctOf(statement.operatingIncome),
    });
    if (statement.incomeTaxRate > 0) {
      out.push({
        key: "pbt",
        label: "Profit before tax",
        indent: 0,
        total: statement.profitBeforeTax,
        bold: true,
        ruleTotal: true,
        signed: true,
        pct: pctOf(statement.profitBeforeTax),
      });
      out.push({
        key: "income-tax",
        label: `Less: Income tax @ ${statement.incomeTaxRate}%`,
        note: statement.profitBeforeTax > 0 ? "Applied on profit before tax" : "No tax on loss",
        indent: 1,
        detail: -statement.incomeTax,
      });
    }
    out.push({
      key: "net-income",
      label: statement.incomeTaxRate > 0 ? "Profit after tax" : "Profit",
      note: `Net margin ${statement.netMargin.toFixed(1)}%`,
      indent: 0,
      total: statement.netIncome,
      bold: true,
      highlight: true,
      ruleTotal: true,
      doubleRule: true,
      signed: true,
      pct: pctOf(statement.netIncome),
    });
    return out;
  }, [statement, detailed, summaryOnly]);

  const indentPx = [12, 28, 48, 68];
  const fmtPct = (v?: number) => (v === undefined || !isFinite(v) ? "" : `${v.toFixed(1)}%`);

  const cards = [
    { label: "Net sales", value: statement.netSales, sub: `${statement.salesCount} invoices`, color: "#1d4ed8" },
    { label: "Cost of sales", value: statement.costOfSales, sub: `${fmtPct(pctOf(statement.costOfSales))} of net sales`, color: "#b45309" },
    { label: "Gross income", value: statement.grossIncome, sub: `Margin ${statement.grossMargin.toFixed(1)}%`, color: statement.grossIncome >= 0 ? "#15803d" : "#b91c1c" },
    { label: "Operating expenses", value: statement.operatingExpenses, sub: `${fmtPct(statement.opexRatio)} of net sales`, color: "#7c3aed" },
    { label: statement.incomeTaxRate > 0 ? "Profit (after tax)" : "Profit", value: statement.netIncome, sub: `Margin ${statement.netMargin.toFixed(1)}%`, color: statement.netIncome >= 0 ? "#15803d" : "#b91c1c" },
  ];
  if (statement.incomeTaxRate > 0 || statement.salesTaxExcluded > 0) {
    cards.push({
      label: "Tax",
      value: statement.incomeTax + statement.salesTaxExcluded,
      sub: `${statement.salesTaxRate ? `Sales tax ${statement.salesTaxRate}% · ` : ""}${statement.incomeTaxRate ? `Income tax ${statement.incomeTaxRate}%` : ""}`.replace(/ · $/, ""),
      color: "#be123c",
    });
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div id="report-print-table">
        <div
          className="text-center py-4 px-4"
          style={{ background: "#1d4ed8", color: "#ffffff" }}
        >
          <h2 className="text-lg font-bold uppercase tracking-wide" style={{ margin: 0 }}>{companyName}</h2>
          <p className="text-sm font-semibold" style={{ margin: "4px 0 0" }}>Income Statement (Profit &amp; Loss)</p>
          <p className="text-xs" style={{ margin: "2px 0 0", opacity: 0.9 }}>{dateRange}</p>
        </div>

        {!statement.hasData ? (
          <p className="text-muted-foreground text-sm text-center py-10">No data available for the selected period.</p>
        ) : (
          <>
            {/* Summary cards */}
            <div
              className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4"
              style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: "10px", padding: "14px" }}
            >
              {cards.map(c => (
                <div
                  key={c.label}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", background: "#f9fafb" }}
                >
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>{c.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.color, marginTop: 2 }} title={formatCurrency(c.value)}>{formatCompactAmount(c.value)}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{formatCurrency(c.value)}</div>
                  <div
                    style={{ fontSize: 10, color: "#374151", marginTop: 3, fontStyle: "italic", lineHeight: 1.35, textTransform: "capitalize" }}
                  >
                    {amountToWords(c.value)}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table data-no-sort className="w-full text-sm" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ textAlign: "left", padding: "6px 12px", fontSize: 11, color: "#374151", border: "1px solid #e5e7eb" }}>Description</th>
                    <th style={{ textAlign: "right", padding: "6px 12px", fontSize: 11, color: "#374151", width: 150, border: "1px solid #e5e7eb" }}>Detail</th>
                    <th style={{ textAlign: "right", padding: "6px 12px", fontSize: 11, color: "#374151", width: 160, border: "1px solid #e5e7eb" }}>Amount</th>
                    <th style={{ textAlign: "right", padding: "6px 12px", fontSize: 11, color: "#374151", width: 90, border: "1px solid #e5e7eb" }}>% Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const valueColor = (v?: number) =>
                      row.signed && v !== undefined ? (v >= 0 ? "#15803d" : "#b91c1c") : undefined;
                    return (
                      <tr
                        key={row.key}
                        style={{
                          background: row.heading ? "#eef2ff" : row.highlight ? "#f8fafc" : undefined,
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <td
                          style={{
                            padding: "6px 12px",
                            paddingLeft: indentPx[row.indent],
                            fontWeight: row.bold || row.heading ? 700 : 400,
                            textTransform: row.heading ? "uppercase" : undefined,
                            fontSize: row.heading ? 11 : 12,
                            letterSpacing: row.heading ? "0.04em" : undefined,
                            color: row.heading ? "#3730a3" : "#111827",
                          }}
                        >
                          {row.label}
                          {row.note && (
                            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                              {row.note}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, whiteSpace: "nowrap", borderTop: row.ruleDetail ? "1px solid #9ca3af" : undefined }}>
                          {row.detail !== undefined ? formatCurrency(row.detail) : ""}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            fontSize: row.bold ? 13 : 12,
                            fontWeight: row.bold ? 700 : 400,
                            whiteSpace: "nowrap",
                            color: valueColor(row.total),
                            borderTop: row.ruleTotal ? "1px solid #9ca3af" : undefined,
                            borderBottom: row.doubleRule ? "4px double #111827" : undefined,
                          }}
                        >
                          {row.total !== undefined ? formatCurrency(row.total) : ""}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                          {fmtPct(row.pct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "10px 14px", fontSize: 10, color: "#6b7280", borderTop: "1px solid #e5e7eb" }}>
              {statement.salesTaxExcluded > 0 && (
                <div>Sales tax @ {statement.salesTaxRate}% is treated as included in invoice amounts and excluded from revenue.</div>
              )}
              {statement.incomeTaxRate > 0 && (
                <div>Income tax @ {statement.incomeTaxRate}% is applied on profit before tax (no tax charged on a loss).</div>
              )}
              <div>Basis: only approved / paid invoices are counted as sales. Carried-forward old balance lines are treated as receivables, not revenue.</div>
              {statement.usedPurchasesFallback && (
                <div>Cost of sales is based on purchase bills for this period because product cost prices were not available on the sold items.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Report Detail ---
function ReportDetail({ report, onBack, monthlySales, kpiData, expenseBreakdown, inventory, assets, invoices, expenses, bills, customers, receipts, salesOrders, purchaseOrders, purchasePayments, stockAdjustments, accounts, ledger }: {
  report: Report; onBack: () => void;
  monthlySales: MonthlyReportRow[];
  kpiData: { totalSales: number; totalExpenses: number; netProfit: number; outstandingReceivables: number; outstandingPayables: number; bankBalance: number };
  expenseBreakdown: { name: string; value: number; color: string }[];
  inventory: InventoryItem[];
  assets: CompanyAsset[];
  invoices: Invoice[];
  expenses: Expense[];
  bills: Bill[];
  customers: Customer[];
  receipts: Receipt[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  purchasePayments: PurchasePayment[];
  stockAdjustments: StockAdjustment[];
  accounts: Account[];
  ledger: LedgerEntry[];
}) {
  const { formatCurrency, settings } = useSettings();
  const companyName = settings?.companyName || "K & S Solar";
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [productSearch, setProductSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [txnSearch, setTxnSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedProductKey, setSelectedProductKey] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [multiSelectedKeys, setMultiSelectedKeys] = useState<string[]>([]);
  const [viewMultiSelected, setViewMultiSelected] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [salesTaxRate, setSalesTaxRate] = useState("");
  const [incomeTaxRate, setIncomeTaxRate] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>("all");
  
  const toggleMultiSelected = (key: string) =>
    setMultiSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const dateRange = useMemo(() => {
    if (fromDate && toDate) return `${format(fromDate, "dd MMM yyyy")} - ${format(toDate, "dd MMM yyyy")}`;
    if (fromDate) return `From ${format(fromDate, "dd MMM yyyy")}`;
    if (toDate) return `To ${format(toDate, "dd MMM yyyy")}`;
    return "All Time";
  }, [fromDate, toDate]);

  const filteredData = useMemo(() => {
    return monthlySales.filter(m => inRange(m.monthStart, fromDate, toDate));
  }, [fromDate, toDate, monthlySales]);

  // Inventory-specific data tables
  const inventoryTableData = useMemo(() => {
    let data: InventoryItem[] | null = null;
    if (report.code === "078") data = inventory; // Products List
    else if (report.code === "080") data = inventory; // Stock Quantity
    else if (report.code === "082") data = inventory.filter(i => i.qty <= 0); // Out of Stock includes oversold items
    else if (report.code === "083") data = inventory.filter(i => i.qty > 0 && i.qty <= i.reorderLevel); // Low Stock
    else if (report.code === "148") data = inventory;

    if (data) {
      const tokens = tokenize(stockSearch);
      data = data.filter(i => {
        if (stockCategoryFilter !== "all" && i.category !== stockCategoryFilter) return false;
        return matchesTokens(tokens, i.name, i.sku, i.model, i.category, i.uniqueCode, i.unit);
      });

      if (report.code === "148") {
        // Deduplicate: merge rows that represent the same product.
        const groups = new Map<string, InventoryItem[]>();
        for (const it of data) {
          const key =
            (it.uniqueCode && it.uniqueCode.trim()) ||
            (it.sku && it.sku.trim() ? `${it.sku.trim()}|${(it.model || "").trim()}` : "") ||
            (it.name ? `${it.name.trim().toLowerCase()}|${(it.model || "").trim()}` : it.id);
          const list = groups.get(key) || [];
          list.push(it);
          groups.set(key, list);
        }
        data = Array.from(groups.values()).map(list => {
          if (list.length === 1) return list[0];
          const totalQty = list.reduce((s, x) => s + (x.qty || 0), 0);
          const totalValue = list.reduce((s, x) => s + (x.qty || 0) * (x.costPrice || 0), 0);
          const avgCost = totalQty !== 0 ? totalValue / totalQty : Math.max(...list.map(x => x.costPrice || 0));
          const salePrice = Math.max(...list.map(x => x.salePrice || 0));
          const base = list.find(x => x.model) || list.find(x => x.category) || list[0];
          return {
            ...base,
            qty: totalQty,
            costPrice: avgCost,
            salePrice,
            model: list.find(x => x.model)?.model || base.model,
            category: list.find(x => x.category)?.category || base.category,
          } as InventoryItem;
        });
      }
    }
    return data;
  }, [report.code, inventory, stockSearch, stockCategoryFilter]);

  // Weighted average purchase cost per inventory item, computed from PO history.
  // Keyed by both inventory item id and by SKU/uniqueCode/name so merged rows still match.
  const poAvgCostMap = useMemo(() => {
    const totals = new Map<string, { qty: number; value: number }>();
    const bump = (key: string, qty: number, rate: number) => {
      if (!key || qty <= 0) return;
      const t = totals.get(key) || { qty: 0, value: 0 };
      t.qty += qty;
      t.value += qty * rate;
      totals.set(key, t);
    };
    for (const po of purchaseOrders) {
      for (const it of po.items || []) {
        const qty = it.qty || 0;
        const rate = it.rate || 0;
        if (qty <= 0 || rate <= 0) continue;
        if (it.inventoryItemId) bump(`id:${it.inventoryItemId}`, qty, rate);
        // Also index by product identity for cases where inventoryItemId isn't set
        const inv = inventory.find(i => i.id === it.inventoryItemId);
        const identity = inv
          ? (inv.uniqueCode || inv.sku || inv.name)
          : (it.description || "");
        const key = identity.trim().toLowerCase();
        if (key) bump(`k:${key}`, qty, rate);
      }
    }
    return totals;
  }, [purchaseOrders, inventory]);

  const getAvgCost = useCallback((item: InventoryItem): number => {
    const key = (item.uniqueCode || item.sku || item.name).trim().toLowerCase();
    const byKey = poAvgCostMap.get(`k:${key}`);
    if (byKey && byKey.qty > 0) return byKey.value / byKey.qty;
    const byId = poAvgCostMap.get(`id:${item.id}`);
    if (byId && byId.qty > 0) return byId.value / byId.qty;
    return item.costPrice || 0;
  }, [poAvgCostMap]);

  const stockCategories = useMemo(
    () => Array.from(new Set(inventory.map(i => i.category).filter(Boolean))).sort(),
    [inventory]
  );

  const showInventoryTable = ["078", "080", "082", "083", "148"].includes(report.code);
  const isPnL = ["121", "123", "125", "127"].includes(report.code);

  const reportRootRef = useRef<HTMLDivElement>(null);
  useSortableTables(reportRootRef, [report.code, fromDate, toDate, productSearch, invoiceSearch, customerSearch, receiptSearch, txnSearch, categoryFilter, selectedProductKey, productTypeFilter, viewMultiSelected, stockSearch, stockCategoryFilter]);

  return (
    <div className="space-y-6" ref={reportRootRef}>

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
        {isPnL && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Tax %:</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={salesTaxRate}
                onChange={(e) => setSalesTaxRate(e.target.value)}
                placeholder="Sales tax"
                className="h-8 text-xs w-28"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={incomeTaxRate}
                onChange={(e) => setIncomeTaxRate(e.target.value)}
                placeholder="Income tax"
                className="h-8 text-xs w-28"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            {(salesTaxRate || incomeTaxRate) && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSalesTaxRate(""); setIncomeTaxRate(""); }}>
                Reset tax
              </Button>
            )}
          </div>
        )}
        {showInventoryTable && (
          <>
            <div className="relative">
              <Input
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search name, SKU, model…"
                className="h-8 text-xs w-56"
              />
            </div>
            <Select value={stockCategoryFilter} onValueChange={setStockCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {stockCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {(stockSearch || stockCategoryFilter !== "all") && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setStockSearch(""); setStockCategoryFilter("all"); }}>
                Reset
              </Button>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
            if (!exportVisibleTableCSV(report, dateRange)) exportCSV(report, filteredData, dateRange);
          }}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
            const tableEl = document.getElementById("report-print-table");
            if (tableEl) exportTablePrint(report.title, dateRange, tableEl.outerHTML, companyName);
            else exportPDF(report, filteredData, dateRange);
          }}>
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    {report.code === "148" && <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost Price</th>}
                    {report.code === "148" && <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sale Price</th>}
                    {report.code === "148" && <th className="text-right px-3 py-2 font-medium text-muted-foreground">Avg Cost</th>}
                    {report.code === "148" && <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock Value</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventoryTableData.map((item, idx) => {
                    // Avg Cost is derived from purchase order history (weighted avg of PO rates).
                    // Inventory's own Cost Price stays user-controlled.
                    const avgCost = getAvgCost(item);
                    const stockValue = item.qty * avgCost;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium"><HighlightText text={item.name} query={stockSearch} /></td>
                        <td className="px-3 py-2 text-muted-foreground"><HighlightText text={item.sku} query={stockSearch} /></td>
                        <td className="px-3 py-2 text-muted-foreground">{item.model ? <HighlightText text={item.model} query={stockSearch} /> : "—"}</td>
                        <td className="px-3 py-2"><HighlightText text={item.category} query={stockSearch} /></td>
                        <td className={`px-3 py-2 text-right font-semibold ${item.qty <= item.reorderLevel ? "text-destructive" : ""}`}>{item.qty}</td>
                        {report.code === "148" && <td className="px-3 py-2 text-right">{formatCurrency(item.costPrice)}</td>}
                        {report.code === "148" && <td className="px-3 py-2 text-right">{formatCurrency(item.salePrice)}</td>}
                        {report.code === "148" && <td className="px-3 py-2 text-right text-primary font-medium">{formatCurrency(avgCost)}</td>}
                        {report.code === "148" && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(stockValue)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                {report.code === "148" && (
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/40">
                      <td className="px-3 py-2" colSpan={5}>Total Products: {inventoryTableData.length}</td>
                      <td className="px-3 py-2 text-right">{inventoryTableData.reduce((s, i) => s + (i.qty || 0), 0)}</td>
                      <td className="px-3 py-2" colSpan={3}>Total Stock Valuation</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(inventoryTableData.reduce((s, i) => s + (i.qty || 0) * getAvgCost(i), 0))}</td>
                    </tr>
                  </tfoot>
                )}

              </table>
            </div>
          )}
        </div>
      )}

      {/* P&L Reports */}
      {["121", "123", "125", "127"].includes(report.code) && (
        <>
          <IncomeStatement
            report={report}
            invoices={invoices}
            expenses={expenses}
            bills={bills}
            inventory={inventory}
            getAvgCost={getAvgCost}
            fromDate={fromDate}
            toDate={toDate}
            dateRange={dateRange}
            companyName={companyName}
            salesTaxRate={Number(salesTaxRate) || 0}
            incomeTaxRate={Number(incomeTaxRate) || 0}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Revenue", value: filteredData.reduce((s, d) => s + d.sales, 0), cls: "text-primary" },
              { label: "Total Expenses", value: filteredData.reduce((s, d) => s + d.expenses, 0), cls: "text-destructive" },
              { label: "Net Profit", value: filteredData.reduce((s, d) => s + d.sales - d.expenses, 0), cls: "text-success" },
            ].map((m) => (
              <div key={m.label} className="bg-card border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className={`text-2xl font-bold ${m.cls}`} title={formatCurrency(m.value)}>{formatCompactAmount(m.value)}</p>
                <p className="text-[11px] text-muted-foreground italic capitalize leading-snug mt-1">{amountToWords(m.value)}</p>
              </div>
            ))}
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
      {report.code === "220" && (
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

      {["060", "061"].includes(report.code) && (() => {
        const wantsCash = report.code === "060";
        const rows = ledger.filter(entry => {
          const isCash = /cash|petty/i.test(entry.bank || "");
          return (wantsCash ? isCash : !isCash) && inRange(entry.date, fromDate, toDate);
        });
        return <div className="bg-card rounded-lg border p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">{report.title} ({rows.length} entries)</h2>
          <table id="report-print-table" className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Sr #</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Account</th><th className="text-left px-3 py-2">Description</th><th className="text-left px-3 py-2">Reference</th><th className="text-right px-3 py-2">Incoming</th><th className="text-right px-3 py-2">Outgoing</th></tr></thead><tbody>{rows.map((entry, index) => <tr key={entry.id} className="border-b"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2">{entry.date}</td><td className="px-3 py-2 font-medium">{entry.bank}</td><td className="px-3 py-2">{entry.description}</td><td className="px-3 py-2">{entry.reference || "—"}</td><td className="px-3 py-2 text-right text-success">{entry.type === "incoming" ? formatCurrency(entry.amount) : "—"}</td><td className="px-3 py-2 text-right text-destructive">{entry.type === "outgoing" ? formatCurrency(entry.amount) : "—"}</td></tr>)}</tbody><tfoot><tr className="border-t-2 font-bold"><td className="px-3 py-2" colSpan={5}>Net movement</td><td className="px-3 py-2 text-right">{formatCurrency(rows.filter(row => row.type === "incoming").reduce((sum, row) => sum + row.amount, 0))}</td><td className="px-3 py-2 text-right">{formatCurrency(rows.filter(row => row.type === "outgoing").reduce((sum, row) => sum + row.amount, 0))}</td></tr></tfoot></table>
        </div>;
      })()}

      {report.code === "221" && <div className="bg-card rounded-lg border p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Bank Balances ({accounts.length} accounts)</h2>
        <table id="report-print-table" className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Sr #</th><th className="text-left px-3 py-2">Account</th><th className="text-left px-3 py-2">Title</th><th className="text-left px-3 py-2">Code</th><th className="text-left px-3 py-2">Currency</th><th className="text-right px-3 py-2">Balance</th></tr></thead><tbody>{accounts.map((account, index) => <tr key={account.id} className="border-b"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-medium">{account.name}</td><td className="px-3 py-2">{account.accountTitle}</td><td className="px-3 py-2">{account.code}</td><td className="px-3 py-2">{account.currency}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(account.balance)}</td></tr>)}</tbody><tfoot><tr className="border-t-2 font-bold"><td className="px-3 py-2" colSpan={5}>Total</td><td className="px-3 py-2 text-right">{formatCurrency(accounts.reduce((sum, account) => sum + account.balance, 0))}</td></tr></tfoot></table>
      </div>}

      {/* Income Statement / Balance Sheet / Overview */}
      {report.code === "129" && (() => {
        const stockValue = inventory.reduce((sum, item) => sum + Math.max(0, item.qty) * (item.costPrice || 0), 0);
        const fixedAssets = assets.reduce((sum, asset) => sum + asset.value, 0);
        const totalAssets = kpiData.bankBalance + kpiData.outstandingReceivables + stockValue + fixedAssets;
        const equity = totalAssets - kpiData.outstandingPayables;
        const rows = [
          { label: "Cash & bank", amount: kpiData.bankBalance },
          { label: "Accounts receivable", amount: kpiData.outstandingReceivables },
          { label: "Inventory", amount: stockValue },
          { label: "Fixed assets", amount: fixedAssets },
        ];
        return <div className="bg-card rounded-lg border p-6 overflow-x-auto"><h2 className="text-lg font-semibold mb-4">Balance Sheet — {dateRange}</h2><table id="report-print-table" data-no-sort className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Description</th><th className="text-right px-3 py-2">Amount</th></tr></thead><tbody><tr className="font-bold bg-muted/30"><td className="px-3 py-2">Assets</td><td /></tr>{rows.map(row => <tr key={row.label} className="border-b"><td className="px-3 py-2 pl-8">{row.label}</td><td className="px-3 py-2 text-right">{formatCurrency(row.amount)}</td></tr>)}<tr className="font-bold border-t-2"><td className="px-3 py-2">Total assets</td><td className="px-3 py-2 text-right">{formatCurrency(totalAssets)}</td></tr><tr className="font-bold bg-muted/30"><td className="px-3 py-2">Liabilities & equity</td><td /></tr><tr className="border-b"><td className="px-3 py-2 pl-8">Accounts payable</td><td className="px-3 py-2 text-right">{formatCurrency(kpiData.outstandingPayables)}</td></tr><tr className="border-b"><td className="px-3 py-2 pl-8">Owner's equity / retained earnings</td><td className="px-3 py-2 text-right">{formatCurrency(equity)}</td></tr><tr className="font-bold border-t-2"><td className="px-3 py-2">Total liabilities & equity</td><td className="px-3 py-2 text-right">{formatCurrency(kpiData.outstandingPayables + equity)}</td></tr></tbody></table></div>;
      })()}

      {["240", "307"].includes(report.code) && (
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
      {["028", "029", "034", "037", "063", "084", "085", "088", "235", "236", "200", "201", "202", "203"].includes(report.code) && (
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
            const saleInvoices = uniqueInvoicesById(invoices.filter(countsAsSale));
            const invList = report.code === "037"
              ? saleInvoices.filter(i => getInvoicePaymentSummary(i, receipts).remaining > 0)
              : saleInvoices;
            const invTokens = tokenize(invoiceSearch);
            const filtered = invList.filter(inv => {
              if (inv.date) {
                const d = new Date(inv.date);
                if (!inRange(inv.date, fromDate, toDate)) return false;
              }
              if (!matchesTokens(invTokens, inv.number, inv.customer, (inv as any).documentNumber, inv.status)) return false;
              return true;
            });
            const today = new Date();

            return (
              <div className="bg-card rounded-lg border p-6">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <h2 className="text-lg font-semibold">
                    {report.code === "037" ? "Unpaid Sale Invoices/Credits" : "Sale Invoices/Credits"} (By Date) — {filtered.length} records
                  </h2>
                  <Input
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Search invoice / customer / doc..."
                    className="h-9 w-full sm:w-72"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table id="report-print-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Doc No.</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Age Days</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mobile</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv, idx) => {
                        const { remaining: balance, overpaid } = getInvoicePaymentSummary(inv, receipts);
                        const invDate = new Date(inv.date);
                        const ageDays = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                        const cust = customers.find(c => normName(c.name) === normName(inv.customer));
                        return (
                          <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium whitespace-nowrap"><HighlightText text={inv.number} query={invoiceSearch} /></td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{inv.date}</td>
                            <td className="px-3 py-2 font-medium"><HighlightText text={inv.customer} query={invoiceSearch} /></td>
                            <td className="px-3 py-2">{inv.documentNumber || "—"}</td>
                            <td className="px-3 py-2 text-center">{ageDays}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{cust?.phone || "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(inv.amount)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${balance > 0 ? "text-destructive" : "text-success"}`}>
                              {formatCurrency(balance)}
                              {overpaid > 0 && <div className="text-[10px] font-normal text-muted-foreground">Advance: {formatCurrency(overpaid)}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="px-3 py-2" colSpan={7}>Total ({filtered.length} invoices)</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(filtered.reduce((s, i) => s + i.amount, 0))}</td>
                        <td className="px-3 py-2 text-right text-destructive">{formatCurrency(filtered.reduce((s, inv) => s + getInvoicePaymentSummary(inv, receipts).remaining, 0))}</td>
                      </tr>
                    </tfoot>

                  </table>
                </div>
              </div>
            );
          })()}

          {/* Customer-wise Summary (029, 034, 201) */}
          {["029", "034", "201"].includes(report.code) && (() => {
            // Sum per-invoice clamped remaining so overpayments don't make a customer look negative
            const sumOutstanding = (invs: Invoice[], recs: Receipt[]) =>
              invs.reduce((s, inv) => s + getInvoicePaymentSummary(inv, recs).remaining, 0);
            const sumAdvance = (invs: Invoice[], recs: Receipt[]) =>
              invs.reduce((s, inv) => s + getInvoicePaymentSummary(inv, recs).overpaid, 0);

            // Apply the selected date range to invoices & receipts
            const invoicesInRange = uniqueInvoicesById(
              invoices.filter(i => inRange(i.date, fromDate, toDate) && (report.code === "034" || countsAsSale(i)))
            );
            const receiptsInRange = receipts.filter(r => inRange(r.date, fromDate, toDate));

            // Customer names are the document link in the current data model. Group duplicate
            // customer profiles first so one invoice can never be rendered once per duplicate profile.
            const customerGroups = new Map<string, Customer[]>();
            customers.forEach(customer => {
              const key = normName(customer.name);
              const group = customerGroups.get(key) || [];
              group.push(customer);
              customerGroups.set(key, group);
            });

            const custData = Array.from(customerGroups.values()).map(group => {
              const first = group[0];
              const cust = {
                ...first,
                company: group.find(c => c.company)?.company || first.company,
                email: group.find(c => c.email)?.email || first.email,
                phone: group.find(c => c.phone)?.phone || first.phone,
                address: group.find(c => c.address)?.address || first.address,
              };
              const custInv = invoicesInRange.filter(i => normName(i.customer) === normName(cust.name));
              const custRec = receiptsInRange.filter(r => normName(r.customer) === normName(cust.name));
              const totalBilled = custInv.reduce((s, i) => s + i.amount, 0);
              const totalPaid = custInv.reduce((sum, invoice) => sum + getInvoicePaymentSummary(invoice, custRec).totalPaid, 0);
              const outstanding = sumOutstanding(custInv, custRec);
              const advance = sumAdvance(custInv, custRec);
              return { ...cust, invoiceCount: custInv.length, totalBilled, totalPaid, outstanding, advance, invoices: custInv, receipts: custRec };
            }).filter(c => c.totalBilled > 0 || c.invoiceCount > 0);

            // Catch orphan invoices (customer name doesn't match any customer record, or is blank)
            const knownNames = new Set(customerGroups.keys());
            const orphanInv = invoicesInRange.filter(i => !knownNames.has(normName(i.customer)));
            if (orphanInv.length > 0) {
              const groups = new Map<string, typeof orphanInv>();
              orphanInv.forEach(i => {
                const key = (i.customer || "").trim() || "(No Customer)";
                const group = groups.get(key) || [];
                group.push(i);
                groups.set(key, group);
              });
              groups.forEach((invs, name) => {
                const recs = receiptsInRange.filter(r => normName(r.customer) === normName(name));
                const totalBilled = invs.reduce((s, i) => s + i.amount, 0);
                const totalPaid = invs.reduce((sum, invoice) => sum + getInvoicePaymentSummary(invoice, recs).totalPaid, 0);
                custData.push({
                  id: `orphan-${name}`, name, company: "", email: "", phone: "", address: "",
                  invoiceCount: invs.length,
                  totalBilled,
                  totalPaid,
                  outstanding: sumOutstanding(invs, recs),
                  advance: sumAdvance(invs, recs),
                  invoices: invs,
                  receipts: recs,
                } as any);

              });
            }


            const custTokens = tokenize(customerSearch);
            const visibleCust = custTokens.length
              ? custData.filter((c: any) => matchesTokens(custTokens, c.name, c.company, c.phone, c.email))
              : custData;

            return (
              <div className="bg-card rounded-lg border p-6">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <h2 className="text-lg font-semibold">
                    {report.code === "034" ? "Customer Statement" : "Sale Invoices/Credits (By Customer)"} — {visibleCust.length} customers
                  </h2>
                  <Input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer..."
                    className="h-9 w-full sm:w-64"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table id="report-print-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Doc No.</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Company</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Billed</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Paid</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let __sr = 0;
                        return visibleCust.flatMap(cust =>
                          cust.invoices.length > 0 ? cust.invoices.map((inv) => {
                            const { totalPaid: invPaid, remaining: invOutstanding, overpaid: invOverpaid } = getInvoicePaymentSummary(inv, cust.receipts);
                            __sr += 1;
                            return (
                              <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-3 py-2 text-muted-foreground">{__sr}</td>
                                <td className="px-3 py-2 font-medium">{cust.name}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{inv.number}</td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{inv.date}</td>
                                <td className="px-3 py-2">{inv.documentNumber || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground">{cust.company || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">{cust.phone || "—"}</td>

                                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(inv.amount)}</td>
                                <td className="px-3 py-2 text-right text-success">{formatCurrency(invPaid)}</td>
                                <td className={`px-3 py-2 text-right font-medium ${invOutstanding > 0 ? "text-destructive" : "text-success"}`}>
                                  {formatCurrency(invOutstanding)}
                                  {invOverpaid > 0 && <div className="text-[10px] font-normal text-muted-foreground">Advance: {formatCurrency(invOverpaid)}</div>}
                                </td>
                              </tr>
                            );
                          }) : (() => {
                            __sr += 1;
                            const n = __sr;
                            return [(
                              <tr key={cust.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-3 py-2 text-muted-foreground">{n}</td>
                                <td className="px-3 py-2 font-medium">{cust.name}</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2 text-muted-foreground">{cust.company || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">{cust.phone || "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(cust.totalBilled)}</td>
                                <td className="px-3 py-2 text-right text-success">{formatCurrency(cust.totalPaid)}</td>
                                <td className={`px-3 py-2 text-right font-medium ${cust.outstanding > 0 ? "text-destructive" : cust.outstanding < 0 ? "text-success" : "text-success"}`}>{formatCurrency(cust.outstanding)}</td>
                              </tr>
                            )];
                          })()
                        );
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="px-3 py-2" colSpan={7}>Total</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(visibleCust.reduce((s, c) => s + c.totalBilled, 0))}</td>
                        <td className="px-3 py-2 text-right text-success">{formatCurrency(visibleCust.reduce((s, c) => s + c.totalPaid, 0))}</td>
                        <td className="px-3 py-2 text-right text-destructive">{formatCurrency(visibleCust.reduce((s, c) => s + c.outstanding, 0))}</td>
                      </tr>
                    </tfoot>

                  </table>
                </div>

                {/* Detailed Customer Statement - show each customer's invoices */}
                {report.code === "034" && visibleCust.map(cust => (
                  <div key={cust.id} className="mt-6 border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-1">{cust.name} {cust.company && `— ${cust.company}`}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{cust.phone || ""} {cust.email ? `| ${cust.email}` : ""}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-2 py-1.5 w-10">Sr #</th>
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
                        {cust.invoices.map((inv, idx) => {
                          const { totalPaid: paid, remaining: balance, overpaid } = getInvoicePaymentSummary(inv, cust.receipts);
                          const ageDays = Math.floor((new Date().getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <tr key={inv.id} className="border-b last:border-0">
                              <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                              <td className="px-2 py-1.5">{inv.date}</td>
                              <td className="px-2 py-1.5">{inv.number}</td>
                              <td className="px-2 py-1.5">{inv.projectName || "—"}</td>
                              <td className="px-2 py-1.5 text-right">{formatCurrency(inv.amount)}</td>
                              <td className="px-2 py-1.5 text-right text-success">{formatCurrency(paid)}</td>
                              <td className={`px-2 py-1.5 text-right ${balance > 0 ? "text-destructive font-medium" : ""}`}>
                                {formatCurrency(balance)}
                                {overpaid > 0 && <div className="text-[10px] font-normal text-muted-foreground">Adv {formatCurrency(overpaid)}</div>}
                              </td>
                              <td className="px-2 py-1.5 text-center">{ageDays}</td>
                              <td className="px-2 py-1.5 text-center"><Badge variant="outline" className="text-[10px] px-1.5 py-0">{inv.status}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t">
                          <td className="px-2 py-1.5" colSpan={4}>Sub Total</td>
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

          {/* Product Sale Detail (084, 085, 088, 235, 236, 203) */}
          {["084", "085", "088", "235", "236", "203"].includes(report.code) && (() => {
            // Build inventory lookup for category resolution
            const invById: Record<string, InventoryItem> = {};
            const invByName: Record<string, InventoryItem> = {};
            inventory.forEach(i => {
              invById[i.id] = i;
              invByName[normName(i.name)] = i;
            });
            const resolveInv = (item: { description: string; inventoryItemId?: string }): InventoryItem | undefined =>
              (item.inventoryItemId && invById[item.inventoryItemId]) || invByName[normName(item.description)];

            type Line = {
              key: string;
              name: string;
              category: string;
              productType: string;
              costPrice: number;
              qty: number;
              revenue: number;
              count: number;
              details: { invoiceNumber: string; documentNumber: string; date: string; customer: string; qty: number; rate: number; amount: number; costPrice: number }[];
            };
            const productMap: Record<string, Line> = {};
            const addProductSale = (
              inv: Invoice,
              invItem: InventoryItem | undefined,
              fallbackName: string,
              qty: number,
              rate: number,
              amount: number,
            ) => {
              const key = invItem?.id || `name:${normName(fallbackName) || "unknown"}`;
              const name = invItem?.name || fallbackName || "Unknown";
              const category = invItem?.category || "Uncategorized";
              const productType = (invItem?.productType as string | undefined) || "unknown";
              const costPrice = invItem?.costPrice ?? 0;
              if (!productMap[key]) productMap[key] = { key, name, category, productType, costPrice, qty: 0, revenue: 0, count: 0, details: [] };
              productMap[key].qty += qty;
              productMap[key].revenue += amount;
              productMap[key].count += 1;
              productMap[key].details.push({
                invoiceNumber: inv.number,
                documentNumber: inv.documentNumber || "",
                date: inv.date,
                customer: inv.customer,
                qty,
                rate,
                amount,
                costPrice,
              });
            };

            uniqueInvoicesById(invoices.filter(countsAsSale)).forEach(inv => {
              // Date range filter (applies here so per-product report respects it)
              if (fromDate || toDate) {
                if (!inv.date) return;
                const d = new Date(inv.date);
                if (fromDate && d < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) return;
                if (toDate && d > new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59)) return;
              }
              inv.items.forEach(item => {
                const invItem = resolveInv(item);
                if (invItem?.productType === "old-balance") return;

                // Report 085 follows the actual stock movement: bundles are shown as
                // their tracked components rather than as one top-level bundle line.
                if (report.code === "085") {
                  const lineQty = Number(item.qty) || 0;
                  const catalogComponents = invItem?.productType === "bundle" && invItem.bundleItems?.length
                    ? invItem.bundleItems.map(component => {
                        const override = item.bundleItemPrices?.find(saved => saved.itemId === component.itemId);
                        return {
                          itemId: component.itemId,
                          qty: override?.qty ?? component.qty ?? 1,
                          rate: override?.price ?? component.price,
                        };
                      })
                    : [];
                  const savedComponents = item.adhocLines?.length
                    ? item.adhocLines.map(component => ({ itemId: component.itemId, qty: component.qty, rate: component.rate }))
                    : (item.bundleItemPrices || []).map(component => ({ itemId: component.itemId, qty: component.qty ?? 1, rate: component.price }));
                  const components = savedComponents.length ? savedComponents : catalogComponents;

                  if (components.length) {
                    components.forEach(component => {
                      const componentItem = invById[component.itemId];
                      if (!componentItem) return;
                      const qty = (Number(component.qty) || 0) * lineQty;
                      const rate = Number(component.rate ?? componentItem.salePrice ?? 0) || 0;
                      addProductSale(inv, componentItem, componentItem.name, qty, rate, qty * rate);
                    });
                    return;
                  }
                }

                addProductSale(inv, invItem, item.description, Number(item.qty) || 0, Number(item.rate) || 0, Number(item.amount) || 0);
              });
            });

            // Report 085: only tracked stock products (exclude non-stock, bundle, old-balance, unknown)
            const allLines = report.code === "085"
              ? Object.values(productMap).filter(l => l.productType === "stock")
              : Object.values(productMap);
            const categories = Array.from(new Set(allLines.map(l => l.category))).sort();
            const productTypes = Array.from(new Set(allLines.map(l => l.productType))).sort();
            const prodTokens = tokenize(productSearch);

            // Product-type filter
            const typeFiltered = productTypeFilter === "all"
              ? allLines
              : allLines.filter(l => l.productType === productTypeFilter);

            // Category filter
            const catFiltered = categoryFilter === "all"
              ? typeFiltered
              : typeFiltered.filter(l => l.category === categoryFilter);

            // Product search filter
            const searchFiltered = catFiltered
              .filter((p: any) => matchesTokens(prodTokens, p.name, p.sku, p.category, p.productType))
              .sort((a, b) => b.revenue - a.revenue);

            // Report 236: group by category
            if (report.code === "236") {
              const catMap: Record<string, { category: string; qty: number; revenue: number; count: number; productCount: number }> = {};
              searchFiltered.forEach(l => {
                if (!catMap[l.category]) catMap[l.category] = { category: l.category, qty: 0, revenue: 0, count: 0, productCount: 0 };
                catMap[l.category].qty += l.qty;
                catMap[l.category].revenue += l.revenue;
                catMap[l.category].count += l.count;
                catMap[l.category].productCount += 1;
              });
              const rows = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
              return (
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <h2 className="text-lg font-semibold">
                      {categoryFilter === "all"
                        ? `Sales by Category (${rows.length})`
                        : viewMultiSelected && multiSelectedKeys.length > 0
                          ? `Combined Sales Detail (${multiSelectedKeys.length} products)`
                          : selectedProductKey !== "all"
                            ? `Sales Detail: ${searchFiltered.find(p => p.key === selectedProductKey)?.name || ""}`
                            : `${categoryFilter} — Products (${searchFiltered.length})`}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                        <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="All product types" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All product types</SelectItem>
                          {productTypes.map(t => (
                            <SelectItem key={t} value={t}>
                              {t === "non-stock" ? "Non-Stock" : t === "bundle" ? "Bundle" : t === "stock" ? "Stock" : "Unknown"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search product..."
                        className="h-9 w-full sm:w-56"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {categoryFilter === "all" ? (
                      <table id="report-print-table" className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Products</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Times Sold</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, idx) => (
                            <tr
                              key={r.category}
                              className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                              onClick={() => setCategoryFilter(r.category)}
                              title="Click to view products in this category"
                            >
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-primary hover:underline">{r.category}</td>
                              <td className="px-3 py-2 text-right">{r.productCount}</td>
                              <td className="px-3 py-2 text-right">{r.count}</td>
                              <td className="px-3 py-2 text-right">{r.qty}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.revenue)}</td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No sales in selected range.</td></tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-bold">
                            <td className="px-3 py-2" colSpan={2}>Total</td>
                            <td className="px-3 py-2 text-right">{rows.reduce((s, r) => s + r.productCount, 0)}</td>
                            <td className="px-3 py-2 text-right">{rows.reduce((s, r) => s + r.count, 0)}</td>
                            <td className="px-3 py-2 text-right">{rows.reduce((s, r) => s + r.qty, 0)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(rows.reduce((s, r) => s + r.revenue, 0))}</td>
                          </tr>
                        </tfoot>

                      </table>
                    ) : (() => {
                      const singleSelected = selectedProductKey !== "all"
                        ? searchFiltered.find(p => p.key === selectedProductKey)
                        : null;
                      const multiSelected = viewMultiSelected
                        ? allLines.filter(p => multiSelectedKeys.includes(p.key))
                        : [];
                      const showCombined = viewMultiSelected && multiSelected.length > 0;

                      if (singleSelected || showCombined) {
                        const combinedDetails = showCombined
                          ? multiSelected.flatMap(p => p.details.map(d => ({ ...d, productName: p.name })))
                          : (singleSelected?.details || []).map(d => ({ ...d, productName: singleSelected!.name }));
                        const totalQty = showCombined
                          ? multiSelected.reduce((s, p) => s + p.qty, 0)
                          : (singleSelected?.qty || 0);
                        const totalRevenue = showCombined
                          ? multiSelected.reduce((s, p) => s + p.revenue, 0)
                          : (singleSelected?.revenue || 0);
                        const heading = showCombined
                          ? `Combined Sales Detail (${multiSelected.length} products)`
                          : `Total (${singleSelected!.name})`;
                        return (
                          <>
                            <div className="mb-3 flex items-center gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedProductKey("all"); setViewMultiSelected(false); }}>
                                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to {categoryFilter}
                              </Button>
                              {showCombined && (
                                <span className="text-sm text-muted-foreground">
                                  {multiSelected.map(p => p.name).join(", ")}
                                </span>
                              )}
                            </div>
                            <table id="report-print-table" className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                                  {showCombined && (
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                                  )}
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice #</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Doc #</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rate</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {combinedDetails
                                  .slice()
                                  .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                                  .map((d, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                      {showCombined && (
                                        <td className="px-3 py-2 font-medium">{d.productName}</td>
                                      )}
                                      <td className="px-3 py-2 font-medium">{d.invoiceNumber}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{d.documentNumber || "-"}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                                      <td className="px-3 py-2">{d.customer}</td>
                                      <td className="px-3 py-2 text-right">{d.qty}</td>
                                      <td className="px-3 py-2 text-right">{formatCurrency(d.rate)}</td>
                                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.amount)}</td>
                                    </tr>
                                  ))}
                                {combinedDetails.length === 0 && (
                                  <tr><td colSpan={showCombined ? 9 : 8} className="text-center py-6 text-muted-foreground">No sales for selected products.</td></tr>
                                )}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 font-bold">
                                  <td className="px-3 py-2" colSpan={showCombined ? 6 : 5}>{heading}</td>
                                  <td className="px-3 py-2 text-right">{totalQty}</td>
                                  <td className="px-3 py-2 text-right"></td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(totalRevenue)}</td>
                                </tr>
                              </tfoot>

                            </table>
                          </>
                        );
                      }
                      const allVisibleSelected = searchFiltered.length > 0 && searchFiltered.every(p => multiSelectedKeys.includes(p.key));
                      return (
                        <>
                          {multiSelectedKeys.length > 0 && (
                            <div className="mb-3 flex items-center gap-2 flex-wrap p-2 rounded-md bg-muted/40 border">
                              <span className="text-sm font-medium">{multiSelectedKeys.length} product(s) selected</span>
                              <Button size="sm" onClick={() => setViewMultiSelected(true)}>
                                View combined report
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setMultiSelectedKeys([])}>
                                Clear
                              </Button>
                            </div>
                          )}
                          <table id="report-print-table" className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-3 py-2 w-8">
                                  <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setMultiSelectedKeys(prev => Array.from(new Set([...prev, ...searchFiltered.map(p => p.key)])));
                                      } else {
                                        const visible = new Set(searchFiltered.map(p => p.key));
                                        setMultiSelectedKeys(prev => prev.filter(k => !visible.has(k)));
                                      }
                                    }}
                                    aria-label="Select all"
                                  />
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Times Sold</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searchFiltered.map((p, idx) => (
                                <tr
                                  key={p.key}
                                  className="border-b last:border-0 hover:bg-muted/30"
                                >
                                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={multiSelectedKeys.includes(p.key)}
                                      onChange={() => toggleMultiSelected(p.key)}
                                      aria-label={`Select ${p.name}`}
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                  <td
                                    className="px-3 py-2 font-medium text-primary hover:underline cursor-pointer"
                                    onClick={() => setSelectedProductKey(p.key)}
                                    title="Click to view sales detail"
                                  >
                                    <HighlightText text={p.name} query={productSearch} />
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{p.category}</td>
                                  <td className="px-3 py-2 text-right">{p.count}</td>
                                  <td className="px-3 py-2 text-right">{p.qty}</td>
                                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.revenue)}</td>
                                </tr>
                              ))}
                              {searchFiltered.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No products found.</td></tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 font-bold">
                                <td className="px-3 py-2" colSpan={4}>Total ({categoryFilter})</td>
                                <td className="px-3 py-2 text-right">{searchFiltered.reduce((s, p) => s + p.count, 0)}</td>
                                <td className="px-3 py-2 text-right">{searchFiltered.reduce((s, p) => s + p.qty, 0)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(searchFiltered.reduce((s, p) => s + p.revenue, 0))}</td>
                              </tr>
                            </tfoot>

                          </table>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            }

            // Selected product drilldown
            const selected = selectedProductKey !== "all" ? searchFiltered.find(p => p.key === selectedProductKey) : null;
            const multiSelected = viewMultiSelected
              ? allLines.filter(p => multiSelectedKeys.includes(p.key))
              : [];
            const showCombined = viewMultiSelected && multiSelected.length > 0 && !selected;
            const allVisibleSelected = searchFiltered.length > 0 && searchFiltered.every(p => multiSelectedKeys.includes(p.key));

            return (
              <div className="bg-card rounded-lg border p-6">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="text-lg font-semibold">
                    {selected
                      ? `Sales Detail: ${selected.name}`
                      : showCombined
                        ? `Combined Sales Detail (${multiSelected.length} products)`
                        : `${report.title} (${searchFiltered.length} products)`}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSelectedProductKey("all"); }}>
                      <SelectTrigger className="h-9 w-full sm:w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedProductKey} onValueChange={setSelectedProductKey}>
                      <SelectTrigger className="h-9 w-full sm:w-64"><SelectValue placeholder="All products" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="all">All products</SelectItem>
                        {catFiltered
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product..."
                      className="h-9 w-full sm:w-56"
                    />
                  </div>
                </div>

                {showCombined ? (
                  <div className="overflow-x-auto">
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => { setViewMultiSelected(false); }}>
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to list
                      </Button>
                      <span className="text-sm text-muted-foreground truncate max-w-full">
                        {multiSelected.map(p => p.name).join(", ")}
                      </span>
                    </div>
                    <table id="report-print-table" className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Doc #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                          {report.code === "085" && (
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost Price</th>
                          )}
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rate</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {multiSelected
                          .flatMap(p => p.details.map(d => ({ ...d, productName: p.name })))
                          .slice()
                          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                          .map((d, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2 font-medium">{d.productName}</td>
                              <td className="px-3 py-2">{d.invoiceNumber}</td>
                              <td className="px-3 py-2 text-muted-foreground">{d.documentNumber || "-"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                              <td className="px-3 py-2">{d.customer}</td>
                              <td className="px-3 py-2 text-right">{d.qty}</td>
                              {report.code === "085" && (
                                <td className="px-3 py-2 text-right">{formatCurrency(d.costPrice)}</td>
                              )}
                              <td className="px-3 py-2 text-right">{formatCurrency(d.rate)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.amount)}</td>
                            </tr>
                          ))}
                        {multiSelected.every(p => p.details.length === 0) && (
                          <tr><td colSpan={report.code === "085" ? 10 : 9} className="text-center py-6 text-muted-foreground">No sales for selected products.</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold">
                          <td className="px-3 py-2" colSpan={6}>Total ({multiSelected.length} products)</td>
                          <td className="px-3 py-2 text-right">{multiSelected.reduce((s, p) => s + p.qty, 0)}</td>
                          {report.code === "085" && (
                            <td className="px-3 py-2 text-right">{formatCurrency(multiSelected.flatMap(p => p.details).reduce((s, d) => s + d.qty * d.costPrice, 0))}</td>
                          )}
                          <td className="px-3 py-2 text-right"></td>
                          <td className="px-3 py-2 text-right">{formatCurrency(multiSelected.reduce((s, p) => s + p.revenue, 0))}</td>
                        </tr>
                      </tfoot>

                    </table>
                  </div>
                ) : selected ? (
                  <div className="overflow-x-auto">
                    <table id="report-print-table" className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Doc #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                          {report.code === "085" && (
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost Price</th>
                          )}
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rate</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.details
                          .slice()
                          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                          .map((d, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2 font-medium">{d.invoiceNumber}</td>
                              <td className="px-3 py-2 text-muted-foreground">{d.documentNumber || "-"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                              <td className="px-3 py-2">{d.customer}</td>
                              <td className="px-3 py-2 text-right">{d.qty}</td>
                              {report.code === "085" && (
                                <td className="px-3 py-2 text-right">{formatCurrency(d.costPrice)}</td>
                              )}
                              <td className="px-3 py-2 text-right">{formatCurrency(d.rate)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.amount)}</td>
                            </tr>
                          ))}
                        {selected.details.length === 0 && (
                          <tr><td colSpan={report.code === "085" ? 9 : 8} className="text-center py-6 text-muted-foreground">No sales for this product.</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold">
                          <td className="px-3 py-2" colSpan={5}>Total ({selected.category})</td>
                          <td className="px-3 py-2 text-right">{selected.qty}</td>
                          {report.code === "085" && (
                            <td className="px-3 py-2 text-right">{formatCurrency(selected.details.reduce((s, d) => s + d.qty * d.costPrice, 0))}</td>
                          )}
                          <td className="px-3 py-2 text-right"></td>
                          <td className="px-3 py-2 text-right">{formatCurrency(selected.revenue)}</td>
                        </tr>
                      </tfoot>

                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {multiSelectedKeys.length > 0 && (
                      <div className="mb-3 flex items-center gap-2 flex-wrap p-2 rounded-md bg-muted/40 border">
                        <span className="text-sm font-medium">{multiSelectedKeys.length} product(s) selected</span>
                        <Button size="sm" onClick={() => setViewMultiSelected(true)}>
                          View combined report
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setMultiSelectedKeys([])}>
                          Clear
                        </Button>
                      </div>
                    )}
                    <table id="report-print-table" className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 w-8">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMultiSelectedKeys(prev => Array.from(new Set([...prev, ...searchFiltered.map(p => p.key)])));
                                } else {
                                  const visible = new Set(searchFiltered.map(p => p.key));
                                  setMultiSelectedKeys(prev => prev.filter(k => !visible.has(k)));
                                }
                              }}
                              aria-label="Select all"
                            />
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Times Sold</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
                          {report.code === "085" && (
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost Price</th>
                          )}
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchFiltered.map((p, idx) => (
                          <tr
                            key={p.key}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={multiSelectedKeys.includes(p.key)}
                                onChange={() => toggleMultiSelected(p.key)}
                                aria-label={`Select ${p.name}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td
                              className="px-3 py-2 font-medium text-primary hover:underline cursor-pointer"
                              onClick={() => setSelectedProductKey(p.key)}
                              title="Click to view detail"
                            >
                              <HighlightText text={p.name} query={productSearch} />
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{p.category}</td>
                            <td className="px-3 py-2 text-right">{p.count}</td>
                            <td className="px-3 py-2 text-right">{p.qty}</td>
                            {report.code === "085" && (
                              <td className="px-3 py-2 text-right">{formatCurrency(p.costPrice)}</td>
                            )}
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.revenue)}</td>
                          </tr>
                        ))}
                        {searchFiltered.length === 0 && (
                          <tr><td colSpan={report.code === "085" ? 8 : 7} className="text-center py-6 text-muted-foreground">No sales in selected range.</td></tr>
                        )}
                      </tbody>
                        <tfoot>
                        <tr className="border-t-2 font-bold">
                          <td className="px-3 py-2" colSpan={4}>Total</td>
                          <td className="px-3 py-2 text-right">{searchFiltered.reduce((s, p) => s + p.count, 0)}</td>
                          <td className="px-3 py-2 text-right">{searchFiltered.reduce((s, p) => s + p.qty, 0)}</td>
                          {report.code === "085" && (
                            <td className="px-3 py-2 text-right">{formatCurrency(searchFiltered.reduce((s, p) => s + p.qty * p.costPrice, 0))}</td>
                          )}
                          <td className="px-3 py-2 text-right">{formatCurrency(searchFiltered.reduce((s, p) => s + p.revenue, 0))}</td>
                        </tr>
                      </tfoot>

                    </table>
                  </div>
                )}

                {["084", "085", "088", "235", "236", "203"].includes(report.code) && (() => {
                  const all = Object.values(productMap);
                  const sumOf = (fn: (l: Line) => boolean) =>
                    all.filter(fn).reduce((s, l) => s + l.revenue, 0);
                  const stockRev = sumOf(l => l.productType === "stock");
                  const nonStockRev = sumOf(l => l.productType === "non-stock");
                  const bundleRev = sumOf(l => l.productType === "bundle");
                  const unknownRev = sumOf(l => l.productType !== "stock" && l.productType !== "non-stock" && l.productType !== "bundle");
                  const periodInvoices = uniqueInvoicesById(invoices.filter(i => inRange(i.date, fromDate, toDate)));
                  const netSales =
                    periodInvoices
                      .filter(i => !i.isReturn && i.status !== "returned" && countsAsSale(i))
                      .reduce((s, i) => s + saleAmount(i, inventory), 0) -
                    periodInvoices
                      .filter(i => i.isReturn || i.status === "returned")
                      .reduce((s, i) => s + Math.abs(saleAmount(i, inventory)), 0);
                  const diff = netSales - (stockRev + nonStockRev + bundleRev + unknownRev);
                  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
                    <div className={`flex items-center justify-between py-1.5 ${bold ? "font-semibold border-t mt-1 pt-2" : ""}`}>
                      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
                      <span>{formatCurrency(value)}</span>
                    </div>
                  );
                  return (
                    <div className="mt-6 border-t pt-4">
                      <h3 className="text-sm font-semibold mb-2">Reconciliation with Income Statement</h3>
                      <div className="text-sm max-w-xl">
                        <Row label={report.code === "084" ? "Stock product lines" : "Stock products revenue (this report)"} value={stockRev} />
                        <Row label="Non-stock / service lines" value={nonStockRev} />
                        <Row label="Bundle lines (not split)" value={bundleRev} />
                        <Row label="Unmatched / uncatalogued lines" value={unknownRev} />
                        {report.code === "084" && (
                          <Row label="Total line revenue (this report)" value={stockRev + nonStockRev + bundleRev + unknownRev} bold />
                        )}
                        <Row label="Rounding, discounts & sales tax adjustment" value={diff} />
                        <Row label="Net sales (Income Statement)" value={netSales} bold />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {report.code === "084"
                          ? "This report totals raw invoice line amounts (before invoice-level discount and tax adjustments); the Income Statement uses full invoice values excluding old balance and returns, so the adjustment line explains the difference."
                          : "This report counts only tracked stock products; the Income Statement counts full invoice values (excluding old balance and returns), so the lines above explain the difference."}
                      </p>
                    </div>
                  );
                })()}
              </div>

            );
          })()}

          {/* Payment Receipts Summary (063) */}
          {report.code === "063" && (() => {
            const rTokens = tokenize(receiptSearch);
          const filteredReceipts = receipts.filter(r =>
            inRange(r.date, fromDate, toDate) &&
            matchesTokens(rTokens, r.number, r.customer, r.invoiceNumber, r.paymentMethod)
          );
            return (
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <h2 className="text-lg font-semibold">Payment Receipts ({filteredReceipts.length})</h2>
                <Input
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="Search receipt / customer / invoice..."
                  className="h-9 w-full sm:w-72"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Receipt #</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Account</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map((r, idx) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium"><HighlightText text={r.number} query={receiptSearch} /></td>
                        <td className="px-3 py-2"><HighlightText text={r.customer} query={receiptSearch} /></td>
                        <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.invoiceNumber}</td>
                        <td className="px-3 py-2">{r.paymentMethod}</td>
                        <td className="px-3 py-2 text-right font-semibold text-success">{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="px-3 py-2" colSpan={6}>Total Received</td>
                      <td className="px-3 py-2 text-right text-success">{formatCurrency(filteredReceipts.reduce((s, r) => s + r.amount, 0))}</td>
                    </tr>
                  </tfoot>

                </table>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* Purchase Reports */}
      {["040", "041", "042", "043", "090", "091", "210", "211", "272"].includes(report.code) && (() => {
        const paymentsForBill = (bill: Bill) => purchasePayments
          .filter(payment => normName(payment.supplier) === normName(bill.supplier) && normName(payment.billNumber) === normName(bill.number))
          .reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const sourceBills = bills.filter(bill => inRange(bill.date, fromDate, toDate));
        const visibleBills = report.code === "043"
          ? sourceBills.filter(bill => Math.max(0, bill.amount - paymentsForBill(bill)) > 0)
          : sourceBills;
        const productReport = ["090", "091"].includes(report.code);
        if (productReport) {
          const products = new Map<string, { name: string; qty: number; amount: number; transactions: number }>();
          const purchaseDocs = purchaseOrders.filter(order => inRange(order.date, fromDate, toDate));
          purchaseDocs.forEach(order => (order.items || []).forEach(item => {
            const key = normName(item.description) || item.inventoryItemId || "unknown";
            const row = products.get(key) || { name: item.description || "Unknown", qty: 0, amount: 0, transactions: 0 };
            row.qty += Number(item.qty) || 0;
            row.amount += Number(item.amount) || (Number(item.qty) || 0) * (Number(item.rate) || 0);
            row.transactions += 1;
            products.set(key, row);
          }));
          const rows = Array.from(products.values()).sort((a, b) => b.amount - a.amount);
          return <div className="bg-card rounded-lg border p-6 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4">{report.title} ({rows.length} products)</h2>
            <table id="report-print-table" className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Sr #</th><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Transactions</th><th className="text-right px-3 py-2">Qty Purchased</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.name} className="border-b"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-medium">{row.name}</td><td className="px-3 py-2 text-right">{row.transactions}</td><td className="px-3 py-2 text-right">{row.qty}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td></tr>)}</tbody>
              <tfoot><tr className="border-t-2 font-bold"><td className="px-3 py-2" colSpan={2}>Total</td><td className="px-3 py-2 text-right">{rows.reduce((s, row) => s + row.transactions, 0)}</td><td className="px-3 py-2 text-right">{rows.reduce((s, row) => s + row.qty, 0)}</td><td className="px-3 py-2 text-right">{formatCurrency(rows.reduce((s, row) => s + row.amount, 0))}</td></tr></tfoot>
            </table>
          </div>;
        }
        return <div className="bg-card rounded-lg border p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">{report.title} ({visibleBills.length} bills)</h2>
          <table id="report-print-table" className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Sr #</th><th className="text-left px-3 py-2">Bill #</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Supplier</th><th className="text-left px-3 py-2">Due Date</th><th className="text-right px-3 py-2">Total</th><th className="text-right px-3 py-2">Paid</th><th className="text-right px-3 py-2">Balance</th></tr></thead>
            <tbody>{visibleBills.map((bill, index) => { const paid = paymentsForBill(bill); const balance = Math.max(0, bill.amount - paid); return <tr key={bill.id} className="border-b"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-medium">{bill.number}</td><td className="px-3 py-2">{bill.date}</td><td className="px-3 py-2">{bill.supplier}</td><td className="px-3 py-2">{bill.dueDate}</td><td className="px-3 py-2 text-right">{formatCurrency(bill.amount)}</td><td className="px-3 py-2 text-right text-success">{formatCurrency(paid)}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(balance)}</td></tr>; })}</tbody>
            <tfoot><tr className="border-t-2 font-bold"><td className="px-3 py-2" colSpan={5}>Total</td><td className="px-3 py-2 text-right">{formatCurrency(visibleBills.reduce((s, bill) => s + bill.amount, 0))}</td><td className="px-3 py-2 text-right">{formatCurrency(visibleBills.reduce((s, bill) => s + paymentsForBill(bill), 0))}</td><td className="px-3 py-2 text-right">{formatCurrency(visibleBills.reduce((s, bill) => s + Math.max(0, bill.amount - paymentsForBill(bill)), 0))}</td></tr></tfoot>
          </table>
        </div>;
      })()}

      {/* Inventory chart Reports - Category-wise stock data */}
      {/* Inventory Transactions Summary By Product (366) */}
      {report.code === "366" && (() => {
        const map: Record<string, { name: string; qtyOut: number; revenue: number; count: number }> = {};
        invoices.filter(countsAsSale).forEach(inv => {
          if (inv.date) {
            const d = new Date(inv.date);
            if (!inRange(inv.date, fromDate, toDate)) return;
          }
          inv.items.forEach((it: any) => {
            const key = it.description || "Unknown";
            if (!map[key]) map[key] = { name: key, qtyOut: 0, revenue: 0, count: 0 };
            map[key].qtyOut += it.qty || 0;
            map[key].revenue += it.amount || 0;
            map[key].count += 1;
          });
        });
        const txnTokens = tokenize(txnSearch);
        const rows = Object.values(map)
          .filter(p => matchesTokens(txnTokens, p.name))
          .sort((a, b) => b.qtyOut - a.qtyOut);
        return (
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="text-lg font-semibold">Inventory Transactions Summary By Product ({rows.length})</h2>
              <Input
                value={txnSearch}
                onChange={(e) => setTxnSearch(e.target.value)}
                placeholder="Search product..."
                className="h-9 w-full sm:w-64"
              />
            </div>
            <div className="overflow-x-auto">
              <table id="report-print-table" className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Transactions</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty Out</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, idx) => (
                    <tr key={p.name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium"><HighlightText text={p.name} query={txnSearch} /></td>
                      <td className="px-3 py-2 text-right">{p.count}</td>
                      <td className="px-3 py-2 text-right font-semibold">{p.qtyOut}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-3 py-2" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right">{rows.reduce((s, p) => s + p.count, 0)}</td>
                    <td className="px-3 py-2 text-right">{rows.reduce((s, p) => s + p.qtyOut, 0)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(rows.reduce((s, p) => s + p.revenue, 0))}</td>
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>
        );
      })()}

      {report.code === "180" && (() => {
        const rows = stockAdjustments.filter(adjustment => inRange(adjustment.date, fromDate, toDate));
        return <div className="bg-card rounded-lg border p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">Stock Adjustment Detail ({rows.length})</h2>
          <table id="report-print-table" className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Sr #</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Product</th><th className="text-left px-3 py-2">Type</th><th className="text-right px-3 py-2">Qty</th><th className="text-left px-3 py-2">Reason</th><th className="text-left px-3 py-2">Note</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className="border-b"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2 font-medium">{row.itemName}</td><td className="px-3 py-2 capitalize">{row.type}</td><td className="px-3 py-2 text-right">{row.type === "decrease" ? -Math.abs(row.qty) : Math.abs(row.qty)}</td><td className="px-3 py-2">{row.reason}</td><td className="px-3 py-2">{row.note || "—"}</td></tr>)}</tbody></table>
        </div>;
      })()}

      {["173", "230", "231", "232"].includes(report.code) && (() => {
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
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Products</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((cat, idx) => (
                        <tr key={cat.name} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{cat.name}</td>
                          <td className="px-3 py-2 text-right">{cat.items}</td>
                          <td className="px-3 py-2 text-right font-semibold">{cat.qty}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(cat.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="px-3 py-2" colSpan={2}>Total</td>
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

      {/* Tax reports */}
      {["100", "101", "102"].includes(report.code) && (() => {
        const salesRows = uniqueInvoicesById(invoices.filter(invoice => countsAsSale(invoice) && inRange(invoice.date, fromDate, toDate)));
        const purchaseRows = bills.filter(bill => inRange(bill.date, fromDate, toDate));
        const rows = report.code === "100"
          ? salesRows.map(invoice => ({ id: invoice.id, number: invoice.number, date: invoice.date, party: invoice.customer, amount: invoice.amount, tax: invoice.tax || 0, type: "Sales" }))
          : report.code === "101"
            ? purchaseRows.map(bill => ({ id: bill.id, number: bill.number, date: bill.date, party: bill.supplier, amount: bill.amount, tax: bill.tax || 0, type: "Purchase" }))
            : [
                ...salesRows.map(invoice => ({ id: invoice.id, number: invoice.number, date: invoice.date, party: invoice.customer, amount: invoice.amount, tax: invoice.tax || 0, type: "Sales" })),
                ...purchaseRows.map(bill => ({ id: bill.id, number: bill.number, date: bill.date, party: bill.supplier, amount: bill.amount, tax: -(bill.tax || 0), type: "Purchase" })),
              ];
        return <div className="bg-card rounded-lg border p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">{report.title} ({rows.length} records)</h2>
          <table id="report-print-table" className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Sr #</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Document #</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Customer / Supplier</th><th className="text-right px-3 py-2">Document Total</th><th className="text-right px-3 py-2">Tax</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.type}-${row.id}`} className="border-b"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2">{row.type}</td><td className="px-3 py-2 font-medium">{row.number}</td><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.party}</td><td className="px-3 py-2 text-right">{formatCurrency(row.amount)}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.tax)}</td></tr>)}</tbody><tfoot><tr className="border-t-2 font-bold"><td className="px-3 py-2" colSpan={5}>Total</td><td className="px-3 py-2 text-right">{formatCurrency(rows.reduce((sum, row) => sum + row.amount, 0))}</td><td className="px-3 py-2 text-right">{formatCurrency(rows.reduce((sum, row) => sum + row.tax, 0))}</td></tr></tfoot></table>
        </div>;
      })()}

      {/* Reports without dedicated source tables use the shared trend view, never fabricated rows. */}
      {["050", "051", "052", "062", "135", "244", "258", "381", "383", "241", "242"].includes(report.code) && (
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Count</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Value</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(assets.map(a => a.category))).map((cat, idx) => {
                    const catAssets = assets.filter(a => a.category === cat);
                    const total = catAssets.reduce((s, a) => s + a.value, 0);
                    return (
                      <tr key={cat} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
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
                    <td className="px-3 py-2" colSpan={2}>Total</td>
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
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Condition</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Purchase Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.filter(a => a.category === cat).map((a, idx) => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
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
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Sr #</th>
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
                {assets.map((a, idx) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
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
                  <td className="px-3 py-2" colSpan={3}>Total</td>
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
    "028", "029", "034", "037", "084", "085", "088", "235", "236",
    "078", "080", "082", "083", "148", "180",
    "121", "123", "125", "127", "129", "135", "258", "307", "381", "383",
    "272",
  ]);

  // Read real data from cloud
  const { data: invoices } = useInvoicesCloud();
  const { data: expenses } = useExpensesCloud();
  const { data: bills } = useBillsCloud();
  const { data: rawInventory } = useInventoryCloud();
  // Only main inventory in reports; merge legacy duplicates without losing stock.
  const inventory = useMemo(() => {
    const mainOnly = (rawInventory as any[]).filter((i: any) => (i.location || "main") === "main");
    const byKey = new Map<string, any[]>();
    for (const it of mainOnly) {
      const key = ((it as any).uniqueCode || it.sku || it.name || it.id).toString().trim().toLowerCase();
      byKey.set(key, [...(byKey.get(key) || []), it]);
    }
    return Array.from(byKey.values()).map(group => {
      if (group.length === 1) return group[0];
      const base = group[0];
      const qty = group.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const positiveQty = group.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
      const costValue = group.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0) * (Number(item.costPrice) || 0), 0);
      return {
        ...base,
        qty,
        costPrice: positiveQty > 0 ? costValue / positiveQty : Number(base.costPrice) || 0,
        reorderLevel: Math.max(...group.map(item => Number(item.reorderLevel) || 0)),
      };
    }) as typeof rawInventory;
  }, [rawInventory]);
  const { data: accounts } = useAccountsCloud();
  const { data: ledger } = useLedgerEntriesCloud();
  const [assets] = useLocalStorage<CompanyAsset[]>("cb-company-assets", []);

  // Read additional data
  const { data: customers } = useCustomersCloud();
  const { data: receipts } = useReceiptsCloud();
  const { data: salesOrders } = useSalesOrdersCloud();
  const { data: purchaseOrders } = usePurchaseOrdersCloud();
  const { data: purchasePayments } = usePurchasePaymentsCloud();
  const { data: stockAdjustments } = useStockAdjustmentsCloud();

  // Build monthly data from real data
  const monthlySales = useMemo(() => buildMonthlyData(invoices, expenses, bills, inventory), [invoices, expenses, bills, inventory]);

  // Build expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    const colors = ["hsl(0, 72%, 51%)", "hsl(217, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(270, 60%, 50%)", "hsl(215, 16%, 47%)", "hsl(160, 60%, 45%)"];
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    return Object.entries(catMap).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [expenses]);

  // Build KPI data
  const kpiData = useMemo(() => {
    const totalSales = invoices.filter(countsAsSale).reduce((s, i) => s + saleAmount(i, inventory), 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + bills.reduce((s, b) => s + b.amount, 0);
    const outstandingReceivables = invoices.filter(countsAsSale).reduce((s, invoice) => s + getInvoicePaymentSummary(invoice, receipts).remaining, 0);
    const outstandingPayables = bills.filter(b => b.status !== "paid").reduce((sum, bill) => {
      const paid = purchasePayments
        .filter(payment => normName(payment.billNumber) === normName(bill.number) && normName(payment.supplier) === normName(bill.supplier))
        .reduce((paymentSum, payment) => paymentSum + (payment.amount || 0), 0);
      return sum + Math.max(0, (bill.amount || 0) - paid);
    }, 0);

    // Bank balance from accounts + ledger
    const bankBalance = accounts.reduce((s, a) => s + a.balance, 0);

    return { totalSales, totalExpenses, netProfit: totalSales - totalExpenses, outstandingReceivables, outstandingPayables, bankBalance };
  }, [invoices, expenses, bills, accounts, inventory, receipts, purchasePayments]);

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
    return <ReportDetail report={activeReport} onBack={() => setActiveReport(null)} monthlySales={monthlySales} kpiData={kpiData} expenseBreakdown={expenseBreakdown} inventory={inventory} assets={assets} invoices={invoices} expenses={expenses} bills={bills} customers={customers} receipts={receipts} salesOrders={salesOrders} purchaseOrders={purchaseOrders} purchasePayments={purchasePayments} stockAdjustments={stockAdjustments} accounts={accounts} ledger={ledger} />;
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

