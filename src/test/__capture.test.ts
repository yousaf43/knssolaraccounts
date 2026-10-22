import { it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { printProposal } from "@/lib/proposalPrint";

const p: any = {
  id: "1", proposalNo: "KS-20261018-01", date: "2026-10-18", validDays: 3,
  customerName: "MR ASMAT ULLAH KHAN SB", companyName: "M/s King Pvc Pipe Industry Pvt",
  address: "", city: "Bhakkar", phone: "", cnic: "", systemType: "on-grid",
  systemKw: 50, panelQty: 80, panelWatt: 625, panelBrand: "JA Solar", panelWarranty: "30y",
  inverterKw: 50, inverterBrand: "Itel", inverterWarranty: "3y", includeInverter: true,
  structureQty: 40, structureType: "L2", netBilling: false, earthing: false, disco: "",
  tariffCategory: "auto", battery: null, monthlyUnits: new Array(12).fill(1200),
  items: [], total: 0,
  paymentMethod: "", delivery: "", terms: "", salesExec: "",
  signedName: "", signedTitle: "", signedPhone: "", signedEmail: "", status: "draft",
};

it("capture proposal html", () => {
  let html = "";
  const fakeDoc = { write: (s: string) => { html += s; }, close: () => {}, fonts: { ready: Promise.resolve() }, images: [], querySelectorAll: () => [] };
  vi.spyOn(window, "open").mockReturnValue({ document: fakeDoc, requestAnimationFrame: (cb: any) => cb(), print: () => {} } as any);
  printProposal(p, { name: "K&S Solar Energy Pvt. Ltd.", address: "", phone: "", email: "", logoUrl: "" }, (d) => { const t = new Date(d); return `${String(t.getDate()).padStart(2,"0")}-${String(t.getMonth()+1).padStart(2,"0")}-${t.getFullYear()}`; });
  writeFileSync("/tmp/proposal.html", html);
});
