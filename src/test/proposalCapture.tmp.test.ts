import { it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { printProposal } from "@/lib/proposalPrint";

const base: any = {
  id: "1", proposalNo: "KS-20261018-01", date: "2026-10-18", validDays: 3,
  customerName: "MR ASMAT ULLAH KHAN SB", companyName: "M/s King Pvc Pipe Industry Pvt",
  address: "", city: "Bhakkar", phone: "", cnic: "", systemType: "on-grid",
  systemKw: 50, panelQty: 80, panelWatt: 625, panelBrand: "JA Solar", panelWarranty: "30y",
  inverterKw: 50, inverterBrand: "Itel", inverterWarranty: "3y", includeInverter: true,
  structureQty: 40, structureType: "L2", netBilling: true, earthing: true, disco: "MEPCO",
  tariffCategory: "auto", battery: null, monthlyUnits: new Array(12).fill(5000),
  items: [
    { brand: "JA Solar", description: "Solar Panel 625W", qty: 80, unit: "pcs", unitPrice: 26000, amount: 2080000 },
    { brand: "Itel", description: "Inverter 50kW On-Grid", qty: 1, unit: "unit", unitPrice: 850000, amount: 850000 },
  ],
  total: 5000000, paymentMethod: "Cash", delivery: "2 weeks", terms: "", salesExec: "",
  signedName: "", signedTitle: "", signedPhone: "", signedEmail: "", status: "draft",
};

it("capture proposal html", () => {
  let html = "";
  const fakeDoc = { write: (s: string) => { html += s; }, close: () => {}, fonts: { ready: Promise.resolve() }, images: [] as any[], querySelectorAll: () => [] as any[] };
  vi.spyOn(window, "open").mockReturnValue({ document: fakeDoc, requestAnimationFrame: (cb: any) => cb(), print: () => {} } as any);
  printProposal(base, { name: "K&S Solar Energy", address: "Bhakkar", phone: "0328-0454939", email: "info@knssolar.com.pk", logoUrl: "" }, (d: any) => String(d));
  writeFileSync("/tmp/browser/proposal/proposal.html", html.replaceAll("http://localhost:3000", "http://localhost:8080"));
});
