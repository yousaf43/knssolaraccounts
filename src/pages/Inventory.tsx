import { useState, useMemo, useRef } from "react";
import StockAdjustmentSection from "@/components/StockAdjustmentSection";
import StoreInventorySection from "@/components/StoreInventorySection";
import { BundleComponentSearch } from "@/components/BundleComponentSearch";
import type { InventoryItem, StockAdjustment } from "@/data/mockData";
import { useInventoryCloud, useUserSettingsCloud, useStockAdjustmentsCloud } from "@/hooks/useAppData";
import { AlertTriangle, Plus, Edit, Trash2, X, Search, CalendarIcon, Upload, Loader2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
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
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";

const DEFAULT_UNITS = ["pcs", "kg", "ltr", "box", "dozen", "meter", "feet"];
const DEFAULT_ACCOUNTS = ["Inventory Asset", "Stock on Hand", "Raw Materials", "Finished Goods"];
const DEFAULT_CATEGORIES = ["Electronics", "Office Supplies", "Raw Materials", "Packaging", "Tools"];

const emptyItem = (): Partial<InventoryItem> => ({
  name: "", sku: "", model: "", uniqueCode: "", qty: 0, reorderLevel: 5, price: 0, category: "",
  date: new Date().toISOString().split("T")[0], costPrice: 0, salePrice: 0,
  unit: "pcs", weight: 0, stockAssetAccount: "Inventory Asset",
  saleDiscount: 0, purchaseDiscount: 0, productType: "stock", bundleItems: [],
});

export default function Inventory() {
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { moveToTrash } = useTrash();
  const { data: inventory, loading, upsert, remove, replaceAll } = useInventoryCloud();
  const { upsert: upsertAdjustment } = useStockAdjustmentsCloud();
  const { customUnits, customAccounts, customCategories, setCustomUnits, setCustomAccounts, setCustomCategories } = useUserSettingsCloud();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(emptyItem());
  const [newUnit, setNewUnit] = useState("");
  const [addingUnit, setAddingUnit] = useState(false);
  const [newAccount, setNewAccount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q) && !(item.model || "").toLowerCase().includes(q) && !(item.uniqueCode || "").toLowerCase().includes(q)) return false;
      }
      if (filterCategory !== "__all__" && item.category !== filterCategory) return false;
      if (filterStatus === "low" && item.qty > item.reorderLevel) return false;
      if (filterStatus === "in_stock" && item.qty <= item.reorderLevel) return false;
      if (dateFrom && item.date && new Date(item.date) < dateFrom) return false;
      if (dateTo && item.date && new Date(item.date) > dateTo) return false;
      return true;
    });
  }, [inventory, searchQuery, filterCategory, filterStatus, dateFrom, dateTo]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 13;

  const openAdd = () => { setEditing(null); setForm({ ...emptyItem(), sku: generateProductCode() }); setShowForm(true); };
  const openEdit = (item: InventoryItem) => { setEditing(item); setForm(item); setShowForm(true); };

  // Auto-generate product code
  const generateProductCode = () => {
    const existingCodes = inventory
      .map((i) => i.sku)
      .filter((s) => s.startsWith("PRD-"))
      .map((s) => parseInt(s.replace("PRD-", ""), 10))
      .filter((n) => !isNaN(n));
    const next = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `PRD-${String(next).padStart(4, "0")}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    // Auto-generate SKU if empty
    const sku = form.sku?.trim() || generateProductCode();
    const item: InventoryItem = {
      ...emptyItem(),
      ...form,
      sku,
      id: editing?.id || crypto.randomUUID(),
    } as InventoryItem;

    // Log price change as stock adjustment if editing and price changed
    if (editing) {
      const oldCost = editing.costPrice;
      const newCost = item.costPrice;
      const oldSale = editing.salePrice;
      const newSale = item.salePrice;
      if (oldCost !== newCost || oldSale !== newSale) {
        const priceAdj: StockAdjustment = {
          id: crypto.randomUUID(),
          itemId: item.id,
          itemName: item.name,
          type: "increase", // type just for record; qty 0 means price-only change
          qty: 0,
          reason: "Price Update",
          date: new Date().toISOString().split("T")[0],
          note: `Cost: ${oldCost} → ${newCost} | Sale: ${oldSale} → ${newSale}`,
        };
        await upsertAdjustment(priceAdj);
      }
    }

    await upsert(item);
    await log(editing ? "edit" : "create", "inventory", item.id, item.name, `SKU: ${item.sku}, Qty: ${item.qty}`);
    toast.success(editing ? "Item updated" : "Item added");
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const item = inventory.find(i => i.id === id);
    if (item) {
      await moveToTrash("inventory", id, item);
      await log("delete", "inventory", id, item.name, `SKU: ${item.sku}`);
    }
    await remove(id);
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

  // CSV/Excel Import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv"].includes(ext || "")) {
      toast.error("Only CSV files are supported. Please export your Excel file as CSV first.");
      return;
    }
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { toast.error("CSV file is empty or has no data rows"); setImportLoading(false); return; }

        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
        const getCol = (row: string[], ...keys: string[]) => {
          for (const k of keys) {
            const idx = headers.indexOf(k);
            if (idx !== -1 && row[idx]?.trim()) return row[idx].trim().replace(/^"|"$/g, "");
          }
          return "";
        };

        const imported: InventoryItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          const name = getCol(cols, "name", "item_name", "product_name", "item");
          const sku = getCol(cols, "sku", "code", "item_code", "product_code");
          if (!name) continue;
          imported.push({
            id: crypto.randomUUID(),
            name,
            sku: sku || `SKU-${i}`,
            qty: Number(getCol(cols, "qty", "quantity", "stock", "stock_qty")) || 0,
            reorderLevel: Number(getCol(cols, "reorder_level", "reorder", "min_qty")) || 5,
            price: Number(getCol(cols, "price", "sale_price", "selling_price")) || 0,
            costPrice: Number(getCol(cols, "cost_price", "cost", "purchase_price", "buying_price")) || 0,
            salePrice: Number(getCol(cols, "sale_price", "selling_price", "price")) || 0,
            category: getCol(cols, "category", "cat", "type"),
            date: getCol(cols, "date") || new Date().toISOString().split("T")[0],
            unit: getCol(cols, "unit", "uom") || "pcs",
            weight: Number(getCol(cols, "weight")) || 0,
            stockAssetAccount: getCol(cols, "stock_asset_account", "account") || "Inventory Asset",
            saleDiscount: Number(getCol(cols, "sale_discount", "discount")) || 0,
            purchaseDiscount: Number(getCol(cols, "purchase_discount")) || 0,
            productType: (getCol(cols, "product_type", "type") as InventoryItem["productType"]) || "stock",
            bundleItems: [],
          });
        }

        if (imported.length === 0) { toast.error("No valid rows found in CSV"); setImportLoading(false); return; }

        // Merge with existing: update by SKU if exists, else add new
        const existingSkus = new Map(inventory.map(i => [i.sku, i]));
        let added = 0, updated = 0;
        for (const item of imported) {
          const existing = existingSkus.get(item.sku);
          if (existing) {
            await upsert({ ...item, id: existing.id });
            updated++;
          } else {
            await upsert(item);
            added++;
          }
        }
        toast.success(`Import complete: ${added} added, ${updated} updated`);
      } catch {
        toast.error("Failed to parse CSV file");
      }
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleUpdateInventory = async (updater: (prev: InventoryItem[]) => InventoryItem[]) => {
    const updated = updater(inventory);
    await replaceAll(updated);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Stock management and alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importLoading}>
            {importLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>
      </div>

      {/* CSV Format Help */}
      <div className="bg-muted/40 border rounded-lg px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium">CSV Import Format:</span> name, sku, qty, cost_price, sale_price, category, unit, reorder_level, date
        {" "}(columns auto-detected by header name)
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
            <div><Label>Model</Label><Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1" maxLength={50} placeholder="e.g. LONGi Hi-MO 6" /></div>
            <div><Label>Unique Code</Label><Input value={form.uniqueCode || ""} onChange={(e) => setForm({ ...form, uniqueCode: e.target.value })} className="mt-1" maxLength={50} placeholder="e.g. SN-12345" /></div>
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

            {form.productType !== "non-stock" && (
              <>
                <div><Label>Quantity</Label><Input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Reorder Level</Label><Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="mt-1" /></div>
              </>
            )}

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

            {form.productType === "bundle" && (
              <div className="md:col-span-3 lg:col-span-4">
                <Label className="mb-2 block">Bundle Components</Label>
                <div className="bg-muted/30 rounded-lg border p-3 space-y-2">
                  {(form.bundleItems || []).map((bi, idx) => {
                    const bundledItem = inventory.find((inv) => inv.id === bi.itemId);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <BundleComponentSearch
                          inventory={inventory.filter((inv) => inv.id !== editing?.id && inv.productType !== "bundle")}
                          selectedItemId={bi.itemId}
                          onSelect={(v) => {
                            const selectedInv = inventory.find((inv) => inv.id === v);
                            const updated = [...(form.bundleItems || [])];
                            updated[idx] = { ...updated[idx], itemId: v, price: selectedInv?.salePrice || 0 };
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
                        <span className="text-xs text-muted-foreground w-8 truncate">{bundledItem?.unit || ""}</span>
                        <Input
                          type="number" min={0} value={bi.price ?? bundledItem?.salePrice ?? 0}
                          onChange={(e) => {
                            const updated = [...(form.bundleItems || [])];
                            updated[idx] = { ...updated[idx], price: Number(e.target.value) };
                            setForm({ ...form, bundleItems: updated });
                          }}
                          className="w-24 h-8 text-xs" placeholder="Price"
                        />
                        <span className="text-xs text-muted-foreground font-medium w-20 text-right">
                          = {((bi.price ?? bundledItem?.salePrice ?? 0) * bi.qty).toLocaleString()}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                          const updated = (form.bundleItems || []).filter((_, i) => i !== idx);
                          setForm({ ...form, bundleItems: updated });
                        }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  {/* Bundle total */}
                  {(form.bundleItems || []).length > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t mt-2">
                      <span className="text-xs font-medium text-muted-foreground">Bundle Total Price:</span>
                      <span className="text-sm font-bold text-primary">
                        {(form.bundleItems || []).reduce((sum, bi) => {
                          const bundledItem = inventory.find((inv) => inv.id === bi.itemId);
                          return sum + (bi.price ?? bundledItem?.salePrice ?? 0) * bi.qty;
                        }, 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      setForm({ ...form, bundleItems: [...(form.bundleItems || []), { itemId: "", qty: 1, price: 0 }] });
                    }}>
                      <Plus className="w-3 h-3 mr-1" /> Add Component
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => {
                      const bundleTotal = (form.bundleItems || []).reduce((sum, bi) => {
                        const bundledItem = inventory.find((inv) => inv.id === bi.itemId);
                        return sum + (bi.price ?? bundledItem?.salePrice ?? 0) * bi.qty;
                      }, 0);
                      const bundleCost = (form.bundleItems || []).reduce((sum, bi) => {
                        const bundledItem = inventory.find((inv) => inv.id === bi.itemId);
                        return sum + (bundledItem?.costPrice ?? 0) * bi.qty;
                      }, 0);
                      setForm({ ...form, salePrice: bundleTotal, price: bundleTotal, costPrice: bundleCost });
                      toast.success("Bundle prices updated from components");
                    }}>
                      Apply Prices to Bundle
                    </Button>
                  </div>
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

      {/* Notification removed */}

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Item</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Model</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Unique Code</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Cost</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Sale</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Unit</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
              const safeCurrentPage = Math.min(currentPage, totalPages || 1);
              return filteredInventory.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);
            })().map((item) => {
              const typeLabel = item.productType === "non-stock" ? "Non-Stock" : item.productType === "bundle" ? "Bundle" : "Stock";
              const typeVariant = item.productType === "non-stock" ? "outline" : item.productType === "bundle" ? "secondary" : "default";
              return (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 font-medium">{item.name}</td>
                  <td className="px-3 py-3"><Badge variant={typeVariant} className="text-xs">{typeLabel}</Badge></td>
                  <td className="px-3 py-3 text-muted-foreground">{item.sku}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.model || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.uniqueCode || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.category}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.date || "—"}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.costPrice || 0)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.salePrice || 0)}</td>
                  <td className="px-3 py-3 text-center">{item.unit || "pcs"}</td>
                  <td className="px-3 py-3 text-right">{item.productType === "non-stock" ? "∞" : item.qty}</td>
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
                      <ConfirmDeleteDialog onConfirm={() => handleDelete(item.id)} title="Delete Product?" description={`Are you sure you want to delete "${item.name}"? It will be moved to trash.`} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredInventory.length === 0 && <tr><td colSpan={14} className="text-center py-8 text-muted-foreground">{inventory.length === 0 ? "No inventory items." : "No items match your filters."}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredInventory.length > ITEMS_PER_PAGE && (() => {
        const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
        return (
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredInventory.length)} of {filteredInventory.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <Button key={i+1} variant={currentPage === i+1 ? "default" : "outline"} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(i+1)}>{i+1}</Button>
              ))}
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        );
      })()}

      {/* Stock Adjustment Section */}
      <StockAdjustmentSection inventory={inventory} onUpdateInventory={handleUpdateInventory} />

      {/* Store Inventory Section */}
      <StoreInventorySection inventory={inventory} />
    </div>
  );
}
