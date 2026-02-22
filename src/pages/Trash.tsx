import { useState } from "react";
import { useTrash } from "@/hooks/useTrash";
import { useActivityLog } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

// Map item_type to supabase table name
const TYPE_TABLE: Record<string, string> = {
  invoice: "invoices",
  sales_order: "sales_orders",
  stock_adjustment: "stock_adjustments",
  customer: "customers",
  supplier: "suppliers",
  expense: "expenses",
  receipt: "receipts",
  inventory: "inventory",
  bill: "bills",
  purchase_order: "purchase_orders",
  purchase_payment: "purchase_payments",
};

export default function TrashPage() {
  const { user } = useAuth();
  const { items, loading, restoreFromTrash, permanentDelete, emptyTrash } = useTrash();
  const { log } = useActivityLog();
  const [search, setSearch] = useState("");

  const handleRestore = async (trashId: string) => {
    const item = await restoreFromTrash(trashId);
    if (!item || !user) return;
    const table = TYPE_TABLE[item.itemType];
    if (table) {
      // Re-insert the item data back into its original table
      await supabase.from(table as never).upsert(item.itemData as never, { onConflict: "id" });
    }
    await log("restore", item.itemType, item.itemId, getLabel(item.itemType, item.itemData), "Restored from trash");
    toast.success("Item restored successfully");
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
    return (data.number as string) || (data.name as string) || (data.item_name as string) || (data.id as string) || "Unknown";
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
