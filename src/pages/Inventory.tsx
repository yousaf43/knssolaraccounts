import { useState } from "react";
import { getInitialInventory, type InventoryItem } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AlertTriangle, Plus, Edit, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const emptyItem = (): Partial<InventoryItem> => ({ name: "", sku: "", qty: 0, reorderLevel: 5, price: 0, category: "" });

export default function Inventory() {
  const [inventory, setInventory] = useLocalStorage<InventoryItem[]>("cb-inventory", getInitialInventory());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(emptyItem());

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

      {showForm && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? "Edit Item" : "Add Item"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Item Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} required /></div>
            <div><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" maxLength={20} required /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" maxLength={50} /></div>
            <div><Label>Quantity</Label><Input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="mt-1" /></div>
            <div><Label>Reorder Level</Label><Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="mt-1" /></div>
            <div><Label>Price</Label><Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-1" /></div>
            <div className="md:col-span-3 flex gap-3 justify-end">
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

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.sku}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3 text-center">
                  {item.qty <= item.reorderLevel ? (
                    <Badge className="bg-destructive/10 text-destructive border-0">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success border-0">In Stock</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(item)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {inventory.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No inventory items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
