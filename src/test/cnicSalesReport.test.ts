import { describe, expect, it } from "vitest";
import type { Customer, Invoice, InventoryItem } from "@/data/mockData";
import { buildCNICSalesReport, customerCNIC, matchesCNICProduct } from "@/lib/cnicSalesReport";

const customer = (id: string, name: string, address: string): Customer => ({ id, name, address, company: "", email: "", phone: "", totalBilled: 0, outstanding: 0 });
const invoice = (id: string, name: string, amount: number, extra: Partial<Invoice> = {}): Invoice => ({ id, number: `INV-${id}`, customer: name, date: "2026-11-08", dueDate: "2026-11-08", amount, status: "approved", items: [], ...extra });
const customers = [customer("1", "Ali", "CNIC: 35202-1234567-1 | Lahore")];

describe("Sales by CNIC taxation", () => {
  it("normalizes stored CNICs and groups sales against the taxpayer", () => {
    expect(customerCNIC({ address: "CNIC: 3520212345671" })).toBe("35202-1234567-1");
    const result = buildCNICSalesReport([invoice("1", "Ali", 100), invoice("2", "Ali", 200)], customers, []);
    expect(result.groups).toEqual([expect.objectContaining({ cnic: "35202-1234567-1", count: 2, total: 300 })]);
  });
  it("uses saved tax percentage and already-discounted totals", () => {
    const result = buildCNICSalesReport([invoice("1", "Ali", 1062, { tax: 18, discount: 100 })], customers, []);
    expect(result.totals).toEqual({ netSales: 900, tax: 162, total: 1062 });
  });
  it("excludes pending sales and nets signed credit notes without deduplicating invoice numbers", () => {
    const sale = invoice("1", "Ali", 1000);
    const result = buildCNICSalesReport([sale, sale, invoice("2", "Ali", -200, { isReturn: true, number: sale.number }), invoice("3", "Ali", 9000, { status: "pending" })], customers, []);
    expect(result.totals.total).toBe(800);
    expect(result.rows).toHaveLength(2);
  });
  it("filters inclusive dates and separator-insensitive CNIC search", () => {
    const result = buildCNICSalesReport([invoice("1", "Ali", 100), invoice("2", "Ali", 200, { date: "2026-11-09" })], customers, [], { from: new Date(2026, 10, 8), to: new Date(2026, 10, 8), search: "3520212345671" });
    expect(result.totals.total).toBe(100);
  });
  it("does not infer CNIC from similar or ambiguous customer names", () => {
    const duplicate = customer("2", "Ali", "CNIC: 35202-7654321-1");
    const result = buildCNICSalesReport([invoice("1", "Ali", 100), invoice("2", "Ali Khan", 200)], [...customers, duplicate], [], { cnicFilter: "missing" });
    expect(result.rows.map(r => r.cnic)).toEqual(["", ""]);
    expect(result.groups).toHaveLength(2);
  });
  it("excludes carried-forward old balances from taxation sales", () => {
    const inventory = [{ id: "old", name: "Old Balance", productType: "old-balance" }] as InventoryItem[];
    const result = buildCNICSalesReport([invoice("1", "Ali", 1500, { items: [{ description: "Old Balance", inventoryItemId: "old", qty: 1, rate: 500, amount: 500 }] })], customers, inventory);
    expect(result.totals.total).toBe(1000);
  });
  const inventory = [
    { id: "panel", name: "ASTRO ENERGY", category: "SOLAR MODULE" },
    { id: "itel", name: "I-TELL INVERTER", model: "ITEL IGT-8KTA", category: "ON-GRID INVERTERS" },
    { id: "nuts", name: "NUT & BOLT FOR SOLAR PANELS", category: "ACCESSORIES" },
  ] as InventoryItem[];
  const mixed = invoice("mix", "Ali", 1062, { tax: 18, discount: 100, items: [
    { description: "ASTRO ENERGY", inventoryItemId: "panel", qty: 2, rate: 200, amount: 400 },
    { description: "I-TELL INVERTER", inventoryItemId: "itel", qty: 1, rate: 500, amount: 500 },
    { description: "NUT & BOLT FOR SOLAR PANELS", inventoryItemId: "nuts", qty: 10, rate: 10, amount: 100 },
  ] });
  it("counts only solar modules, not panel accessories, with proportional saved discount/tax", () => {
    const report = buildCNICSalesReport([mixed], customers, inventory, { productFilter: "solar-panels" });
    expect(report.totals.netSales).toBe(360);
    expect(report.totals.tax).toBeCloseTo(64.8);
    expect(report.rows[0].products.map(p => p.name)).toEqual(["ASTRO ENERGY"]);
    expect(matchesCNICProduct("NUT & BOLT FOR SOLAR PANELS", inventory[2], "solar-panels")).toBe(false);
  });
  it("filters ITEL brand sales independently", () => {
    const report = buildCNICSalesReport([mixed], customers, inventory, { productFilter: "itel" });
    expect(report.totals.netSales).toBe(450);
    expect(report.rows[0].products[0].qty).toBe(1);
  });
  it("combines ITEL and panels without counting unrelated products or invoices", () => {
    const report = buildCNICSalesReport([mixed, invoice("other", "Ali", 100, { items: [mixed.items[2]] })], customers, inventory, { productFilter: "itel-solar" });
    expect(report.totals.netSales).toBe(810);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].products).toHaveLength(2);
  });
  it("uses saved bundle component prices to allocate actual discounted sales", () => {
    const bundled = invoice("bundle", "Ali", 900, { items: [{ description: "Solar package", qty: 1, rate: 1000, amount: 1000, bundleItemPrices: [{ itemId: "panel", qty: 2, price: 200 }, { itemId: "itel", qty: 1, price: 500 }, { itemId: "nuts", qty: 10, price: 10 }] }] });
    const report = buildCNICSalesReport([bundled], customers, inventory, { productFilter: "solar-panels" });
    expect(report.totals.total).toBe(360);
    expect(report.rows[0].products[0].qty).toBe(2);
  });
  it("nets filtered signed credits and retains sold-product detail", () => {
    const report = buildCNICSalesReport([{ ...mixed, amount: -1062, isReturn: true }], customers, inventory, { productFilter: "itel" });
    expect(report.totals.netSales).toBe(-450);
    expect(report.rows[0].products[0].qty).toBe(-1);
  });
});