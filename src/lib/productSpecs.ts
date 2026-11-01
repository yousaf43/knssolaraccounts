export type ProductIdentity = { brand: string; description: string; model?: string };
export type ProductResearch = {
  identityKey: string;
  status: "found" | "not_found";
  checkedAt: string;
  facts: { text: string; sourceUrl: string; evidence: string }[];
};
export const productIdentityKey = (item: ProductIdentity) =>
  [item.brand, item.description, item.model || ""].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
export function printableProductFacts(item: ProductIdentity & { research?: ProductResearch }) {
  if (item.research?.status !== "found" || item.research.identityKey !== productIdentityKey(item)) return [];
  return item.research.facts.filter((f) => {
    try { return new URL(f.sourceUrl).protocol === "https:" && Boolean(f.text.trim()) && Boolean(f.evidence.trim()); }
    catch { return false; }
  });
}