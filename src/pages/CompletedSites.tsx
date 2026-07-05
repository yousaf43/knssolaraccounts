import { useMemo, useState } from "react";
import { Loader2, Edit, Eye, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { useInventoryCloud, useSalesOrdersCloud, useCustomersCloud } from "@/hooks/useAppData";
import type { SalesOrder } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";

export default function CompletedSites() {
  const { log } = useActivityLog();
  const { data: inventoryAll, loading: invLoading } = useInventoryCloud();
  const { data: salesOrdersAll, upsert: upsertSO, remove: removeSO, loading: soLoading } = useSalesOrdersCloud();
  const { data: customers } = useCustomersCloud();

  const orders = useMemo(
    () => salesOrdersAll.filter((s) => s.location === "completed"),
    [salesOrdersAll]
  );

  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);

  if (invLoading || soLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (viewOrder) {
    return (
      <SalesOrderPreview
        order={viewOrder}
        onClose={() => setViewOrder(null)}
        showPrices={false}
        customers={customers}
        inventory={inventoryAll}
      />
    );
  }

  if (editOrder) {
    return (
      <SalesOrderForm
        customers={customers}
        inventory={inventoryAll}
        editOrder={editOrder}
        nextNumber={editOrder.number}
        hidePrices
        onCancel={() => setEditOrder(null)}
        onSave={async (order) => {
          await upsertSO({ ...order, location: "completed" });
          await log("edit", "sales_order", order.id, order.number, "Completed site updated");
          toast.success(`${order.number} updated`);
          setEditOrder(null);
        }}
      />
    );
  }

  const moveBackToStore = async (so: SalesOrder) => {
    await upsertSO({ ...so, location: "store" });
    toast.success(`${so.number} moved back to Store Sale Orders`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Completed Sites</h1>
          <p className="text-muted-foreground text-sm">Store sale orders marked as completed sites</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">SO #</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Delivery</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((so) => {
              const totalQty = (so.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
              return (
                <tr key={so.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{so.number}</td>
                  <td className="px-3 py-2">{so.customer}</td>
                  <td className="px-3 py-2 text-muted-foreground">{so.date}</td>
                  <td className="px-3 py-2 text-muted-foreground">{so.deliveryDate}</td>
                  <td className="px-3 py-2 text-right font-semibold">{totalQty}</td>
                  <td className="px-3 py-2 text-center"><Badge variant="outline" className="text-xs">{so.status}</Badge></td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 rounded hover:bg-muted" title="View" onClick={() => setViewOrder(so)}>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-muted" title="Edit" onClick={() => setEditOrder(so)}>
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-primary/10" title="Move back to Store Sale Orders" onClick={() => moveBackToStore(so)}>
                        <ArrowLeftRight className="w-4 h-4 text-primary" />
                      </button>
                      <ConfirmDeleteDialog onConfirm={() => removeSO(so.id)} title="Delete Completed Site?" description={`Delete ${so.number}?`} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No completed sites yet. Click "Complete Site" on a Store Sale Order to move it here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
