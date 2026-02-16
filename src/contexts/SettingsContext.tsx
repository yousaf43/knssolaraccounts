import { createContext, useContext, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

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
};

const defaultSettings: AppSettings = {
  companyName: "K&S Solar Energy",
  companyEmail: "info@knssolar.com",
  companyPhone: "+92 300 0000000",
  companyAddress: "Lahore, Pakistan",
  currency: "PKR",
  currencyLocale: "en-PK",
  taxRate: 17,
  taxLabel: "GST",
  fiscalYearStart: "07",
  dateFormat: "dd/MM/yyyy",
  logoUrl: "",
};

type SettingsContextType = {
  settings: AppSettings;
  setSettings: (val: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  formatCurrency: (amount: number) => string;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<AppSettings>("cb-settings-v2", defaultSettings);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(settings.currencyLocale, {
      style: "currency",
      currency: settings.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
