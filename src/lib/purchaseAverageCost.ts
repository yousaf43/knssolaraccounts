import type { Bill, InventoryItem, PurchaseOrder } from "@/data/mockData";

type Totals = Map<string, { qty: number; value: number }>;
const norm = (value?: string) => (value || "").trim().toLowerCase();
const identity = (item: InventoryItem) => norm(item.uniqueCode) || `${norm(item.sku || item.name)}|${norm(item.model)}`;

/** Quantity-weighted purchase rates; bills fill gaps where no PO history exists. */
export function buildPurchaseAverageCosts(orders: PurchaseOrder[], bills: Bill[], inventory: InventoryItem[]) {
  const fromOrders: Totals = new Map();
  const fromBills: Totals = new Map();
  const byId = new Map(inventory.map(item => [item.id, item]));
  const ingest = (docs: { items: PurchaseOrder["items"] }[], totals: Totals) => {
    for (const doc of Array.from(new Set(docs))) {
      for (const line of doc.items || []) {
        const qty = Number(line.qty), rate = Number(line.rate);
        if (!Number.isFinite(qty) || !Number.isFinite(rate) || qty <= 0 || rate <= 0) continue;
        const item = line.inventoryItemId ? byId.get(line.inventoryItemId) : undefined;
        const keys = item ? [`id:${item.id}`, `product:${identity(item)}`] : [`name:${norm(line.description)}`];
        for (const key of keys) {
          const total = totals.get(key) || { qty: 0, value: 0 };
          total.qty += qty;
          total.value += qty * rate;
          totals.set(key, total);
        }
      }
    }
  };
  ingest(Array.from(new Map(orders.filter(order => order.status !== "pending" && order.status !== "cancelled").map(order => [order.id, order])).values()), fromOrders);
  ingest(Array.from(new Map(bills.map(bill => [bill.id, bill])).values()), fromBills);
  return (item: InventoryItem): number => {
    const keys = [`product:${identity(item)}`, `id:${item.id}`, `name:${norm(item.name)}`];
    for (const totals of [fromOrders, fromBills]) {
      // Combine identified and description-only lines without counting id aliases twice.
      const identified = totals.get(keys[0]) || totals.get(keys[1]);
      const loose = totals.get(keys[2]);
      const qty = (identified?.qty || 0) + (loose?.qty || 0);
      if (qty > 0) return ((identified?.value || 0) + (loose?.value || 0)) / qty;
    }
    return Number(item.costPrice) || 0;
  };
}