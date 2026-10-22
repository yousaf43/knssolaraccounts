import { describe, expect, it } from "vitest";
import { buildStockValuation } from "@/lib/stockValuation";
import type { InventoryItem, PurchaseOrder } from "@/data/mockData";

const item = { id: "inverter", name: "12 kW", sku: "INV12", model: "12kW", qty: 8, costPrice: 999, salePrice: 400000 } as InventoryItem;
const purchase = (id: string, date: string, rate: number): PurchaseOrder => ({
  id, number: id, supplier: "", date, deliveryDate: "", amount: 4 * rate, status: "received",
  items: [{ inventoryItemId: item.id, description: item.name, qty: 4, rate, amount: 4 * rate } as PurchaseOrder["items"][number]],
});
const orders = [purchase("first", "2026-09-09", 260000), purchase("second", "2026-10-12", 250000)];

describe("Report 148 handwritten example", () => {
  it("shows purchase average 255000 for eight purchased units", () => {
    const value = buildStockValuation(orders, [], [item])(item);
    expect(value.purchaseAverage).toBe(255000);
    expect(value.stockValue).toBe(2040000);
  });
  it("values five remaining units at 252000 after three oldest units sell", () => {
    const remaining = { ...item, qty: 5 };
    const value = buildStockValuation(orders, [], [remaining])(remaining);
    expect(value.purchaseAverage).toBe(255000);
    expect(value.remainingAverage).toBe(252000);
    expect(value.stockValue).toBe(1260000);
  });
  it("combines purchase history across merged inventory IDs", () => {
    const duplicate = { ...item, id: "duplicate", qty: 4 };
    const second = { ...orders[1], items: orders[1].items.map(line => ({ ...line, inventoryItemId: duplicate.id })) };
    expect(buildStockValuation([orders[0], second], [], [item, duplicate])({ ...item, qty: 5 }).remainingAverage).toBe(252000);
  });
  it("does not count pending purchases or duplicate PO bills", () => {
    const pending = { ...purchase("pending", "2026-10-20", 1000000), status: "pending" as const };
    const bill = { ...orders[0], status: "paid" as const, dueDate: "", purchaseOrderNumber: "first" };
    expect(buildStockValuation([...orders, pending], [bill], [item])(item).purchaseAverage).toBe(255000);
  });
});