import { useState } from "react";
import { useTrash } from "@/hooks/useTrash";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
  useInvoicesCloud,
  useSalesOrdersCloud,
  useStockAdjustmentsCloud,
  useCustomersCloud,
  useSuppliersCloud,
  useExpensesCloud,
  useReceiptsCloud,
  useInventoryCloud,
  useBillsCloud,
  usePurchaseOrdersCloud,
  usePurchasePaymentsCloud,
} from "@/hooks/useAppData";
import { Loader2, RotateCcw, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  sales_order: "Sales Order",
  stock_adjustment: "Stock Adjustment",
  customer: "Customer",
  supplier: "Supplier",
  expense: "Expense",
  receipt: "Receipt",
  inventory: "Inventory Item",
  bill: "Bill",
  purchase_order: "Purchase Order",
  purchase_payment: "Purchase Payment",
};

export default function TrashPage() {
  const { items, loading, restoreFromTrash, permanentDelete, emptyTrash } = useTrash();
  const { log } = useActivityLog();
  const [search, setSearch] = useState("");

  // Load cloud hooks for each restorable type so we can upsert via the
  // proper camelCase → snake_case mapper (raw supabase upsert with the
  // camelCase JS object silently fails because columns don't match).
  const invoices = useInvoicesCloud();
  const salesOrders = useSalesOrdersCloud();
  const stockAdjustments = useStockAdjustmentsCloud();
  const customers = useCustomersCloud();
  const suppliers = useSuppliersCloud();
  const expenses = useExpensesCloud();
  const receipts = useReceiptsCloud();
  const inventory = useInventoryCloud();
  const bills = useBillsCloud();
  const purchaseOrders = usePurchaseOrdersCloud();
  const purchasePayments = usePurchasePaymentsCloud();

  const restoreDispatch: Record<string, (data: Record<string, unknown>) => Promise<void>> = {
    invoice: (d) => invoices.upsert(d as never),
    sales_order: (d) => salesOrders.upsert(d as never),
    stock_adjustment: (d) => stockAdjustments.upsert(d as never),
    customer: (d) => customers.upsert(d as never),
    supplier: (d) => suppliers.upsert(d as never),
    expense: (d) => expenses.upsert(d as never),
    receipt: (d) => receipts.upsert(d as never),
    inventory: (d) => inventory.upsert(d as never),
    bill: (d) => bills.upsert(d as never),
    purchase_order: (d) => purchaseOrders.upsert(d as never),
    purchase_payment: (d) => purchasePayments.upsert(d as never),
  };

  const handleRestore = async (trashId: string) => {
    const trashItem = items.find((i) => i.id === trashId);
    if (!trashItem) return;
    const restorer = restoreDispatch[trashItem.itemType];
    if (!restorer) {
      toast.error(`Cannot restore item of type "${trashItem.itemType}"`);
      return;
    }
    try {
      await restorer(trashItem.itemData);
      await restoreFromTrash(trashId);
      await log("restore", trashItem.itemType, trashItem.itemId, getLabel(trashItem.itemType, trashItem.itemData), "Restored from trash");
      toast.success("Item restored successfully");
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("Failed to restore item");
    }
  };

  const handlePermanentDelete = async (trashId: string) => {
    await permanentDelete(trashId);
    toast.success("Permanently deleted");
  };

  const handleEmptyTrash = async () => {
    await emptyTrash();
    toast.success("Trash emptied");
  };

  const getLabel = (type: string, data: Record<string, unknown>) => {
    return (data.number as string) || (data.name as string) || (data.itemName as string) || (data.item_name as string) || (data.id as string) || "Unknown";
  };

  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const label = getLabel(item.itemType, item.itemData).toLowerCase();
    const type = (TYPE_LABELS[item.itemType] || item.itemType).toLowerCase();
    return label.includes(q) || type.includes(q);
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trash</h1>
          <p className="text-muted-foreground text-sm">Recover accidentally deleted items</p>
        </div>
        {items.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleEmptyTrash}>
            <Trash2 className="w-4 h-4 mr-2" /> Empty Trash
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search trash..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Label</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Deleted At</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3">
                    <Badge variant="outline">{TYPE_LABELS[item.itemType] || item.itemType}</Badge>
                  </td>
                  <td className="px-3 py-3 font-medium">{getLabel(item.itemType, item.itemData)}</td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">
                    {new Date(item.deletedAt).toLocaleDateString()} {new Date(item.deletedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleRestore(item.id)}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Restore
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handlePermanentDelete(item.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground text-sm">
          Trash is empty. Deleted items will appear here for recovery.
        </div>
      )}
    </div>
  );
}
