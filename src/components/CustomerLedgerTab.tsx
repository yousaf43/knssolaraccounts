import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { HighlightText } from "@/components/HighlightText";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { useSettings } from "@/contexts/SettingsContext";
import type { Invoice, Receipt } from "@/data/mockData";

export type LedgerEntry = {
  id: string; date: string; bank: string;
  type: "incoming" | "outgoing"; amount: number;
  description: string; reference: string;
};

type Props = {
  invoices: Invoice[];
  receipts: Receipt[];
  ledger: LedgerEntry[];
  accounts?: { id: string; name: string }[];
};

type Row = {
  date: string;
  narration: string;
  qty: number | null;
  ref: string;
  rate: number | null;
  account: string;
  debit: number;
  credit: number;
};

const inRange = (date: string, from: string, to: string) => {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const LEDGER_CUSTOMERS_KEY = "ledgerCustomers";

export function CustomerLedgerTab({ invoices, receipts, ledger, accounts = [] }: Props) {
  const { formatCurrency, formatDate } = useSettings();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [account, setAccount] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [ledgerCustomers, setLedgerCustomers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LEDGER_CUSTOMERS_KEY) || "[]"); } catch { return []; }
  });

  const saveLedgerCustomers = (list: string[]) => {
    setLedgerCustomers(list);
    localStorage.setItem(LEDGER_CUSTOMERS_KEY, JSON.stringify(list));
  };

  const allCustomers = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((i) => i.customer && s.add(i.customer.trim()));
    return Array.from(s).sort();
  }, [invoices]);

  const accountOptions = useMemo(() => {
    const names = new Set<string>();
    accounts.forEach((a) => a.name && names.add(a.name));
    ledger.forEach((l) => l.bank && names.add(l.bank));
    receipts.forEach((r) => r.paymentMethod && names.add(r.paymentMethod));
    return Array.from(names).sort();
  }, [accounts, ledger, receipts]);

  // Ledger entries created from an invoice ("Add to Ledger" option)
  const invoiceLedgerByNumber = useMemo(() => {
    const map = new Map<string, LedgerEntry>();
    for (const e of ledger) {
      if ((e.description || "").startsWith(`Invoice ${e.reference} `)) map.set(e.reference, e);
    }
    return map;
  }, [ledger]);

  // Build customer-wise rows (Excel-style: one narration line per invoice item)
  const byCustomer = useMemo(() => {
    const map = new Map<string, Row[]>();
    const push = (customer: string, row: Row) => {
      const key = (customer || "Unknown").trim() || "Unknown";
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    };

    const ledgerCustomers = new Set<string>();

    for (const inv of invoices) {
      const status = (inv.status || "").toLowerCase();
      if (status === "cancelled") continue;
      const linked = invoiceLedgerByNumber.get(inv.number);
      if (!linked) continue; // only invoices explicitly added to ledger
      ledgerCustomers.add((inv.customer || "Unknown").trim() || "Unknown");
      if (!inRange(inv.date, from, to)) continue;

      const items = Array.isArray(inv.items) ? inv.items : [];
      const lineTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      if (items.length > 0) {
        items.forEach((it, idx) => {
          const amount = Number(it.amount) || 0;
          // put invoice-level adjustment on the last line so total matches invoice amount
          const adj = idx === items.length - 1 ? (Number(inv.amount) || 0) - lineTotal : 0;
          push(inv.customer, {
            date: inv.date,
            narration: it.bundleTitle || it.description || "Item",
            qty: Number(it.qty) || null,
            ref: inv.documentNumber || inv.number,
            rate: Number(it.rate) || null,
            account: linked.bank || "—",
            debit: amount + adj,
            credit: 0,
          });
        });
      } else {
        push(inv.customer, {
          date: inv.date,
          narration: inv.projectName ? `Invoice — ${inv.projectName}` : "Invoice",
          qty: null,
          ref: inv.documentNumber || inv.number,
          rate: null,
          account: linked.bank || "—",
          debit: Number(inv.amount) || 0,
          credit: 0,
        });
      }

      // Payment recorded through the invoice "Add to Ledger" option
      if (Number(linked.amount) > 0) {
        push(inv.customer, {
          date: linked.date || inv.date,
          narration: linked.bank ? `${linked.bank} — payment received` : "Payment received",
          qty: null,
          ref: inv.documentNumber || inv.number,
          rate: null,
          account: linked.bank,
          debit: 0,
          credit: Number(linked.amount) || 0,
        });
      }
    }

    for (const r of receipts) {
      if (!inRange(r.date, from, to)) continue;
      const key = (r.customer || "Unknown").trim() || "Unknown";
      if (!ledgerCustomers.has(key)) continue; // only ledger customers
      push(r.customer, {
        date: r.date,
        narration: `Payment received${r.invoiceNumber ? ` against ${r.invoiceNumber}` : ""}`,
        qty: null,
        ref: r.number,
        rate: null,
        account: r.paymentMethod || "—",
        debit: 0,
        credit: Number(r.amount) || 0,
      });
    }

    for (const [k, list] of map) {
      list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      map.set(k, list);
    }
    return map;
  }, [invoices, receipts, invoiceLedgerByNumber, from, to]);

  const summary = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = Array.from(byCustomer.entries()).map(([customer, rows]) => {
      const filtered = account === "all" ? rows : rows.filter((r) => r.account === account || r.debit > 0);
      const invoiced = filtered.reduce((s, r) => s + r.debit, 0);
      const received = filtered.reduce((s, r) => s + r.credit, 0);
      return { customer, invoiced, received, balance: invoiced - received, count: filtered.length };
    });
    return out
      .filter((r) => (q ? r.customer.toLowerCase().includes(q) : true))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [byCustomer, search, account]);

  const totals = useMemo(() => ({
    invoiced: summary.reduce((s, r) => s + r.invoiced, 0),
    received: summary.reduce((s, r) => s + r.received, 0),
    balance: summary.reduce((s, r) => s + r.balance, 0),
  }), [summary]);

  const pg = usePagination(summary, 25);

  const detailRows = useMemo(() => {
    if (!selected) return [];
    const rows = byCustomer.get(selected) || [];
    const filtered = account === "all" ? rows : rows.filter((r) => r.account === account || r.debit > 0);
    let running = 0;
    return filtered.map((r) => {
      running += r.debit - r.credit;
      return { ...r, running };
    });
  }, [selected, byCustomer, account]);

  const detailTotals = useMemo(() => ({
    debit: detailRows.reduce((s, r) => s + r.debit, 0),
    credit: detailRows.reduce((s, r) => s + r.credit, 0),
    balance: detailRows.reduce((s, r) => s + r.debit - r.credit, 0),
  }), [detailRows]);

  const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  const exportCsv = () => {
    const header = selected
      ? "Sr,Date,Narration,Qty,Ref No.,Rate,DR,CR,Balance"
      : "Customer,Invoiced,Received,Balance";
    const body = selected
      ? detailRows.map((r, i) => `${i + 1},${r.date},"${r.narration}",${r.qty ?? ""},${r.ref},${r.rate ?? ""},${r.debit || ""},${r.credit || ""},${r.running}`).join("\n")
      : summary.map((r) => `"${r.customer}",${r.invoiced},${r.received},${r.balance}`).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selected ? `ledger-${selected}.csv` : "customer-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const printLedger = () => {
    const title = selected ? selected : "Customer Ledger";
    const head = selected
      ? "<tr><th>Sr.</th><th>Date</th><th>Narration</th><th class='c'>QTY.</th><th class='c'>REF; NO.</th><th class='r'>RATE</th><th class='r'>DR.</th><th class='r'>CR.</th><th class='r'>Balance</th></tr>"
      : "<tr><th>Sr #</th><th>Customer</th><th class='r'>Invoiced</th><th class='r'>Received</th><th class='r'>Balance</th></tr>";
    const body = selected
      ? detailRows.map((r, i) => `<tr><td>${i + 1}</td><td>${formatDate(r.date)}</td><td>${r.narration}</td><td class='c'>${r.qty ?? ""}</td><td class='c'>${r.ref}</td><td class='r'>${r.rate ? num(r.rate) : ""}</td><td class='r'>${r.debit ? num(r.debit) : "0"}</td><td class='r'>${r.credit ? num(r.credit) : ""}</td><td class='r'>${num(r.running)}</td></tr>`).join("")
      : summary.map((r, i) => `<tr><td>${i + 1}</td><td>${r.customer}</td><td class='r'>${formatCurrency(r.invoiced)}</td><td class='r'>${formatCurrency(r.received)}</td><td class='r'>${formatCurrency(r.balance)}</td></tr>`).join("");
    const foot = selected
      ? `<tr class='tot'><td colspan='6'>Total Pending Payment.</td><td class='r'>${num(detailTotals.debit)}</td><td class='r'>${num(detailTotals.credit)}</td><td class='r'>${num(detailTotals.balance)}</td></tr>`
      : `<tr class='tot'><td colspan='2'>Total</td><td class='r'>${formatCurrency(totals.invoiced)}</td><td class='r'>${formatCurrency(totals.received)}</td><td class='r'>${formatCurrency(totals.balance)}</td></tr>`;
    const w = window.open("", "_blank", "width=1000,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${title}</title><style>
      @page { size: A4 landscape; margin: 8mm; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color:#111; }
      h1 { text-align:center; font-size:16px; margin:0 0 2px; }
      h2 { text-align:center; font-size:14px; font-weight:700; margin:0 0 8px; background:#1f3864; color:#fff; padding:6px; }
      table { width:100%; border-collapse:collapse; }
      th, td { border:1px solid #999; padding:3px 6px; }
      th { background:#ffc000; text-align:left; font-weight:700; }
      .r { text-align:right; } .c { text-align:center; }
      tr.tot td { background:#ffc000; font-weight:700; font-size:12px; }
    </style></head><body><h1>K&amp;S Solar Energy</h1><h2>${title}</h2>
      <table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-end gap-2">
        {selected && (
          <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        <Input
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-56"
        />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accountOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><FileDown className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={printLedger}><Printer className="w-4 h-4 mr-1" /> Print</Button>
        </div>
      </div>

      {!selected && (
        <div className="bg-card rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-14">Sr #</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Invoiced</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Received</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {pg.paginatedItems.map((r, i) => (
                <tr
                  key={r.customer}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelected(r.customer)}
                >
                  <td className="px-3 py-2 text-muted-foreground">{(pg.currentPage - 1) * 25 + i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <HighlightText text={r.customer} query={search} />
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.invoiced)}</td>
                  <td className="px-3 py-2 text-right text-success">{formatCurrency(r.received)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.balance > 0 ? "text-destructive" : ""}`}>{formatCurrency(r.balance)}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No ledger data found.</td></tr>
              )}
            </tbody>
            {summary.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>Total ({summary.length} customers)</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.invoiced)}</td>
                  <td className="px-3 py-2 text-right text-success">{formatCurrency(totals.received)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <TablePagination currentPage={pg.currentPage} totalPages={pg.totalPages} totalItems={pg.totalItems} onPageChange={pg.goToPage} itemLabel="customer" />
        </div>
      )}

      {selected && (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-primary/10">
            <div className="font-bold text-base uppercase tracking-wide">{selected}</div>
            <Badge variant="outline">{detailRows.length} entries</Badge>
          </div>
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b bg-warning/20">
                <th className="text-left px-3 py-2 font-semibold w-14">Sr.</th>
                <th className="text-left px-3 py-2 font-semibold w-28">Date</th>
                <th className="text-left px-3 py-2 font-semibold">Narration</th>
                <th className="text-center px-3 py-2 font-semibold w-16">QTY.</th>
                <th className="text-center px-3 py-2 font-semibold w-24">REF; NO.</th>
                <th className="text-right px-3 py-2 font-semibold w-28">RATE</th>
                <th className="text-right px-3 py-2 font-semibold w-28">DR.</th>
                <th className="text-right px-3 py-2 font-semibold w-28">CR.</th>
                <th className="text-right px-3 py-2 font-semibold w-32">Balance</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r, i) => (
                <tr key={`${r.ref}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-3 py-1.5">{r.narration}</td>
                  <td className="px-3 py-1.5 text-center">{r.qty ?? ""}</td>
                  <td className="px-3 py-1.5 text-center text-muted-foreground">{r.ref}</td>
                  <td className="px-3 py-1.5 text-right">{r.rate ? num(r.rate) : ""}</td>
                  <td className="px-3 py-1.5 text-right">{r.debit ? num(r.debit) : "0"}</td>
                  <td className="px-3 py-1.5 text-right text-success">{r.credit ? num(r.credit) : ""}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{num(r.running)}</td>
                </tr>
              ))}
              {detailRows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No entries.</td></tr>
              )}
            </tbody>
            {detailRows.length > 0 && (
              <tfoot>
                <tr className="border-t bg-warning/30 font-bold">
                  <td className="px-3 py-2 text-right" colSpan={6}>Total Pending Payment.</td>
                  <td className="px-3 py-2 text-right">{num(detailTotals.debit)}</td>
                  <td className="px-3 py-2 text-right">{num(detailTotals.credit)}</td>
                  <td className="px-3 py-2 text-right text-base">{num(detailTotals.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
