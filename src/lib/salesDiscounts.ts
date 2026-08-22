import type { Expense, Invoice } from "@/data/mockData";
import { countsAsSale } from "@/lib/salesStatus";

export const SALES_DISCOUNT_CATEGORY = "Sales Discount";

export type DiscountExpense = Expense & { isDiscount: true };

/**
 * Customer discounts are treated as expenses in this app (business rule).
 * Every approved, non-return invoice with a discount produces one read-only
 * expense row under the "Sales Discount" nominal account/category.
 */
export function buildDiscountExpenses(invoices: Invoice[]): DiscountExpense[] {
  return invoices
    .filter((inv) => countsAsSale(inv) && !inv.isReturn)
    .map((inv) => {
      const itemDiscount = (inv.items || []).reduce((s, it: any) => {
        const gross = (it.qty || 0) * (it.rate || 0);
        return s + gross * ((it.discount || 0) / 100);
      }, 0);
      const total = itemDiscount + (inv.discount || 0);
      return {
        id: `disc-${inv.id}`,
        date: inv.date,
        category: SALES_DISCOUNT_CATEGORY,
        description: `Discount — ${inv.customer}${inv.number ? ` (${inv.number})` : ""}`,
        amount: Math.round(total * 100) / 100,
        paymentMethod: "—",
        nominalAccount: SALES_DISCOUNT_CATEGORY,
        isDiscount: true,
      } as DiscountExpense;
    })
    .filter((r) => r.amount > 0)
    .sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));
}
