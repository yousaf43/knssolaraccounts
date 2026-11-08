import { describe, expect, it } from "vitest";
import type { Customer, Invoice, InventoryItem } from "@/data/mockData";
import { buildCNICSalesReport, customerCNIC } from "@/lib/cnicSalesReport";

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
});