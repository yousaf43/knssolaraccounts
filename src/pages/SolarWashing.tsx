import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useSettings } from "@/contexts/SettingsContext";
import { useSolarWashingCloud } from "@/hooks/useAppData";
import type { SolarWashing } from "@/hooks/useAppData";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "@/hooks/use-toast";

const emptyRecord: SolarWashing = { id: "", date: new Date().toISOString().slice(0, 10), customer: "", amount: 0, notes: "" };

export default function SolarWashingPage() {
  const { formatCurrency } = useSettings();
  const { data: records, upsert, remove } = useSolarWashingCloud();
  const { log } = useActivityLog();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SolarWashing>(emptyRecord);
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const filtered = useMemo(() => {
    let list = [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (search) list = list.filter(r => r.customer.toLowerCase().includes(search.toLowerCase()));
    if (monthFilter) list = list.filter(r => r.date.startsWith(monthFilter));
    return list;
  }, [records, search, monthFilter]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    records.forEach(r => {
      const month = r.date.slice(0, 7);
      if (!map[month]) map[month] = { count: 0, total: 0 };
      map[month].count++;
      map[month].total += r.amount;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([month, d]) => ({ month, ...d }));
  }, [records]);

  const totalEarnings = records.reduce((s, r) => s + r.amount, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEarnings = records.filter(r => r.date.startsWith(thisMonth)).reduce((s, r) => s + r.amount, 0);
  const totalWashings = records.length;

  const openAdd = () => { setForm({ ...emptyRecord, id: crypto.randomUUID() }); setEditing(false); setDialogOpen(true); };
  const openEdit = (r: SolarWashing) => { setForm({ ...r }); setEditing(true); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.customer || !form.date || form.amount <= 0) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    await upsert(form);
    logActivity(editing ? "updated" : "created", "solar_washing", form.id, form.customer);
    toast({ title: editing ? "Record updated" : "Record added" });
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const rec = records.find(r => r.id === deleteId);
    await remove(deleteId);
    logActivity("deleted", "solar_washing", deleteId, rec?.customer || "");
    toast({ title: "Record deleted" });
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplets className="w-6 h-6 text-primary" /> Solar Panel Washing
          </h1>
          <p className="text-sm text-muted-foreground">Track washing services and earnings</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Record</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Washings</p>
          <p className="text-xl font-bold text-primary">{totalWashings}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">This Month Earnings</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(thisMonthEarnings)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Earnings</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalEarnings)}</p>
        </div>
      </div>

      {/* Monthly Summary */}
      {monthlySummary.length > 0 && (
        <div className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">Monthly Summary</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-muted-foreground font-medium">Month</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Washings</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map(m => (
                <tr key={m.month} className="border-b border-border/50">
                  <td className="py-2">{m.month}</td>
                  <td className="py-2 text-center">{m.count}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="max-w-xs" />
        {monthFilter && <Button variant="ghost" size="sm" onClick={() => setMonthFilter("")}>Clear</Button>}
      </div>

      {/* Records Table */}
      <div className="bg-card border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Customer</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Notes</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No washing records found</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-3">{r.date}</td>
                <td className="p-3 font-medium">{r.customer}</td>
                <td className="p-3 text-right">{formatCurrency(r.amount)}</td>
                <td className="p-3 text-muted-foreground">{r.notes}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Washing Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Customer *</Label>
              <Input value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Customer name" />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Update" : "Add"} Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Washing Record"
        description="Are you sure? This action cannot be undone."
      />
    </div>
  );
}
