import { useState } from "react";
import { getInitialSuppliers, type Supplier } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, X } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const empty = (): Partial<Supplier> => ({ name: "", email: "", phone: "", company: "", totalPaid: 0, outstanding: 0 });

export default function Suppliers() {
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>("cb-suppliers", getInitialSuppliers());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(empty());

  const openAdd = () => { setEditing(null); setForm(empty()); setShowForm(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm(s); setShowForm(true); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.email?.trim() || !form.company?.trim()) return;
    if (editing) {
      setSuppliers((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...form } as Supplier : s));
      toast.success("Supplier updated");
    } else {
      setSuppliers((prev) => [...prev, { ...form, id: crypto.randomUUID(), totalPaid: 0, outstanding: 0 } as Supplier]);
      toast.success("Supplier added");
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    toast.success("Supplier deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage your supplier contacts</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Supplier
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? "Edit Supplier" : "Add Supplier"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Contact Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} required /></div>
            <div><Label>Company *</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1" maxLength={100} required /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" maxLength={255} required /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" maxLength={20} /></div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Add"}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Paid</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.company}</td>
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(s.totalPaid)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${s.outstanding > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(s.outstanding)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(s)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
