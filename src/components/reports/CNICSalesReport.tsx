import { useMemo, useState } from "react";
import type { Customer, Invoice, InventoryItem } from "@/data/mockData";
import { buildCNICSalesReport, type CNICProductFilter, type CNICSaleRow } from "@/lib/cnicSalesReport";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function CustomerSalesDropdown({ name, rows }: { name: string; rows: CNICSaleRow[] }) {
  const { formatCurrency, formatDate } = useSettings();
  return <Popover>
    <PopoverTrigger asChild><Button variant="link" asChild className="h-auto max-w-full justify-start whitespace-normal p-0 text-left text-xs"><a href="#" onClick={e => e.preventDefault()} aria-label={`Sales for ${name}`}>{name}<ChevronDown className="ml-1 h-3 w-3 shrink-0" /></a></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[420px] max-w-[calc(100vw-32px)] p-0">
      <h3 className="border-b px-4 py-3 text-sm font-semibold">{name}</h3>
      <div className="max-h-80 overflow-y-auto divide-y">
        {rows.map(row => <div key={row.id} className="px-4 py-3">
          <div className="mb-2 flex justify-between gap-2 text-xs text-muted-foreground"><span>{row.number}</span><span>{formatDate(row.date)}</span></div>
          {row.products.length ? row.products.map((p, i) => <div key={i} className="mb-2 text-xs"><p className="font-medium">{p.name}</p><div className="mt-1 flex justify-between gap-2 text-muted-foreground"><span>Qty: {p.qty}</span><span>{formatCurrency(p.total)}</span></div></div>) : <p className="text-xs text-muted-foreground">Product details not recorded.</p>}
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}

export function CNICSalesReport({ invoices, customers, inventory, from, to }: {
  invoices: Invoice[]; customers: Customer[]; inventory: InventoryItem[]; from?: Date; to?: Date;
}) {
  const { formatCurrency, formatDate } = useSettings();
  const [search, setSearch] = useState("");
  const [cnicFilter, setCnicFilter] = useState("all");
  const [view, setView] = useState<"summary" | "detail">("summary");
  const [productFilter, setProductFilter] = useState<CNICProductFilter>("itel-solar");
  const report = useMemo(() => buildCNICSalesReport(invoices, customers, inventory, { from, to, search, cnicFilter, productFilter }), [invoices, customers, inventory, from, to, search, cnicFilter, productFilter]);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Input aria-label="Search CNIC sales" placeholder="Search CNIC, customer or invoice" value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-72" />
      <Select value={cnicFilter} onValueChange={setCnicFilter}>
        <SelectTrigger aria-label="CNIC status" className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All customers</SelectItem><SelectItem value="present">With CNIC</SelectItem><SelectItem value="missing">Missing CNIC</SelectItem></SelectContent>
      </Select>
      <Select value={productFilter} onValueChange={value => setProductFilter(value as CNICProductFilter)}>
        <SelectTrigger aria-label="Product sales filter" className="w-52"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="itel-solar">ITEL &amp; Solar Panels</SelectItem><SelectItem value="itel">ITEL only</SelectItem><SelectItem value="solar-panels">Solar Panels only</SelectItem><SelectItem value="all">All products</SelectItem></SelectContent>
      </Select>
      <div className="flex gap-1" role="group" aria-label="Report view">
        <Button variant={view === "summary" ? "default" : "outline"} size="sm" onClick={() => setView("summary")}>By CNIC</Button>
        <Button variant={view === "detail" ? "default" : "outline"} size="sm" onClick={() => setView("detail")}>Invoice Detail</Button>
      </div>
    </div>
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-y py-3 text-sm">
      <span>Invoices / Credits: <strong>{report.rows.length}</strong></span>
      <span>CNICs: <strong>{report.groups.filter(g => g.cnic).length}</strong></span>
      <span className="text-destructive">Missing CNIC: <strong>{report.rows.filter(r => !r.cnic).length}</strong></span>
    </div>
    <div className="overflow-x-auto">
      <table id="report-print-table" className="w-full text-xs">
        <caption className="pb-3 text-left font-medium">{productFilter === "itel-solar" ? "ITEL & Solar Panels" : productFilter === "itel" ? "ITEL only" : productFilter === "solar-panels" ? "Solar Panels only" : "All products"}</caption>
        <thead><tr className="border-b bg-muted/50">
          {["Sr #", "CNIC", "Customer", ...(view === "detail" ? ["Invoice / Credit #", "Date"] : ["Invoices / Credits"]), "Sales excl. Tax (PKR)", "Sales Tax (PKR)", "Total incl. Tax (PKR)"].map((heading, i) => <th key={heading} className={`px-3 py-3 font-semibold ${i >= (view === "detail" ? 5 : 4) ? "text-right" : "text-left"}`}>{heading}</th>)}
        </tr></thead>
        <tbody>
          {view === "summary" ? report.groups.map((row, i) => <tr key={row.key} className="border-b">
            <td className="px-3 py-3">{i + 1}</td><td className={`px-3 py-3 whitespace-nowrap ${row.cnic ? "font-medium" : "text-destructive"}`}>{row.cnic || "Missing CNIC"}</td><td className="px-3 py-3"><CustomerSalesDropdown name={row.customer} rows={report.rows.filter(r => row.cnic ? r.cnic === row.cnic : r.customer === row.customer)} /></td><td className="px-3 py-3">{row.count}</td>
            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.netSales)}</td><td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.tax)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total)}</td>
          </tr>) : report.rows.map((row, i) => <tr key={row.id} className="border-b">
            <td className="px-3 py-3">{i + 1}</td><td className={`px-3 py-3 whitespace-nowrap ${row.cnic ? "font-medium" : "text-destructive"}`}>{row.cnic || "Missing CNIC"}</td><td className="px-3 py-3"><CustomerSalesDropdown name={row.customer} rows={[row]} /></td><td className="px-3 py-3">{row.number}</td><td className="px-3 py-3">{formatDate(row.date)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.netSales)}</td><td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.tax)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total)}</td>
          </tr>)}
          {!report.rows.length && <tr><td colSpan={view === "detail" ? 8 : 7} className="py-10 text-center text-muted-foreground">No sales found.</td></tr>}
        </tbody>
        <tfoot><tr className="border-t-2 bg-muted/50 font-bold"><td colSpan={view === "detail" ? 5 : 4} className="px-3 py-3">Total</td><td className="px-3 py-3 text-right">{formatCurrency(report.totals.netSales)}</td><td className="px-3 py-3 text-right">{formatCurrency(report.totals.tax)}</td><td className="px-3 py-3 text-right">{formatCurrency(report.totals.total)}</td></tr></tfoot>
      </table>
    </div>
  </section>;
}