import { useState, useMemo } from "react";
import StockAdjustmentSection from "@/components/StockAdjustmentSection";
import { getInitialInventory, type InventoryItem } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AlertTriangle, Plus, Edit, Trash2, X, Search, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";

const DEFAULT_UNITS = ["pcs", "kg", "ltr", "box", "dozen", "meter", "feet"];
const DEFAULT_ACCOUNTS = ["Inventory Asset", "Stock on Hand", "Raw Materials", "Finished Goods"];
const DEFAULT_CATEGORIES = ["Electronics", "Office Supplies", "Raw Materials", "Packaging", "Tools"];

const emptyItem = (): Partial<InventoryItem> => ({
  name: "", sku: "", qty: 0, reorderLevel: 5, price: 0, category: "",
  date: new Date().toISOString().split("T")[0], costPrice: 0, salePrice: 0,
  unit: "pcs", weight: 0, stockAssetAccount: "Inventory Asset",
  saleDiscount: 0, purchaseDiscount: 0, productType: "stock", bundleItems: [],
});

export default function Inventory() {
  const { formatCurrency } = useSettings();
  const [inventory, setInventory] = useLocalStorage<InventoryItem[]>("cb-inventory", getInitialInventory());
  const [customUnits, setCustomUnits] = useLocalStorage<string[]>("cb-custom-units", []);
  const [customAccounts, setCustomAccounts] = useLocalStorage<string[]>("cb-custom-accounts", []);
  const [customCategories, setCustomCategories] = useLocalStorage<string[]>("cb-custom-categories", []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(emptyItem());
  const [newUnit, setNewUnit] = useState("");
  const [addingUnit, setAddingUnit] = useState(false);
  const [newAccount, setNewAccount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const allUnits = [...DEFAULT_UNITS, ...customUnits];
  const allAccounts = [...DEFAULT_ACCOUNTS, ...customAccounts];
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const usedCategories = useMemo(() => {
    const cats = new Set(inventory.map((i) => i.category).filter(Boolean));
    allCategories.forEach((c) => cats.add(c));
    return Array.from(cats).sort();
  }, [inventory, allCategories]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) return false;
      }
      // Category
      if (filterCategory !== "__all__" && item.category !== filterCategory) return false;
      // Status
      if (filterStatus === "low" && item.qty > item.reorderLevel) return false;
      if (filterStatus === "in_stock" && item.qty <= item.reorderLevel) return false;
      // Date range
      if (dateFrom && item.date && new Date(item.date) < dateFrom) return false;
      if (dateTo && item.date && new Date(item.date) > dateTo) return false;
      return true;
    });
  }, [inventory, searchQuery, filterCategory, filterStatus, dateFrom, dateTo]);

  const lowStock = inventory.filter((i) => i.qty <= i.reorderLevel);

  const openAdd = () => { setEditing(null); setForm(emptyItem()); setShowForm(true); };
  const openEdit = (item: InventoryItem) => { setEditing(item); setForm(item); setShowForm(true); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.sku?.trim()) return;
    if (editing) {
      setInventory((prev) => prev.map((i) => i.id === editing.id ? { ...i, ...form } as InventoryItem : i));
      toast.success("Item updated");
    } else {
      setInventory((prev) => [...prev, { ...form, id: crypto.randomUUID() } as InventoryItem]);
      toast.success("Item added");
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== id));
    toast.success("Item deleted");
  };

  const addNewUnit = () => {
    const v = newUnit.trim();
    if (!v || allUnits.includes(v)) return;
    setCustomUnits((prev) => [...prev, v]);
    setForm({ ...form, unit: v });
    setNewUnit("");
    setAddingUnit(false);
    toast.success(`Unit "${v}" added`);
  };

  const addNewAccount = () => {
    const v = newAccount.trim();
    if (!v || allAccounts.includes(v)) return;
    setCustomAccounts((prev) => [...prev, v]);
    setForm({ ...form, stockAssetAccount: v });
    setNewAccount("");
    setAddingAccount(false);
    toast.success(`Account "${v}" added`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Stock management and alerts</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="bg-card rounded-lg border p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="min-w-[150px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {usedCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Date From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PP") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Date To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PP") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        {(searchQuery || filterCategory !== "__all__" || filterStatus !== "__all__" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setFilterCategory("__all__"); setFilterStatus("__all__"); setDateFrom(undefined); setDateTo(undefined); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? "Edit Item" : "Add Item"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Product Type */}
            <div>
              <Label>Product Type</Label>
              <Select value={form.productType || "stock"} onValueChange={(v) => setForm({ ...form, productType: v as InventoryItem["productType"] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock (Tracked)</SelectItem>
                  <SelectItem value="non-stock">Non-Stock (Service)</SelectItem>
                  <SelectItem value="bundle">Bundle (Composite)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Item Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} required /></div>
            <div><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" maxLength={20} required /></div>
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
                    {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__add_new__">+ Add New Category</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" /></div>
            <div><Label>Cost Price</Label><Input type="number" min={0} step={0.01} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="mt-1" /></div>
            <div><Label>Sale Price</Label><Input type="number" min={0} step={0.01} value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} className="mt-1" /></div>

            {/* Only show qty/reorder for stock items */}
            {form.productType !== "non-stock" && (
              <>
                <div><Label>Quantity</Label><Input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Reorder Level</Label><Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="mt-1" /></div>
              </>
            )}

            {/* Unit dropdown with Add New */}
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

            <div><Label>Weight</Label><Input type="number" min={0} step={0.01} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} className="mt-1" /></div>

            {/* Stock Asset Account dropdown with Add New */}
            {form.productType !== "non-stock" && (
              <div>
                <Label>Stock Asset Account</Label>
                {addingAccount ? (
                  <div className="flex gap-1 mt-1">
                    <Input value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder="New account..." className="flex-1" maxLength={50} autoFocus onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewAccount())} />
                    <Button type="button" size="sm" onClick={addNewAccount} className="shrink-0">Add</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAddingAccount(false)} className="shrink-0"><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <Select value={form.stockAssetAccount || "Inventory Asset"} onValueChange={(v) => v === "__add_new__" ? setAddingAccount(true) : setForm({ ...form, stockAssetAccount: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allAccounts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      <SelectItem value="__add_new__">+ Add New Account</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div><Label>Sale Discount (%)</Label><Input type="number" min={0} max={100} step={0.1} value={form.saleDiscount} onChange={(e) => setForm({ ...form, saleDiscount: Number(e.target.value) })} className="mt-1" /></div>
            <div><Label>Purchase Discount (%)</Label><Input type="number" min={0} max={100} step={0.1} value={form.purchaseDiscount} onChange={(e) => setForm({ ...form, purchaseDiscount: Number(e.target.value) })} className="mt-1" /></div>
            <div><Label>Price (Display)</Label><Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-1" /></div>

            {/* Bundle Items - only for bundle type */}
            {form.productType === "bundle" && (
              <div className="md:col-span-3 lg:col-span-4">
                <Label className="mb-2 block">Bundle Components</Label>
                <div className="bg-muted/30 rounded-lg border p-3 space-y-2">
                  {(form.bundleItems || []).map((bi, idx) => {
                    const bundledItem = inventory.find((inv) => inv.id === bi.itemId);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Select value={bi.itemId} onValueChange={(v) => {
                          const updated = [...(form.bundleItems || [])];
                          updated[idx] = { ...updated[idx], itemId: v };
                          setForm({ ...form, bundleItems: updated });
                        }}>
                          <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Select component product" /></SelectTrigger>
                          <SelectContent>
                            {inventory.filter((inv) => inv.id !== editing?.id && inv.productType !== "bundle").map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.sku})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

            <div className="md:col-span-3 lg:col-span-4 flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Add"}</Button>
            </div>
          </form>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{lowStock.length} items</span> below reorder level: {lowStock.map((i) => i.name).join(", ")}
          </p>
        </div>
      )}

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Item</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Cost</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Sale</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Unit</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Weight</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Sale Disc%</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Purch Disc%</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => {
              const typeLabel = item.productType === "non-stock" ? "Non-Stock" : item.productType === "bundle" ? "Bundle" : "Stock";
              const typeVariant = item.productType === "non-stock" ? "outline" : item.productType === "bundle" ? "secondary" : "default";
              return (
              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-3 font-medium">{item.name}</td>
                <td className="px-3 py-3"><Badge variant={typeVariant} className="text-xs">{typeLabel}</Badge></td>
                <td className="px-3 py-3 text-muted-foreground">{item.sku}</td>
                <td className="px-3 py-3 text-muted-foreground">{item.category}</td>
                <td className="px-3 py-3 text-muted-foreground">{item.date || "—"}</td>
                <td className="px-3 py-3 text-right">{formatCurrency(item.costPrice || 0)}</td>
                <td className="px-3 py-3 text-right">{formatCurrency(item.salePrice || 0)}</td>
                <td className="px-3 py-3 text-center">{item.unit || "pcs"}</td>
                <td className="px-3 py-3 text-right">{item.weight || 0}</td>
                <td className="px-3 py-3 text-right">{item.productType === "non-stock" ? "∞" : item.qty}</td>
                <td className="px-3 py-3 text-right">{item.saleDiscount || 0}%</td>
                <td className="px-3 py-3 text-right">{item.purchaseDiscount || 0}%</td>
                <td className="px-3 py-3 text-center">
                  {item.productType === "non-stock" ? (
                    <Badge className="bg-primary/10 text-primary border-0">Service</Badge>
                  ) : item.qty <= item.reorderLevel ? (
                    <Badge className="bg-destructive/10 text-destructive border-0">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success border-0">In Stock</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(item)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
              );
            })}
            {filteredInventory.length === 0 && <tr><td colSpan={14} className="text-center py-8 text-muted-foreground">{inventory.length === 0 ? "No inventory items." : "No items match your filters."}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Stock Adjustment Section */}
      <StockAdjustmentSection inventory={inventory} onUpdateInventory={setInventory} />
    </div>
  );
}
