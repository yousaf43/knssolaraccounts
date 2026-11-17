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
