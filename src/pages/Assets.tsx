import { useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building, Package, X, Save } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";

export type CompanyAsset = {
  id: string;
  name: string;
  category: string;
  value: number;
  purchaseDate: string;
  purchaseFrom: string;
  description: string;
  condition: "new" | "good" | "fair" | "poor";
  serialNumber?: string;
  nominalAccount?: string;
};

const categories = [
  "Furniture", "Electronics", "Vehicles", "Machinery", "Office Equipment",
  "Solar Panels", "Inverters", "Tools", "Land & Building", "Other"
];
const nominalAccounts = [
  "1500 - Fixed Assets", "1510 - Furniture & Fixtures", "1520 - Office Equipment",
  "1530 - Vehicles", "1540 - Machinery & Equipment", "1550 - Land & Buildings",
  "1560 - Solar Equipment", "1590 - Other Fixed Assets",
  "1600 - Accumulated Depreciation", "6500 - Depreciation Expense",
];

const defaultAsset: Omit<CompanyAsset, "id"> = {
  name: "", category: "Other", value: 0, purchaseDate: new Date().toISOString().slice(0, 10),
  purchaseFrom: "", description: "", condition: "new", serialNumber: "", nominalAccount: ""
};

export default function Assets() {
  const { settings } = useSettings();
  const [assets, setAssets] = useLocalStorage<CompanyAsset[]>("cb-company-assets", []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CompanyAsset, "id">>(defaultAsset);
  const [search, setSearch] = useState("");

  const fmt = (n: number) =>
    new Intl.NumberFormat(settings.currencyLocale, { style: "currency", currency: settings.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

  const totalValue = assets.reduce((sum, a) => sum + a.value, 0);

  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase()) ||
    a.purchaseFrom.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setForm({ ...defaultAsset, purchaseDate: new Date().toISOString().slice(0, 10) });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (asset: CompanyAsset) => {
    const { id, ...rest } = asset;
    setForm(rest);
    setEditId(id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Asset name is required"); return; }
    if (form.value <= 0) { toast.error("Value must be greater than 0"); return; }

    if (editId) {
      setAssets(assets.map(a => a.id === editId ? { ...form, id: editId } : a));
      toast.success("Asset updated");
    } else {
      setAssets([...assets, { ...form, id: crypto.randomUUID() }]);
      toast.success("Asset added");
    }
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
    toast.success("Asset deleted");
  };

  const conditionColor = (c: string) => {
    switch (c) {
      case "new": return "default";
      case "good": return "secondary";
      case "fair": return "outline";
      case "poor": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Assets</h1>
          <p className="text-sm text-muted-foreground">Track and manage all company assets</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Add Asset</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Assets</p>
          <p className="text-2xl font-bold">{assets.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold text-primary">{fmt(totalValue)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold">{new Set(assets.map(a => a.category)).size}</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">{editId ? "Edit Asset" : "Add New Asset"}</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Asset Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. Office Desk" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value *</Label>
              <Input type="number" min={0} value={form.value || ""} onChange={e => setForm({ ...form, value: Number(e.target.value) })} className="mt-1" placeholder="0" />
            </div>
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Purchased From</Label>
              <Input value={form.purchaseFrom} onChange={e => setForm({ ...form, purchaseFrom: e.target.value })} className="mt-1" placeholder="Vendor / Supplier" />
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v as CompanyAsset["condition"] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Serial Number</Label>
              <Input value={form.serialNumber || ""} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className="mt-1" placeholder="Optional" />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" placeholder="Brief description" />
            </div>
            <div className="md:col-span-3">
              <Label>Nominal Account</Label>
              <Select value={form.nominalAccount || ""} onValueChange={v => setForm({ ...form, nominalAccount: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select nominal account (optional)" /></SelectTrigger>
                <SelectContent>
                  {nominalAccounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> {editId ? "Update" : "Save"}</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <Input placeholder="Search assets by name, category, or vendor..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <Building className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{assets.length === 0 ? "No assets added yet" : "No matching assets found"}</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Value</th>
                  <th className="text-left px-4 py-3 font-medium">Purchase Date</th>
                  <th className="text-left px-4 py-3 font-medium">From</th>
                  <th className="text-left px-4 py-3 font-medium">Nominal Account</th>
                  <th className="text-left px-4 py-3 font-medium">Condition</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                   <tr key={a.id} className="border-t hover:bg-muted/30">
                     <td className="px-4 py-3 font-medium">{a.name}</td>
                     <td className="px-4 py-3"><Badge variant="outline">{a.category}</Badge></td>
                     <td className="px-4 py-3 text-right font-semibold">{fmt(a.value)}</td>
                     <td className="px-4 py-3">{a.purchaseDate}</td>
                     <td className="px-4 py-3">{a.purchaseFrom || "—"}</td>
                     <td className="px-4 py-3 text-xs text-muted-foreground">{a.nominalAccount || "—"}</td>
                     <td className="px-4 py-3"><Badge variant={conditionColor(a.condition) as any} className="capitalize">{a.condition}</Badge></td>
                     <td className="px-4 py-3 text-right">
                       <div className="flex justify-end gap-1">
                         <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                         <ConfirmDeleteDialog onConfirm={() => handleDelete(a.id)} title="Delete Asset?" description={`Delete asset "${a.name}"?`}>
                           <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                         </ConfirmDeleteDialog>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
               <tfoot>
                 <tr className="border-t bg-muted/30">
                   <td className="px-4 py-3 font-semibold" colSpan={2}>Total</td>
                   <td className="px-4 py-3 text-right font-bold text-primary">{fmt(totalValue)}</td>
                   <td colSpan={5}></td>
                 </tr>
               </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
