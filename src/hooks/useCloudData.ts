import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Generic cloud data hook for any table
export function useCloudData<T extends { id: string }>(
  tableName: string,
  mapFromDb: (row: Record<string, unknown>) => T,
  mapToDb: (item: T, userId: string) => Record<string, unknown>
) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: rows, error } = await supabase
      .from(tableName as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && rows) {
      setData((rows as Record<string, unknown>[]).map(mapFromDb));
    }
    setLoading(false);
  }, [user, tableName]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (item: T) => {
    if (!user) return;
    const row = mapToDb(item, user.id);
    const { error } = await supabase.from(tableName as never).insert(row as never);
    if (!error) {
      setData((prev) => [item, ...prev]);
    }
    return error;
  }, [user, tableName, mapToDb]);

  const update = useCallback(async (item: T) => {
    if (!user) return;
    const row = mapToDb(item, user.id);
    const { error } = await supabase.from(tableName as never).update(row as never).eq("id", item.id);
    if (!error) {
      setData((prev) => prev.map((d) => d.id === item.id ? item : d));
    }
    return error;
  }, [user, tableName, mapToDb]);

  const remove = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from(tableName as never).delete().eq("id", id);
    if (!error) {
      setData((prev) => prev.filter((d) => d.id !== id));
    }
    return error;
  }, [user, tableName]);

  const setAll = useCallback(async (items: T[]) => {
    if (!user) return;
    // Delete all existing then insert new (shared team data)
    await supabase.from(tableName as never).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (items.length > 0) {
      const rows = items.map((item) => mapToDb(item, user.id));
      await supabase.from(tableName as never).insert(rows as never);
    }
    setData(items);
  }, [user, tableName, mapToDb]);

  return { data, setData, loading, fetch, add, update, remove, setAll };
}
