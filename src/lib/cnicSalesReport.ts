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
  products: CNICProductSale[];
};
export type CNICProductFilter = "all" | "itel" | "solar-panels" | "itel-solar";
export type CNICProductSale = { name: string; qty: number; netSales: number; tax: number; total: number };

export function matchesCNICProduct(name: string, item: InventoryItem | undefined, filter: CNICProductFilter) {
  if (filter === "all") return true;
  const text = normalize(`${name} ${item?.name || ""} ${item?.model || ""}`);
  const itel = /\b(?:itel|i[ -]?tell?)\b/.test(text);
  const category = normalize(item?.category);
  const accessory = /accessor|frame|mount|structure|electronic/.test(category) || /\b(?:nut|bolt|frame|meter|bracket|mounting|structure|washer)\b/.test(text);
  const panels = !accessory && (/solar (?:module|panel)|pv (?:module|panel)/.test(category) || /\bsolar (?:panels?|modules?)\b/.test(text));
  return filter === "itel" ? itel : filter === "solar-panels" ? panels : itel || panels;
}

function invoiceProductSales(invoice: Invoice, inventory: InventoryItem[]) {
  const byId = new Map(inventory.map(item => [item.id, item]));
  const resolve = (id?: string, name?: string) => (id ? byId.get(id) : undefined) || inventory.find(item => normalize(item.name) === normalize(name));
  const products: { name: string; item?: InventoryItem; qty: number; amount: number }[] = [];
  for (const line of invoice.items || []) {
    const item = resolve(line.inventoryItemId, line.description);
    if (item?.productType === "old-balance") continue;
    const amount = Number.isFinite(line.amount) ? line.amount : line.qty * line.rate;
    const components = line.adhocLines?.length ? line.adhocLines.map(c => ({ id: c.itemId, qty: c.qty, rate: c.rate }))
      : line.bundleItemPrices?.length ? line.bundleItemPrices.map(c => ({ id: c.itemId, qty: c.qty ?? 1, rate: c.price }))
        : (item?.bundleItems || []).map(c => ({ id: c.itemId, qty: c.qty, rate: c.price }));
    const weighted = components.map(c => ({ ...c, item: byId.get(c.id), weight: Math.abs(c.qty * (c.rate || 0)) }));
    const weight = weighted.reduce((sum, c) => sum + c.weight, 0);
    if (weight > 0) {
      for (const c of weighted) products.push({ name: c.item?.name || "Unidentified bundle component", item: c.item, qty: c.qty * line.qty, amount: amount * c.weight / weight });
    } else products.push({ name: line.description, item, qty: line.qty, amount });
  }
  return products;
}
export type CNICSalesGroup = {
  key: string; cnic: string; customer: string; count: number;
  netSales: number; tax: number; total: number;
};

export function buildCNICSalesReport(invoices: Invoice[], customers: Customer[], inventory: InventoryItem[], options: {
  from?: Date; to?: Date; search?: string; cnicFilter?: string; productFilter?: CNICProductFilter;
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
    const lines = invoiceProductSales(invoice, inventory);
    const basis = lines.reduce((sum, line) => sum + Math.abs(line.amount), 0);
    const selected = lines.filter(line => matchesCNICProduct(line.name, line.item, options.productFilter || "all"));
    if (options.productFilter && options.productFilter !== "all" && (!selected.length || !basis)) continue;
    const products = selected.map(line => {
      const net = basis ? netSales * Math.abs(line.amount) / basis : 0;
      const tax = net * rate / 100;
      return { name: line.name, qty: (invoice.isReturn || total < 0) ? -Math.abs(line.qty) : line.qty, netSales: net, tax, total: net + tax };
    });
    const filteredNet = options.productFilter && options.productFilter !== "all" ? products.reduce((sum, p) => sum + p.netSales, 0) : netSales;
    const filteredTotal = options.productFilter && options.productFilter !== "all" ? products.reduce((sum, p) => sum + p.total, 0) : total;
    rows.push({ id: invoice.id, cnic, customer: invoice.customer, number: invoice.number, date: invoice.date, netSales: filteredNet, tax: filteredTotal - filteredNet, total: filteredTotal, products });
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