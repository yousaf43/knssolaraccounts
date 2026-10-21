import { describe, expect, it, vi } from "vitest";
import { printProposal } from "@/lib/proposalPrint";

const base: any = {
  id: "1", proposalNo: "P-1", date: "2026-10-19", validDays: 3, customerName: "Test",
  companyName: "", address: "", city: "", phone: "", cnic: "", systemType: "on-grid",
  systemKw: 10, panelQty: 16, panelWatt: 625, panelBrand: "JA", panelWarranty: "30y",
  inverterKw: 10, inverterBrand: "Itel", inverterWarranty: "3y", includeInverter: true,
  structureQty: 8, structureType: "L2", netBilling: false, earthing: false, disco: "",
  tariffCategory: "auto", battery: null, monthlyUnits: new Array(12).fill(0),
  items: [], total: 0, paymentMethod: "", delivery: "", terms: "", salesExec: "",
  signedName: "", signedTitle: "", signedPhone: "", signedEmail: "", status: "draft",
};

function capture(p: any): string {
  let html = "";
  const fakeDoc = { write: (s: string) => { html += s; }, close: () => {}, fonts: { ready: Promise.resolve() }, images: [] as any[], querySelectorAll: () => [] as any[] };
  vi.spyOn(window, "open").mockReturnValue({ document: fakeDoc, requestAnimationFrame: (cb: any) => cb(), print: () => {} } as any);
  printProposal(p, { name: "K&S", address: "", phone: "", email: "", logoUrl: "" }, (d) => String(d));
  vi.restoreAllMocks();
  return html;
}

describe("proposal inverter/battery step", () => {
  it("panels-only proposal hides the inverter from the printed PDF", () => {
    const html = capture({ ...base, includeInverter: false });
    expect(html).not.toContain("INVERTER CAPACITY");
    expect(html).not.toContain("Itel");
  });
  it("inverter+battery proposal shows both", () => {
    const html = capture({ ...base, battery: { type: "Lithium (LiFePO4)", brand: "Itel", model: "X", units: 2, kwhEach: 5.12, warranty: "5y" } });
    expect(html).toContain("Inverter");
    expect(html).toContain("Battery");
  });
});
