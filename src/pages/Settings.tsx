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
import { Building2, Globe, Receipt, Calendar, Save, Upload, Image, Users, Shield, Download, UploadCloud, Database, Cloud, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCloudBackup } from "@/hooks/useCloudBackup";

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
  const cloudBackup = useCloudBackup();

  const handleSave = async () => {
    let logoUrl = form.logoUrl || "";

    // Upload logo if new file selected
    if (logoFile && user) {
      setUploading(true);
      const ext = logoFile.name.split(".").pop();
      const path = `company-logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { upsert: true });

      if (uploadError) {
        toast.error("Logo upload failed: " + uploadError.message);
        setUploading(false);
        return;
      }

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
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be less than 2MB");
      return;
    }
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
        return {
          user_id: p.user_id,
          full_name: p.full_name || "Unknown",
          email: "",
          role: r?.role || "sales",
        };
      });
      setUsers(merged);
    }
    setUsersLoaded(true);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (role !== "admin") {
      toast.error("Only admins can change roles");
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole as "admin" | "accountant" | "sales" })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u));
      toast.success("Role updated");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your business preferences</p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="company" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="currency" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Currency</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs"><Receipt className="w-3.5 h-3.5" /> Tax</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5 text-xs"><Calendar className="w-3.5 h-3.5" /> Fiscal Year</TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5 text-xs"><Database className="w-3.5 h-3.5" /> Backup</TabsTrigger>
          {role === "admin" && (
            <TabsTrigger value="users" className="gap-1.5 text-xs" onClick={loadUsers}><Users className="w-3.5 h-3.5" /> Users & Roles</TabsTrigger>
          )}
        </TabsList>

        {/* Company */}
        <TabsContent value="company">
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <h2 className="font-semibold text-lg">Company Information</h2>

            {/* Logo */}
            <div className="space-y-3">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.companyEmail} onChange={(e) => update("companyEmail", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.companyPhone} onChange={(e) => update("companyPhone", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.companyAddress} onChange={(e) => update("companyAddress", e.target.value)} className="mt-1" />
              </div>
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
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
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
              <div>
                <Label>Tax Label</Label>
                <Input value={form.taxLabel} onChange={(e) => update("taxLabel", e.target.value)} placeholder="GST / VAT / Sales Tax" className="mt-1" />
              </div>
              <div>
                <Label>Default Tax Rate (%)</Label>
                <Input type="number" min={0} max={100} step={0.5} value={form.taxRate} onChange={(e) => update("taxRate", Number(e.target.value))} className="mt-1" />
              </div>
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
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
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

        {/* Backup & Restore */}
        <TabsContent value="backup">
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Backup & Restore</h2>
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

            {/* Local Export */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2"><Download className="w-4 h-4" /> Export to File</h3>
              <p className="text-sm text-muted-foreground">Download a complete backup as a JSON file.</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                const backupKeys = [
                  "cb-settings-v2", "cb-invoices", "cb-sales-orders", "cb-receipts",
                  "cb-customers", "cb-suppliers", "cb-expenses", "cb-inventory",
                  "cb-stock-adjustments", "cb-purchase-orders", "cb-bills", "cb-purchase-payments",
                  "cb-custom-units", "cb-custom-accounts", "cb-custom-categories",
                  "accounts", "otherPayments", "otherReceipts", "transfers", "reconcileEntries", "ledgerEntries"
                ];
                const backup: Record<string, any> = { _backupVersion: 1, _exportedAt: new Date().toISOString() };
                backupKeys.forEach(key => { const val = localStorage.getItem(key); if (val) backup[key] = JSON.parse(val); });
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `ks-solar-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click(); URL.revokeObjectURL(url);
                toast.success("Backup exported");
              }}>
                <Download className="w-4 h-4" /> Download Backup
              </Button>
            </div>

            {/* Local Import */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Import from File</h3>
              <p className="text-sm text-muted-foreground">Restore from a previously exported JSON file. This <strong>replaces</strong> all current data.</p>
              <input type="file" accept=".json" className="hidden" id="backup-import" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target?.result as string);
                    if (!data._backupVersion) { toast.error("Invalid backup file"); return; }
                    const { _backupVersion, _exportedAt, ...entries } = data;
                    Object.entries(entries).forEach(([key, value]) => { localStorage.setItem(key, JSON.stringify(value)); });
                    toast.success("Backup restored! Reloading..."); setTimeout(() => window.location.reload(), 1000);
                  } catch { toast.error("Failed to parse backup file"); }
                };
                reader.readAsText(file); e.target.value = "";
              }} />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => document.getElementById("backup-import")?.click()}>
                <UploadCloud className="w-4 h-4" /> Import Backup File
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Users & Roles - Admin only */}
        {role === "admin" && (
          <TabsContent value="users">
            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Users & Roles Management</h2>
              </div>
              <p className="text-sm text-muted-foreground">Manage user roles. First signup gets Admin role automatically.</p>

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
                              {u.user_id === user?.id && (
                                <Badge variant="outline" className="text-[10px]">You</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {u.user_id !== user?.id ? (
                              <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="accountant">Accountant</SelectItem>
                                  <SelectItem value="sales">Sales</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">Cannot change own role</span>
                            )}
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
