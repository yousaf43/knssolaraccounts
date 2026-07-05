import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Edit, Trash2, X, Store, ShoppingCart, ArrowLeftRight, Package, Eye, Boxes, CheckCircle2, Search } from "lucide-react";
import { useInventoryCloud, useSalesOrdersCloud, useCustomersCloud, useUserSettingsCloud } from "@/hooks/useAppData";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import type { InventoryItem, SalesOrder } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BundleComponentSearch } from "@/components/BundleComponentSearch";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";

const DEFAULT_UNITS = ["pcs", "kg", "ltr", "box", "dozen", "meter", "feet"];
const DEFAULT_CATEGORIES = ["Electronics", "Office Supplies", "Raw Materials", "Packaging", "Tools"];

const emptyItem = (): Partial<InventoryItem> => ({
  name: "", sku: "", model: "", uniqueCode: "", qty: 0, reorderLevel: 5, price: 0, category: "",
  date: new Date().toISOString().split("T")[0], costPrice: 0, salePrice: 0,
  unit: "pcs", weight: 0, stockAssetAccount: "Inventory Asset",
  saleDiscount: 0, purchaseDiscount: 0, productType: "stock", bundleItems: [],
  location: "store",
});

export default function StoreInventory() {
  const { log } = useActivityLog();
  const { data: inventoryAll, loading, upsert, remove } = useInventoryCloud();
  const { data: salesOrdersAll, upsert: upsertSO, remove: removeSO } = useSalesOrdersCloud();
  const { data: customers } = useCustomersCloud();
  const { customUnits, customCategories, setCustomUnits, setCustomCategories } = useUserSettingsCloud();

  const items = useMemo(
    () => inventoryAll.filter((i) => (i.location || "main") === "store"),
    [inventoryAll]
  );
  const storeOrders = useMemo(
    () => salesOrdersAll.filter((s) => (s.location || "main") === "store"),
    [salesOrdersAll]
  );

  const allUnits = useMemo(() => [...DEFAULT_UNITS, ...customUnits], [customUnits]);
  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const usedCategories = useMemo(() => {
    const cats = new Set<string>(inventoryAll.map((i) => i.category).filter(Boolean));
    allCategories.forEach((c) => cats.add(c));
    return Array.from(cats).sort();
  }, [inventoryAll, allCategories]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(emptyItem());
  const [newUnit, setNewUnit] = useState("");
  const [addingUnit, setAddingUnit] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);

  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.sku || "").toLowerCase().includes(q) ||
      (i.model || "").toLowerCase().includes(q) ||
      (i.uniqueCode || "").toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q)
    );
  }, [items, search]);
  const pg = usePagination(filteredItems, 25);
  useEffect(() => { pg.resetPage(); }, [search]);


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
    const lowStock = items.filter((i) => i.qty <= i.reorderLevel).length;
    const bundles = items.filter((i) => i.productType === "bundle").length;
    return { totalProducts: items.length, totalQty, lowStock, bundles, orders: storeOrders.length };
  }, [items, storeOrders]);

  const addNewUnit = () => {
    const v = newUnit.trim();
    if (!v || allUnits.includes(v)) return;
    setCustomUnits((prev) => [...prev, v]);
    setForm({ ...form, unit: v });
    setNewUnit("");
    setAddingUnit(false);
    toast.success(`Unit "${v}" added`);
  };

  const addNewCategory = () => {
    const v = newCategory.trim();
    if (!v || allCategories.includes(v)) return;
    setCustomCategories((prev) => [...prev, v]);
    setForm({ ...form, category: v });
    setNewCategory("");
    setAddingCategory(false);
    toast.success(`Category "${v}" added`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    const item: InventoryItem = {
      ...emptyItem(),
      ...form,
      // prices always hidden in store; keep zero
      price: 0, costPrice: 0, salePrice: 0, saleDiscount: 0, purchaseDiscount: 0,
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

  const completeSite = async (so: SalesOrder) => {
    // Deduct store stock by SO items (bundles expanded). Store stock is the source of truth
    // while the order sits in Completed Projects.
    await applyStoreStockDelta([], so.items || []);
    await upsertSO({ ...so, location: "completed" });
    await log("edit", "sales_order", so.id, so.number, "Marked as Completed Project — store stock deducted");
    toast.success(`${so.number} moved to Completed Projects · store stock deducted`);
  };

  // Resolve any inventoryItemId (main or store) to the corresponding STORE inventory item, matched by sku/name.
  const resolveStoreItem = (inventoryItemId?: string): InventoryItem | undefined => {
    if (!inventoryItemId) return undefined;
    const direct = items.find((i) => i.id === inventoryItemId);
    if (direct) return direct;
    const src = inventoryAll.find((i) => i.id === inventoryItemId);
    if (!src) return undefined;
    return items.find(
      (i) =>
        (i.sku && src.sku && i.sku.trim().toLowerCase() === src.sku.trim().toLowerCase()) ||
        i.name.trim().toLowerCase() === src.name.trim().toLowerCase()
    );
  };

  const expandLine = (line: { inventoryItemId?: string; qty: number; bundleItemPrices?: { itemId: string; qty?: number }[] }): Map<string, number> => {
    const out = new Map<string, number>();
    if (!line.inventoryItemId) return out;
    const src = inventoryAll.find((i) => i.id === line.inventoryItemId);
    if (src?.productType === "bundle" && src.bundleItems?.length) {
      for (const bi of src.bundleItems) {
        const override = line.bundleItemPrices?.find((p) => p.itemId === bi.itemId);
        const subQty = override?.qty !== undefined ? override.qty : bi.qty;
        const storeSub = resolveStoreItem(bi.itemId);
        if (storeSub) out.set(storeSub.id, (out.get(storeSub.id) || 0) + subQty * line.qty);
      }
    } else {
      const store = resolveStoreItem(line.inventoryItemId);
      if (store) out.set(store.id, (out.get(store.id) || 0) + line.qty);
    }
    return out;
  };

  const totalsFor = (lines: { inventoryItemId?: string; qty: number; bundleItemPrices?: { itemId: string; qty?: number }[] }[]) => {
    const totals = new Map<string, number>();
    for (const l of lines) {
      const m = expandLine(l);
      for (const [k, v] of m) totals.set(k, (totals.get(k) || 0) + v);
    }
    return totals;
  };

  const applyStoreStockDelta = async (prevItems: SalesOrder["items"], nextItems: SalesOrder["items"]) => {
    const prev = totalsFor(prevItems || []);
    const next = totalsFor(nextItems || []);
    const keys = new Set<string>([...prev.keys(), ...next.keys()]);
    for (const id of keys) {
      const delta = (next.get(id) || 0) - (prev.get(id) || 0);
      if (!delta) continue;
      const inv = items.find((i) => i.id === id);
      if (!inv) continue;
      await upsert({ ...inv, qty: Math.max(0, (inv.qty || 0) - delta) });
    }
  };

  if (loading) {
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
          await upsertSO({ ...order, location: "store" });
          await log("edit", "sales_order", order.id, order.number, "Store sale order updated");
          toast.success(`${order.number} updated`);
          setEditOrder(null);
        }}
      />
    );
  }

  const kpis = [
    { label: "Store Products", value: stats.totalProducts, icon: Package },
    { label: "Total Qty", value: stats.totalQty.toLocaleString(), icon: Store },
    { label: "Bundles", value: stats.bundles, icon: Boxes },
    { label: "Low Stock", value: stats.lowStock, icon: Store },
    { label: "Store Orders", value: stats.orders, icon: ShoppingCart },
  ];

  // Bundle picker source: store items only (exclude bundles and the item being edited)
  const bundlePickerSource = items.filter((inv) => inv.id !== editing?.id && inv.productType !== "bundle");

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <h2 className="text-base font-semibold">Store Products</h2>
            <p className="text-xs text-muted-foreground">Products auto-mirror from Main Inventory. Store stock is managed independently here.</p>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, model, code, category..."
              className="pl-8"
            />
          </div>


          {/* Edit Store Item Dialog (stock managed independently from Main Inventory) */}
          <Dialog open={showForm && !!editing} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Store Item — {editing?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div><Label>Item Name *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} required /></div>
                <div><Label>SKU</Label><Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" maxLength={20} /></div>
                <div><Label>Model</Label><Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1" maxLength={50} /></div>
                <div><Label>Unique Code</Label><Input value={form.uniqueCode || ""} onChange={(e) => setForm({ ...form, uniqueCode: e.target.value })} className="mt-1" maxLength={50} /></div>

                <div>
                  <Label>Category</Label>
                  {addingCategory ? (
                    <div className="flex gap-1 mt-1">
                      <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category..." className="flex-1" maxLength={50} autoFocus onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewCategory())} />
                      <Button type="button" size="sm" onClick={addNewCategory} className="shrink-0">Add</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAddingCategory(false)} className="shrink-0"><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <Select value={form.category || ""} onValueChange={(v) => v === "__add_new__" ? setAddingCategory(true) : setForm({ ...form, category: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {usedCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="__add_new__">+ Add New Category</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label>Unit</Label>
                  {addingUnit ? (
                    <div className="flex gap-1 mt-1">
                      <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="New unit..." className="flex-1" maxLength={20} autoFocus onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewUnit())} />
                      <Button type="button" size="sm" onClick={addNewUnit} className="shrink-0">Add</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAddingUnit(false)} className="shrink-0"><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <Select value={form.unit || "pcs"} onValueChange={(v) => v === "__add_new__" ? setAddingUnit(true) : setForm({ ...form, unit: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        <SelectItem value="__add_new__">+ Add New Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {form.productType !== "non-stock" && (
                  <>
                    <div><Label>Quantity (Store Stock)</Label><Input type="number" min={0} value={form.qty ?? 0} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="mt-1" /></div>
                    <div><Label>Reorder Level</Label><Input type="number" min={0} value={form.reorderLevel ?? 5} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="mt-1" /></div>
                  </>
                )}


                {form.productType === "bundle" && (
                  <div className="md:col-span-2">
                    <Label className="mb-2 block">Bundle Components (from Store Inventory)</Label>
                    <div className="bg-muted/30 rounded-lg border p-3 space-y-2">
                      {(form.bundleItems || []).map((bi, idx) => {
                        const bundledItem = items.find((inv) => inv.id === bi.itemId);
                        const pickerSource = items.filter((inv) => inv.id !== editing?.id && inv.productType !== "bundle");
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <BundleComponentSearch
                              inventory={pickerSource}
                              selectedItemId={bi.itemId}
                              onSelect={(v) => {
                                const updated = [...(form.bundleItems || [])];
                                updated[idx] = { ...updated[idx], itemId: v };
                                setForm({ ...form, bundleItems: updated });
                              }}
                            />
                            <Input
                              type="number" min={1} value={bi.qty}
                              onChange={(e) => {
                                const updated = [...(form.bundleItems || [])];
                                updated[idx] = { ...updated[idx], qty: Number(e.target.value) };
                                setForm({ ...form, bundleItems: updated });
                              }}
                              className="w-20 h-8 text-xs" placeholder="Qty"
                            />
                            <span className="text-xs text-muted-foreground w-16 truncate">{bundledItem?.unit || ""}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                              const updated = (form.bundleItems || []).filter((_, i) => i !== idx);
                              setForm({ ...form, bundleItems: updated });
                            }}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setForm({ ...form, bundleItems: [...(form.bundleItems || []), { itemId: "", qty: 1 }] });
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Add Component
                      </Button>
                    </div>
                  </div>
                )}


                <DialogFooter className="md:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit">Update</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>





          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pg.paginatedItems.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{i.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{i.productType || "stock"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{i.sku}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.model || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.category || "—"}</td>
                    <td className="px-3 py-2 text-center">{i.unit || "pcs"}</td>
                    <td className="px-3 py-2 text-right">{i.qty}</td>
                    <td className="px-3 py-2 text-center">
                      {i.productType === "non-stock" ? (
                        <Badge variant="outline" className="text-xs">Service</Badge>
                      ) : i.qty <= 0 ? (
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
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">{items.length === 0 ? "No store products yet. Add a product in Main Inventory to auto-mirror it here." : "No products match your search."}</td></tr>}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={pg.currentPage}
            totalPages={pg.totalPages}
            totalItems={pg.totalItems}
            onPageChange={pg.goToPage}
            itemLabel="product"
          />
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
                          <button className="p-1.5 rounded hover:bg-green-500/10" title="Complete Project (move to Completed Projects)" onClick={() => completeSite(so)}>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
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
