import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMemo } from "react";
import {
  getInitialInvoices, getInitialInventory, getInitialExpenses,
  getInitialBills, getInitialPurchaseOrders,
  type Invoice, type InventoryItem, type Expense, type Bill,
} from "@/data/mockData";

type Account = { id: string; name: string; accountTitle: string; code: string; reconcileDate: string; currency: string; fxBalance: number; balance: number };
type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };

const agingColors = [
  { name: "Older", color: "hsl(0, 72%, 51%)" },
  { name: "Current", color: "hsl(217, 71%, 45%)" },
  { name: "1-7 Days", color: "hsl(142, 71%, 45%)" },
  { name: "8-14 Days", color: "hsl(38, 92%, 50%)" },
  { name: "15-21 Days", color: "hsl(270, 60%, 50%)" },
  { name: "22-28 Days", color: "hsl(215, 16%, 47%)" },
  { name: "Future", color: "hsl(160, 60%, 45%)" },
];

function getAgingBucket(dueDateStr: string): string {
  const now = new Date();
  const due = new Date(dueDateStr);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);
  if (diffDays > 0) return "Future";
  const overdue = Math.abs(diffDays);
  if (overdue === 0) return "Current";
  if (overdue <= 7) return "1-7 Days";
  if (overdue <= 14) return "8-14 Days";
  if (overdue <= 21) return "15-21 Days";
  if (overdue <= 28) return "22-28 Days";
  return "Older";
}

function buildAgingData(items: { dueDate: string; amount: number }[]) {
  const buckets: Record<string, number> = {};
  agingColors.forEach(a => buckets[a.name] = 0);
  items.forEach(item => {
    const bucket = getAgingBucket(item.dueDate);
    buckets[bucket] += item.amount;
  });
  return agingColors.map(a => ({ ...a, value: buckets[a.name] }));
}

function AgingChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const { formatCurrency } = useSettings();
  const hasData = data.some((d) => d.value > 0);
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 h-32 flex items-center justify-center">
        {hasData ? (
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
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
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

function AgingTable({ data, title, totalLabel }: { data: { name: string; value: number; color: string }[]; title: string; totalLabel: string }) {
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

const defaultAccounts: Account[] = [
  { id: "1", name: "Faysal Bank", accountTitle: "K&S Solar Energy", code: "230901", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "2", name: "Bank Al Habib", accountTitle: "K&S Solar Energy Pvt. Ltd.", code: "230902", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "3", name: "Bank Islami Pakistan Limited", accountTitle: "K&S Solar Energy", code: "230903", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "4", name: "U MICROFINANCE BANK LIMITED", accountTitle: "K&S Solar Energy", code: "230904", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "5", name: "MEEZAN BANK", accountTitle: "KHAWAR MEHMOOD", code: "230905", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "6", name: "MOBILINK MICROFINANCE BANK", accountTitle: "K&S Solar Energy", code: "230906", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "7", name: "U-BANK LIMITED", accountTitle: "K&S Solar Energy Pvt. Ltd.", code: "230907", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "8", name: "UBL BANK LTD", accountTitle: "KHAWAR MEHMOOD", code: "230908", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "9", name: "Bank of Punjab (BOP)", accountTitle: "Bhakkar Solar House", code: "230909", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "10", name: "Bank of Punjab (BOP)", accountTitle: "BHAKKAR SOLAR HOUSE", code: "230910", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "11", name: "UBL BANK LTD", accountTitle: "BHAKKAR SOLAR HOUSE", code: "230911", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
];

export default function Dashboard() {
  const { formatCurrency } = useSettings();
  const { profile } = useAuth();

  // Read all data from localStorage
  const [invoices] = useLocalStorage<Invoice[]>("cb-invoices", getInitialInvoices());
  const [bills] = useLocalStorage<Bill[]>("cb-bills", []);
  const [inventory] = useLocalStorage<InventoryItem[]>("cb-inventory", getInitialInventory());
  const [expenses] = useLocalStorage<Expense[]>("cb-expenses", getInitialExpenses());
  const [accounts] = useLocalStorage<Account[]>("accounts", defaultAccounts);
  const [ledger] = useLocalStorage<LedgerEntry[]>("ledgerEntries", []);

  // Compute receivable aging from unpaid invoices
  const receivableAging = useMemo(() => {
    const unpaid = invoices.filter(i => i.status === "pending" || i.status === "overdue");
    return buildAgingData(unpaid.map(i => ({ dueDate: i.dueDate, amount: i.amount })));
  }, [invoices]);

  // Compute payable aging from unpaid bills
  const payableAging = useMemo(() => {
    const unpaid = bills.filter(b => b.status === "pending" || b.status === "overdue");
    return buildAgingData(unpaid.map(b => ({ dueDate: b.dueDate, amount: b.amount })));
  }, [bills]);

  // Compute bank balances from accounts + ledger transactions
  const bankAccounts = useMemo(() => {
    return accounts.map(acc => {
      const accLedger = ledger.filter(e => e.bank === acc.name);
      const incoming = accLedger.filter(e => e.type === "incoming").reduce((s, e) => s + e.amount, 0);
      const outgoing = accLedger.filter(e => e.type === "outgoing").reduce((s, e) => s + e.amount, 0);
      const computedBalance = acc.balance + incoming - outgoing;
      return { name: acc.name, code: acc.code, balance: computedBalance };
    }).filter(a => a.balance !== 0 || true); // show all
  }, [accounts, ledger]);

  // Compute product stats
  const productStats = useMemo(() => {
    const lowStock = inventory.filter(i => i.qty > 0 && i.qty <= i.reorderLevel).length;
    const outOfStock = inventory.filter(i => i.qty === 0).length;
    const oversold = inventory.filter(i => i.qty < 0).length;
    const inStock = inventory.filter(i => i.qty > i.reorderLevel).length;
    return [
      { label: "Low Stock", value: lowStock, color: "text-warning" },
      { label: "Out of Stock", value: outOfStock, color: "text-destructive" },
      { label: "Oversold", value: oversold, color: "text-destructive" },
      { label: "In Stock", value: inStock, color: "text-primary" },
    ];
  }, [inventory]);

  // KPI summary
  const totalSales = useMemo(() => invoices.reduce((s, i) => s + i.amount, 0), [invoices]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const totalBills = useMemo(() => bills.reduce((s, b) => s + b.amount, 0), [bills]);
  const netProfit = totalSales - totalExpenses - totalBills;
  const totalBankBalance = useMemo(() => bankAccounts.reduce((s, a) => s + a.balance, 0), [bankAccounts]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <p className="text-muted-foreground text-sm">Welcome</p>
        <h1 className="text-2xl font-bold">{profile?.full_name || "User"}</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Sales</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Net Profit/Loss</p>
          <p className={`text-xl font-bold ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(netProfit)}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Bank Balance</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalBankBalance)}</p>
        </div>
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
            {bankAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No bank accounts added</p>
            ) : (
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
                        <Link to="/accounts" className="text-primary hover:underline">
                          {acc.name} - ({acc.code})
                        </Link>
                      </td>
                      <td className="py-1.5 text-right">{formatCurrency(acc.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
