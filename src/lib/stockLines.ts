import type { InventoryItem, InvoiceItem } from "@/data/mockData";
import { isStockTrackedItem } from "@/lib/oldBalance";

type LineLike = Pick<InvoiceItem, "inventoryItemId" | "qty" | "adhocLines" | "bundleItemPrices" | "bundleTitle">;

/**
 * Expands document lines into actual stock-tracked inventory quantities.
 *
 * - normal line  → its own inventory item
 * - catalog bundle line → each component × component qty × line qty
 * - ad-hoc bundle line  → each adhoc/bundle component × its qty × line qty
 */
export function expandStockQty(
  lines: LineLike[] | undefined,
  inventory: InventoryItem[],
  qtyOverride?: (line: LineLike, index: number) => number,
): Map<string, number> {
  const map = new Map<string, number>();
  const add = (itemId: string, qty: number) => {
    if (!itemId || !qty) return;
    const invItem = inventory.find((i) => i.id === itemId);
    if (!invItem || !isStockTrackedItem(invItem)) return;
    map.set(itemId, (map.get(itemId) || 0) + qty);
  };

  (lines || []).forEach((line, idx) => {
    const lineQty = Number(qtyOverride ? qtyOverride(line, idx) : line.qty) || 0;
    if (!lineQty) return;

    const invItem = line.inventoryItemId ? inventory.find((i) => i.id === line.inventoryItemId) : undefined;

    // Ad-hoc and legacy bundles can carry a stale/non-bundle inventoryItemId.
    // Their saved component list is the authoritative stock breakdown.
    const components = line.adhocLines?.length
      ? line.adhocLines.map((l) => ({ itemId: l.itemId, qty: l.qty }))
      : (line.bundleItemPrices || []).map((p) => ({ itemId: p.itemId, qty: p.qty ?? 1 }));
    if (components.length > 0) {
      for (const c of components) add(c.itemId, (Number(c.qty) || 0) * lineQty);
      return;
    }

    // Catalog bundle → explode into components when no saved custom list exists.
    if (invItem?.productType === "bundle" && invItem.bundleItems?.length) {
      for (const bi of invItem.bundleItems) add(bi.itemId, (bi.qty ?? 1) * lineQty);
      return;
    }

    if (line.inventoryItemId) add(line.inventoryItemId, lineQty);
  });

  return map;
}
