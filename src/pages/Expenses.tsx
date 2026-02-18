import { useState } from "react";
import { type Expense } from "@/data/mockData";
import { useExpensesCloud } from "@/hooks/useAppData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";

const categories = ["Software", "Office", "Marketing", "Utilities", "Travel", "Payroll", "Insurance", "Other"];
const paymentMethods = ["Credit Card", "Bank Transfer", "Auto-debit", "Cash", "Check"];

const categoryColors: Record<string, string> = {
  Software: "bg-primary/10 text-primary",
  Office: "bg-accent/10 text-accent",
  Marketing: "bg-warning/10 text-warning",
  Utilities: "bg-muted text-muted-foreground",
  Travel: "bg-success/10 text-success",
  Payroll: "bg-destructive/10 text-destructive",
  Insurance: "bg-secondary text-secondary-foreground",
};

const emptyExpense = (): Partial<Expense> => ({ date: new Date().toISOString().split("T")[0], category: "Other", description: "", amount: 0, paymentMethod: "Bank Transfer" });

export default function Expenses() {
  const { formatCurrency } = useSettings();
  const { data: expenses, upsert: upsertExpense, remove: removeExpense } = useExpensesCloud();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyExpense());

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const openAdd = () => { setEditing(null); setForm(emptyExpense()); setShowForm(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm(e); setShowForm(true); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description?.trim() || !form.amount || !form.date) return;
    if (editing) {
      upsertExpense({ ...editing, ...form } as Expense);
      toast.success("Expense updated");
    } else {
      upsertExpense({ ...form, id: crypto.randomUUID() } as Expense);
      toast.success("Expense added");
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    removeExpense(id);
    toast.success("Expense deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track and manage business expenses</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Expense
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? "Edit Expense" : "Add Expense"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" required /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" maxLength={200} required /></div>
            <div><Label>Amount *</Label><Input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="mt-1" required /></div>
            <div className="md:col-span-3 flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Add"}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="kpi-card">
        <p className="text-sm text-muted-foreground">Total Expenses (This Period)</p>
        <p className="text-2xl font-bold">{formatCurrency(total)}</p>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                <td className="px-4 py-3"><Badge className={`${categoryColors[e.category] || "bg-muted text-muted-foreground"} border-0`}>{e.category}</Badge></td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(e.amount)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(e)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button className="p-1.5 rounded hover:bg-destructive/10" onClick={() => handleDelete(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
