import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Check, Edit3, Loader2, Plus, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";

type Company = {
  id: string;
  name: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  notes: string | null;
};

type CompanyStats = { users: number; records: number };
type CompanyForm = Omit<Company, "id"> & { adminName: string; adminEmail: string; adminPassword: string };

const emptyCompany: CompanyForm = {
  name: "", contact_email: "", phone: "", address: "", plan: "standard", status: "active",
  starts_at: new Date().toISOString().slice(0, 10), expires_at: "", notes: "",
  adminName: "", adminEmail: "", adminPassword: "",
};

const trackedTables = ["customers", "suppliers", "inventory", "invoices", "sales_orders", "quotations", "expenses", "purchase_orders", "bills", "accounts"] as const;

export default function PlatformAdmin() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyCompany);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const nextCompanies = (data || []) as Company[];
    setCompanies(nextCompanies);
    const nextStats: Record<string, CompanyStats> = {};
    await Promise.all(nextCompanies.map(async (company) => {
      const [{ count: users }, ...counts] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", company.id),
        ...trackedTables.map((table) => supabase.from(table).select("id", { count: "exact", head: true }).eq("company_id", company.id)),
      ]);
      nextStats[company.id] = { users: users || 0, records: counts.reduce((sum, result) => sum + (result.count || 0), 0) };
    }));
    setStats(nextStats);
    setLoading(false);
  }, []);

  useEffect(() => { if (isSuperAdmin) void load(); else setLoading(false); }, [isSuperAdmin, load]);
  const openCreate = () => { setEditing(null); setForm({ ...emptyCompany, starts_at: new Date().toISOString().slice(0, 10) }); setFormOpen(true); };
  const openEdit = (company: Company) => {
    setEditing(company);
    setForm({ name: company.name, contact_email: company.contact_email || "", phone: company.phone || "", address: company.address || "", plan: company.plan, status: company.status, starts_at: company.starts_at, expires_at: company.expires_at || "", notes: company.notes || "", adminName: "", adminEmail: "", adminPassword: "" });
    setFormOpen(true);
  };
  const saveCompany = async () => {
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    if (!editing && (!form.adminName.trim() || !form.adminEmail.trim() || form.adminPassword.length < 6)) { toast.error("Enter the first admin details; password must be at least 6 characters"); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), contact_email: form.contact_email || null, phone: form.phone || null, address: form.address || null, plan: form.plan, status: form.status, starts_at: form.starts_at, expires_at: form.expires_at || null, notes: form.notes || null };
    const result = editing
      ? await supabase.from("companies").update(payload).eq("id", editing.id)
      : await supabase.functions.invoke("create-user", { body: { action: "create-company", company: payload, admin: { fullName: form.adminName.trim(), email: form.adminEmail.trim(), password: form.adminPassword } } });
    if (result.error) toast.error(result.error.message);
    else { toast.success(editing ? "Company updated" : "Company and admin created"); setFormOpen(false); await load(); }
    setSaving(false);
  };

  const activeCount = useMemo(() => companies.filter((company) => company.status === "active").length, [companies]);
  if (authLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isSuperAdmin) return <div className="flex min-h-[60vh] items-center justify-center"><Card><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">This workspace is available to the platform administrator.</p></CardContent></Card></div>;

  return <div className="space-y-6 p-1">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-medium text-primary">Platform control</p><h1 className="text-3xl font-semibold tracking-tight">Companies</h1><p className="mt-1 text-sm text-muted-foreground">Manage customer workspaces, plans, access, and usage.</p></div><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add company</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-4 p-5"><Building2 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-semibold">{companies.length}</p><p className="text-xs text-muted-foreground">Total companies</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-4 p-5"><Check className="h-8 w-8 text-primary" /><div><p className="text-2xl font-semibold">{activeCount}</p><p className="text-xs text-muted-foreground">Active workspaces</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-4 p-5"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-semibold">{Object.values(stats).reduce((sum, item) => sum + item.users, 0)}</p><p className="text-xs text-muted-foreground">Team members</p></div></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="text-lg">Workspace directory</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Expiry</TableHead><TableHead>Usage</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{companies.map((company) => { const companyStats = stats[company.id] || { users: 0, records: 0 }; const expired = company.expires_at && new Date(company.expires_at) < new Date(); return <TableRow key={company.id}><TableCell><div className="font-medium">{company.name}</div><div className="text-xs text-muted-foreground">{company.contact_email || "No email"}</div></TableCell><TableCell><Badge variant="outline" className="capitalize">{company.plan}</Badge></TableCell><TableCell><Badge variant={company.status === "active" ? "default" : "secondary"} className="capitalize">{company.status}</Badge></TableCell><TableCell><span className={expired ? "text-destructive" : "text-muted-foreground"}>{company.expires_at || "No expiry"}</span></TableCell><TableCell><div className="text-sm">{companyStats.users} users</div><div className="text-xs text-muted-foreground">{companyStats.records} records</div></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(company)} aria-label={`Edit ${company.name}`}><Edit3 className="h-4 w-4" /></Button></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>
    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Edit company" : "Create company workspace"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Company name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Company name" /></div><div className="space-y-2"><Label>Contact email</Label><Input type="email" value={form.contact_email || ""} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div><div className="space-y-2"><Label>Plan</Label><Select value={form.plan} onValueChange={(value) => setForm({ ...form, plan: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="professional">Professional</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem><SelectItem value="owner">Owner</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></div><div className="space-y-2"><Label>Expiry date</Label><Input type="date" value={form.expires_at || ""} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>{!editing && <><div className="sm:col-span-2 border-t pt-4"><p className="text-sm font-medium">First company admin</p><p className="text-xs text-muted-foreground">This account will manage the new company’s team.</p></div><div className="space-y-2"><Label>Admin name</Label><Input value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} /></div><div className="space-y-2"><Label>Admin email</Label><Input type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>Temporary password</Label><Input type="password" value={form.adminPassword} onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} /></div></>}<div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Input value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button><Button onClick={saveCompany} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Create company"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
