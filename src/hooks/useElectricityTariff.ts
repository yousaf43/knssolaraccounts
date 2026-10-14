import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TARIFF, isValidRates, type TariffRecord } from "@/lib/electricityTariff";

type Row = { rates: unknown; source: string | null; effective_label: string | null; updated_at: string };

const toRecord = (r: Row | null | undefined): TariffRecord | null =>
  r && isValidRates(r.rates)
    ? { rates: r.rates, source: r.source || "NEPRA", effectiveLabel: r.effective_label || "", updatedAt: r.updated_at }
    : null;

/** Current DISCO tariff. Loads the saved copy, then asks the server to refresh it if it is older than 7 days. */
export function useElectricityTariff() {
  const [tariff, setTariff] = useState<TariffRecord>(DEFAULT_TARIFF);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("electricity-tariff", { body: { force } });
      if (error) throw error;
      const rec = toRecord(data?.tariff);
      if (rec) setTariff(rec);
      return { ok: !!rec, changed: !!data?.changed, refreshed: !!data?.refreshed, error: data?.error as string | undefined };
    } catch (e) {
      return { ok: false, changed: false, refreshed: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from("electricity_tariffs").select("rates, source, effective_label, updated_at").eq("id", "pk-uniform").maybeSingle();
      const rec = toRecord(data as Row | null);
      if (active && rec) setTariff(rec);
      if (active) void refresh(false);
    })();
    return () => { active = false; };
  }, [refresh]);

  return { tariff, checking, refresh };
}
