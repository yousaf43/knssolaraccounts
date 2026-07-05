import { useMemo, useState } from "react";
import { Loader2, Edit, Eye, ArrowLeftRight, CheckCircle2, FileText } from "lucide-react";
import {
  useInventoryCloud,
  useSalesOrdersCloud,
  useCustomersCloud,
  useInvoicesCloud,
  useReceiptsCloud,
} from "@/hooks/useAppData";
import type { SalesOrder, InventoryItem, Invoice, Receipt } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useSettings } from "@/contexts/SettingsContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function CompletedSites() {
  const { log } = useActivityLog();
  const { formatCurrency } = useSettings();
  const { data: inventoryAll, upsert: upsertInv, loading: invLoading } = useInventoryCloud();
  const { data: salesOrdersAll, upsert: upsertSO, remove: removeSO, loading: soLoading } = useSalesOrdersCloud();
  const { data: customers } = useCustomersCloud();
  const { data: invoices, upsert: upsertInvoice } = useInvoicesCloud();
  const { data: receipts, upsert: upsertReceipt } = useReceiptsCloud();

  const orders = useMemo(
    () => salesOrdersAll.filter((s) => s.location === "completed"),
    [salesOrdersAll]
  );
  const mainInventory = useMemo(
    () => inventoryAll.filter((i) => (i.location || "main") === "main"),
    [inventoryAll]
  );

  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [confirmInvoice, setConfirmInvoice] = useState<SalesOrder | null>(null);

  // Resolve any inventoryItemId (main or store) to the corresponding MAIN inventory item.
  const resolveMainItem = (inventoryItemId?: string): InventoryItem | undefined => {
    if (!inventoryItemId) return undefined;
    const direct = mainInventory.find((i) => i.id === inventoryItemId);
    if (direct) return direct;
    const src = inventoryAll.find((i) => i.id === inventoryItemId);
    if (!src) return undefined;
    return mainInventory.find(
      (i) =>
        (i.sku && src.sku && i.sku.trim().toLowerCase() === src.sku.trim().toLowerCase()) ||
        i.name.trim().toLowerCase() === src.name.trim().toLowerCase()
    );
  };

  const expandLine = (line: { inventoryItemId?: string; qty: number; bundleItemPrices?: { itemId: string; qty?: number }[] }) => {
    const out = new Map<string, number>();
    if (!line.inventoryItemId) return out;
    const src = inventoryAll.find((i) => i.id === line.inventoryItemId);
    if (src?.productType === "bundle" && src.bundleItems?.length) {
      for (const bi of src.bundleItems) {
        const override = line.bundleItemPrices?.find((p) => p.itemId === bi.itemId);
        const subQty = override?.qty !== undefined ? override.qty : bi.qty;
        const mainSub = resolveMainItem(bi.itemId);
        if (mainSub) out.set(mainSub.id, (out.get(mainSub.id) || 0) + subQty * line.qty);
      }
    } else {
      const main = resolveMainItem(line.inventoryItemId);
      if (main) out.set(main.id, (out.get(main.id) || 0) + line.qty);
    }
    return out;
  };

  const totalsFor = (lines: SalesOrder["items"]) => {
    const totals = new Map<string, number>();
    for (const l of lines || []) {
      for (const [k, v] of expandLine(l)) totals.set(k, (totals.get(k) || 0) + v);
    }
    return totals;
  };

  const applyMainStockDelta = async (prevItems: SalesOrder["items"], nextItems: SalesOrder["items"]) => {
    const prev = totalsFor(prevItems || []);
    const next = totalsFor(nextItems || []);
    const keys = new Set<string>([...prev.keys(), ...next.keys()]);
    for (const id of keys) {
      const delta = (next.get(id) || 0) - (prev.get(id) || 0);
      if (!delta) continue;
      const inv = mainInventory.find((i) => i.id === id);
      if (!inv || inv.productType === "non-stock") continue;
      await upsertInv({ ...inv, qty: Math.max(0, (inv.qty || 0) - delta) });
    }
  };

  const moveBackToStore = async (so: SalesOrder) => {
    await upsertSO({ ...so, location: "store" });
    toast.success(`${so.number} moved back to Store Sale Orders`);
  };

  const convertToInvoice = async (so: SalesOrder) => {
    // Map SO items so inventoryItemId references MAIN inventory where possible
    const mappedItems = (so.items || []).map((it) => {
      const main = resolveMainItem(it.inventoryItemId);
      return { ...it, inventoryItemId: main?.id || it.inventoryItemId };
    });

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      number: `INV-${String(invoices.length + 1).padStart(3, "0")}`,
      projectName: so.projectName,
      customer: so.customer,
      date: new Date().toISOString().split("T")[0],
      dueDate: so.deliveryDate,
      amount: so.amount,
      status: "pending",
      items: mappedItems,
      notes: so.notes ? `From ${so.number}. ${so.notes}` : `Converted from ${so.number} (Completed Site)`,
      tax: so.tax,
    };
    await upsertInvoice(newInvoice);

    // Deduct MAIN inventory (expand bundles)
    const totals = totalsFor(so.items || []);
    for (const [id, qty] of totals) {
      const inv = mainInventory.find((i) => i.id === id);
      if (!inv || inv.productType === "non-stock") continue;
      await upsertInv({ ...inv, qty: Math.max(0, (inv.qty || 0) - qty) });
    }

    if (so.advancePayment && so.advancePayment > 0) {
      const newReceipt: Receipt = {
        id: crypto.randomUUID(),
        number: `RCP-${String(receipts.length + 1).padStart(3, "0")}`,
        customer: so.customer, date: so.date, invoiceNumber: newInvoice.number,
        amount: so.advancePayment, paymentMethod: so.advancePaymentMethod || "cash",
        reference: so.advancePaymentRef, notes: `Advance payment against ${so.number}`,
      };
      await upsertReceipt(newReceipt);
    }

    await removeSO(so.id);
    await log("create", "invoice", newInvoice.id, newInvoice.number, `Converted from Completed Site ${so.number}`);
    toast.success(`${so.number} → Invoice ${newInvoice.number} created, main stock deducted`);
  };

  if (invLoading || soLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (viewOrder) {
    return (
      <SalesOrderPreview
        order={viewOrder}
        onClose={() => setViewOrder(null)}
        showPrices={true}
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
        onCancel={() => setEditOrder(null)}
        onSave={async (order) => {
          await applyMainStockDelta(editOrder.items || [], order.items || []);
          await upsertSO({ ...order, location: "completed" });
          await log("edit", "sales_order", order.id, order.number, "Completed site updated · main stock adjusted");
          toast.success(`${order.number} updated · main stock adjusted`);
          setEditOrder(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Completed Sites</h1>
          <p className="text-muted-foreground text-sm">Completed store sale orders — edits adjust main inventory</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">SO #</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Delivery</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Qty</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
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
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(so.amount || 0)}</td>
                  <td className="px-3 py-2 text-center"><Badge variant="outline" className="text-xs">{so.status}</Badge></td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 rounded hover:bg-muted" title="View" onClick={() => setViewOrder(so)}>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-muted" title="Edit" onClick={() => setEditOrder(so)}>
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-success/10" title="Move to Invoice" onClick={() => setConfirmInvoice(so)}>
                        <FileText className="w-4 h-4 text-success" />
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
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No completed sites yet. Click "Complete Site" on a Store Sale Order to move it here.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmInvoice} onOpenChange={(open) => { if (!open) setConfirmInvoice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Convert <strong>{confirmInvoice?.number}</strong> into a new Invoice for <strong>{confirmInvoice?.customer}</strong>?
              This will deduct <strong>main inventory</strong> stock and remove the completed site.
              {confirmInvoice?.advancePayment && confirmInvoice.advancePayment > 0 ? (
                <> An advance receipt of <strong>{formatCurrency(confirmInvoice.advancePayment)}</strong> will also be created.</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmInvoice) { const c = confirmInvoice; setConfirmInvoice(null); convertToInvoice(c); } }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
