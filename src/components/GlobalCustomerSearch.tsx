import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessMenu } from "@/lib/menuAccess";
import { createCustomerSearch, matchesQuery, tokenize } from "@/lib/search";
import { useCustomersCloud, useInvoicesCloud, useSalesOrdersCloud, useQuotationsCloud, useReceiptsCloud } from "@/hooks/useAppData";

export function GlobalCustomerSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role, menuAccess } = useAuth();
  const { data: customers } = useCustomersCloud();
  const { data: invoices } = useInvoicesCloud();
  const { data: orders } = useSalesOrdersCloud();
  const { data: quotations } = useQuotationsCloud();
  const { data: receipts } = useReceiptsCloud();
  const match = useMemo(() => createCustomerSearch(customers), [customers]);
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const tokens = tokenize(query);
    const contacts = canAccessMenu("/customers", role, menuAccess) ? customers
      .filter(c => matchesQuery(query, c.name, c.company, c.phone, c.email, c.address))
      .map(c => ({ key: `customer-${c.id}`, label: c.name, detail: "Customer", path: "/customers", tab: "" })) : [];
    const documents = canAccessMenu("/invoices", role, menuAccess) ? [
      ...invoices.map(d => ({ ...d, kind: "Invoice", tab: "invoices" })),
      ...orders.map(d => ({ ...d, kind: "Sales Order", tab: d.location === "completed" ? "project-completed" : "sales-orders" })),
      ...quotations.map(d => ({ ...d, kind: "Quotation", tab: "quotations" })),
      ...receipts.map(d => ({ ...d, kind: "Receipt", tab: "receipts" })),
    ].filter(d => match(tokens, d.number, d.customer))
      .map(d => ({ key: `${d.kind}-${d.id}`, label: `${d.number} · ${d.customer}`, detail: d.kind, path: "/invoices", tab: d.tab })) : [];
    return [...contacts, ...documents].slice(0, 30);
  }, [query, customers, invoices, orders, quotations, receipts, match, role, menuAccess]);

  return (
    <div className="relative flex-1 max-w-md" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input aria-label="Search customers and sales" placeholder="Search name, number, CNIC..." value={query}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} className="pl-9 h-9 bg-background/70" />
      {open && query.trim() && (
        <div className="absolute top-full mt-1 w-full min-w-64 max-h-80 overflow-y-auto rounded-md border bg-popover shadow-md z-50">
          {results.length === 0 && <p className="p-3 text-sm text-muted-foreground">No results</p>}
          {results.map(result => (
            <Button key={result.key} variant="ghost" className="w-full h-auto min-h-10 px-3 py-2 justify-start flex-col items-start rounded-none"
              onClick={() => { navigate(`${result.path}?search=${encodeURIComponent(query)}${result.tab ? `&tab=${result.tab}` : ""}`); setOpen(false); }}>
              <span className="text-sm w-full truncate text-left">{result.label}</span>
              <span className="text-xs text-muted-foreground">{result.detail}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}