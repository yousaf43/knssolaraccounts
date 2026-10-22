import { useMemo, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, FileText, Plus, Trash2, Upload, CheckCircle2, AlertTriangle, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { matchesQuery } from "@/lib/search";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";

type Account = { id: string; name: string; accountTitle?: string; code?: string; balance: number };
type LedgerEntry = { id: string; date: string; bank: string; type: "incoming" | "outgoing"; amount: number; description: string; reference: string };
type StatementLine = { id: string; date: string; description: string; reference: string; amount: number }; // + credit (deposit), − debit

type Item = { date: string; ref: string; description: string; amount: number; note?: string };

const toIso = (raw: string): string => {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
const num = (v: string) => Number(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const uid = () => Math.random().toString(36).slice(2, 10);

function parseCsv(text: string): StatementLine[] {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if ((ch === "," || ch === ";" || ch === "\t") && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  const hasHeader = head.some((h) => /date|desc|amount|debit|credit|withdraw|deposit/.test(h));
  const find = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iDate = hasHeader ? Math.max(0, find(/date/)) : 0;
  const iDesc = hasHeader ? find(/desc|narr|particular|detail/) : 1;
  const iRef = hasHeader ? find(/ref|cheque|chq/) : -1;
  const iDebit = hasHeader ? find(/debit|withdraw|dr\b/) : -1;
  const iCredit = hasHeader ? find(/credit|deposit|cr\b/) : -1;
  const iAmt = hasHeader ? find(/amount/) : 2;
  return (hasHeader ? rows.slice(1) : rows).map((r) => {
    let amount = 0;
    if (iDebit >= 0 || iCredit >= 0) amount = (iCredit >= 0 ? num(r[iCredit]) : 0) - (iDebit >= 0 ? Math.abs(num(r[iDebit])) : 0);
    else amount = num(r[iAmt]);
    return { id: uid(), date: toIso(r[iDate]), description: iDesc >= 0 ? r[iDesc] || "" : "", reference: iRef >= 0 ? r[iRef] || "" : "", amount };
  }).filter((l) => l.date && l.amount !== 0);
}

export function BankReconciliationReport({ accounts, ledger, onBack }: { accounts: Account[]; ledger: LedgerEntry[]; onBack: () => void }) {
  const { formatCurrency, formatDate, settings } = useSettings();
  const bankAccounts = useMemo(() => accounts, [accounts]);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [accountId, setAccountId] = useState<string>("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [closing, setClosing] = useState("");
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [draft, setDraft] = useState({ date: today, description: "", reference: "", amount: "" });
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountQuery, setAccountQuery] = useState("");
  const filteredAccounts = useMemo(
    () => bankAccounts.filter((a) => matchesQuery(accountQuery, a.name, a.accountTitle, a.code)),
    [bankAccounts, accountQuery]
  );

  const account = bankAccounts.find((a) => a.id === accountId) || null;
  const money = (n: number) => formatCurrency(Math.round(n * 100) / 100);

  const calc = useMemo(() => {
    if (!account) return null;
    const mine = ledger.filter((e) => (e.bank || "").trim().toLowerCase() === account.name.trim().toLowerCase());
    const signed = (e: LedgerEntry) => (e.type === "incoming" ? e.amount : -e.amount);
    const after = mine.filter((e) => toIso(e.date) > to).reduce((s, e) => s + signed(e), 0);
    const bookBalance = account.balance - after;
    const period = mine.filter((e) => { const d = toIso(e.date); return d >= from && d <= to; })
      .sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)));
    const stmt = lines.filter((l) => l.date >= from && l.date <= to);
    const used = new Set<string>();
    const matched: { book: LedgerEntry; line: StatementLine; exact: boolean }[] = [];
    const unmatchedBook: LedgerEntry[] = [];
    for (const e of period) {
      const amt = signed(e); const d = toIso(e.date);
      let best: StatementLine | null = null;
      for (const l of stmt) {
        if (used.has(l.id) || Math.abs(l.amount - amt) > 0.5) continue;
        if (!best || dayDiff(l.date, d) < dayDiff(best.date, d)) best = l;
      }
      if (best && dayDiff(best.date, d) <= 7) { used.add(best.id); matched.push({ book: e, line: best, exact: best.date === d }); }
      else unmatchedBook.push(e);
    }
    const bankOnly = stmt.filter((l) => !used.has(l.id));
    const deposits: Item[] = unmatchedBook.filter((e) => e.type === "incoming").map((e) => ({ date: toIso(e.date), ref: e.reference, description: e.description, amount: e.amount }));
    const cheques: Item[] = unmatchedBook.filter((e) => e.type === "outgoing").map((e) => ({ date: toIso(e.date), ref: e.reference, description: e.description, amount: e.amount }));
    const adjustments: Item[] = bankOnly.map((l) => ({
      date: l.date, ref: l.reference, description: l.description, amount: l.amount,
      note: l.amount < 0 ? (/interest/i.test(l.description) ? "Bank debit" : "Bank charges / debit") : (/interest|profit/i.test(l.description) ? "Interest / profit" : "Bank credit"),
    }));
    const mismatches: Item[] = matched.filter((m) => !m.exact).map((m) => ({
      date: toIso(m.book.date), ref: m.book.reference, description: `${m.book.description || "Entry"} — bank date ${formatDate(m.line.date)}`, amount: signed(m.book), note: "Date difference",
    }));
    const dit = deposits.reduce((s, i) => s + i.amount, 0);
    const oc = cheques.reduce((s, i) => s + i.amount, 0);
    const adj = adjustments.reduce((s, i) => s + i.amount, 0);
    const hasClosing = closing.trim() !== "";
    const bankBalance = hasClosing ? num(closing) : bookBalance - dit + oc + adj;
    const adjustedBank = bankBalance + dit - oc;
    const adjustedBook = bookBalance + adj;
    const difference = adjustedBank - adjustedBook;
    return { bookBalance, bankBalance, hasClosing, deposits, cheques, adjustments, mismatches, dit, oc, adj, adjustedBank, adjustedBook, difference, matchedCount: matched.length, periodCount: period.length };
  }, [account, ledger, lines, from, to, closing, formatDate]);

  const reconciled = calc ? Math.abs(calc.difference) < 0.5 : false;

  const addLine = () => {
    const amount = num(draft.amount);
    if (!draft.date || !amount) { toast.error("Enter a date and a non-zero amount"); return; }
    setLines((p) => [...p, { id: uid(), date: draft.date, description: draft.description, reference: draft.reference, amount }]);
    setDraft({ ...draft, description: "", reference: "", amount: "" });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    if (!parsed.length) { toast.error("No statement lines found. Use columns: Date, Description, Reference, Debit, Credit (or Amount)."); return; }
    setLines((p) => [...p, ...parsed]);
    toast.success(`${parsed.length} statement lines imported`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const period = `${formatDate(from)} to ${formatDate(to)}`;

  const buildHtml = (forExcel: boolean) => {
    if (!calc || !account) return "";
    const table = (title: string, items: Item[], total: number, sign: string, withNote = false) => `
      <h3>${esc(title)}</h3>
      <table><thead><tr><th class="c" style="width:6%">Sr</th><th style="width:14%">Date</th><th style="width:16%">Cheque / Ref</th><th>Description</th>${withNote ? "<th style='width:16%'>Type</th>" : ""}<th class="n" style="width:18%">Amount (PKR)</th></tr></thead>
      <tbody>${items.length ? items.map((i, k) => `<tr><td class="c">${k + 1}</td><td>${esc(formatDate(i.date))}</td><td>${esc(i.ref || "-")}</td><td>${esc(i.description || "-")}</td>${withNote ? `<td>${esc(i.note || "")}</td>` : ""}<td class="n">${esc(money(i.amount))}</td></tr>`).join("") : `<tr><td colspan="${withNote ? 6 : 5}" class="c muted">None</td></tr>`}</tbody>
      <tfoot><tr><td colspan="${withNote ? 5 : 4}">Total ${esc(sign)}</td><td class="n">${esc(money(total))}</td></tr></tfoot></table>`;
    const line = (label: string, v: number, cls = "") => `<tr class="${cls}"><td>${esc(label)}</td><td class="n">${esc(money(v))}</td></tr>`;
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Bank Reconciliation - ${esc(account.name)}</title>
    <style>
      *{box-sizing:border-box} body{margin:0;padding:${forExcel ? "0" : "8mm"};font-family:Segoe UI,Arial,sans-serif;color:#0f172a;font-size:11px}
      header{display:flex;align-items:center;gap:12px;border-bottom:3px solid #0b63c5;padding-bottom:10px}
      .logo{height:52px;object-fit:contain} h1{margin:0;font-size:18px;color:#0b63c5} .sub{margin:3px 0 0;color:#475569;font-size:10.5px}
      .title{margin-left:auto;text-align:right;font-size:15px;font-weight:800;color:#0b63c5}.title span{display:block;font-size:10.5px;color:#334155;font-weight:600}
      .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.meta div{border:1px solid #e2e8f0;border-radius:4px;padding:5px 8px;font-size:10px;color:#475569}.meta b{display:block;color:#0f172a;font-size:11px}
      h3{margin:14px 0 5px;font-size:12px;color:#0b63c5;text-transform:uppercase;letter-spacing:.4px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #e2e8f0;padding:5px 7px}
      thead th{background:#0b63c5;color:#fff;font-size:10px;text-transform:uppercase;text-align:left} tfoot td{background:#f1f5f9;font-weight:800}
      .c{text-align:center}.n{text-align:right;white-space:nowrap}.muted{color:#94a3b8}
      .stmt td{font-size:11.5px}.stmt .strong td{font-weight:800;background:#eef5ff}.stmt .final td{font-weight:800;background:#0b63c5;color:#fff}
      .status{margin-top:12px;padding:10px;border-radius:6px;font-weight:800;font-size:13px;text-align:center}
      .ok{background:#ecfdf5;color:#047857;border:1px solid #6ee7b7}.bad{background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5}
      .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:40px}.sign div{border-top:1px solid #0f172a;padding-top:5px;font-size:10.5px}
      footer{margin-top:14px;display:flex;justify-content:space-between;font-size:9.5px;color:#64748b}
      @media print{body{padding:0}@page{size:A4 portrait;margin:10mm}thead{display:table-header-group}tr{page-break-inside:avoid}}
    </style></head><body>
    <header>${!forExcel && settings.logoUrl ? `<img class="logo" src="${esc(settings.logoUrl)}" />` : ""}
      <div><h1>${esc(settings.companyName || "K&S Solar Energy")}</h1><p class="sub">${esc([settings.companyAddress, settings.companyPhone, settings.companyEmail].filter(Boolean).join(" | "))}</p></div>
      <div class="title">BANK RECONCILIATION STATEMENT<span>${esc(period)}</span></div></header>
    <div class="meta"><div>Bank Account<b>${esc(account.name)}</b></div><div>Account Number<b>${esc(account.accountTitle || account.code || "-")}</b></div><div>Period<b>${esc(period)}</b></div><div>Generated<b>${esc(formatDate(today))}</b></div></div>
    <h3>Reconciliation Summary</h3>
    <table class="stmt"><tbody>
      ${line("1. Balance as per Bank Statement" + (calc.hasClosing ? "" : " (derived)"), calc.bankBalance, "strong")}
      ${line("2. Add: Deposits in Transit", calc.dit)}
      ${line("3. Less: Outstanding Cheques / Payments", -calc.oc)}
      ${line("5. Adjusted Bank Balance", calc.adjustedBank, "strong")}
      ${line("6. Balance as per Books", calc.bookBalance)}
      ${line("4. Add / (Less): Bank-only adjustments (charges, interest, errors)", calc.adj)}
      ${line("Adjusted Book Balance", calc.adjustedBook, "final")}
    </tbody></table>
    ${table("Section 2 — Add: Deposits in Transit", calc.deposits, calc.dit, "deposits in transit")}
    ${table("Section 3 — Less: Outstanding Cheques / Payments", calc.cheques, calc.oc, "outstanding cheques")}
    ${table("Section 4 — Other Adjustments (bank-only entries)", calc.adjustments, calc.adj, "adjustments", true)}
    ${calc.mismatches.length ? table("Other Mismatches (matched with date difference)", calc.mismatches, calc.mismatches.reduce((s, i) => s + i.amount, 0), "", true) : ""}
    <div class="status ${reconciled ? "ok" : "bad"}">Section 7 — Status: ${reconciled ? "RECONCILED ✅" : `NOT RECONCILED — Difference ${esc(money(calc.difference))}`}</div>
    <div class="sign"><div>Prepared by: <b>${esc(preparedBy)}</b></div><div>Reviewed by: <b>${esc(reviewedBy)}</b></div><div>Signature &amp; Date</div></div>
    <footer><span>Printed: ${esc(new Date().toLocaleString("en-GB"))}</span><span>${esc(settings.companyName || "")}</span></footer>
    ${forExcel ? "" : "<script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>"}
    </body></html>`;
  };

  const exportPdf = () => {
    const html = buildHtml(false); if (!html) return;
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) { toast.error("Allow pop-ups to export PDF"); return; }
    w.document.write(html); w.document.close();
  };
  const exportExcel = () => {
    const html = buildHtml(true); if (!html || !account) return;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bank-reconciliation-${account.name.replace(/\W+/g, "-")}-${from}_${to}.xls`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const Section = ({ title, items, total, withNote }: { title: string; items: Item[]; total: number; withNote?: boolean }) => (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <div className="px-4 py-2.5 border-b bg-muted/40 text-sm font-semibold">{title} <span className="text-muted-foreground font-normal">({items.length})</span></div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-muted-foreground"><th className="text-left px-3 py-2 w-12">Sr</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Cheque / Ref</th><th className="text-left px-3 py-2">Description</th>{withNote && <th className="text-left px-3 py-2">Type</th>}<th className="text-right px-3 py-2">Amount</th></tr></thead>
        <tbody>{items.length ? items.map((i, k) => (
          <tr key={k} className="border-b"><td className="px-3 py-2">{k + 1}</td><td className="px-3 py-2">{formatDate(i.date)}</td><td className="px-3 py-2">{i.ref || "—"}</td><td className="px-3 py-2">{i.description || "—"}</td>{withNote && <td className="px-3 py-2 text-muted-foreground">{i.note}</td>}<td className="px-3 py-2 text-right tabular-nums">{money(i.amount)}</td></tr>
        )) : <tr><td colSpan={withNote ? 6 : 5} className="px-3 py-4 text-center text-muted-foreground">None</td></tr>}</tbody>
        <tfoot><tr className="font-semibold bg-muted/30"><td colSpan={withNote ? 5 : 4} className="px-3 py-2">Total</td><td className="px-3 py-2 text-right tabular-nums">{money(total)}</td></tr></tfoot>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div>
          <h1 className="text-xl font-bold">062 — Bank Reconciliation Report</h1>
          <p className="text-xs text-muted-foreground">Match book entries against the bank statement and reconcile the closing balance.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!calc} onClick={exportPdf}><FileText className="w-4 h-4 mr-1" /> Export to PDF</Button>
          <Button variant="outline" size="sm" disabled={!calc} onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Export to Excel</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Bank Account</label>
          <Popover open={accountOpen} onOpenChange={setAccountOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={accountOpen} className="w-full justify-between font-normal">
                <span className="truncate">{account ? `${account.name}${account.accountTitle ? ` — ${account.accountTitle}` : ""}` : "Select an account"}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search account..." value={accountQuery} onValueChange={setAccountQuery} />
                <CommandList>
                  <CommandEmpty>No account found.</CommandEmpty>
                  <CommandGroup>
                    {filteredAccounts.map((a) => (
                      <CommandItem
                        key={a.id}
                        value={a.id}
                        onSelect={() => { setAccountId(a.id); setAccountOpen(false); setAccountQuery(""); }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${accountId === a.id ? "opacity-100" : "opacity-0"}`} />
                        {a.name}{a.accountTitle ? ` — ${a.accountTitle}` : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div><label className="text-xs text-muted-foreground">Start Date</label><DateInput value={from} onChange={(v) => setFrom(v)} /></div>
        <div><label className="text-xs text-muted-foreground">End Date</label><DateInput value={to} onChange={(v) => setTo(v)} /></div>
        <div><label className="text-xs text-muted-foreground">Closing balance as per bank statement (PKR)</label><Input inputMode="decimal" placeholder="e.g. 1250000" value={closing} onChange={(e) => setClosing(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Prepared by</label><Input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Reviewed by</label><Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} /></div>
      </div>

      {!account ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">{bankAccounts.length ? "Select a bank account to start the reconciliation." : "No bank accounts found. Add one under Accounts first."}</div>
      ) : calc && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Book Balance</p><p className="text-2xl font-bold tabular-nums">{money(calc.bookBalance)}</p></div>
            <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Bank Balance{calc.hasClosing ? "" : " (enter statement closing)"}</p><p className="text-2xl font-bold tabular-nums">{money(calc.bankBalance)}</p></div>
            <div className={`rounded-lg border p-4 ${reconciled ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
              <p className="text-xs text-muted-foreground">Difference</p>
              <p className={`text-2xl font-bold tabular-nums flex items-center gap-2 ${reconciled ? "text-success" : "text-destructive"}`}>
                {reconciled ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}{money(calc.difference)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Bank Statement Lines <span className="text-muted-foreground font-normal">({lines.length}) · {calc.matchedCount} of {calc.periodCount} book entries matched</span></h2>
              <div className="ml-auto flex gap-2">
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Upload CSV</Button>
                {lines.length > 0 && <Button size="sm" variant="ghost" onClick={() => setLines([])}>Clear</Button>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">CSV columns: Date, Description, Reference, Debit, Credit (or a single signed Amount). Save Excel sheets as CSV before uploading. Positive = deposit, negative = withdrawal/charge.</p>
            <div className="grid gap-2 md:grid-cols-[140px_1fr_140px_150px_auto]">
              <DateInput value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} />
              <Input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <Input placeholder="Cheque / Ref" value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
              <Input placeholder="Amount (+/−)" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addLine()} />
              <Button size="sm" onClick={addLine}><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            {lines.length > 0 && (
              <div className="max-h-64 overflow-auto border rounded-md">
                <table className="w-full text-sm"><tbody>{lines.map((l, k) => (
                  <tr key={l.id} className="border-b"><td className="px-3 py-1.5 w-10">{k + 1}</td><td className="px-3 py-1.5">{formatDate(l.date)}</td><td className="px-3 py-1.5">{l.description || "—"}</td><td className="px-3 py-1.5">{l.reference || "—"}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${l.amount < 0 ? "text-destructive" : "text-success"}`}>{money(l.amount)}</td>
                    <td className="px-2 w-10"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLines((p) => p.filter((x) => x.id !== l.id))}><Trash2 className="w-3.5 h-3.5" /></Button></td></tr>
                ))}</tbody></table>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm"><tbody>
              {[
                ["1. Balance as per Bank Statement", calc.bankBalance, true],
                ["2. Add: Deposits in Transit", calc.dit, false],
                ["3. Less: Outstanding Cheques / Payments", -calc.oc, false],
                ["5. Adjusted Bank Balance", calc.adjustedBank, true],
                ["6. Balance as per Books", calc.bookBalance, false],
                ["4. Add / (Less): Bank charges, interest & errors", calc.adj, false],
                ["Adjusted Book Balance", calc.adjustedBook, true],
              ].map(([l, v, strong]) => (
                <tr key={l as string} className={`border-b ${strong ? "bg-muted/40 font-semibold" : ""}`}><td className="px-4 py-2">{l as string}</td><td className="px-4 py-2 text-right tabular-nums">{money(v as number)}</td></tr>
              ))}
              <tr><td colSpan={2} className={`px-4 py-3 text-center font-bold ${reconciled ? "text-success bg-success/10" : "text-destructive bg-destructive/10"}`}>
                {reconciled ? "Reconciled ✅" : `Not reconciled — Difference ${money(calc.difference)}`}
              </td></tr>
            </tbody></table>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Deposits in Transit" items={calc.deposits} total={calc.dit} />
            <Section title="Outstanding Cheques / Payments" items={calc.cheques} total={calc.oc} />
            <Section title="Bank-only Entries (charges, interest, other)" items={calc.adjustments} total={calc.adj} withNote />
            <Section title="Other Mismatches (date differences)" items={calc.mismatches} total={calc.mismatches.reduce((s, i) => s + i.amount, 0)} withNote />
          </div>
        </>
      )}
    </div>
  );
}
