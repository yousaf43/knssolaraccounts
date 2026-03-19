import { useState, useRef } from "react";
import { useSettings, type AppSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building2, Globe, Receipt, Calendar, Save, Upload, Image, Users, Shield, Download, UploadCloud, Database, Cloud, Trash2, RotateCcw, Loader2, UserCircle, Edit, X, Check, FileDown, FileSpreadsheet, FileJson } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import { useUserSettingsCloud } from "@/hooks/useAppData";
import { exportAsJson, exportAsCsvZip } from "@/utils/exportData";

const currencies = [
  { code: "PKR", locale: "en-PK", label: "PKR - Pakistani Rupee (₨)" },
  { code: "USD", locale: "en-US", label: "USD - US Dollar ($)" },
  { code: "EUR", locale: "de-DE", label: "EUR - Euro (€)" },
  { code: "GBP", locale: "en-GB", label: "GBP - British Pound (£)" },
  { code: "AED", locale: "ar-AE", label: "AED - UAE Dirham (د.إ)" },
  { code: "SAR", locale: "ar-SA", label: "SAR - Saudi Riyal (﷼)" },
  { code: "INR", locale: "en-IN", label: "INR - Indian Rupee (₹)" },
  { code: "CNY", locale: "zh-CN", label: "CNY - Chinese Yuan (¥)" },
  { code: "CAD", locale: "en-CA", label: "CAD - Canadian Dollar ($)" },
  { code: "AUD", locale: "en-AU", label: "AUD - Australian Dollar ($)" },
];

const months = [
  { value: "01", label: "January" }, { value: "02", label: "February" }, { value: "03", label: "March" },
  { value: "04", label: "April" }, { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

type UserWithRole = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
};

export default function Settings() {
  const { settings, setSettings } = useSettings();
  const { profile, role, user, refreshProfile } = useAuth();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(settings.logoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const cloudBackup = useCloudBackup();
  const { customCategories, setCustomCategories } = useUserSettingsCloud();

  // New user creation state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("sales");
  const [creatingUser, setCreatingUser] = useState(false);

  // Profile edit state
  const [profileName, setProfileName] = useState(profile?.full_name || "");
  const [profilePhone, setProfilePhone] = useState(profile?.phone || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [profilePassword, setProfilePassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Category edit state
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [editCatValue, setEditCatValue] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSave = async () => {
    let logoUrl = form.logoUrl || "";
    if (logoFile && user) {
      setUploading(true);
      const ext = logoFile.name.split(".").pop();
      const path = `company-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
      if (uploadError) { toast.error("Logo upload failed: " + uploadError.message); setUploading(false); return; }
      const { data: urlData } = await supabase.storage.from("logos").createSignedUrl(path, 60 * 60 * 24 * 365);
      logoUrl = urlData?.signedUrl || "";
      setUploading(false);
    }
    setSettings({ ...form, logoUrl });
    setLogoPreview(logoUrl);
    setLogoFile(null);
    toast.success("Settings saved successfully");
  };

  const update = (key: keyof AppSettings, val: string | number) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleCurrencyChange = (code: string) => {
    const c = currencies.find((c) => c.code === code);
    if (c) setForm((prev) => ({ ...prev, currency: c.code, currencyLocale: c.locale }));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be less than 2MB"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const loadUsers = async () => {
    if (usersLoaded) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (profiles && roles) {
      const merged: UserWithRole[] = profiles.map((p: any) => {
        const r = roles.find((r: any) => r.user_id === p.user_id);
        return { user_id: p.user_id, full_name: p.full_name || "Unknown", email: "", role: r?.role || "sales" };
      });
      setUsers(merged);
    }
    setUsersLoaded(true);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (role !== "admin") { toast.error("Only admins can change roles"); return; }
    const { error } = await supabase.from("user_roles").update({ role: newRole as "admin" | "accountant" | "sales" }).eq("user_id", userId);
    if (error) { toast.error("Failed to update role: " + error.message); }
    else { setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u)); toast.success("Role updated"); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) { toast.error("Cannot delete your own account"); return; }
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "delete", userId }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || "Failed to delete user"); }
      else { setUsers((prev) => prev.filter((u) => u.user_id !== userId)); toast.success("User deleted"); }
    } catch (err: any) { toast.error("Failed: " + err.message); }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) { toast.error("Please fill all required fields"); return; }
    if (newUserPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newUserEmail.trim(), password: newUserPassword, fullName: newUserName.trim(), role: newUserRole }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || "Failed to create user"); }
      else { toast.success("User created successfully!"); setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("sales"); setUsersLoaded(false); loadUsers(); }
    } catch (err: any) { toast.error("Failed to create user: " + err.message); }
    setCreatingUser(false);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      // Update profile name & phone
      if (user) {
        await supabase.from("profiles").update({ full_name: profileName, phone: profilePhone }).eq("user_id", user.id);
      }
      // Update email if changed
      if (profileEmail && profileEmail !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email: profileEmail });
        if (error) { toast.error("Email update failed: " + error.message); setSavingProfile(false); return; }
      }
      // Update password if provided
      if (profilePassword && profilePassword.length >= 6) {
        const { error } = await supabase.auth.updateUser({ password: profilePassword });
        if (error) { toast.error("Password update failed: " + error.message); setSavingProfile(false); return; }
      }
      await refreshProfile();
      setProfilePassword("");
      toast.success("Profile updated!");
    } catch (err: any) { toast.error("Failed: " + err.message); }
    setSavingProfile(false);
  };

  const handleEditCategory = (idx: number) => {
    setEditingCatIdx(idx);
    setEditCatValue(customCategories[idx]);
  };

  const handleSaveCategory = () => {
    if (editingCatIdx === null) return;
    const val = editCatValue.trim();
    if (!val) return;
    setCustomCategories((prev) => prev.map((c, i) => i === editingCatIdx ? val : c));
    setEditingCatIdx(null);
    setEditCatValue("");
    toast.success("Category updated");
  };

  const handleDeleteCategory = (idx: number) => {
    setCustomCategories((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Category deleted");
  };

  // One-click full database export
  const handleFullExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "export" }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || "Export failed"); setExporting(false); return; }
      
      const blob = new Blob([JSON.stringify({ _backupVersion: 2, _exportedAt: new Date().toISOString(), ...result.data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Full backup exported!");
    } catch (err: any) { toast.error("Export failed: " + err.message); }
    setExporting(false);
  };

  // Import full backup from JSON file
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup || typeof backup !== "object") { toast.error("Invalid backup file"); setImporting(false); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setImporting(false); return; }

      // Map backup keys to supabase tables
      const tableMap: Record<string, string> = {
        inventory: "inventory",
        invoices: "invoices",
        customers: "customers",
        suppliers: "suppliers",
        sales_orders: "sales_orders",
        quotations: "quotations",
        receipts: "receipts",
        expenses: "expenses",
        purchase_orders: "purchase_orders",
        bills: "bills",
        purchase_payments: "purchase_payments",
        stock_adjustments: "stock_adjustments",
        accounts: "accounts",
        ledger_entries: "ledger_entries",
        other_payments: "other_payments",
        other_receipts: "other_receipts",
        transfers: "transfers",
        reconcile_entries: "reconcile_entries",
        user_settings: "user_settings",
      };

      let imported = 0;
      for (const [key, tableName] of Object.entries(tableMap)) {
        const rows = backup[key];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        // Ensure user_id is set
        const prepared = rows.map((row: any) => ({ ...row, user_id: session.user.id }));
        const { error } = await supabase.from(tableName as any).upsert(prepared as any, { onConflict: "id" });
        if (!error) imported += prepared.length;
      }

      toast.success(`Backup imported! ${imported} records restored. Reloading...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) { toast.error("Import failed: " + err.message); }
    setImporting(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your business preferences</p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="company" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="currency" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Currency</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs"><Receipt className="w-3.5 h-3.5" /> Tax</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5 text-xs"><Calendar className="w-3.5 h-3.5" /> Fiscal Year</TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5 text-xs"><UserCircle className="w-3.5 h-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5 text-xs"><Database className="w-3.5 h-3.5" /> Backup</TabsTrigger>
          {role === "admin" && (
            <TabsTrigger value="users" className="gap-1.5 text-xs" onClick={loadUsers}><Users className="w-3.5 h-3.5" /> Users</TabsTrigger>
          )}
        </TabsList>

        {/* Company */}
        <TabsContent value="company">
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <h2 className="font-semibold text-lg">Company Information</h2>
            <div className="space-y-3">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted">
                  {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" /> : <Image className="w-8 h-8 text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Company Name</Label><Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} className="mt-1" /></div>
              <div><Label>Email</Label><Input type="email" value={form.companyEmail} onChange={(e) => update("companyEmail", e.target.value)} className="mt-1" /></div>
              <div><Label>Phone</Label><Input value={form.companyPhone} onChange={(e) => update("companyPhone", e.target.value)} className="mt-1" /></div>
              <div><Label>Address</Label><Input value={form.companyAddress} onChange={(e) => update("companyAddress", e.target.value)} className="mt-1" /></div>
            </div>

            {/* Category Management */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-medium text-sm">Custom Categories</h3>
              <p className="text-xs text-muted-foreground">Edit or delete custom categories added to inventory.</p>
              {customCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom categories added yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {customCategories.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {editingCatIdx === idx ? (
                        <>
                          <Input value={editCatValue} onChange={(e) => setEditCatValue(e.target.value)} className="h-8 flex-1" autoFocus onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()} />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveCategory}><Check className="w-3.5 h-3.5 text-primary" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCatIdx(null)}><X className="w-3.5 h-3.5" /></Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm flex-1">{cat}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditCategory(idx)}><Edit className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteCategory(idx)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Currency */}
        <TabsContent value="currency">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-lg">Currency Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Default Currency</Label>
                <Select value={form.currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preview</Label>
                <div className="mt-1 bg-muted rounded-md p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Sample amounts:</p>
                  {[1000, 50000, 1250000].map((amt) => (
                    <p key={amt} className="font-semibold">
                      {new Intl.NumberFormat(form.currencyLocale, { style: "currency", currency: form.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amt)}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tax */}
        <TabsContent value="tax">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-lg">Tax Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Tax Label</Label><Input value={form.taxLabel} onChange={(e) => update("taxLabel", e.target.value)} placeholder="GST / VAT / Sales Tax" className="mt-1" /></div>
              <div><Label>Default Tax Rate (%)</Label><Input type="number" min={0} max={100} step={0.5} value={form.taxRate} onChange={(e) => update("taxRate", Number(e.target.value))} className="mt-1" /></div>
            </div>
          </div>
        </TabsContent>

        {/* Fiscal Year */}
        <TabsContent value="fiscal">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-lg">Fiscal Year</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Fiscal Year Starts In</Label>
                <Select value={form.fiscalYearStart} onValueChange={(v) => update("fiscalYearStart", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Format</Label>
                <Select value={form.dateFormat} onValueChange={(v) => update("dateFormat", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile">
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">My Profile</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Full Name</Label><Input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-1" /></div>
              <div><Label>Phone</Label><Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="mt-1" /></div>
              <div><Label>Email</Label><Input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="mt-1" /></div>
              <div><Label>New Password (leave blank to keep current)</Label><Input type="password" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{role}</Badge>
              <span className="text-xs text-muted-foreground">Your current role</span>
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-1.5">
              {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Profile
            </Button>
          </div>
        </TabsContent>

        {/* Backup & Restore */}
        <TabsContent value="backup">
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Backup & Restore</h2>
            </div>

            {/* One-Click Full Export & Import */}
            <div className="border rounded-lg p-4 space-y-3 bg-primary/5">
              <h3 className="font-medium flex items-center gap-2"><Download className="w-4 h-4" /> One-Click Full Backup</h3>
              <p className="text-sm text-muted-foreground">Download or restore complete backup of all data: Products, Invoices, Customers, Suppliers, Sales Orders, Quotations, Receipts, Expenses, Purchase Orders, Bills, and Payments.</p>
              <div className="flex gap-2">
                <Button size="sm" className="gap-2" disabled={exporting} onClick={handleFullExport}>
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export Full Backup
                </Button>
                <Button size="sm" variant="outline" className="gap-2" disabled={importing} onClick={() => importFileRef.current?.click()}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  Import Full Backup
                </Button>
                <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
              </div>
            </div>

            {/* Auto Cloud Backup */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2"><Cloud className="w-4 h-4" /> Auto Cloud Backup</h3>
              <p className="text-sm text-muted-foreground">Automatically save your data to the cloud every 5 minutes. Max 10 backups are kept.</p>
              <div className="flex items-center gap-3">
                <Switch checked={cloudBackup.autoBackup} onCheckedChange={cloudBackup.setAutoBackup} />
                <span className="text-sm">{cloudBackup.autoBackup ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" disabled={cloudBackup.saving} onClick={() => { cloudBackup.saveToCloud("manual"); toast.success("Backup saved to cloud"); }}>
                  {cloudBackup.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                  Save to Cloud Now
                </Button>
              </div>
            </div>

            {/* Cloud Backups List */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Cloud Backups</h3>
              {cloudBackup.loading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
              ) : cloudBackup.backups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No cloud backups yet</p>
              ) : (
                <div className="space-y-2">
                  {cloudBackup.backups.map((b) => (
                    <div key={b.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div>
                        <span className="text-sm font-medium">{new Date(b.created_at).toLocaleString()}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">{b.label}</Badge>
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" disabled={cloudBackup.restoring} onClick={async () => {
                          const ok = await cloudBackup.restoreFromCloud(b.id);
                          if (ok) { toast.success("Restored! Reloading..."); setTimeout(() => window.location.reload(), 1000); }
                          else toast.error("Restore failed");
                        }}>
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-destructive hover:text-destructive" onClick={() => { cloudBackup.deleteBackup(b.id); toast.success("Backup deleted"); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Users & Roles - Admin only */}
        {role === "admin" && (
          <TabsContent value="users">
            <div className="bg-card border rounded-lg p-6 space-y-6">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Users & Roles Management</h2>
              </div>

              {/* Add New User Form */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm">Add New User</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Full Name *</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Full name" className="mt-1 h-9" /></div>
                  <div><Label className="text-xs">Email *</Label><Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@example.com" className="mt-1 h-9" /></div>
                  <div><Label className="text-xs">Password *</Label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1 h-9" minLength={6} /></div>
                  <div>
                    <Label className="text-xs">Role *</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" disabled={creatingUser} onClick={handleCreateUser} className="gap-1.5">
                  {creatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  Create User
                </Button>
              </div>

              {/* Existing Users */}
              <p className="text-sm text-muted-foreground">Existing users and their roles:</p>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No users found</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium">Name</th>
                        <th className="text-left px-4 py-3 font-medium">Role</th>
                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id} className="border-t">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{u.full_name}</span>
                              {u.user_id === user?.id && <Badge variant="outline" className="text-[10px]">You</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><Badge variant="secondary" className="capitalize">{u.role}</Badge></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {u.user_id !== user?.id ? (
                                <>
                                  <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                                    <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="accountant">Accountant</SelectItem>
                                      <SelectItem value="sales">Sales</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(u.user_id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">Cannot modify own account</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2" disabled={uploading}>
          {uploading ? "Uploading..." : <><Save className="w-4 h-4" /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}
