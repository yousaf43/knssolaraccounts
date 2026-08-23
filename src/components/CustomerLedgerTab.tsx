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
  ref: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
};

const inRange = (date: string, from: string, to: string) => {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

export function CustomerLedgerTab({ invoices, receipts, ledger, accounts = [] }: Props) {
  const { formatCurrency, formatDate } = useSettings();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [account, setAccount] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

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

  // Build customer-wise rows
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
      push(inv.customer, {
        date: inv.date,
        ref: inv.number,
        description: inv.projectName ? `Invoice — ${inv.projectName}` : "Invoice",
        account: linked.bank || "—",
        debit: Number(inv.amount) || 0,
        credit: 0,
      });
      push(inv.customer, {
        date: linked.date || inv.date,
        ref: inv.number,
        description: "Ledger entry (invoice)",
        account: linked.bank,
        debit: 0,
        credit: Number(linked.amount) || 0,
      });
    }

    for (const r of receipts) {
      if (!inRange(r.date, from, to)) continue;
      const key = (r.customer || "Unknown").trim() || "Unknown";
      if (!ledgerCustomers.has(key)) continue; // only ledger customers
      push(r.customer, {
        date: r.date,
        ref: r.number,
        description: `Payment received${r.invoiceNumber ? ` against ${r.invoiceNumber}` : ""}`,
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

  const exportCsv = () => {
    const header = selected
      ? "Date,Reference,Description,Account,Debit,Credit,Balance"
      : "Customer,Invoiced,Received,Balance";
    const body = selected
      ? detailRows.map((r) => `${r.date},${r.ref},"${r.description}",${r.account},${r.debit},${r.credit},${r.running}`).join("\n")
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
    const title = selected ? `Customer Ledger — ${selected}` : "Customer Ledger";
    const head = selected
      ? "<tr><th>Sr #</th><th>Date</th><th>Reference</th><th>Description</th><th>Account</th><th class='r'>Debit</th><th class='r'>Credit</th><th class='r'>Balance</th></tr>"
      : "<tr><th>Sr #</th><th>Customer</th><th class='r'>Invoiced</th><th class='r'>Received</th><th class='r'>Balance</th></tr>";
    const body = selected
      ? detailRows.map((r, i) => `<tr><td>${i + 1}</td><td>${formatDate(r.date)}</td><td>${r.ref}</td><td>${r.description}</td><td>${r.account}</td><td class='r'>${r.debit ? formatCurrency(r.debit) : "-"}</td><td class='r'>${r.credit ? formatCurrency(r.credit) : "-"}</td><td class='r'>${formatCurrency(r.running)}</td></tr>`).join("")
      : summary.map((r, i) => `<tr><td>${i + 1}</td><td>${r.customer}</td><td class='r'>${formatCurrency(r.invoiced)}</td><td class='r'>${formatCurrency(r.received)}</td><td class='r'>${formatCurrency(r.balance)}</td></tr>`).join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${title}</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color:#111; }
      h1 { text-align:center; font-size:18px; margin:0 0 2px; }
      h2 { text-align:center; font-size:13px; font-weight:500; margin:0 0 12px; color:#444; }
      table { width:100%; border-collapse:collapse; }
      th, td { border:1px solid #ccc; padding:4px 6px; }
      th { background:#f2f6fb; text-align:left; }
      .r { text-align:right; }
    </style></head><body><h1>K&amp;S Solar Energy</h1><h2>${title}</h2>
      <table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`);
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
        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="font-semibold">{selected}</div>
            <Badge variant="outline">{detailRows.length} entries</Badge>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-14">Sr #</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Account</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Debit</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Credit</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r, i) => (
                <tr key={`${r.ref}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-3 py-2 font-medium">{r.ref}</td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.account}</td>
                  <td className="px-3 py-2 text-right">{r.debit ? formatCurrency(r.debit) : "-"}</td>
                  <td className="px-3 py-2 text-right text-success">{r.credit ? formatCurrency(r.credit) : "-"}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.running > 0 ? "text-destructive" : ""}`}>{formatCurrency(r.running)}</td>
                </tr>
              ))}
              {detailRows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
