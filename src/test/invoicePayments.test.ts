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

  it("does NOT deduct a receipt from a different customer's invoice with the same number", () => {
    const inv: any = { number: "INV-535", customer: "ZAHEER SHAIKH SB (DULLEWALA)", amount: 70000, payments: [] };
    const r: any = { id: "1", invoiceNumber: "INV-535", customer: "SYYED MUHAMMAD ALI HUSSAIN HAYDER", amount: 50000 };
    const s = getInvoicePaymentSummary(inv, [r]);
    expect(s.totalPaid).toBe(0);
    expect(s.remaining).toBe(70000);
  });

  it("still matches when the receipt has no customer name", () => {
    const inv: any = { number: "INV-535", customer: "ZAHEER SHAIKH SB", amount: 70000, payments: [] };
    const r: any = { id: "1", invoiceNumber: "INV-535", customer: "", amount: 50000 };
    const s = getInvoicePaymentSummary(inv, [r]);
    expect(s.totalPaid).toBe(50000);
    expect(s.remaining).toBe(20000);
  });
});
