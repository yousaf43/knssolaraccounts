import { describe, expect, it } from "vitest";
import type { Proposal } from "@/pages/Proposals";
import { copyProposal, nextProposalNumber, quotationPricing } from "@/lib/proposalOptions";

const source = {
  id: "original", proposalNo: "KS-20261029-01", date: "2026-10-29", status: "sent",
  customerName: "Customer", hideItemPrices: true, total: 180000,
  items: [{ brand: "JA", description: "Panel", qty: 3, unit: "Nos", unitPrice: 60000, amount: 180000 }],
  monthlyUnits: [120], battery: { brand: "Itel", units: 1 },
} as Proposal;

describe("proposal options", () => {
  it("duplicates all quotation details independently with a new number and no original ID", () => {
    const copy = copyProposal(source, "KS-20261031-02", "2026-10-31");
    expect(copy).not.toHaveProperty("id");
    expect(copy.proposalNo).toBe("KS-20261031-02");
    expect(copy.customerName).toBe("Customer");
    expect(copy.items).toEqual(source.items);
    expect(copy.hideItemPrices).toBe(true);
    expect(copy.status).toBe("draft");
    copy.items[0].qty = 9;
    expect(source.items[0].qty).toBe(3);
  });
  it("allocates a new number past existing suffixes even after deletions", () => {
    expect(nextProposalNumber(["KS-20261031-01", "KS-20261031-03", "KS-20261030-99"], "2026-10-31")).toBe("KS-20261031-04");
  });
  it("lump-sum pricing hides every item price and amount but preserves the total and quantities", () => {
    const result = quotationPricing(source);
    expect(result.items[0].unitPrice).toBeUndefined();
    expect(result.items[0].amount).toBeUndefined();
    expect(result.items[0].qty).toBe(3);
    expect(result.total).toBe(180000);
    expect(source.items[0].unitPrice).toBe(60000);
  });
  it("old and itemized proposals keep unit prices and line amounts", () => {
    const result = quotationPricing({ ...source, hideItemPrices: undefined });
    expect(result.items[0].unitPrice).toBe(60000);
    expect(result.items[0].amount).toBe(180000);
  });
});