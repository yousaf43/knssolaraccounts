import { describe, it, expect } from "vitest";
import { DEFAULT_TARIFF, computeSavings, detectCategory, monthlyBill } from "@/lib/electricityTariff";

const r = DEFAULT_TARIFF.rates;
const tax = (x: number) => x * (1 + r.gst / 100);

describe("electricity tariff", () => {
  it("detects flour mill as industrial, shop as commercial, tube-well as agricultural", () => {
    expect(detectCategory({ companyName: "Jamil Flour Mill" }).category).toBe("industrial");
    expect(detectCategory({ companyName: "Afridi Iron Store" }).category).toBe("commercial");
    expect(detectCategory({ address: "Chak 12 tube well" }).category).toBe("agricultural");
    expect(detectCategory({ customerName: "Ali Khan", systemKw: 10 }).category).toBe("domestic");
  });

  it("charges domestic 150 units telescopically (100 @ slab1 + 50 @ slab2)", () => {
    const energy = 100 * 22.44 + 50 * 28.91;
    const expected = tax(energy + 150 * r.fpa + energy * r.electricityDuty / 100);
    expect(monthlyBill(150, "domestic", r)).toBeCloseTo(expected, 2);
  });

  it("charges domestic 450 units all at the 401-500 slab rate plus its fixed charge", () => {
    const energy = 450 * 40.2;
    const expected = tax(energy + 400 + 450 * r.fpa + energy * r.electricityDuty / 100);
    expect(monthlyBill(450, "domestic", r)).toBeCloseTo(expected, 2);
  });

  it("commercial uses a flat rate per unit", () => {
    const energy = 1000 * r.commercial;
    expect(monthlyBill(1000, "commercial", r)).toBeCloseTo(tax(energy + 1000 * r.fpa + energy * r.electricityDuty / 100), 2);
  });

  it("savings = bill before − bill after, plus export credit only with net metering", () => {
    const usage = Array(12).fill(500);
    const gen = Array(12).fill(600);
    const without = computeSavings(usage, gen, "domestic", r, false);
    const withNm = computeSavings(usage, gen, "domestic", r, true);
    expect(without.yearSave).toBe(Math.round(monthlyBill(500, "domestic", r) * 12));
    expect(withNm.yearSave - without.yearSave).toBe(100 * r.exportRate * 12);
  });
});
