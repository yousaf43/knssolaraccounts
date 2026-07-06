import { useState, useMemo, useEffect } from "react";
import { Landmark, ArrowUpRight, ArrowDownRight, Plus, ArrowLeftRight, CheckCircle2, Download, Pencil, Trash2, Printer, X, SendHorizontal, Wallet, Settings2, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StickyPageHeader } from "@/components/StickyPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { recentTransactions } from "@/data/mockData";
import { useAccountsCloud, useLedgerEntriesCloud, useOtherPaymentsCloud, useOtherReceiptsCloud, useTransfersCloud, useReconcileEntriesCloud } from "@/hooks/useAppData";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";

import { defaultAccounts, type Account } from "@/data/defaultAccounts";
type OtherPayment = { id: string; date: string; account: string; payee: string; amount: number; reference: string; description: string };
type OtherReceipt = { id: string; date: string; account: string; receivedFrom: string; amount: number; reference: string; description: string };
type Transfer = { id: string; date: string; fromAccount: string; toAccount: string; amount: number; reference: string };
type ReconcileEntry = { id: string; date: string; account: string; statementBalance: number; bookBalance: number; difference: number; status: "reconciled" | "pending" };
type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };

const initialPayments: OtherPayment[] = [];
const initialReceipts: OtherReceipt[] = [];
const initialTransfers: Transfer[] = [];

const initialReconcile: ReconcileEntry[] = [
  { id: "1", date: "2025-01-31", account: "Business Checking", statementBalance: 155000, bookBalance: 148200, difference: 6800, status: "pending" },
  { id: "2", date: "2025-01-31", account: "Savings Account", statementBalance: 50200, bookBalance: 50200, difference: 0, status: "reconciled" },
];

function printReceipt(r: OtherReceipt, formatCurrency: (n: number) => string, companyName: string) {
  const content = `
    <html><head><title>Receipt ${r.reference}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
      .header { text-align: center; border-bottom: 2px solid #1a56db; padding-bottom: 12px; margin-bottom: 20px; }
      h1 { color: #1a56db; font-size: 20px; margin: 0; }
      .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
      .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
      .amount { font-size: 22px; font-weight: bold; color: #16a34a; text-align: right; margin-top: 16px; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #666; }
      .sig { border-top: 1px solid #999; padding-top: 4px; width: 180px; text-align: center; }
    </style></head><body>
    <div class="header"><h1>${companyName}</h1><p style="margin:4px 0;font-size:13px;color:#555">RECEIPT</p></div>
    <div class="meta"><span><b>Receipt No:</b> ${r.reference}</span><span><b>Date:</b> ${r.date}</span></div>
    <div class="row"><span>Received From</span><span><b>${r.receivedFrom}</b></span></div>
    <div class="row"><span>Account / Bank</span><span>${r.account}</span></div>
    <div class="row"><span>Description</span><span>${r.description || "—"}</span></div>
    <div class="amount">Amount: ${formatCurrency(r.amount)}</div>
    <div class="footer">
      <div class="sig">Received By<br/>&nbsp;</div>
      <div class="sig">Authorized Signature<br/>&nbsp;</div>
    </div>
    </body></html>
  `;
  const win = window.open("", "_blank");
  if (win) { win.document.write(content); win.document.close(); setTimeout(() => win.print(), 400); }
}

export default function Accounts() {
  const { formatCurrency, settings } = useSettings();
  const { data: accounts, setData: setAccounts, upsert: upsertAccount, remove: removeAccount, loading: accountsLoading } = useAccountsCloud();
  const [activeTab, setActiveTab] = useState("balances");
  const [showAccForm, setShowAccForm] = useState(false);
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [accForm, setAccForm] = useState({ name: "", accountTitle: "", code: "", currency: "PKR", balance: "" });

  const sectionMeta: Record<string, { title: string; subtitle: string }> = {
    balances: { title: "Account Balances", subtitle: "Bank accounts, opening & ledger balances" },
    management: { title: "Account Management", subtitle: "Ledger entries, incoming & outgoing" },
    payments: { title: "Other Payments", subtitle: "Miscellaneous outgoing payments" },
    receipts: { title: "Other Receipts", subtitle: "Miscellaneous incoming receipts" },
    transfers: { title: "Account Transfers", subtitle: "Move funds between accounts" },
    reconcile: { title: "Bank Reconciliation", subtitle: "Match statement with book balances" },
  };
  const currentSection = sectionMeta[activeTab] ?? sectionMeta.balances;
  const { data: payments, setData: setPayments, upsert: upsertPayment, remove: removePayment } = useOtherPaymentsCloud();
  const { data: receipts, setData: setReceipts, upsert: upsertReceipt, remove: removeReceipt } = useOtherReceiptsCloud();
  const { data: transfers, setData: setTransfers, upsert: upsertTransfer, remove: removeTransfer } = useTransfersCloud();
  const { data: reconcile, setData: setReconcile, upsert: upsertReconcile } = useReconcileEntriesCloud();

  // Seed default accounts if none exist
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!accountsLoading && accounts.length === 0 && !seeded) {
      setSeeded(true);
      defaultAccounts.forEach(a => upsertAccount({ ...a, id: crypto.randomUUID() }));
    }
  }, [accountsLoading, accounts.length]);

   // Ledger
  const { data: ledger, setData: setLedger, upsert: upsertLedger, remove: removeLedger } = useLedgerEntriesCloud();
  const [ledgerForm, setLedgerForm] = useState({ date: "", bank: "", type: "incoming" as "incoming" | "outgoing", amount: "", description: "", reference: "" });
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [editLedgerId, setEditLedgerId] = useState<string | null>(null);
  const [ledgerMonth, setLedgerMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [ledgerBank, setLedgerBank] = useState("all");
  const [ledgerPeriod, setLedgerPeriod] = useState<"month" | "year">("month");

  // Petty Cash transfer
  const [showPettyCashTransfer, setShowPettyCashTransfer] = useState(false);
  const [pettyCashForm, setPettyCashForm] = useState({ account: "", date: new Date().toISOString().split("T")[0], amount: "", description: "" });

  const handlePettyCashTransfer = () => {
    if (!pettyCashForm.account || !pettyCashForm.date || !pettyCashForm.amount || parseFloat(pettyCashForm.amount) <= 0) return;
    if (pettyCashForm.account === "Petty Cash") { toast.error("Cannot transfer from Petty Cash to itself"); return; }
    const amt = parseFloat(pettyCashForm.amount);
    // Outgoing from source account
    const outEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      date: pettyCashForm.date,
      bank: pettyCashForm.account,
      type: "outgoing",
      amount: amt,
      description: pettyCashForm.description || `Transfer to Petty Cash`,
      reference: `PC-${(ledger.length + 1).toString().padStart(3, "0")}`,
    };
    const inEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      date: pettyCashForm.date,
      bank: "Petty Cash",
      type: "incoming",
      amount: amt,
      description: pettyCashForm.description || `Transfer from ${pettyCashForm.account}`,
      reference: `PC-${(ledger.length + 2).toString().padStart(3, "0")}`,
    };
    upsertLedger(outEntry);
    upsertLedger(inEntry);
    toast.success(`${formatCurrency(amt)} transferred to Petty Cash from ${pettyCashForm.account}`);
    setPettyCashForm({ account: "", date: new Date().toISOString().split("T")[0], amount: "", description: "" });
    setShowPettyCashTransfer(false);
  };

  // Payment form
  const emptyPay = { date: "", account: "", payee: "", amount: "", reference: "", description: "" };
  const [payForm, setPayForm] = useState(emptyPay);
  const [showPayForm, setShowPayForm] = useState(false);
  const [editPayId, setEditPayId] = useState<string | null>(null);

  // Receipt form
  const emptyRec = { date: "", account: "", receivedFrom: "", amount: "", reference: "", description: "" };
  const [recForm, setRecForm] = useState(emptyRec);
  const [showRecForm, setShowRecForm] = useState(false);
  const [editRecId, setEditRecId] = useState<string | null>(null);

  // Transfer form
  const emptyTrf = { date: "", fromAccount: "", toAccount: "", amount: "", reference: "" };
  const [trfForm, setTrfForm] = useState(emptyTrf);
  const [showTrfForm, setShowTrfForm] = useState(false);
  const [editTrfId, setEditTrfId] = useState<string | null>(null);

  // ---- Ledger computed balance per bank from ledger entries ----
  const bankBalances = useMemo(() => {
    const map: Record<string, number> = {};
    ledger.forEach(e => {
      if (!map[e.bank]) map[e.bank] = 0;
      if (e.type === "incoming") map[e.bank] += e.amount;
      else map[e.bank] -= e.amount;
    });
    return map;
  }, [ledger]);

  const addOrUpdateLedgerEntry = () => {
    if (!ledgerForm.date || !ledgerForm.bank || !ledgerForm.amount) return;
    const entry: LedgerEntry = {
      id: editLedgerId || crypto.randomUUID(),
      date: ledgerForm.date, bank: ledgerForm.bank, type: ledgerForm.type,
      amount: parseFloat(ledgerForm.amount), description: ledgerForm.description,
      reference: ledgerForm.reference || `LED-${(ledger.length + 1).toString().padStart(3, "0")}`,
    };
    upsertLedger(entry);
    if (!editLedgerId) {
      const entryMonth = entry.date.substring(0, 7);
      if (entryMonth !== ledgerMonth) setLedgerMonth(entryMonth);
    }
    setEditLedgerId(null);
    setLedgerForm({ date: "", bank: "", type: "incoming", amount: "", description: "", reference: "" });
    setShowLedgerForm(false);
  };

  const openEditLedger = (e: LedgerEntry) => {
    setLedgerForm({ date: e.date, bank: e.bank, type: e.type, amount: String(e.amount), description: e.description, reference: e.reference });
    setEditLedgerId(e.id);
    setShowLedgerForm(true);
  };

  const deleteLedger = (id: string) => removeLedger(id);

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

  // ---- Payments ----
  const addOrUpdatePayment = () => {
    if (!payForm.date || !payForm.payee || !payForm.amount) return;
    const p: OtherPayment = {
      id: editPayId || crypto.randomUUID(), date: payForm.date, account: payForm.account || accounts[0]?.name || "",
      payee: payForm.payee, amount: parseFloat(payForm.amount),
      reference: payForm.reference || `PAY-${(payments.length + 1).toString().padStart(3, "0")}`,
      description: payForm.description,
    };
    upsertPayment(p);
    setEditPayId(null);
    setPayForm(emptyPay);
    setShowPayForm(false);
  };

  const openEditPayment = (p: OtherPayment) => {
    setPayForm({ date: p.date, account: p.account, payee: p.payee, amount: String(p.amount), reference: p.reference, description: p.description });
    setEditPayId(p.id);
    setShowPayForm(true);
  };

  const deletePayment = (id: string) => removePayment(id);

  // ---- Receipts ----
  const addOrUpdateReceipt = () => {
    if (!recForm.date || !recForm.receivedFrom || !recForm.amount) return;
    const r: OtherReceipt = {
      id: editRecId || crypto.randomUUID(), date: recForm.date, account: recForm.account || accounts[0]?.name || "",
      receivedFrom: recForm.receivedFrom, amount: parseFloat(recForm.amount),
      reference: recForm.reference || `REC-${(receipts.length + 1).toString().padStart(3, "0")}`,
      description: recForm.description,
    };
    upsertReceipt(r);
    setEditRecId(null);
    setRecForm(emptyRec);
    setShowRecForm(false);
  };

  const openEditReceipt = (r: OtherReceipt) => {
    setRecForm({ date: r.date, account: r.account, receivedFrom: r.receivedFrom, amount: String(r.amount), reference: r.reference, description: r.description });
    setEditRecId(r.id);
    setShowRecForm(true);
  };

  const deleteReceipt = (id: string) => removeReceipt(id);

  // ---- Transfers ----
  const addOrUpdateTransfer = () => {
    if (!trfForm.date || !trfForm.fromAccount || !trfForm.toAccount || !trfForm.amount) return;
    const t: Transfer = {
      id: editTrfId || crypto.randomUUID(), date: trfForm.date, fromAccount: trfForm.fromAccount, toAccount: trfForm.toAccount,
      amount: parseFloat(trfForm.amount), reference: trfForm.reference || `TRF-${(transfers.length + 1).toString().padStart(3, "0")}`,
    };
    upsertTransfer(t);
    setEditTrfId(null);
    setTrfForm(emptyTrf);
    setShowTrfForm(false);
  };

  const openEditTransfer = (t: Transfer) => {
    setTrfForm({ date: t.date, fromAccount: t.fromAccount, toAccount: t.toAccount, amount: String(t.amount), reference: t.reference });
    setEditTrfId(t.id);
    setShowTrfForm(true);
  };

  const deleteTransfer = (id: string) => removeTransfer(id);

  const addOrUpdateAccount = () => {
    if (!accForm.name || !accForm.code) return;
    const acc: Account = {
      id: editAccId || crypto.randomUUID(), name: accForm.name, accountTitle: accForm.accountTitle, code: accForm.code,
      reconcileDate: "", currency: accForm.currency || "PKR",
      fxBalance: 0, balance: parseFloat(accForm.balance) || 0,
    };
    upsertAccount(acc);
    setEditAccId(null);
    setAccForm({ name: "", accountTitle: "", code: "", currency: "PKR", balance: "" });
    setShowAccForm(false);
  };

  const openEditAccount = (a: Account) => {
    setAccForm({ name: a.name, accountTitle: a.accountTitle, code: a.code, currency: a.currency, balance: String(a.balance) });
    setEditAccId(a.id);
    setShowAccForm(true);
  };

  const deleteAccount = (id: string) => removeAccount(id);

  const markReconciled = (id: string) => {
    const entry = reconcile.find(r => r.id === id);
    if (entry) upsertReconcile({ ...entry, status: "reconciled", difference: 0 });
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <StickyPageHeader
          icon={Landmark}
          title={currentSection.title}
          subtitle={currentSection.subtitle}
          tabsFull={
            <TabsList className="grid w-full grid-cols-6 gap-1">
              <TabsTrigger value="balances" className="min-w-0 px-1 text-xs sm:text-sm truncate" title="Account Balances">Balances</TabsTrigger>
              <TabsTrigger value="management" className="min-w-0 px-1 text-xs sm:text-sm truncate" title="Account Management">Management</TabsTrigger>
              <TabsTrigger value="payments" className="min-w-0 px-1 text-xs sm:text-sm truncate" title="Other Payments">Payments</TabsTrigger>
              <TabsTrigger value="receipts" className="min-w-0 px-1 text-xs sm:text-sm truncate" title="Other Receipts">Receipts</TabsTrigger>
              <TabsTrigger value="transfers" className="min-w-0 px-1 text-xs sm:text-sm truncate" title="Transfers">Transfers</TabsTrigger>
              <TabsTrigger value="reconcile" className="min-w-0 px-1 text-xs sm:text-sm truncate" title="Reconcile">Reconcile</TabsTrigger>
            </TabsList>
          }
          tabsCompact={
            <TabsList className="h-7 bg-muted/60 rounded-full p-0.5 gap-0.5 inline-flex w-auto flex-shrink-0">
              <TabsTrigger value="balances" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Account Balances"><Wallet className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="management" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Account Management"><Settings2 className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="payments" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Other Payments"><ArrowUpRight className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="receipts" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Other Receipts"><ArrowDownRight className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="transfers" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Transfers"><ArrowLeftRight className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="reconcile" className="h-6 px-2.5 rounded-full text-xs data-[state=active]:shadow-sm" title="Reconcile"><RefreshCw className="w-3.5 h-3.5" /></TabsTrigger>
            </TabsList>
          }
        />


        {/* Account Balances */}
        <TabsContent value="balances">
          <div className="flex justify-end items-center mb-4">
            <Button size="sm" className="bg-primary" onClick={() => { setEditAccId(null); setAccForm({ name: "", accountTitle: "", code: "", currency: "PKR", balance: "" }); setShowAccForm(!showAccForm); }}>
              <Plus className="w-4 h-4 mr-1" /> New Account
            </Button>
          </div>
          {showAccForm && (
            <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <Input value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} placeholder="Bank Name" />
              <Input value={accForm.accountTitle} onChange={e => setAccForm({ ...accForm, accountTitle: e.target.value })} placeholder="Account Title" />
              <Input value={accForm.code} onChange={e => setAccForm({ ...accForm, code: e.target.value })} placeholder="Code" />
              <Input value={accForm.currency} onChange={e => setAccForm({ ...accForm, currency: e.target.value })} placeholder="Currency (e.g. PKR)" />
              <Input type="number" value={accForm.balance} onChange={e => setAccForm({ ...accForm, balance: e.target.value })} placeholder="Opening Balance" />
              <div className="md:col-span-5 flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowAccForm(false); setEditAccId(null); }}>Cancel</Button>
                <Button size="sm" onClick={addOrUpdateAccount}>{editAccId ? "Update" : "Save"}</Button>
              </div>
            </div>
          )}
          {showPettyCashTransfer && (
            <div className="bg-card border rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><SendHorizontal className="w-4 h-4 text-warning" /> Transfer to Petty Cash</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPettyCashTransfer(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium">From Account</label>
                  <Select value={pettyCashForm.account} onValueChange={v => setPettyCashForm({ ...pettyCashForm, account: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.name !== "Petty Cash").map(a => <SelectItem key={a.id} value={a.name}>{a.name} — {a.accountTitle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Date</label>
                  <Input type="date" value={pettyCashForm.date} onChange={e => setPettyCashForm({ ...pettyCashForm, date: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">Amount</label>
                  <Input type="number" min={0} step={0.01} value={pettyCashForm.amount} onChange={e => setPettyCashForm({ ...pettyCashForm, amount: e.target.value })} placeholder="0.00" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">Description</label>
                  <Input value={pettyCashForm.description} onChange={e => setPettyCashForm({ ...pettyCashForm, description: e.target.value })} placeholder="Transfer description" className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowPettyCashTransfer(false)}>Cancel</Button>
                <Button size="sm" onClick={handlePettyCashTransfer}><SendHorizontal className="w-3.5 h-3.5 mr-1" /> Transfer to Petty Cash</Button>
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
                  <th className="text-left p-3">Currency</th>
                  <th className="text-right p-3">Opening Balance</th>
                  <th className="text-right p-3">Ledger Balance</th>
                  <th className="text-right p-3">Total Balance</th>
                  <th className="text-center p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  const ledgerBal = bankBalances[acc.name] || 0;
                  const total = acc.balance + ledgerBal;
                  return (
                    <tr key={acc.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-primary font-medium">{acc.name}</td>
                      <td className="p-3">{acc.accountTitle}</td>
                      <td className="p-3">{acc.code}</td>
                      <td className="p-3">{acc.reconcileDate || "—"}</td>
                      <td className="p-3">{acc.currency}</td>
                      <td className="p-3 text-right">{formatCurrency(acc.balance)}</td>
                      <td className={`p-3 text-right font-medium ${ledgerBal >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(ledgerBal)}</td>
                      <td className={`p-3 text-right font-bold ${total >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(total)}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setPettyCashForm({ ...pettyCashForm, account: acc.name }); setShowPettyCashTransfer(true); }} title="Transfer to Petty Cash"><SendHorizontal className="w-3.5 h-3.5 text-warning" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditAccount(acc)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteAccount(acc.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-bold">
                  <td className="p-3" colSpan={7}>Total Balance</td>
                  <td className="p-3 text-right text-primary">{formatCurrency(accounts.reduce((s, a) => s + a.balance + (bankBalances[a.name] || 0), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </TabsContent>

        {/* Account Management */}
        <TabsContent value="management">
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end items-center gap-2">
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
                <Button size="sm" onClick={() => { setEditLedgerId(null); setLedgerForm({ date: "", bank: "", type: "incoming", amount: "", description: "", reference: "" }); setShowLedgerForm(!showLedgerForm); }}>
                  <Plus className="w-4 h-4 mr-1" /> Add Entry
                </Button>
              </div>
            </div>

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
                <Input value={ledgerForm.description} onChange={e => setLedgerForm({ ...ledgerForm, description: e.target.value })} placeholder="Description" />
                <div className="flex gap-2 justify-end items-end md:col-span-3">
                  <Button variant="outline" size="sm" onClick={() => { setShowLedgerForm(false); setEditLedgerId(null); }}>Cancel</Button>
                  <Button size="sm" onClick={addOrUpdateLedgerEntry}>{editLedgerId ? "Update" : "Save"}</Button>
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
                    <th className="text-center p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No entries for this period</td></tr>
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
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditLedger(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteLedger(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
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
                    <th className="text-left p-3">Account Holder</th>
                    <th className="text-right p-3">Total Incoming</th>
                    <th className="text-right p-3">Total Outgoing</th>
                    <th className="text-right p-3">Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const bankMap: Record<string, { incoming: number; outgoing: number; title: string }> = {};
                    filteredLedger.forEach(e => {
                      if (!bankMap[e.bank]) {
                        const acc = accounts.find(a => a.name === e.bank);
                        bankMap[e.bank] = { incoming: 0, outgoing: 0, title: acc?.accountTitle || "" };
                      }
                      if (e.type === "incoming") bankMap[e.bank].incoming += e.amount;
                      else bankMap[e.bank].outgoing += e.amount;
                    });
                    const banks = Object.entries(bankMap);
                    if (banks.length === 0) return (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No data for this period</td></tr>
                    );
                    return banks.map(([bank, data]) => (
                      <tr key={bank} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium text-primary">{bank}</td>
                        <td className="p-3 text-muted-foreground text-xs">{data.title || "—"}</td>
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
                    <td className="p-3"></td>
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
            <div className="flex justify-end items-center">
              <Button size="sm" onClick={() => { setEditPayId(null); setPayForm(emptyPay); setShowPayForm(!showPayForm); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Payment
              </Button>
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
                  <Button variant="outline" size="sm" onClick={() => { setShowPayForm(false); setEditPayId(null); }}>Cancel</Button>
                  <Button size="sm" onClick={addOrUpdatePayment}>{editPayId ? "Update" : "Save"}</Button>
                </div>
              </div>
            )}
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Date</th><th className="text-left p-3">Account</th>
                  <th className="text-left p-3">Payee</th><th className="text-left p-3">Reference</th>
                  <th className="text-left p-3">Description</th><th className="text-right p-3">Amount</th>
                  <th className="text-center p-3">Actions</th>
                </tr></thead>
                <tbody>
                  {payments.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No payments yet</td></tr>}
                  {payments.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{p.date}</td><td className="p-3">{p.account}</td><td className="p-3">{p.payee}</td>
                      <td className="p-3 text-muted-foreground">{p.reference}</td><td className="p-3">{p.description}</td>
                      <td className="p-3 text-right font-semibold text-destructive">{formatCurrency(p.amount)}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditPayment(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deletePayment(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
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
            <div className="flex justify-end items-center">
              <Button size="sm" onClick={() => { setEditRecId(null); setRecForm(emptyRec); setShowRecForm(!showRecForm); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Receipt
              </Button>
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
                  <Button variant="outline" size="sm" onClick={() => { setShowRecForm(false); setEditRecId(null); }}>Cancel</Button>
                  <Button size="sm" onClick={addOrUpdateReceipt}>{editRecId ? "Update" : "Save"}</Button>
                </div>
              </div>
            )}
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Date</th><th className="text-left p-3">Account</th>
                  <th className="text-left p-3">Received From</th><th className="text-left p-3">Reference</th>
                  <th className="text-left p-3">Description</th><th className="text-right p-3">Amount</th>
                  <th className="text-center p-3">Actions</th>
                </tr></thead>
                <tbody>
                  {receipts.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No receipts yet</td></tr>}
                  {receipts.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{r.date}</td><td className="p-3">{r.account}</td><td className="p-3">{r.receivedFrom}</td>
                      <td className="p-3 text-muted-foreground">{r.reference}</td><td className="p-3">{r.description}</td>
                      <td className="p-3 text-right font-semibold text-success">{formatCurrency(r.amount)}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditReceipt(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => printReceipt(r, formatCurrency, settings.companyName)}><Printer className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteReceipt(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
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
              <Button size="sm" onClick={() => { setEditTrfId(null); setTrfForm(emptyTrf); setShowTrfForm(!showTrfForm); }}>
                <ArrowLeftRight className="w-4 h-4 mr-1" /> New Transfer
              </Button>
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
                <div className="flex gap-2 justify-end items-end md:col-span-3">
                  <Button variant="outline" size="sm" onClick={() => { setShowTrfForm(false); setEditTrfId(null); }}>Cancel</Button>
                  <Button size="sm" onClick={addOrUpdateTransfer}>{editTrfId ? "Update" : "Save"}</Button>
                </div>
              </div>
            )}
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Date</th><th className="text-left p-3">From</th>
                  <th className="text-left p-3">To</th><th className="text-left p-3">Reference</th>
                  <th className="text-right p-3">Amount</th><th className="text-center p-3">Actions</th>
                </tr></thead>
                <tbody>
                  {transfers.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transfers yet</td></tr>}
                  {transfers.map(t => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{t.date}</td><td className="p-3">{t.fromAccount}</td><td className="p-3">{t.toAccount}</td>
                      <td className="p-3 text-muted-foreground">{t.reference}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(t.amount)}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditTransfer(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteTransfer(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
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
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Date</th><th className="text-left p-3">Account</th>
                  <th className="text-right p-3">Statement Balance</th><th className="text-right p-3">Book Balance</th>
                  <th className="text-right p-3">Difference</th><th className="text-center p-3">Status</th><th className="text-center p-3">Action</th>
                </tr></thead>
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
