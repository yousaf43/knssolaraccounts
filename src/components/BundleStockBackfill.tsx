import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useInventoryCloud, useInvoicesCloud } from "@/hooks/useAppData";
import { expandStockQty } from "@/lib/stockLines";
import type { Invoice, InventoryItem, InvoiceItem } from "@/data/mockData";

const DONE_KEY = "bundleStockBackfill:done";

/**
 * One-time fix: purani approved/paid invoices mein bundle lines ka stock
 * deduct nahi hua tha (sirf single items deduct hote the).
 * Yeh sirf BUNDLE lines ke components ka stock deduct karta hai.
 */
export default function BundleStockBackfill() {
  const { data: inventory, upsert: upsertInventory, fetch: refetchInventory } = useInventoryCloud();
  const { data: invoices } = useInvoicesCloud();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(() => localStorage.getItem(DONE_KEY) === "1");

  const isBundleLine = (line: InvoiceItem, inv: InventoryItem[]) => {
    if (!line.inventoryItemId) {
      return Boolean(line.adhocLines?.length || line.bundleItemPrices?.length);
    }
    const item = inv.find((i) => i.id === line.inventoryItemId);
    return item?.productType === "bundle" && Boolean(item.bundleItems?.length);
  };

  const pending = useMemo(() => {
    const map = new Map<string, number>();
    let docs = 0;
    for (const invoice of invoices as Invoice[]) {
      if (invoice.isReturn) continue;
      if (invoice.status !== "approved" && invoice.status !== "paid") continue;
      const bundleLines = (invoice.items || []).filter((l) => isBundleLine(l, inventory));
      if (!bundleLines.length) continue;
      docs++;
      for (const [id, qty] of expandStockQty(bundleLines, inventory)) {
        map.set(id, (map.get(id) || 0) + qty);
      }
    }
    return { map, docs };
  }, [invoices, inventory]);

  const run = async () => {
    if (!pending.map.size) {
      toast.info("Koi bundle line pending nahi mili.");
      return;
    }
    setRunning(true);
    try {
      for (const [itemId, qty] of pending.map) {
        const item = inventory.find((i) => i.id === itemId);
        if (!item) continue;
        await upsertInventory({ ...item, qty: item.qty - qty });
      }
      localStorage.setItem(DONE_KEY, "1");
      setDone(true);
      await refetchInventory();
      toast.success(`${pending.map.size} products ka bundle stock deduct ho gaya (${pending.docs} invoices).`);
    } catch (err) {
      toast.error("Backfill fail hua: " + (err as Error).message);
    }
    setRunning(false);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Boxes className="w-4 h-4 text-primary" />
        <h3 className="font-medium">Bundle Stock Backfill</h3>
        {done && <Badge variant="secondary">Already run</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        Purani approved/paid invoices ki bundle lines ka stock deduct nahi hua tha. Yeh button un bundles ke
        tracked components ka stock ek dafa deduct karega. Aage se har approve par khud-b-khud deduct hota hai.
      </p>
      <p className="text-xs">
        Pending: <strong>{pending.docs}</strong> invoices · <strong>{pending.map.size}</strong> products ·{" "}
        <strong>{[...pending.map.values()].reduce((a, b) => a + b, 0)}</strong> total qty
      </p>
      <Button
        size="sm"
        variant={done ? "outline" : "default"}
        className="gap-2 w-full"
        disabled={running || !pending.map.size}
        onClick={run}
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />}
        {running ? "Deducting..." : done ? "Run Again (careful)" : "Deduct Bundle Stock Now"}
      </Button>
    </div>
  );
}
