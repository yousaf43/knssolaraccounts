import { useState } from "react";
import { Landmark, ArrowUpRight, ArrowDownRight, Plus, ArrowLeftRight, CheckCircle2 } from "lucide-react";
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

type Account = { id: string; name: string; bank: string; balance: number; number: string };
type OtherPayment = { id: string; date: string; account: string; payee: string; amount: number; reference: string; description: string };
type OtherReceipt = { id: string; date: string; account: string; receivedFrom: string; amount: number; reference: string; description: string };
type Transfer = { id: string; date: string; fromAccount: string; toAccount: string; amount: number; reference: string };
type ReconcileEntry = { id: string; date: string; account: string; statementBalance: number; bookBalance: number; difference: number; status: "reconciled" | "pending" };

const initialAccounts: Account[] = [
  { id: "1", name: "Business Checking", bank: "Chase Bank", balance: 148200, number: "****4521" },
  { id: "2", name: "Savings Account", bank: "Chase Bank", balance: 50200, number: "****7833" },
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
  const [accounts] = useLocalStorage<Account[]>("accounts", initialAccounts);
  const [payments, setPayments] = useLocalStorage<OtherPayment[]>("otherPayments", initialPayments);
  const [receipts, setReceipts] = useLocalStorage<OtherReceipt[]>("otherReceipts", initialReceipts);
  const [transfers, setTransfers] = useLocalStorage<Transfer[]>("transfers", initialTransfers);
  const [reconcile, setReconcile] = useLocalStorage<ReconcileEntry[]>("reconcileEntries", initialReconcile);

  // Payment form
  const [payForm, setPayForm] = useState({ date: "", account: "", payee: "", amount: "", reference: "", description: "" });
  const [showPayForm, setShowPayForm] = useState(false);

  // Receipt form
  const [recForm, setRecForm] = useState({ date: "", account: "", receivedFrom: "", amount: "", reference: "", description: "" });
  const [showRecForm, setShowRecForm] = useState(false);

  // Transfer form
  const [trfForm, setTrfForm] = useState({ date: "", fromAccount: "", toAccount: "", amount: "", reference: "" });
  const [showTrfForm, setShowTrfForm] = useState(false);

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="balances">Account Balances</TabsTrigger>
          <TabsTrigger value="payments">Other Payments</TabsTrigger>
          <TabsTrigger value="receipts">Other Receipts</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
        </TabsList>

        {/* Account Balances */}
        <TabsContent value="balances">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {accounts.map((acc) => (
              <div key={acc.id} className="bg-card rounded-lg border p-6">
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "credit" ? "bg-success/10" : "bg-destructive/10"}`}>
                      {tx.type === "credit" ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
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
                <Select value={payForm.account} onValueChange={v => setPayForm({ ...payForm, account: v })}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
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
                <Select value={recForm.account} onValueChange={v => setRecForm({ ...recForm, account: v })}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
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
                <Select value={trfForm.fromAccount} onValueChange={v => setTrfForm({ ...trfForm, fromAccount: v })}>
                  <SelectTrigger><SelectValue placeholder="From Account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={trfForm.toAccount} onValueChange={v => setTrfForm({ ...trfForm, toAccount: v })}>
                  <SelectTrigger><SelectValue placeholder="To Account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
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
