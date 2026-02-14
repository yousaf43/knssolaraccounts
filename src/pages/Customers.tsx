import { useState } from "react";
import { getInitialCustomers, type Customer } from "@/data/mockData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Mail, Phone, Edit, Trash2, X } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

const emptyCustomer = (): Partial<Customer> => ({ name: "", email: "", phone: "", company: "", totalBilled: 0, outstanding: 0 });

export default function Customers() {
  const [customers, setCustomers] = useLocalStorage<Customer[]>("cb-customers", getInitialCustomers());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(emptyCustomer());

  const openAdd = () => { setEditing(null); setForm(emptyCustomer()); setShowForm(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm(c); setShowForm(true); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.email?.trim() || !form.company?.trim()) return;
    if (editing) {
      setCustomers((prev) => prev.map((c) => c.id === editing.id ? { ...c, ...form } as Customer : c));
      toast.success("Customer updated");
    } else {
      setCustomers((prev) => [...prev, { ...form, id: crypto.randomUUID(), totalBilled: 0, outstanding: 0 } as Customer]);
      toast.success("Customer added");
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    toast.success("Customer deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer contacts</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? "Edit Customer" : "Add Customer"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} required /></div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div key={c.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {c.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.company}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="p-1 rounded hover:bg-muted" onClick={() => openEdit(c)}><Edit className="w-3.5 h-3.5 text-muted-foreground" /></button>
                <button className="p-1 rounded hover:bg-destructive/10" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" /><span className="truncate">{c.email}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" /><span>{c.phone}</span></div>
            </div>
            <div className="flex justify-between mt-4 pt-4 border-t text-sm">
              <div><p className="text-muted-foreground">Total Billed</p><p className="font-semibold">{formatCurrency(c.totalBilled)}</p></div>
              <div className="text-right"><p className="text-muted-foreground">Outstanding</p><p className={`font-semibold ${c.outstanding > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(c.outstanding)}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
