import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, FileText, Edit, Trash2, Printer, RotateCcw, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const LOGS_PER_PAGE = 20;

export default function ActivityLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / LOGS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLogs = filtered.slice((safePage - 1) * LOGS_PER_PAGE, safePage * LOGS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

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
            {paginatedLogs.map((log) => {
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
            {paginatedLogs.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No activity logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {(safePage - 1) * LOGS_PER_PAGE + 1}–{Math.min(safePage * LOGS_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1]) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">...</span>
                ) : (
                  <Button key={p} variant={p === safePage ? "default" : "outline"} size="icon" className="h-8 w-8 text-xs" onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
