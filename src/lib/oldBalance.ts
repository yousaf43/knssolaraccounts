import type { Invoice, InventoryItem, InvoiceItem } from "@/data/mockData";

/**
 * "Old Balance" product type.
 *
 * An old-balance line on an invoice is NOT a sale — it is a carried-forward
 * customer receivable. It therefore:
 *  - never touches stock,
 *  - shows up in the invoice Amount / Remaining (balance-sheet side),
 *  - is excluded from revenue in Profit & Loss / sales reports.
 */
export const OLD_BALANCE_TYPE = "old-balance" as const;

type TypedItem = { productType?: string | null } | null | undefined;

export const isOldBalanceItem = (item: TypedItem) => item?.productType === OLD_BALANCE_TYPE;

/** Stock is tracked for every type except services and old balance lines. */
export const isStockTrackedType = (productType?: string | null) =>
  productType !== "non-stock" && productType !== OLD_BALANCE_TYPE;

export const isStockTrackedItem = (item: TypedItem) => !!item && isStockTrackedType(item.productType);

const lineTotal = (l: InvoiceItem) =>
  typeof l.amount === "number" && !Number.isNaN(l.amount)
    ? l.amount
    : (l.qty || 0) * (l.rate || 0);

function buildLookups(inventory: InventoryItem[]) {
  const byId = new Map<string, InventoryItem>();
  const byName = new Map<string, InventoryItem>();
  for (const i of inventory) {
    byId.set(i.id, i);
    const n = (i.name || "").toLowerCase().trim();
    if (n && !byName.has(n)) byName.set(n, i);
  }
  return { byId, byName };
}

/** Total amount of old-balance lines on a document. */
export function oldBalanceAmount(
  doc: { items?: InvoiceItem[] } | null | undefined,
  inventory: InventoryItem[]
): number {
  if (!doc?.items?.length) return 0;
  const { byId, byName } = buildLookups(inventory);
  return doc.items.reduce((sum, l) => {
    const item =
      (l.inventoryItemId ? byId.get(l.inventoryItemId) : undefined) ||
      byName.get((l.description || "").toLowerCase().trim());
    return isOldBalanceItem(item) ? sum + lineTotal(l) : sum;
  }, 0);
}

/**
 * Revenue portion of an invoice (total minus any carried-forward old balance).
 * Use this everywhere sales / P&L figures are calculated.
 */
export function saleAmount(inv: Invoice, inventory: InventoryItem[]): number {
  const ob = oldBalanceAmount(inv, inventory);
  if (!ob) return inv.amount || 0;
  const sign = (inv.amount || 0) < 0 ? -1 : 1;
  return (inv.amount || 0) - sign * Math.abs(ob);
}
