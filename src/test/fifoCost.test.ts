import { describe, expect, it } from "vitest";
import { buildFifoLayers, fifoConsumeCost, fifoRemainingAvgCost, layersForItem } from "@/lib/fifoCost";
import type { InventoryItem, PurchaseOrder } from "@/data/mockData";

const item: InventoryItem = {
  id: "i1", name: "Panel", sku: "P-1", qty: 15, reorderLevel: 0, price: 0,
  category: "", date: "", costPrice: 100, salePrice: 0, unit: "pcs", weight: 0,
  stockAssetAccount: "", saleDiscount: 0, purchaseDiscount: 0,
};

const po = (date: string, qty: number, rate: number, status: PurchaseOrder["status"] = "received"): PurchaseOrder => ({
  id: `po-${date}-${rate}`, number: "", supplier: "", date, deliveryDate: "",
  amount: qty * rate, status,
  items: [{ description: "Panel", qty, rate, amount: qty * rate, inventoryItemId: "i1" } as never],
});

describe("fifoCost", () => {
  it("consumes the oldest purchase layer first (FIFO)", () => {
    const layers = buildFifoLayers([po("2026-01-01", 10, 100), po("2026-02-01", 10, 120)], [], [item]);
    // Sell 12: 10 @ 100 + 2 @ 120 = 1240
    expect(fifoConsumeCost(layersForItem(layers, item), 12)).toBe(1240);
  });

  it("prices the excess at the most recent rate when sales exceed purchases", () => {
    const layers = buildFifoLayers([po("2026-01-01", 5, 100)], [], [item]);
    expect(fifoConsumeCost(layersForItem(layers, item), 8)).toBe(5 * 100 + 3 * 100);
  });

  it("values remaining stock from the newest layers", () => {
    const layers = buildFifoLayers([po("2026-01-01", 10, 100), po("2026-02-01", 10, 120)], [], [item]);
    // 15 on hand after selling 5 → 5 @ 100 + 10 @ 120 = 1700 / 15
    expect(fifoRemainingAvgCost(layersForItem(layers, item), 15)).toBeCloseTo(1700 / 15);
  });

  it("stock valuation prices only the units on hand, not the full purchase history", () => {
    // Bought 10 @ 100 then 10 @ 200; 8 sold (oldest first) → 12 on hand:
    // 10 @ 200 + 2 @ 100 = 2200 / 12 ≈ 183.33 (not the 150 weighted purchase avg)
    const layers = buildFifoLayers([po("2026-01-01", 10, 100), po("2026-02-01", 10, 200)], [], [item]);
    expect(fifoRemainingAvgCost(layersForItem(layers, item), 12)).toBeCloseTo(2200 / 12);
  });

  it("ignores pending and cancelled purchase orders", () => {
    const layers = buildFifoLayers(
      [po("2026-01-01", 10, 100, "pending"), po("2026-01-02", 10, 100, "cancelled"), po("2026-01-03", 4, 150)],
      [], [item],
    );
    expect(fifoConsumeCost(layersForItem(layers, item), 4)).toBe(600);
  });

  it("matches purchase lines to inventory by description when no item id is set", () => {
    const loose: PurchaseOrder = {
      id: "po-x", number: "", supplier: "", date: "2026-01-01", deliveryDate: "",
      amount: 500, status: "confirmed",
      items: [{ description: "panel", qty: 5, rate: 100, amount: 500 } as never],
    };
    const layers = buildFifoLayers([loose], [], [item]);
    expect(fifoConsumeCost(layersForItem(layers, item), 5)).toBe(500);
  });
});
