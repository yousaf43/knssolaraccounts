// Central rule: an invoice counts as a "sale" only once it is approved.
// Pending (not yet approved) invoices are excluded from all sales/revenue figures
// and are reported separately as "Pending Balance".
export function countsAsSale(inv: { status?: string }): boolean {
  const s = (inv?.status || "").toLowerCase();
  return s !== "pending" && s !== "draft" && s !== "cancelled" && s !== "rejected";
}

export function isPendingSale(inv: { status?: string }): boolean {
  return (inv?.status || "").toLowerCase() === "pending";
}
