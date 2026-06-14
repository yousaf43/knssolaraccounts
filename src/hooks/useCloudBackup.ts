import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BACKUP_TABLES = [
  "customers", "suppliers", "inventory", "invoices", "sales_orders",
  "quotations", "receipts", "expenses", "purchase_orders", "bills",
  "purchase_payments", "stock_adjustments", "accounts", "ledger_entries",
  "other_payments", "other_receipts", "transfers", "reconcile_entries",
  "user_settings", "activity_logs", "solar_washing"
] as const;

export type CloudBackup = {
  id: string;
  created_at: string;
  label: string;
};

const AUTO_BACKUP_KEY = "cb-auto-backup-enabled";
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function collectBackupData(_userId: string) {
  const data: Record<string, any[]> = {};
  const promises = BACKUP_TABLES.map(async (table) => {
    const { data: rows } = await supabase
      .from(table)
      .select("*");
    data[table] = rows || [];
  });
  await Promise.all(promises);
  return data;
}

async function restoreBackupData(userId: string, backupData: Record<string, any[]>) {
  for (const [table, rows] of Object.entries(backupData)) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
    if (!BACKUP_TABLES.includes(table as any)) continue;

    // Delete existing shared data in this table
    await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert backup data (ensure user_id is set on rows that lack it)
    const rowsWithUser = rows.map((r: any) => ({ ...r, user_id: r.user_id || userId }));
    // Insert in batches of 100
    for (let i = 0; i < rowsWithUser.length; i += 100) {
      const batch = rowsWithUser.slice(i, i + 100);
      await supabase.from(table as any).insert(batch);
    }
  }
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
    try {
      const backupData = await collectBackupData(user.id);

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

      setLastAutoBackup(new Date().toISOString());
      await fetchBackups();
    } finally {
      setSaving(false);
    }
  }, [user, fetchBackups]);

  const restoreFromCloud = useCallback(async (backupId: string) => {
    if (!user) return false;
    setRestoring(true);
    try {
      const { data } = await supabase
        .from("backups")
        .select("backup_data")
        .eq("id", backupId)
        .single();

      if (data?.backup_data && typeof data.backup_data === "object") {
        await restoreBackupData(user.id, data.backup_data as Record<string, any[]>);
        return true;
      }
      return false;
    } finally {
      setRestoring(false);
    }
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
