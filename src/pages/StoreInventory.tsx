import { useMemo, useState } from "react";
import { Loader2, Plus, Edit, Trash2, X, Store, ShoppingCart, ArrowLeftRight, Package, Eye } from "lucide-react";
import { useInventoryCloud, useSalesOrdersCloud, useCustomersCloud } from "@/hooks/useAppData";
import type { InventoryItem, SalesOrder } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";

const emptyItem = (): Partial<InventoryItem> => ({
  name: "", sku: "", qty: 0, reorderLevel: 5, price: 0, category: "",
  date: new Date().toISOString().split("T")[0], costPrice: 0, salePrice: 0,
  unit: "pcs", weight: 0, stockAssetAccount: "Inventory Asset",
  saleDiscount: 0, purchaseDiscount: 0, productType: "stock", bundleItems: [],
  location: "store",
});

export default function StoreInventory() {
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { data: inventoryAll, loading, upsert, remove } = useInventoryCloud();
  const { data: salesOrdersAll, upsert: upsertSO, remove: removeSO } = useSalesOrdersCloud();
  const { data: customers } = useCustomersCloud();

  const items = useMemo(
    () => inventoryAll.filter((i) => (i.location || "main") === "store"),
    [inventoryAll]
  );
  const storeOrders = useMemo(
    () => salesOrdersAll.filter((s) => (s.location || "main") === "store"),
    [salesOrdersAll]
  );

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(emptyItem());

  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);

  const generateSku = () => {
    const nums = items
      .map((i) => i.sku)
      .filter((s) => s.startsWith("STR-"))
      .map((s) => parseInt(s.replace("STR-", ""), 10))
      .filter((n) => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `STR-${String(next).padStart(4, "0")}`;
  };

  const openAdd = () => { setEditing(null); setForm({ ...emptyItem(), sku: generateSku() }); setShowForm(true); };
  const openEdit = (i: InventoryItem) => { setEditing(i); setForm(i); setShowForm(true); };

  const stats = useMemo(() => {
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
    const stockValue = items.reduce((s, i) => s + (i.qty || 0) * (i.costPrice || 0), 0);
    const retailValue = items.reduce((s, i) => s + (i.qty || 0) * (i.salePrice || 0), 0);
    const lowStock = items.filter((i) => i.qty <= i.reorderLevel).length;
    return { totalProducts: items.length, totalQty, stockValue, retailValue, lowStock, orders: storeOrders.length };
  }, [items, storeOrders]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    const item: InventoryItem = {
      ...emptyItem(),
      ...form,
      sku: form.sku?.trim() || generateSku(),
      location: "store",
      id: editing?.id || crypto.randomUUID(),
    } as InventoryItem;
    await upsert(item);
    await log(editing ? "edit" : "create", "inventory", item.id, item.name, `Store · SKU: ${item.sku}, Qty: ${item.qty}`);
    toast.success(editing ? "Store item updated" : "Store item added");
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    toast.success("Store item deleted");
  };

  const moveBackToMain = async (so: SalesOrder) => {
    await upsertSO({ ...so, location: "main" });
    toast.success(`${so.number} moved back to Sales Orders`);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const kpis = [
    { label: "Store Products", value: stats.totalProducts, icon: Package },
    { label: "Total Qty", value: stats.totalQty.toLocaleString(), icon: Store },
    { label: "Stock Value", value: formatCurrency(stats.stockValue), icon: Store },
    { label: "Retail Value", value: formatCurrency(stats.retailValue), icon: Store },
    { label: "Low Stock", value: stats.lowStock, icon: Store },
    { label: "Store Orders", value: stats.orders, icon: ShoppingCart },
  ];

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
          await upsertSO({ ...order, location: "store" });
          await log("edit", "sales_order", order.id, order.number, "Store sale order updated");
          toast.success(`${order.number} updated`);
          setEditOrder(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Store Inventory</h1>
            <p className="text-muted-foreground text-sm">Independent store stock &amp; sale orders</p>
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="p-3 pb-1 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-lg font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">Store Products</TabsTrigger>
          <TabsTrigger value="orders">Store Sale Orders ({storeOrders.length})</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Store Products</h2>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Store Item</Button>
          </div>

          {showForm && (
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{editing ? "Edit Store Item" : "Add Store Item"}</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
              </div>
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div><Label>Item Name *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" required /></div>
                <div><Label>SKU</Label><Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" /></div>
                <div><Label>Category</Label><Input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" /></div>
                <div><Label>Unit</Label><Input value={form.unit || "pcs"} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1" /></div>
                <div><Label>Qty</Label><Input type="number" value={form.qty ?? 0} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Reorder Level</Label><Input type="number" value={form.reorderLevel ?? 5} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Cost Price</Label><Input type="number" value={form.costPrice ?? 0} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Sale Price</Label><Input type="number" value={form.salePrice ?? 0} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value), price: Number(e.target.value) })} className="mt-1" /></div>
                <div className="md:col-span-3 lg:col-span-4 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit">{editing ? "Update" : "Add"}</Button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sale</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{i.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.sku}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.category || "—"}</td>
                    <td className="px-3 py-2 text-center">{i.unit || "pcs"}</td>
                    <td className="px-3 py-2 text-right">{i.qty}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(i.costPrice || 0)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(i.salePrice || 0)}</td>
                    <td className="px-3 py-2 text-center">
                      {i.qty <= 0 ? (
                        <Badge className="bg-destructive/10 text-destructive border-0">Out</Badge>
                      ) : i.qty <= i.reorderLevel ? (
                        <Badge className="bg-destructive/10 text-destructive border-0">Low</Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success border-0">In Stock</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(i)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                        <ConfirmDeleteDialog onConfirm={() => handleDelete(i.id)} title="Delete Store Item?" description={`Delete "${i.name}" from store inventory?`} />
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No store products yet. Click "Add Store Item" to get started.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Store Sale Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Store Sale Orders</h2>
            <p className="text-xs text-muted-foreground">Sale orders moved here from the main Sales Orders section.</p>
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
                {storeOrders.map((so) => {
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
                          <button className="p-1.5 rounded hover:bg-primary/10" title="Move back to Main Sales Orders" onClick={() => moveBackToMain(so)}>
                            <ArrowLeftRight className="w-4 h-4 text-primary" />
                          </button>
                          <ConfirmDeleteDialog onConfirm={() => removeSO(so.id)} title="Delete Store Sale Order?" description={`Delete ${so.number}?`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {storeOrders.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No store sale orders yet. Move an order here from the Sales Orders tab.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
