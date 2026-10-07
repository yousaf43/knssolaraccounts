import type { Bill, InventoryItem, PurchaseOrder } from "@/data/mockData";

/**
 * FIFO (First-In, First-Out) cost layers built from purchase history.
 *
 * Purchase orders (confirmed/received) and bills both represent stock coming
 * in, so both become cost layers. Layers are kept oldest-first per product;
 * selling consumes the oldest layer first (FIFO), and the value of stock
 * still on hand is the value of the newest remaining layers.
 */

export type FifoLayer = { qty: number; rate: number; date: string };

export type FifoLayers = Map<string, FifoLayer[]>;

const norm = (s?: string) => (s || "").trim().toLowerCase();

/** Layer key for an inventory item: by id, plus identity key for merged rows. */
export function fifoKeysForItem(item: InventoryItem): string[] {
  const keys = [`id:${item.id}`];
  const identity = norm(item.uniqueCode || item.sku || item.name);
  if (identity) keys.push(`k:${identity}`);
  // Purchase lines without an item id are keyed by description = item name.
  const name = norm(item.name);
  if (name && name !== identity) keys.push(`k:${name}`);
  return keys;
}

function addLayer(map: FifoLayers, key: string, qty: number, rate: number, date: string) {
  if (!key || qty <= 0 || rate <= 0) return;
  const list = map.get(key) || [];
  list.push({ qty, rate, date });
  map.set(key, list);
}

/**
 * Builds FIFO layers from purchase orders and bills.
 * Cancelled / still-pending purchase orders are excluded — that stock has not
 * arrived. Bills count regardless of payment status (goods received).
 */
export function buildFifoLayers(
  purchaseOrders: PurchaseOrder[],
  bills: Bill[],
  inventory: InventoryItem[],
): FifoLayers {
  const map: FifoLayers = new Map();
  const invById = new Map(inventory.map((i) => [i.id, i]));

  const ingest = (doc: { date?: string; items?: { inventoryItemId?: string; description?: string; qty?: number; rate?: number }[] }) => {
    for (const it of doc.items || []) {
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      if (qty <= 0 || rate <= 0) continue;
      const inv = it.inventoryItemId ? invById.get(it.inventoryItemId) : undefined;
      if (inv) {
        for (const key of fifoKeysForItem(inv)) addLayer(map, key, qty, rate, doc.date || "");
      } else {
        const key = norm(it.description);
        if (key) addLayer(map, `k:${key}`, qty, rate, doc.date || "");
      }
    }
  };

  purchaseOrders
    .filter((po) => po.status !== "cancelled" && po.status !== "pending")
    .forEach(ingest);
  bills.forEach(ingest);

  // Oldest first so consumption is FIFO.
  map.forEach((layers) => layers.sort((a, b) => a.date.localeCompare(b.date)));
  return map;
}

function findLayers(map: FifoLayers, keys: string[]): FifoLayer[] | undefined {
  for (const key of keys) {
    const layers = map.get(key);
    if (layers && layers.length) return layers;
  }
  return undefined;
}

/**
 * Consumes `qty` units oldest-first (FIFO) and returns the total cost.
 * If sales exceed recorded purchases, the excess is priced at the most
 * recent purchase rate (best available estimate).
 */
export function fifoConsumeCost(layers: FifoLayer[] | undefined, qty: number): number {
  if (!layers || !layers.length || qty <= 0) return 0;
  let remaining = qty;
  let cost = 0;
  let lastRate = layers[layers.length - 1].rate;
  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(layer.qty, remaining);
    cost += take * layer.rate;
    layer.qty -= take;
    remaining -= take;
    lastRate = layer.rate;
  }
  if (remaining > 0) cost += remaining * lastRate;
  return cost;
}

/**
 * Average cost of the stock currently on hand under FIFO: the newest
 * `currentQty` units (what remains after the oldest stock sold first).
 */
export function fifoRemainingAvgCost(layers: FifoLayer[] | undefined, currentQty: number): number {
  if (!layers || !layers.length || currentQty <= 0) return 0;
  let remaining = currentQty;
  let value = 0;
  for (let i = layers.length - 1; i >= 0 && remaining > 0; i--) {
    const layer = layers[i];
    const take = Math.min(layer.qty, remaining);
    value += take * layer.rate;
    remaining -= take;
  }
  if (remaining > 0) value += remaining * layers[layers.length - 1].rate;
  return value / currentQty;
}

/** Look up layers for an item, trying id first then identity key. */
export function layersForItem(map: FifoLayers, item: InventoryItem): FifoLayer[] | undefined {
  return findLayers(map, fifoKeysForItem(item));
}
