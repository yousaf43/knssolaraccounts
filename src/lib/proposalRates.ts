// Matches proposal quotation lines to inventory items and uses their sale price.
// Only confident matches are applied; anything else stays marked "missing" for the user.

export interface RateInventoryItem {
  id: string;
  name: string;
  model?: string;
  sku?: string;
  category?: string;
  salePrice: number;
}

export interface RateLine {
  brand: string;
  description: string;
  model?: string;
}

const STOP = new Set(["the", "and", "set", "sets", "pcs", "nos", "with", "for", "of", "kw", "kwp", "w"]);

export const rateTokens = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(kw|kwh|kwp|w|v|ah)\b/g, "$1$2")
    .split(/[^a-z0-9.]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

/** Returns the best inventory match with a sale price, or null when unsure. */
export function matchInventoryRate(line: RateLine, inventory: RateInventoryItem[]): RateInventoryItem | null {
  const want = new Set(rateTokens(`${line.brand} ${line.description} ${line.model ?? ""}`));
  if (want.size === 0) return null;
  const numbersWanted = [...want].filter((t) => /\d/.test(t));
  let best: RateInventoryItem | null = null;
  let bestScore = 0;
  for (const inv of inventory) {
    if (!(inv.salePrice > 0)) continue;
    const have = new Set(rateTokens(`${inv.name} ${inv.model ?? ""} ${inv.sku ?? ""}`));
    if (have.size === 0) continue;
    // Sizes (625w, 10kw, 5kwh) must agree when the inventory item states one of the same unit.
    const sizeConflict = numbersWanted.some((n) => {
      const unit = n.replace(/[\d.]/g, "");
      if (!unit) return false;
      const invSizes = [...have].filter((t) => /\d/.test(t) && t.replace(/[\d.]/g, "") === unit);
      return invSizes.length > 0 && !invSizes.includes(n);
    });
    if (sizeConflict) continue;
    let hit = 0;
    have.forEach((t) => { if (want.has(t)) hit++; });
    const score = hit / have.size;
    if (hit >= 2 && score >= 0.5 && score > bestScore) {
      best = inv;
      bestScore = score;
    }
  }
  return best;
}
