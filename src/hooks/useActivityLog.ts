import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ActivityLog = {
  id: string;
  action: string;
  itemType: string;
  itemId: string;
  itemLabel: string;
  details: string;
  createdAt: string;
};

export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(async (
    action: string,
    itemType: string,
    itemId: string,
    itemLabel: string,
    details?: string
  ) => {
    if (!user) return;
    await supabase.from("activity_logs" as never).insert({
      user_id: user.id,
      action,
      item_type: itemType,
      item_id: itemId,
      item_label: itemLabel,
      details: details || "",
    } as never);
  }, [user]);

  return { log };
}
