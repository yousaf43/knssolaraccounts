import type { Bill, InventoryItem, PurchaseOrder } from "@/data/mockData";
import { fifoRemainingAvgCost, type FifoLayer } from "@/lib/fifoCost";

const norm = (value?: string) => (value || "").trim().toLowerCase();
export const stockProductKey = (item: InventoryItem) => norm(item.uniqueCode)
  || `${norm(item.sku || item.name)}|${norm(item.model)}`;

/** Report-only purchase layers; bills fill missing PO history, not duplicate it. */
export function buildStockValuation(orders: PurchaseOrder[], bills: Bill[], inventory: InventoryItem[]) {
  const byId = new Map(inventory.map(item => [item.id, item]));
  const purchaseLayers = new Map<string, FifoLayer[]>();
  const billLayers = new Map<string, FifoLayer[]>();
  const ingest = (docs: { id: string; date: string; items: PurchaseOrder["items"] }[], target: Map<string, FifoLayer[]>) => {
    for (const doc of new Map(docs.map(doc => [doc.id, doc])).values()) {
      for (const line of doc.items || []) {
        const qty = Number(line.qty), rate = Number(line.rate);
        if (!Number.isFinite(qty) || !Number.isFinite(rate) || qty <= 0 || rate <= 0) continue;
        const item = line.inventoryItemId ? byId.get(line.inventoryItemId) : undefined;
        const key = item ? `product:${stockProductKey(item)}` : `name:${norm(line.description)}`;
        const layers = target.get(key) || [];
        layers.push({ qty, rate, date: doc.date || "" });
        target.set(key, layers);
      }
    }
  };
  ingest(orders.filter(order => order.status !== "pending" && order.status !== "cancelled"), purchaseLayers);
  ingest(bills, billLayers);
  return (item: InventoryItem) => {
    const product = `product:${stockProductKey(item)}`, name = `name:${norm(item.name)}`;
    const from = (source: Map<string, FifoLayer[]>) => [...(source.get(product) || []), ...(source.get(name) || [])];
    const purchases = from(purchaseLayers);
    const layers = (purchases.length ? purchases : from(billLayers)).sort((a, b) => a.date.localeCompare(b.date));
    const purchasedQty = layers.reduce((sum, layer) => sum + layer.qty, 0);
    const fallback = Number(item.costPrice) || 0;
    const purchaseAverage = purchasedQty > 0
      ? layers.reduce((sum, layer) => sum + layer.qty * layer.rate, 0) / purchasedQty : fallback;
    const quantity = Math.max(0, Number(item.qty) || 0);
    const remainingAverage = quantity > 0
      ? layers.length ? fifoRemainingAvgCost(layers, quantity) : fallback : 0;
    return { purchaseAverage, remainingAverage, stockValue: quantity * remainingAverage };
  };
}