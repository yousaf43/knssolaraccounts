import { useState, useMemo } from "react";
import { Landmark, ArrowUpRight, ArrowDownRight, Plus, ArrowLeftRight, CheckCircle2, Download, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { recentTransactions } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

type Account = { id: string; name: string; accountTitle: string; code: string; reconcileDate: string; currency: string; fxBalance: number; balance: number };
type OtherPayment = { id: string; date: string; account: string; payee: string; amount: number; reference: string; description: string };
type OtherReceipt = { id: string; date: string; account: string; receivedFrom: string; amount: number; reference: string; description: string };
type Transfer = { id: string; date: string; fromAccount: string; toAccount: string; amount: number; reference: string };
type ReconcileEntry = { id: string; date: string; account: string; statementBalance: number; bookBalance: number; difference: number; status: "reconciled" | "pending" };
type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };

const initialAccounts: Account[] = [
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

const initialPayments: OtherPayment[] = [
  { id: "1", date: "2025-02-10", account: "Business Checking", payee: "Office Landlord", amount: 5500, reference: "PAY-001", description: "Office rent - Feb" },
  { id: "2", date: "2025-02-08", account: "Business Checking", payee: "Google Ads", amount: 3200, reference: "PAY-002", description: "Ad campaign" },
  { id: "3", date: "2025-02-05", account: "Business Checking", payee: "Insurance Co", amount: 1200, reference: "PAY-003", description: "Business insurance" },
];

const initialReceipts: OtherReceipt[] = [
  { id: "1", date: "2025-02-13", account: "Business Checking", receivedFrom: "Acme Corp", amount: 12500, reference: "REC-001", description: "Invoice payment" },
  { id: "2", date: "2025-02-11", account: "Business Checking", receivedFrom: "BlueSky Ltd", amount: 6300, reference: "REC-002", description: "Service fee" },
];

const initialTransfers: Transfer[] = [
  { id: "1", date: "2025-02-01", fromAccount: "Business Checking", toAccount: "Savings Account", amount: 10000, reference: "TRF-001" },
];

const initialReconcile: ReconcileEntry[] = [
  { id: "1", date: "2025-01-31", account: "Business Checking", statementBalance: 155000, bookBalance: 148200, difference: 6800, status: "pending" },
  { id: "2", date: "2025-01-31", account: "Savings Account", statementBalance: 50200, bookBalance: 50200, difference: 0, status: "reconciled" },
];

export default function Accounts() {
  const [accounts, setAccounts] = useLocalStorage<Account[]>("accounts", initialAccounts);
  const [showAccForm, setShowAccForm] = useState(false);
  const [accForm, setAccForm] = useState({ name: "", accountTitle: "", code: "", currency: "PKR", balance: "" });
  const [payments, setPayments] = useLocalStorage<OtherPayment[]>("otherPayments", initialPayments);
  const [receipts, setReceipts] = useLocalStorage<OtherReceipt[]>("otherReceipts", initialReceipts);
  const [transfers, setTransfers] = useLocalStorage<Transfer[]>("transfers", initialTransfers);
  const [reconcile, setReconcile] = useLocalStorage<ReconcileEntry[]>("reconcileEntries", initialReconcile);

  // Ledger (Account Management)
  const [ledger, setLedger] = useLocalStorage<LedgerEntry[]>("ledgerEntries", []);
  const [ledgerForm, setLedgerForm] = useState({ date: "", bank: "", type: "incoming" as "incoming" | "outgoing", amount: "", description: "", reference: "" });
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [ledgerMonth, setLedgerMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [ledgerBank, setLedgerBank] = useState("all");
  const [ledgerPeriod, setLedgerPeriod] = useState<"month" | "year">("month");

  // Payment form
  const [payForm, setPayForm] = useState({ date: "", account: "", payee: "", amount: "", reference: "", description: "" });
  const [showPayForm, setShowPayForm] = useState(false);

  // Receipt form
  const [recForm, setRecForm] = useState({ date: "", account: "", receivedFrom: "", amount: "", reference: "", description: "" });
  const [showRecForm, setShowRecForm] = useState(false);

  // Transfer form
  const [trfForm, setTrfForm] = useState({ date: "", fromAccount: "", toAccount: "", amount: "", reference: "" });
  const [showTrfForm, setShowTrfForm] = useState(false);

  const addLedgerEntry = () => {
    if (!ledgerForm.date || !ledgerForm.bank || !ledgerForm.amount) return;
    const entry: LedgerEntry = {
      id: Date.now().toString(), date: ledgerForm.date, bank: ledgerForm.bank, type: ledgerForm.type,
      amount: parseFloat(ledgerForm.amount), description: ledgerForm.description,
      reference: ledgerForm.reference || `LED-${(ledger.length + 1).toString().padStart(3, "0")}`,
    };
    setLedger([entry, ...ledger]);
    setLedgerForm({ date: "", bank: "", type: "incoming", amount: "", description: "", reference: "" });
    setShowLedgerForm(false);
  };

  const filteredLedger = useMemo(() => {
    const prefix = ledgerPeriod === "year" ? ledgerMonth.substring(0, 4) : ledgerMonth;
    return ledger.filter(e => e.date.startsWith(prefix) && (ledgerBank === "all" || e.bank === ledgerBank));
  }, [ledger, ledgerMonth, ledgerBank, ledgerPeriod]);

  const ledgerSummary = useMemo(() => {
    const totalIn = filteredLedger.filter(e => e.type === "incoming").reduce((s, e) => s + e.amount, 0);
    const totalOut = filteredLedger.filter(e => e.type === "outgoing").reduce((s, e) => s + e.amount, 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filteredLedger]);

  const exportCSV = () => {
    const headers = "Date,Bank,Type,Amount,Reference,Description\n";
    const rows = filteredLedger.map(e => `${e.date},${e.bank},${e.type},${e.amount},${e.reference},"${e.description}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `account-management-${ledgerMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const addPayment = () => {
    if (!payForm.date || !payForm.payee || !payForm.amount) return;
    const newP: OtherPayment = {
      id: Date.now().toString(), date: payForm.date, account: payForm.account || accounts[0]?.name || "",
      payee: payForm.payee, amount: parseFloat(payForm.amount), reference: payForm.reference || `PAY-${(payments.length + 1).toString().padStart(3, "0")}`,
      description: payForm.description,
    };
    setPayments([newP, ...payments]);
    setPayForm({ date: "", account: "", payee: "", amount: "", reference: "", description: "" });
    setShowPayForm(false);
  };

  const addReceipt = () => {
    if (!recForm.date || !recForm.receivedFrom || !recForm.amount) return;
    const newR: OtherReceipt = {
      id: Date.now().toString(), date: recForm.date, account: recForm.account || accounts[0]?.name || "",
      receivedFrom: recForm.receivedFrom, amount: parseFloat(recForm.amount), reference: recForm.reference || `REC-${(receipts.length + 1).toString().padStart(3, "0")}`,
      description: recForm.description,
    };
    setReceipts([newR, ...receipts]);
    setRecForm({ date: "", account: "", receivedFrom: "", amount: "", reference: "", description: "" });
    setShowRecForm(false);
  };

  const addTransfer = () => {
    if (!trfForm.date || !trfForm.fromAccount || !trfForm.toAccount || !trfForm.amount) return;
    const newT: Transfer = {
      id: Date.now().toString(), date: trfForm.date, fromAccount: trfForm.fromAccount, toAccount: trfForm.toAccount,
      amount: parseFloat(trfForm.amount), reference: trfForm.reference || `TRF-${(transfers.length + 1).toString().padStart(3, "0")}`,
    };
    setTransfers([newT, ...transfers]);
    setTrfForm({ date: "", fromAccount: "", toAccount: "", amount: "", reference: "" });
    setShowTrfForm(false);
  };

  const addAccount = () => {
    if (!accForm.name || !accForm.code) return;
    const newAcc: Account = {
      id: Date.now().toString(), name: accForm.name, accountTitle: accForm.accountTitle, code: accForm.code,
      reconcileDate: "", currency: accForm.currency || "PKR",
      fxBalance: 0, balance: parseFloat(accForm.balance) || 0,
    };
    setAccounts([...accounts, newAcc]);
    setAccForm({ name: "", accountTitle: "", code: "", currency: "PKR", balance: "" });
    setShowAccForm(false);
  };

  const markReconciled = (id: string) => {
    setReconcile(reconcile.map(r => r.id === id ? { ...r, status: "reconciled" as const, difference: 0 } : r));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounts</h1>
        <p className="text-muted-foreground text-sm">Manage bank accounts, payments, receipts, transfers & reconciliation</p>
      </div>

      <Tabs defaultValue="balances" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="balances">Account Balances</TabsTrigger>
          <TabsTrigger value="management">Account Management</TabsTrigger>
          <TabsTrigger value="payments">Other Payments</TabsTrigger>
          <TabsTrigger value="receipts">Other Receipts</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
        </TabsList>

        {/* Account Balances */}
        <TabsContent value="balances">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Account Balances</h2>
            <Button size="sm" className="bg-primary" onClick={() => setShowAccForm(!showAccForm)}><Plus className="w-4 h-4 mr-1" /> New Account</Button>
          </div>
          {showAccForm && (
            <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <Input value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} placeholder="Bank Name" />
              <Input value={accForm.accountTitle} onChange={e => setAccForm({ ...accForm, accountTitle: e.target.value })} placeholder="Account Title" />
              <Input value={accForm.code} onChange={e => setAccForm({ ...accForm, code: e.target.value })} placeholder="Code" />
              <Input value={accForm.currency} onChange={e => setAccForm({ ...accForm, currency: e.target.value })} placeholder="Currency Code (e.g. PKR)" />
              <Input type="number" value={accForm.balance} onChange={e => setAccForm({ ...accForm, balance: e.target.value })} placeholder="Opening Balance" />
              <div className="md:col-span-5 flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAccForm(false)}>Cancel</Button>
                <Button size="sm" onClick={addAccount}>Save</Button>
              </div>
            </div>
          )}
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Bank Name</th>
                  <th className="text-left p-3">Account Title</th>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Reconcile Date</th>
                  <th className="text-left p-3">Fx Currency Code</th>
                  <th className="text-right p-3">Fx Balance</th>
                  <th className="text-right p-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-primary font-medium">{acc.name}</td>
                    <td className="p-3">{acc.accountTitle}</td>
                    <td className="p-3">{acc.code}</td>
                    <td className="p-3">{acc.reconcileDate || "—"}</td>
                    <td className="p-3">{acc.currency}</td>
                    <td className="p-3 text-right">{acc.fxBalance.toFixed(2)}</td>
                    <td className="p-3 text-right">{acc.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
              <span>Showing 1 to {accounts.length} of {accounts.length} entries</span>
            </div>
          </div>
        </TabsContent>

        {/* Account Management */}
        <TabsContent value="management">
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-lg font-semibold">Account Management</h2>
              <div className="flex flex-wrap gap-2">
                <Select value={ledgerBank} onValueChange={setLedgerBank}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="All Banks" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Banks</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name} — {a.accountTitle}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={ledgerPeriod} onValueChange={v => setLedgerPeriod(v as "month" | "year")}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="month" value={ledgerMonth} onChange={e => setLedgerMonth(e.target.value)} className="w-44" />
                <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
                <Button size="sm" onClick={() => setShowLedgerForm(!showLedgerForm)}><Plus className="w-4 h-4 mr-1" /> Add Entry</Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Incoming</p>
                <p className="text-xl font-bold text-success">{formatCurrency(ledgerSummary.totalIn)}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Outgoing</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(ledgerSummary.totalOut)}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Net Balance</p>
                <p className={`text-xl font-bold ${ledgerSummary.net >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(ledgerSummary.net)}</p>
              </div>
            </div>

            {showLedgerForm && (
              <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input type="date" value={ledgerForm.date} onChange={e => setLedgerForm({ ...ledgerForm, date: e.target.value })} placeholder="Date" />
                <Select value={ledgerForm.bank} onValueChange={v => setLedgerForm({ ...ledgerForm, bank: v })}>
                  <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name} — {a.accountTitle}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={ledgerForm.type} onValueChange={v => setLedgerForm({ ...ledgerForm, type: v as "incoming" | "outgoing" })}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incoming">Incoming (Received)</SelectItem>
                    <SelectItem value="outgoing">Outgoing (Paid)</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={ledgerForm.amount} onChange={e => setLedgerForm({ ...ledgerForm, amount: e.target.value })} placeholder="Amount" />
                <Input value={ledgerForm.reference} onChange={e => setLedgerForm({ ...ledgerForm, reference: e.target.value })} placeholder="Reference" />
                <Input value={ledgerForm.description} onChange={e => setLedgerForm({ ...ledgerForm, description: e.target.value })} placeholder="Description" className="md:col-span-2" />
                <div className="flex gap-2 justify-end items-end">
                  <Button variant="outline" size="sm" onClick={() => setShowLedgerForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={addLedgerEntry}>Save</Button>
                </div>
              </div>
            )}

            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Bank</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Reference</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No entries for this month</td></tr>
                  )}
                  {filteredLedger.map(e => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{e.date}</td>
                      <td className="p-3 font-medium">{e.bank}</td>
                      <td className="p-3">
                        <Badge variant={e.type === "incoming" ? "default" : "secondary"}>
                          {e.type === "incoming" ? <ArrowDownRight className="w-3 h-3 mr-1" /> : <ArrowUpRight className="w-3 h-3 mr-1" />}
                          {e.type === "incoming" ? "Incoming" : "Outgoing"}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{e.reference}</td>
                      <td className="p-3">{e.description}</td>
                      <td className={`p-3 text-right font-semibold ${e.type === "incoming" ? "text-success" : "text-destructive"}`}>
                        {e.type === "incoming" ? "+" : "-"}{formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bank-wise Summary */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/50">
                <h3 className="font-semibold text-sm">Bank-wise Summary ({ledgerPeriod === "year" ? ledgerMonth.substring(0, 4) : ledgerMonth})</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3">Bank Name</th>
                    <th className="text-right p-3">Total Incoming</th>
                    <th className="text-right p-3">Total Outgoing</th>
                    <th className="text-right p-3">Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const bankMap: Record<string, { incoming: number; outgoing: number }> = {};
                    filteredLedger.forEach(e => {
                      if (!bankMap[e.bank]) bankMap[e.bank] = { incoming: 0, outgoing: 0 };
                      if (e.type === "incoming") bankMap[e.bank].incoming += e.amount;
                      else bankMap[e.bank].outgoing += e.amount;
                    });
                    const banks = Object.entries(bankMap);
                    if (banks.length === 0) return (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No data for this period</td></tr>
                    );
                    return banks.map(([bank, data]) => (
                      <tr key={bank} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium text-primary">{bank}</td>
                        <td className="p-3 text-right text-success font-semibold">{formatCurrency(data.incoming)}</td>
                        <td className="p-3 text-right text-destructive font-semibold">{formatCurrency(data.outgoing)}</td>
                        <td className={`p-3 text-right font-bold ${data.incoming - data.outgoing >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(data.incoming - data.outgoing)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right text-success">{formatCurrency(ledgerSummary.totalIn)}</td>
                    <td className="p-3 text-right text-destructive">{formatCurrency(ledgerSummary.totalOut)}</td>
                    <td className={`p-3 text-right ${ledgerSummary.net >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(ledgerSummary.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Other Payments */}
        <TabsContent value="payments">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Other Payments</h2>
              <Button size="sm" onClick={() => setShowPayForm(!showPayForm)}><Plus className="w-4 h-4 mr-1" /> Add Payment</Button>
            </div>
            {showPayForm && (
              <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} placeholder="Date" />
                <Input value={payForm.account} onChange={e => setPayForm({ ...payForm, account: e.target.value })} placeholder="Bank / Account Name" list="account-list" />
                <datalist id="account-list">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                <Input value={payForm.payee} onChange={e => setPayForm({ ...payForm, payee: e.target.value })} placeholder="Payee" />
                <Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount" />
                <Input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Reference" />
                <Input value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} placeholder="Description" />
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowPayForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={addPayment}>Save</Button>
                </div>
              </div>
            )}
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Date</th><th className="text-left p-3">Account</th><th className="text-left p-3">Payee</th><th className="text-left p-3">Reference</th><th className="text-left p-3">Description</th><th className="text-right p-3">Amount</th></tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{p.date}</td><td className="p-3">{p.account}</td><td className="p-3">{p.payee}</td>
                      <td className="p-3"><span className="text-muted-foreground">{p.reference}</span></td><td className="p-3">{p.description}</td>
                      <td className="p-3 text-right font-semibold text-destructive">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Other Receipts */}
        <TabsContent value="receipts">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Other Receipts</h2>
              <Button size="sm" onClick={() => setShowRecForm(!showRecForm)}><Plus className="w-4 h-4 mr-1" /> Add Receipt</Button>
            </div>
            {showRecForm && (
              <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input type="date" value={recForm.date} onChange={e => setRecForm({ ...recForm, date: e.target.value })} placeholder="Date" />
                <Input value={recForm.account} onChange={e => setRecForm({ ...recForm, account: e.target.value })} placeholder="Bank / Account Name" list="account-list-rec" />
                <datalist id="account-list-rec">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                <Input value={recForm.receivedFrom} onChange={e => setRecForm({ ...recForm, receivedFrom: e.target.value })} placeholder="Received From" />
                <Input type="number" value={recForm.amount} onChange={e => setRecForm({ ...recForm, amount: e.target.value })} placeholder="Amount" />
                <Input value={recForm.reference} onChange={e => setRecForm({ ...recForm, reference: e.target.value })} placeholder="Reference" />
                <Input value={recForm.description} onChange={e => setRecForm({ ...recForm, description: e.target.value })} placeholder="Description" />
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowRecForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={addReceipt}>Save</Button>
                </div>
              </div>
            )}
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Date</th><th className="text-left p-3">Account</th><th className="text-left p-3">Received From</th><th className="text-left p-3">Reference</th><th className="text-left p-3">Description</th><th className="text-right p-3">Amount</th></tr></thead>
                <tbody>
                  {receipts.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{r.date}</td><td className="p-3">{r.account}</td><td className="p-3">{r.receivedFrom}</td>
                      <td className="p-3"><span className="text-muted-foreground">{r.reference}</span></td><td className="p-3">{r.description}</td>
                      <td className="p-3 text-right font-semibold text-success">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Transfers */}
        <TabsContent value="transfers">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Account Transfers</h2>
              <Button size="sm" onClick={() => setShowTrfForm(!showTrfForm)}><ArrowLeftRight className="w-4 h-4 mr-1" /> New Transfer</Button>
            </div>
            {showTrfForm && (
              <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input type="date" value={trfForm.date} onChange={e => setTrfForm({ ...trfForm, date: e.target.value })} placeholder="Date" />
                <Input value={trfForm.fromAccount} onChange={e => setTrfForm({ ...trfForm, fromAccount: e.target.value })} placeholder="From Bank / Account" list="account-list-from" />
                <datalist id="account-list-from">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                <Input value={trfForm.toAccount} onChange={e => setTrfForm({ ...trfForm, toAccount: e.target.value })} placeholder="To Bank / Account" list="account-list-to" />
                <datalist id="account-list-to">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                <Input type="number" value={trfForm.amount} onChange={e => setTrfForm({ ...trfForm, amount: e.target.value })} placeholder="Amount" />
                <Input value={trfForm.reference} onChange={e => setTrfForm({ ...trfForm, reference: e.target.value })} placeholder="Reference" />
                <div className="flex gap-2 justify-end items-end">
                  <Button variant="outline" size="sm" onClick={() => setShowTrfForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={addTransfer}>Save</Button>
                </div>
              </div>
            )}
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Date</th><th className="text-left p-3">From</th><th className="text-left p-3">To</th><th className="text-left p-3">Reference</th><th className="text-right p-3">Amount</th></tr></thead>
                <tbody>
                  {transfers.map(t => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{t.date}</td><td className="p-3">{t.fromAccount}</td><td className="p-3">{t.toAccount}</td>
                      <td className="p-3"><span className="text-muted-foreground">{t.reference}</span></td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Reconcile */}
        <TabsContent value="reconcile">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Bank Reconciliation</h2>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Date</th><th className="text-left p-3">Account</th><th className="text-right p-3">Statement Balance</th><th className="text-right p-3">Book Balance</th><th className="text-right p-3">Difference</th><th className="text-center p-3">Status</th><th className="text-center p-3">Action</th></tr></thead>
                <tbody>
                  {reconcile.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{r.date}</td><td className="p-3">{r.account}</td>
                      <td className="p-3 text-right">{formatCurrency(r.statementBalance)}</td>
                      <td className="p-3 text-right">{formatCurrency(r.bookBalance)}</td>
                      <td className={`p-3 text-right font-semibold ${r.difference !== 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(r.difference)}</td>
                      <td className="p-3 text-center">
                        <Badge variant={r.status === "reconciled" ? "default" : "secondary"}>{r.status === "reconciled" ? "Reconciled" : "Pending"}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => markReconciled(r.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Reconcile
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
