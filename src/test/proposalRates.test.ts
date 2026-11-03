import { describe, it, expect } from "vitest";
import { matchInventoryRate } from "@/lib/proposalRates";

const inv = [
  { id: "p1", name: "JA Solar 625W Panel", salePrice: 30000 },
  { id: "p2", name: "JA Solar 580W Panel", salePrice: 26000 },
  { id: "i1", name: "Growatt 10kW On-Grid Inverter", salePrice: 350000 },
  { id: "z", name: "AC Breaker Set", salePrice: 0 },
];

describe("proposal inventory rates", () => {
  it("uses the sale price of the matching panel size", () => {
    expect(matchInventoryRate({ brand: "JA Solar", description: "625W solar panel" }, inv)?.salePrice).toBe(30000);
  });
  it("never picks a different size", () => {
    expect(matchInventoryRate({ brand: "Growatt", description: "305 kW on-grid inverter" }, inv)).toBeNull();
  });
  it("skips items without a sale price", () => {
    expect(matchInventoryRate({ brand: "", description: "AC breaker set" }, inv)).toBeNull();
  });
});
