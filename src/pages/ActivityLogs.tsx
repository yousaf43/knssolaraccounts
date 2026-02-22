import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, FileText, Edit, Trash2, Printer, RotateCcw, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACTION_ICONS: Record<string, typeof FileText> = {
  create: Plus,
  edit: Edit,
  delete: Trash2,
  print: Printer,
  restore: RotateCcw,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-success/10 text-success",
  edit: "bg-primary/10 text-primary",
  delete: "bg-destructive/10 text-destructive",
  print: "bg-blue-500/10 text-blue-500",
  restore: "bg-warning/10 text-warning",
};

export default function ActivityLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("activity_logs" as never)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setLogs(data as Record<string, unknown>[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.item_label as string)?.toLowerCase().includes(q) ||
      (l.item_type as string)?.toLowerCase().includes(q) ||
      (l.action as string)?.toLowerCase().includes(q) ||
      (l.details as string)?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground text-sm">Track all actions across invoices, sales orders, inventory and more</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Time</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Action</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Label</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const action = log.action as string;
              const Icon = ACTION_ICONS[action] || FileText;
              const colorClass = ACTION_COLORS[action] || "bg-muted text-muted-foreground";
              const time = new Date(log.created_at as string);
              return (
                <tr key={log.id as string} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {time.toLocaleDateString()} {time.toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge className={`${colorClass} border-0 gap-1`}>
                      <Icon className="w-3 h-3" />
                      {action.charAt(0).toUpperCase() + action.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 capitalize">{(log.item_type as string)?.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 font-medium">{log.item_label as string}</td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">{(log.details as string) || "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No activity logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
