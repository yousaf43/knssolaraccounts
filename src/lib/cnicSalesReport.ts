import type { Customer, Invoice, InventoryItem } from "@/data/mockData";
import { normalize, matchesQuery } from "@/lib/search";
import { countsAsSale } from "@/lib/salesStatus";
import { saleAmount } from "@/lib/oldBalance";

export function customerCNIC(customer: { address?: string; cnic?: string }) {
  const text = customer.cnic || customer.address || "";
  const match = text.match(/(?:^|\D)(\d{5}[ -]?\d{7}[ -]?\d)(?!\d)/);
  const digits = match?.[1].replace(/\D/g, "") || "";
  return digits ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` : "";
}

export type CNICSaleRow = {
  id: string; cnic: string; customer: string; number: string; date: string;
  netSales: number; tax: number; total: number;
};
export type CNICSalesGroup = {
  key: string; cnic: string; customer: string; count: number;
  netSales: number; tax: number; total: number;
};

export function buildCNICSalesReport(invoices: Invoice[], customers: Customer[], inventory: InventoryItem[], options: {
  from?: Date; to?: Date; search?: string; cnicFilter?: string;
} = {}) {
  const identities = new Map<string, Customer[]>();
  for (const customer of customers) {
    const aliases = [customer.name, ...(customer.company ? [`${customer.name} [${customer.company}]`, `${customer.name} (${customer.company})`] : [])];
    for (const alias of aliases) {
      const key = normalize(alias);
      identities.set(key, [...(identities.get(key) || []), customer]);
    }
  }
  const rows: CNICSaleRow[] = [];
  const seen = new Set<string>();
  for (const invoice of invoices) {
    if (seen.has(invoice.id) || !countsAsSale(invoice)) continue;
    seen.add(invoice.id);
    const date = new Date(invoice.date);
    if ((options.from || options.to) && Number.isNaN(date.getTime())) continue;
    if (options.from && date < new Date(options.from.getFullYear(), options.from.getMonth(), options.from.getDate())) continue;
    if (options.to && date > new Date(options.to.getFullYear(), options.to.getMonth(), options.to.getDate(), 23, 59, 59, 999)) continue;
    const matches = identities.get(normalize(invoice.customer)) || [];
    // Conflicting duplicate names cannot establish a taxpayer identity.
    const cnics = new Set(matches.map(customerCNIC));
    const cnic = cnics.size === 1 ? customerCNIC(matches[0] || {}) : "";
    if (options.cnicFilter === "present" && !cnic) continue;
    if (options.cnicFilter === "missing" && cnic) continue;
    if (!matchesQuery(options.search, invoice.customer, cnic, invoice.number, invoice.documentNumber)) continue;
    const total = saleAmount(invoice, inventory);
    // Invoice tax stores a percentage, not a rupee amount; totals already include
    // line/document discounts and tax. Reverse the saved rate without taxing twice.
    const rate = Math.max(0, Number(invoice.tax) || 0);
    const netSales = total / (1 + rate / 100);
    rows.push({ id: invoice.id, cnic, customer: invoice.customer, number: invoice.number, date: invoice.date, netSales, tax: total - netSales, total });
  }
  rows.sort((a, b) => a.cnic.localeCompare(b.cnic) || a.customer.localeCompare(b.customer) || a.date.localeCompare(b.date));
  const grouped = new Map<string, CNICSalesGroup>();
  for (const row of rows) {
    const key = row.cnic || `missing:${normalize(row.customer)}`;
    const group = grouped.get(key) || { key, cnic: row.cnic, customer: row.customer, count: 0, netSales: 0, tax: 0, total: 0 };
    if (!group.customer.split(" / ").includes(row.customer)) group.customer += ` / ${row.customer}`;
    group.count++; group.netSales += row.netSales; group.tax += row.tax; group.total += row.total;
    grouped.set(key, group);
  }
  return { rows, groups: [...grouped.values()], totals: rows.reduce((sum, row) => ({
    netSales: sum.netSales + row.netSales, tax: sum.tax + row.tax, total: sum.total + row.total,
  }), { netSales: 0, tax: 0, total: 0 }) };
}