import { describe, expect, it } from "vitest";
import { buildProposalHtml } from "@/lib/proposalPrint";

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

describe("proposal inverter/battery step", () => {
  it("panels-only proposal hides inverter from the printed PDF", () => {
    const html = buildProposalHtml({ ...base, includeInverter: false }, { name: "K&S" } as any);
    expect(html).not.toContain("Inverter</td>");
    expect(html).not.toContain("Inverter</th>");
    expect(html).not.toContain("INVERTER CAPACITY");
  });
  it("inverter+battery proposal shows both", () => {
    const html = buildProposalHtml({ ...base, battery: { type: "Lithium (LiFePO4)", brand: "Itel", model: "X", units: 2, kwhEach: 5.12, warranty: "5y" } }, { name: "K&S" } as any);
    expect(html).toContain("Inverter");
    expect(html).toContain("Battery");
  });
});
