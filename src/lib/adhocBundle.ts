import type { InvoiceItem } from "@/data/mockData";
import type { AdhocBundleResult } from "@/components/ProductPickerWithBundle";

/**
 * Recovers the editable bundle payload for a document line.
 *
 * Handles three generations of stored data:
 *  - new lines: `adhocLines` + `bundleDescription`
 *  - mid lines: only `bundleItemPrices` (qty/price per component)
 *  - legacy lines: only `bundleTitle` + a free-text `description` whose first
 *    line duplicates the title (no components were persisted back then)
 */
export function getAdhocBundleValue(item: InvoiceItem): AdhocBundleResult | undefined {
  if (!item.bundleTitle) return undefined;

  const lines =
    item.adhocLines?.length
      ? item.adhocLines.map((l) => ({ itemId: l.itemId, qty: l.qty, rate: l.rate }))
      : (item.bundleItemPrices || []).map((p) => ({
          itemId: p.itemId,
          qty: p.qty ?? 1,
          rate: p.price ?? 0,
        }));

  return {
    title: item.bundleTitle,
    description: item.bundleDescription ?? stripTitleLine(item.description, item.bundleTitle),
    lines,
  };
}

/** Legacy lines stored "Title\nNotes" in `description`; recover just the notes. */
export function stripTitleLine(description: string | undefined, title: string): string {
  const text = (description || "").trim();
  if (!text) return "";
  const t = title.trim();
  if (!t) return text;
  if (text === t) return "";
  if (text.toLowerCase().startsWith(t.toLowerCase())) {
    return text.slice(t.length).replace(/^\s*\n/, "").trim();
  }
  return text;
}
