import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Droplets, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSettings } from "@/contexts/SettingsContext";
import { useSolarWashingCloud } from "@/hooks/useAppData";
import type { SolarWashing } from "@/hooks/useAppData";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "@/hooks/use-toast";
import { matchesQuery } from "@/lib/search";

const emptyRecord: SolarWashing = {
  id: "", date: new Date().toISOString().slice(0, 10), customer: "", amount: 0, notes: "",
  type: "washing", address: "", phone: "", issue: "", panels: 0,
};

export default function SolarWashingPage() {
  const { formatCurrency, formatDate } = useSettings();
  const { data: records, upsert, remove } = useSolarWashingCloud();
  const { log } = useActivityLog();

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SolarWashing>(emptyRecord);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "washing" | "complaint">("all");

  const filtered = useMemo(() => {
    let list = [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (typeFilter !== "all") list = list.filter(r => r.type === typeFilter);
    if (search) list = list.filter(r => matchesQuery(search, r.customer, r.phone, r.address, r.issue, r.notes));
    if (monthFilter) list = list.filter(r => r.date.startsWith(monthFilter));
    return list;
  }, [records, search, monthFilter, typeFilter]);

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
  const totalWashings = records.filter(r => r.type === "washing").length;
  const totalComplaints = records.filter(r => r.type === "complaint").length;

  const startNew = () => { setTypeDialogOpen(true); };
  const chooseType = (type: "washing" | "complaint") => {
    setForm({ ...emptyRecord, id: crypto.randomUUID(), type });
    setEditing(false);
    setTypeDialogOpen(false);
    setDialogOpen(true);
  };
  const openEdit = (r: SolarWashing) => { setForm({ ...r }); setEditing(true); setDialogOpen(true); };

  const isComplaint = form.type === "complaint";

  const handleSave = async () => {
    if (!form.customer || !form.date || form.amount <= 0) {
      toast({ title: "Please fill customer, date and amount", variant: "destructive" });
      return;
    }
    if (isComplaint && !form.issue.trim()) {
      toast({ title: "Please describe the complaint issue", variant: "destructive" });
      return;
    }
    if (!isComplaint && form.panels <= 0) {
      toast({ title: "Please enter how many panels were washed", variant: "destructive" });
      return;
    }
    await upsert(form);
    log(editing ? "updated" : "created", "solar_washing", form.id, form.customer);
    toast({ title: editing ? "Record updated" : "Record added" });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplets className="w-6 h-6 text-primary" /> Solar Washing &amp; Complaints
          </h1>
          <p className="text-sm text-muted-foreground">Track washing services, complaints and earnings</p>
        </div>
        <Button onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Add Entry</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Washings</p>
          <p className="text-xl font-bold text-primary">{totalWashings}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Complaints</p>
          <p className="text-xl font-bold text-primary">{totalComplaints}</p>
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
                <th className="text-center py-2 text-muted-foreground font-medium">Entries</th>
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
        <Input placeholder="Search customer, phone, issue..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="washing">Solar Panel Washing</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
          </SelectContent>
        </Select>
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="max-w-xs" />
        {monthFilter && <Button variant="ghost" size="sm" onClick={() => setMonthFilter("")}>Clear</Button>}
      </div>

      {/* Records Table */}
      <div className="bg-card border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Customer</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">Address</th>
              <th className="text-left p-3 font-medium">Panels / Issue</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Notes</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No records found</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-3">{formatDate(r.date)}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.type === "complaint" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                    {r.type === "complaint" ? <Wrench className="w-3 h-3" /> : <Droplets className="w-3 h-3" />}
                    {r.type === "complaint" ? "Complaint" : "Washing"}
                  </span>
                </td>
                <td className="p-3 font-medium">{r.customer}</td>
                <td className="p-3 text-muted-foreground">{r.phone || "—"}</td>
                <td className="p-3 text-muted-foreground">{r.address || "—"}</td>
                <td className="p-3 text-muted-foreground">{r.type === "complaint" ? (r.issue || "—") : `${r.panels || 0} panels`}</td>
                <td className="p-3 text-right">{formatCurrency(r.amount)}</td>
                <td className="p-3 text-muted-foreground">{r.notes}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          await remove(r.id);
                          log("deleted", "solar_washing", r.id, r.customer);
                          toast({ title: "Record deleted" });
                        }}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Type chooser */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>What do you want to record?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => chooseType("washing")} className="rounded-xl border p-5 text-left transition-colors hover:bg-muted/50">
              <Droplets className="w-6 h-6 text-primary mb-2" />
              <p className="font-semibold">Solar Panels Washing</p>
              <p className="text-xs text-muted-foreground">Panels washed and amount charged</p>
            </button>
            <button onClick={() => chooseType("complaint")} className="rounded-xl border p-5 text-left transition-colors hover:bg-muted/50">
              <Wrench className="w-6 h-6 text-primary mb-2" />
              <p className="font-semibold">Complaint</p>
              <p className="text-xs text-muted-foreground">Issue reported and amount charged</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} {isComplaint ? "Complaint" : "Washing"} Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as SolarWashing["type"] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="washing">Solar Panels Washing</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Customer name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="03xx-xxxxxxx" />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Customer address" />
              </div>
            </div>

            {isComplaint ? (
              <div>
                <Label>What is the issue? *</Label>
                <Textarea value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })} placeholder="Describe the complaint / fault" rows={3} />
              </div>
            ) : (
              <div>
                <Label>How many panels washed? *</Label>
                <Input type="number" min={0} value={form.panels || ""} onChange={e => setForm({ ...form, panels: Number(e.target.value) })} placeholder="0" />
              </div>
            )}

            <div>
              <Label>Amount *</Label>
              <Input type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Update" : "Save"} Record</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
