import { useState, useRef } from "react";
import { useSettings, type AppSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Globe, Receipt, Calendar, Save, Upload, Image, Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="currency" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Currency</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs"><Receipt className="w-3.5 h-3.5" /> Tax</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5 text-xs"><Calendar className="w-3.5 h-3.5" /> Fiscal Year</TabsTrigger>
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
