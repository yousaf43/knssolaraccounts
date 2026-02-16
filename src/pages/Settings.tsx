import { useState } from "react";
import { useSettings, type AppSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Globe, Receipt, Calendar, Save } from "lucide-react";

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

export default function Settings() {
  const { settings, setSettings, formatCurrency } = useSettings();
  const [form, setForm] = useState<AppSettings>({ ...settings });

  const handleSave = () => {
    setSettings(form);
    toast.success("Settings saved successfully");
  };

  const update = (key: keyof AppSettings, val: string | number) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleCurrencyChange = (code: string) => {
    const c = currencies.find((c) => c.code === code);
    if (c) {
      setForm((prev) => ({ ...prev, currency: c.code, currencyLocale: c.locale }));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your business preferences</p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="company" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="currency" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Currency</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs"><Receipt className="w-3.5 h-3.5" /> Tax</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5 text-xs"><Calendar className="w-3.5 h-3.5" /> Fiscal Year</TabsTrigger>
        </TabsList>

        {/* Company */}
        <TabsContent value="company">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-lg">Company Information</h2>
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
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
