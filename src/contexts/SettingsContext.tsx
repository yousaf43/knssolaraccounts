import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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
  fiscalYearStart: string; // "01" to "12"
  dateFormat: string;
  logoUrl: string;
  thermalPrintWidth: "80mm" | "58mm";
};

const defaultSettings: AppSettings = {
  companyName: "",
  companyEmail: "",
  companyPhone: "",
  companyAddress: "",
  currency: "PKR",
  currencyLocale: "en-PK",
  taxRate: 0,
  taxLabel: "GST",
  fiscalYearStart: "07",
  dateFormat: "dd-MM-yyyy",
  logoUrl: "",
  thermalPrintWidth: "80mm",
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
  const initialSettings = { ...defaultSettings, companyName: company?.name || "" };
  const [settings, setSettings] = useLocalStorage<AppSettings>(storageKey, initialSettings);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadCloudSettings = async () => {
      const { data } = await supabase.from("user_settings").select("settings_data").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      const cloud = data?.settings_data;
      if (cloud && typeof cloud === "object" && !Array.isArray(cloud)) {
        setSettings((prev) => ({ ...prev, ...(cloud as Partial<AppSettings>) }));
      } else if (company?.name) {
        setSettings((prev) => ({ ...prev, companyName: prev.companyName || company.name }));
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

