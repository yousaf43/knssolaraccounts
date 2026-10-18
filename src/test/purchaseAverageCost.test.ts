import { describe, expect, it } from "vitest";
import { buildPurchaseAverageCosts } from "@/lib/purchaseAverageCost";
import type { InventoryItem, PurchaseOrder, Bill } from "@/data/mockData";

const item: InventoryItem = { id: "i1", name: "Panel", sku: "P1", qty: 5, costPrice: 80, salePrice: 900, price: 900, reorderLevel: 0, category: "", date: "", unit: "pcs", weight: 0, stockAssetAccount: "", saleDiscount: 0, purchaseDiscount: 0 };
const order = (id: string, qty: number, rate: number, status: PurchaseOrder["status"] = "received", itemId = "i1"): PurchaseOrder => ({ id, number: id, supplier: "", date: "2026-01-01", deliveryDate: "", status, amount: qty * rate, items: [{ id, description: "Panel", qty, rate, amount: qty * rate, inventoryItemId: itemId }] });
describe("Stock Valuation purchase average", () => {
  it("uses quantity-weighted purchase price, not sale price or newest FIFO rate", () => {
    const avg = buildPurchaseAverageCosts([order("a", 10, 100), order("b", 30, 200)], [], [item])(item);
    expect(avg).toBe(175);
    expect(item.qty * avg).toBe(875);
  });
  it("excludes pending and cancelled purchases", () => {
    expect(buildPurchaseAverageCosts([order("a", 10, 100), order("b", 10, 900, "pending"), order("c", 10, 900, "cancelled")], [], [item])(item)).toBe(100);
  });
  it("combines purchase history of merged product identities", () => {
    const duplicate = { ...item, id: "i2" };
    expect(buildPurchaseAverageCosts([order("a", 10, 100), order("b", 30, 200, "received", "i2")], [], [item, duplicate])({ ...item, qty: -2 })).toBe(175);
  });
  it("uses bills when there is no PO history and never double counts both sources", () => {
    const bill: Bill = { ...order("bill", 5, 120), dueDate: "", status: "pending" };
    expect(buildPurchaseAverageCosts([], [bill], [item])(item)).toBe(120);
    expect(buildPurchaseAverageCosts([order("a", 5, 100)], [bill], [item])(item)).toBe(100);
  });
  it("falls back to inventory cost, never sale price", () => {
    expect(buildPurchaseAverageCosts([], [], [item])(item)).toBe(80);
  });
});