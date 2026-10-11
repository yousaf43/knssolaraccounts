import { describe, it, expect } from "vitest";
import { getInvoicePaymentSummary } from "@/utils/invoicePayments";

describe("invoice payments", () => {
  it("deducts a receipt from the invoice even if customer name differs", () => {
    const inv: any = { number: "INV-612", customer: "MR. AFRIDI IRON STORE", amount: 7440, payments: [] };
    const r: any = { id: "1", invoiceNumber: "INV-612", customer: "MR. AFRIDI IRON STORE BHAKKAR", amount: 7440 };
    const s = getInvoicePaymentSummary(inv, [r]);
    expect(s.totalPaid).toBe(7440);
    expect(s.remaining).toBe(0);
  });
});
