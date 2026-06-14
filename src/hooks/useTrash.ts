import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TrashItem = {
  id: string;
  itemType: string;
  itemId: string;
  itemData: Record<string, unknown>;
  deletedAt: string;
};

export function useTrash() {
  const { user } = useAuth();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("trash" as never)
      .select("*")
      .order("deleted_at", { ascending: false });
    if (data) {
      setItems((data as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        itemType: r.item_type as string,
        itemId: r.item_id as string,
        itemData: r.item_data as Record<string, unknown>,
        deletedAt: r.deleted_at as string,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const moveToTrash = useCallback(async (itemType: string, itemId: string, itemData: Record<string, unknown>) => {
    if (!user) return;
    const trashEntry = {
      user_id: user.id,
      item_type: itemType,
      item_id: itemId,
      item_data: itemData,
    };
    await supabase.from("trash" as never).insert(trashEntry as never);
    await fetch();
  }, [user, fetch]);

  const restoreFromTrash = useCallback(async (trashId: string) => {
    if (!user) return null;
    const item = items.find((i) => i.id === trashId);
    if (!item) return null;
    // Delete from trash
    await supabase.from("trash" as never).delete().eq("id", trashId);
    setItems((prev) => prev.filter((i) => i.id !== trashId));
    return item;
  }, [user, items]);

  const permanentDelete = useCallback(async (trashId: string) => {
    if (!user) return;
    await supabase.from("trash" as never).delete().eq("id", trashId);
    setItems((prev) => prev.filter((i) => i.id !== trashId));
  }, [user]);

  const emptyTrash = useCallback(async () => {
    if (!user) return;
    await supabase.from("trash" as never).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setItems([]);
  }, [user]);

  return { items, loading, moveToTrash, restoreFromTrash, permanentDelete, emptyTrash, fetch };
}
