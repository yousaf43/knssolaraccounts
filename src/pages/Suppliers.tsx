import { useState } from "react";
import type { Supplier } from "@/data/mockData";
import { useSuppliersCloud } from "@/hooks/useAppData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, X, Loader2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";

const empty = (): Partial<Supplier> => ({ name: "", email: "", phone: "", company: "", totalPaid: 0, outstanding: 0 });

export default function Suppliers() {
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { moveToTrash } = useTrash();
  const { data: suppliers, loading, upsert, remove } = useSuppliersCloud();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(empty());

  const openAdd = () => { setEditing(null); setForm(empty()); setShowForm(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm(s); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.email?.trim() || !form.company?.trim()) return;
    const supplier: Supplier = {
      ...empty(),
      ...form,
      id: editing?.id || crypto.randomUUID(),
      totalPaid: form.totalPaid || 0,
      outstanding: form.outstanding || 0,
    } as Supplier;
    await upsert(supplier);
    await log(editing ? "edit" : "create", "supplier", supplier.id, supplier.name, `Company: ${supplier.company}`);
    toast.success(editing ? "Supplier updated" : "Supplier added");
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const s = suppliers.find(su => su.id === id);
    if (s) {
      await moveToTrash("supplier", id, s);
      await log("delete", "supplier", id, s.name, `Company: ${s.company}`);
    }
    await remove(id);
    toast.success("Supplier deleted");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

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
                    <ConfirmDeleteDialog onConfirm={() => handleDelete(s.id)} title="Delete Supplier?" description={`Are you sure you want to delete "${s.name}"? It will be moved to trash.`} />
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
