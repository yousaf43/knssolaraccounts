import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppSettings = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  currency: string;
  currencyLocale: string;
  taxRate: number;
  taxLabel: string;
  fiscalYearStart: string;
  dateFormat: string;
  logoUrl: string;
  thermalPrintWidth: "80mm" | "58mm";
};

const defaultSettings: AppSettings = {
  companyName: "", companyEmail: "", companyPhone: "", companyAddress: "",
  currency: "PKR", currencyLocale: "en-PK", taxRate: 0, taxLabel: "GST",
  fiscalYearStart: "07", dateFormat: "dd-MM-yyyy", logoUrl: "", thermalPrintWidth: "80mm",
};

type SettingsContextType = {
  settings: AppSettings;
  setSettings: (val: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr?: string | Date | null, fallback?: string) => string;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, company } = useAuth();
  const storageKey = `cb-settings-v3-${company?.id || user?.id || "guest"}`;
  const [settings, setSettingsState] = useState<AppSettings>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return { ...defaultSettings, ...(stored ? JSON.parse(stored) : {}), companyName: company?.name || (stored ? JSON.parse(stored).companyName : "") };
    } catch { return { ...defaultSettings, companyName: company?.name || "" }; }
  });
  const setSettings = useCallback((value: AppSettings | ((prev: AppSettings) => AppSettings)) => {
    setSettingsState((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    setSettingsState({ ...defaultSettings, companyName: company?.name || "" });
    if (!user) return () => { active = false; };
    const loadCloudSettings = async () => {
      const { data } = await supabase.from("user_settings").select("settings_data").eq("company_id", company?.id || "");
      if (!active) return;
      const cloud = (data || []).map((row) => row.settings_data).find((value) => value && typeof value === "object" && !Array.isArray(value));
      if (cloud && typeof cloud === "object" && !Array.isArray(cloud)) {
        setSettings({ ...defaultSettings, companyName: company?.name || "", ...(cloud as Partial<AppSettings>) });
      }
    };
    void loadCloudSettings();
    return () => { active = false; };
  }, [user, company?.id, company?.name, setSettings]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(settings.currencyLocale, {
      style: "currency",
      currency: settings.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr?: string | Date | null, fallback = "—") => {
    if (!dateStr) return fallback;
    try {
      const d = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
      if (Number.isNaN(d.getTime())) return fallback;
      return format(d, settings.dateFormat);
    } catch {
      return fallback;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, formatCurrency, formatDate }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

