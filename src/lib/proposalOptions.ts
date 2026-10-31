import type { Proposal } from "@/pages/Proposals";

export function nextProposalNumber(numbers: string[], date: string): string {
  const prefix = `KS-${date.replace(/-/g, "")}-`;
  const highest = numbers.reduce((max, number) => {
    if (!number.startsWith(prefix)) return max;
    const suffix = number.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(2, "0")}`;
}

export function copyProposal(source: Proposal, proposalNo: string, date: string): Omit<Proposal, "id"> {
  const { id: _id, ...data } = structuredClone(source);
  return { ...data, proposalNo, date, status: "draft" };
}

export function quotationPricing(p: Pick<Proposal, "items" | "total" | "hideItemPrices">) {
  return {
    total: p.total,
    items: p.items.map((item) => ({
      ...item,
      unitPrice: p.hideItemPrices ? undefined : item.unitPrice,
      amount: p.hideItemPrices ? undefined : item.amount,
    })),
  };
}