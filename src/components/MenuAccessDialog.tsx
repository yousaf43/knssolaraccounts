import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MENU_OPTIONS, defaultMenusForRole, type MenuRole } from "@/lib/menuAccess";

type Props = { member: { user_id: string; full_name: string; role: string } | null; onClose: () => void };

export function MenuAccessDialog({ member, onClose }: Props) {
  const { profile, user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const role = (member?.role || "sales") as MenuRole;

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    supabase.from("user_menu_access").select("menus").eq("user_id", member.user_id).maybeSingle().then(({ data }) => {
      setIsCustom(Boolean(data));
      setSelected(data ? (data.menus as string[]) : defaultMenusForRole(role));
      setLoading(false);
    });
  }, [member, role]);

  const toggle = (url: string, on: boolean) => setSelected((prev) => (on ? [...prev, url] : prev.filter((u) => u !== url)));

  const save = async () => {
    if (!member) return;
    setSaving(true);
    const { error } = await supabase.from("user_menu_access").upsert({
      user_id: member.user_id,
      company_id: profile?.company_id ?? null,
      menus: selected,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return toast.error("Failed to save: " + error.message);
    toast.success("Menu access saved");
    if (member.user_id === user?.id) await refreshProfile();
    onClose();
  };

  const reset = async () => {
    if (!member) return;
    setSaving(true);
    const { error } = await supabase.from("user_menu_access").delete().eq("user_id", member.user_id);
    setSaving(false);
    if (error) return toast.error("Failed to reset: " + error.message);
    toast.success("Reset to role defaults");
    onClose();
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Menu Access — {member?.full_name}</DialogTitle>
        </DialogHeader>
        {role === "admin" ? (
          <p className="text-sm text-muted-foreground">Admins always have access to every menu.</p>
        ) : loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {isCustom ? "Custom access is set for this member." : `Currently using the default access for the ${role} role.`} Settings is always available.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(MENU_OPTIONS.map((m) => m.url))}>Select all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected([])}>Clear all</Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MENU_OPTIONS.map((m) => (
                <label key={m.url} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                  <Checkbox checked={selected.includes(m.url)} onCheckedChange={(v) => toggle(m.url, Boolean(v))} />
                  {m.title}
                </label>
              ))}
            </div>
          </>
        )}
        <DialogFooter className="gap-2">
          {role !== "admin" && isCustom && <Button variant="ghost" onClick={reset} disabled={saving}>Reset to role default</Button>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {role !== "admin" && <Button onClick={save} disabled={saving || loading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
