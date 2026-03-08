import { useState, useMemo } from "react";
import { type Expense } from "@/data/mockData";
import { useExpensesCloud } from "@/hooks/useAppData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, X, Wallet, TrendingDown, PiggyBank } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { defaultAccounts, type Account } from "@/data/defaultAccounts";

const categories = ["Software", "Office", "Marketing", "Utilities", "Travel", "Payroll", "Insurance", "Other"];
const paymentMethods = ["Credit Card", "Bank Transfer", "Auto-debit", "Cash", "Check"];
const nominalAccounts = [
  "4000 - Sales Revenue", "4100 - Service Revenue", "4200 - Other Income",
  "5000 - Cost of Goods Sold", "5100 - Purchase Returns",
  "6000 - Salaries & Wages", "6100 - Rent Expense", "6200 - Utilities Expense",
  "6300 - Marketing & Advertising", "6400 - Insurance Expense", "6500 - Depreciation",
  "6600 - Office Supplies", "6700 - Travel & Entertainment", "6800 - Professional Fees",
  "6900 - Bank Charges", "7000 - Other Expenses",
];

const categoryColors: Record<string, string> = {
  Software: "bg-primary/10 text-primary",
  Office: "bg-accent/10 text-accent",
  Marketing: "bg-warning/10 text-warning",
  Utilities: "bg-muted text-muted-foreground",
  Travel: "bg-success/10 text-success",
  Payroll: "bg-destructive/10 text-destructive",
  Insurance: "bg-secondary text-secondary-foreground",
};

const emptyExpense = (): Partial<Expense> => ({ date: new Date().toISOString().split("T")[0], category: "Other", description: "", amount: 0, paymentMethod: "Bank Transfer", nominalAccount: "" });

export default function Expenses() {
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { moveToTrash } = useTrash();
  const { data: expenses, upsert: upsertExpense, remove: removeExpense } = useExpensesCloud();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyExpense());

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const openAdd = () => { setEditing(null); setForm(emptyExpense()); setShowForm(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm(e); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description?.trim() || !form.amount || !form.date) return;
    if (editing) {
      await upsertExpense({ ...editing, ...form } as Expense);
      await log("edit", "expense", editing.id, editing.description, `Amount: ${form.amount}`);
      toast.success("Expense updated");
    } else {
      const id = crypto.randomUUID();
      await upsertExpense({ ...form, id } as Expense);
      await log("create", "expense", id, form.description || "", `Amount: ${form.amount}`);
      toast.success("Expense added");
    }
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const exp = expenses.find(e => e.id === id);
    if (exp) {
      await moveToTrash("expense", id, exp);
      await log("delete", "expense", id, exp.description, `Amount: ${exp.amount}`);
    }
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
            <div className="md:col-span-3">
              <Label>Nominal Account</Label>
              <Select value={form.nominalAccount || ""} onValueChange={(v) => setForm({ ...form, nominalAccount: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select nominal account (optional)" /></SelectTrigger>
                <SelectContent>{nominalAccounts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nominal Account</th>
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
                <td className="px-4 py-3 text-muted-foreground text-xs">{e.nominalAccount || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(e.amount)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(e)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <ConfirmDeleteDialog onConfirm={() => handleDelete(e.id)} title="Delete Expense?" description={`Are you sure you want to delete this expense of ${formatCurrency(e.amount)}?`} />
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
