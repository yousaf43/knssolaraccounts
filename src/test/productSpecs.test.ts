import { expect, it } from "vitest";
import { printableProductFacts, productIdentityKey } from "@/lib/productSpecs";
const product = { brand: "ZNShine", description: "590W solar panel", model: "ZXM7-SHLDD144" };
const research = { identityKey: productIdentityKey(product), status: "found" as const, checkedAt: "2026-11-01", facts: [{ text: "590W rated output", evidence: "Rated output: 590W", sourceUrl: "https://www.znshinesolar.com/datasheet" }] };
it("only prints facts for the same exact product", () => {
  expect(printableProductFacts({ ...product, research })).toHaveLength(1);
  expect(printableProductFacts({ ...product, model: "different", research })).toEqual([]);
});
it("never gives panel facts to wiring, earthing or accessories", () => {
  for (const description of ["6mm DC PV wire", "Earthing for solar panels", "PVC pipe accessories"]) expect(printableProductFacts({ brand: "", description, research })).toEqual([]);
});
it("does not print unverified legacy specifications or unsafe sources", () => {
  expect(printableProductFacts(product)).toEqual([]);
  expect(printableProductFacts({ ...product, research: { ...research, facts: [{ ...research.facts[0], sourceUrl: "javascript:alert(1)" }] } })).toEqual([]);
});