import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BACKUP_KEYS = [
  "cb-settings-v2", "cb-invoices", "cb-sales-orders", "cb-receipts",
  "cb-customers", "cb-suppliers", "cb-expenses", "cb-inventory",
  "cb-stock-adjustments", "cb-purchase-orders", "cb-bills", "cb-purchase-payments",
  "cb-custom-units", "cb-custom-accounts", "cb-custom-categories",
  "accounts", "otherPayments", "otherReceipts", "transfers", "reconcileEntries", "ledgerEntries"
];

export type CloudBackup = {
  id: string;
  created_at: string;
  label: string;
};

const AUTO_BACKUP_KEY = "cb-auto-backup-enabled";
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function collectBackupData() {
  const data: Record<string, any> = {};
  BACKUP_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val) {
      try { data[key] = JSON.parse(val); } catch { /* skip */ }
    }
  });
  return data;
}

export function useCloudBackup() {
  const { user } = useAuth();
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [autoBackup, setAutoBackupState] = useState(() => {
    return localStorage.getItem(AUTO_BACKUP_KEY) === "true";
  });
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setAutoBackup = useCallback((enabled: boolean) => {
    localStorage.setItem(AUTO_BACKUP_KEY, String(enabled));
    setAutoBackupState(enabled);
  }, []);

  const fetchBackups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("backups")
      .select("id, created_at, label")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setBackups((data as CloudBackup[]) || []);
    setLoading(false);
  }, [user]);

  const saveToCloud = useCallback(async (label = "manual") => {
    if (!user) return;
    setSaving(true);
    const backupData = collectBackupData();

    // Keep max 10 backups: delete oldest if needed
    const { data: existing } = await supabase
      .from("backups")
      .select("id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (existing && existing.length >= 10) {
      const toDelete = existing.slice(0, existing.length - 9);
      await supabase.from("backups").delete().in("id", toDelete.map(b => b.id));
    }

    await supabase.from("backups").insert({
      user_id: user.id,
      backup_data: backupData,
      label,
    });

    setSaving(false);
    setLastAutoBackup(new Date().toISOString());
    await fetchBackups();
  }, [user, fetchBackups]);

  const restoreFromCloud = useCallback(async (backupId: string) => {
    if (!user) return false;
    setRestoring(true);
    const { data } = await supabase
      .from("backups")
      .select("backup_data")
      .eq("id", backupId)
      .single();

    if (data?.backup_data && typeof data.backup_data === "object") {
      const entries = data.backup_data as Record<string, any>;
      Object.entries(entries).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      setRestoring(false);
      return true;
    }
    setRestoring(false);
    return false;
  }, [user]);

  const deleteBackup = useCallback(async (backupId: string) => {
    await supabase.from("backups").delete().eq("id", backupId);
    await fetchBackups();
  }, [fetchBackups]);

  // Auto-backup interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (autoBackup && user) {
      intervalRef.current = setInterval(() => {
        saveToCloud("auto");
      }, AUTO_BACKUP_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoBackup, user, saveToCloud]);

  // Fetch on mount
  useEffect(() => {
    if (user) fetchBackups();
  }, [user, fetchBackups]);

  return {
    backups,
    loading,
    saving,
    restoring,
    autoBackup,
    setAutoBackup,
    lastAutoBackup,
    saveToCloud,
    restoreFromCloud,
    deleteBackup,
    fetchBackups,
  };
}
