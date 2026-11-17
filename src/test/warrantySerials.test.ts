import { describe, expect, it } from "vitest";
import { extractSerials, suggestSerials, usedElsewhere, wattFromText, type StockSerial } from "@/lib/warrantySerials";

const s = (serial: string, p: Partial<StockSerial> = {}): StockSerial => ({ id: serial, serial, serial_key: serial.toUpperCase(), category: "panel", watt: 605, brand_model: null, batch_label: null, status: "available", warranty_id: null, ...p });

describe("warranty serials", () => {
  it("extracts serial codes from sheet text and skips duplicates and dates", () => {
    expect(extractSerials("S.No Serial\n1 JA605A00012345\n2 JA605A00012346, 12-11-2026 JA605A00012345")).toEqual(["JA605A00012345", "JA605A00012346"]);
  });
  it("reads panel watt from product name", () => { expect(wattFromText("A Grade JA Solar 605W Panels")).toBe(605); });
  it("suggests only available serials of the same category and watt", () => {
    const stock = [s("PANEL605AAA1"), s("PANEL620AAA2", { watt: 620 }), s("INV0000001", { category: "inverter" }), s("PANEL605AAA3", { status: "used", warranty_id: "w1" })];
    expect(suggestSerials(stock, { category: "panel", watt: 605, query: "", exclude: [] }).map((x) => x.serial)).toEqual(["PANEL605AAA1"]);
  });
  it("blocks a serial used in another warranty but not in the same one", () => {
    const stock = [s("PANEL605AAA3", { status: "used", warranty_id: "w1" })];
    expect(usedElsewhere(stock, "panel605aaa3", "w2")?.warranty_id).toBe("w1");
    expect(usedElsewhere(stock, "PANEL605AAA3", "w1")).toBeUndefined();
  });
});

import { brandMatches as bm, suggestSerials as ss } from "@/lib/warrantySerials";
describe("brand matching for warranty dropdown", () => {
  const base = { status: "available", warranty_id: null, category: "panel", watt: 605 } as any;
  const stock = [{ ...base, id: "1", serial: "JA1", serial_key: "JA1", brand_model: "JA Solar" }, { ...base, id: "2", serial: "LG1", serial_key: "LG1", brand_model: "Longi" }];
  it("shows only the brand named in the product", () => {
    expect(ss(stock, { category: "panel", watt: 605, brandText: "A Grade JA Solar 605W", query: "", exclude: [] }).map((s) => s.id)).toEqual(["1"]);
  });
  it("hides used serials", () => {
    expect(ss([{ ...stock[0], warranty_id: "w" }], { category: "panel", query: "", exclude: [] })).toEqual([]);
  });
  it("blank brand text matches all", () => { expect(bm("Longi", "")).toBe(true); });
});
