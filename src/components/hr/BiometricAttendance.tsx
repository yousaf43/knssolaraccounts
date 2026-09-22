import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fingerprint, Upload, RefreshCw, Plus, Copy, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "@/hooks/use-toast";


type Device = {
  id: string; name: string; serial: string | null; api_key: string;
  last_seen_at: string | null; created_at: string;
};
type PendingDevice = { id: string; serial: string | null; name: string; last_seen_at: string | null };
type Punch = {
  id: string; device_user_id: string; employee_name: string | null;
  punch_time: string; punch_date: string; punch_type: string | null; source: string;
};
type Emp = { id: string; name: string; code: string | null; biometric_id: string | null };


const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zkteco-attendance`;

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

const localTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", hour12: false });

/** Parse a ZKTeco export (attlog .dat / .txt / .csv) into punches. */
function parseFile(text: string): { deviceUserId: string; time: string; type?: string; raw: string }[] {
  const out: { deviceUserId: string; time: string; type?: string; raw: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.split(/\t|,|;|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    if (/^(no|sr|user|emp)/i.test(parts[0]) && !/\d/.test(parts[0])) continue; // header row
    const deviceUserId = parts[0];
    const dateIdx = parts.findIndex((p) => /^\d{4}-\d{2}-\d{2}/.test(p) || /^\d{2}[-/]\d{2}[-/]\d{4}/.test(p));
    if (dateIdx === -1) continue;
    let datePart = parts[dateIdx];
    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(datePart)) {
      const [d, m, y] = datePart.split(/[-/]/);
      datePart = `${y}-${m}-${d}`;
    }
    let timePart = "";
    if (/\d{2}:\d{2}/.test(datePart)) {
      const [dp, tp] = datePart.split(/[ T]/);
      datePart = dp; timePart = tp;
    } else if (parts[dateIdx + 1] && /^\d{1,2}:\d{2}/.test(parts[dateIdx + 1])) {
      timePart = parts[dateIdx + 1];
    }
    if (!timePart) timePart = "00:00:00";
    if (timePart.split(":").length === 2) timePart += ":00";
    out.push({ deviceUserId, time: `${datePart} ${timePart}`, type: parts[dateIdx + 2], raw });
  }
  return out;
}

export default function BiometricAttendance({ onImported }: { onImported?: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pending, setPending] = useState<PendingDevice[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState(false);
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ name: "ZKTeco Device", serial: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from("employees" as never)
      .select("id,name,code,biometric_id")
      .order("name");
    setEmployees((data as unknown as Emp[]) || []);
  }, []);


  const loadDevices = useCallback(async () => {
    const { data } = await supabase.from("attendance_devices" as never).select("*").order("created_at");
    setDevices((data as unknown as Device[]) || []);
  }, []);

  const loadPunches = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance_punches" as never)
      .select("id,device_user_id,employee_name,punch_time,punch_date,punch_type,source")
      .gte("punch_date", from).lte("punch_date", to)
      .order("punch_time", { ascending: false })
      .limit(500);
    setPunches((data as unknown as Punch[]) || []);
    setLoading(false);
  }, [from, to]);

  const loadPending = useCallback(async () => {
    const { data } = await supabase.rpc("list_unclaimed_devices" as never);
    setPending((data as unknown as PendingDevice[]) || []);
  }, []);

  useEffect(() => { void loadDevices(); void loadPending(); void loadEmployees(); }, [loadDevices, loadPending, loadEmployees]);
  useEffect(() => { void loadPunches(); }, [loadPunches]);

  // Keep looking for a machine that has just started talking to us.
  useEffect(() => {
    const t = setInterval(() => { void loadPending(); void loadDevices(); }, 15000);
    return () => clearInterval(t);
  }, [loadPending, loadDevices]);

  const device = devices[0];

  const serverParts = useMemo(() => {
    try {
      const u = new URL(FN_BASE);
      return { address: `${u.host}${u.pathname}`, host: u.host, port: u.protocol === "https:" ? "443" : "80" };
    } catch {
      return { address: FN_BASE, host: FN_BASE, port: "443" };
    }
  }, []);

  /** Device IDs that are punching but are not linked to any employee yet. */
  const unmatchedIds = useMemo(() => {
    const map = new Map<string, { count: number; last: string }>();
    for (const p of punches) {
      if (p.employee_name) continue;
      const cur = map.get(p.device_user_id);
      if (!cur) map.set(p.device_user_id, { count: 1, last: p.punch_time });
      else { cur.count++; if (p.punch_time > cur.last) cur.last = p.punch_time; }
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => Number(a.id) - Number(b.id));
  }, [punches]);

  /** Per person, per day: first punch = check in, last punch = check out. */
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; who: string; unmatched: boolean; times: string[] }>();
    for (const p of punches) {
      const key = `${p.punch_date}|${p.device_user_id}`;
      const entry = map.get(key) || {
        date: p.punch_date,
        who: p.employee_name || `Device ID ${p.device_user_id}`,
        unmatched: !p.employee_name,
        times: [],
      };
      entry.times.push(p.punch_time);
      map.set(key, entry);
    }
    return [...map.values()]
      .map((e) => {
        const sorted = [...e.times].sort();
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const hours = sorted.length > 1
          ? Math.round(((new Date(last).getTime() - new Date(first).getTime()) / 3600000) * 100) / 100
          : 0;
        return { ...e, first, last: sorted.length > 1 ? last : "", hours, punches: sorted.length };
      })
      .sort((a, b) => (a.date === b.date ? a.who.localeCompare(b.who) : b.date.localeCompare(a.date)));
  }, [punches]);

  /** Ask the server to re-apply employee mapping to punches already stored. */
  const runRemap = useCallback(async () => {
    if (!device) return;
    const res = await fetch(`${FN_BASE}?key=${encodeURIComponent(device.api_key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remap" }),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok) throw new Error(out?.error || "Could not refresh attendance");
    return out;
  }, [device]);

  const linkEmployee = async (deviceUserId: string) => {
    const employeeId = linkChoice[deviceUserId];
    if (!employeeId) return;
    setLinking(true);
    try {
      const { error } = await supabase
        .from("employees" as never)
        .update({ biometric_id: deviceUserId } as never)
        .eq("id", employeeId);
      if (error) throw new Error(error.message);
      await runRemap();
      await loadEmployees();
      await loadPunches();
      onImported?.();
      toast({ title: "Employee linked", description: `Device ID ${deviceUserId} is now mapped` });
    } catch (e) {
      toast({ title: "Could not link employee", description: String(e), variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };


  const claim = async (p: PendingDevice) => {
    const { error } = await supabase.rpc("claim_attendance_device" as never, { _id: p.id, _name: p.name } as never);
    if (error) { toast({ title: "Could not link device", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Device linked", description: `Serial ${p.serial ?? ""} is now connected` });
    await loadDevices(); await loadPending();
  };

  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  const addDevice = async () => {
    const { error } = await supabase.from("attendance_devices" as never).insert({
      name: form.name || "ZKTeco Device",
      serial: form.serial || null,
    } as never);
    if (error) { toast({ title: "Could not register device", description: error.message, variant: "destructive" }); return; }
    setDialog(false);
    setForm({ name: "ZKTeco Device", serial: "" });
    await loadDevices();
    toast({ title: "Device registered" });
  };

  const removeDevice = async (id: string) => {
    await supabase.from("attendance_devices" as never).delete().eq("id", id);
    await loadDevices();
  };

  const onFile = async (file: File) => {
    if (!device) { toast({ title: "Register a device first", variant: "destructive" }); return; }
    const text = await file.text();
    const parsed = parseFile(text);
    if (parsed.length === 0) { toast({ title: "No attendance records found in this file", variant: "destructive" }); return; }
    setLoading(true);
    try {
      let inserted = 0, days = 0;
      for (let i = 0; i < parsed.length; i += 2000) {
        const res = await fetch(`${FN_BASE}?key=${encodeURIComponent(device.api_key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ punches: parsed.slice(i, i + 2000), source: "upload" }),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error || "Upload failed");
        inserted += out.inserted || 0; days += out.days || 0;
      }
      toast({ title: `${inserted} punches imported`, description: `${days} attendance day(s) updated` });
      await loadPunches();
      onImported?.();
    } catch (e) {
      toast({ title: "Import failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Biometric Device (ZKTeco MB460)</p>
                <p className="text-xs text-muted-foreground">The machine sends punches here by itself — no extra program on any computer</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Manually</Button>
          </div>

          {/* Settings to type into the machine */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
            <p className="text-sm font-medium">Settings to enter on the machine</p>
            <p className="text-xs text-muted-foreground">
              On the device: <span className="font-medium">Menu → Comm. → Cloud Server / ADMS</span>. Turn on
              “Domain Name”, enter the address below, then save and restart the machine.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label className="text-xs">Server address</Label>
                <div className="flex gap-2">
                  <Input readOnly value={serverParts.address} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(serverParts.address, "Server address")}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Server port</Label>
                  <Input readOnly value={serverParts.port} className="font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Enable proxy / SSL</Label>
                  <Input readOnly value="HTTPS: ON" className="font-mono text-xs" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              As soon as the machine connects, it appears below for approval. Make sure each employee’s
              “Biometric ID” in the Employees tab matches the User ID on the machine.
            </p>
          </div>

          {pending.length > 0 && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">New machine detected</p>
              {pending.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.serial && <Badge variant="secondary">SN {p.serial}</Badge>}
                    {p.last_seen_at && (
                      <span className="text-xs text-muted-foreground">Contacted {localTime(p.last_seen_at)}</span>
                    )}
                  </div>
                  <Button size="sm" onClick={() => { void claim(p); }}>Approve &amp; Connect</Button>
                </div>
              ))}
            </div>
          )}

          {devices.length === 0 && pending.length === 0 && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              No machine connected yet. Enter the settings above on the device — it will show up here within a minute.
            </p>
          )}

          {devices.map((d) => {
            const online = d.last_seen_at ? Date.now() - new Date(d.last_seen_at).getTime() < 10 * 60000 : false;
            return (
              <div key={d.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    {d.serial && <Badge variant="secondary">SN {d.serial}</Badge>}
                    <Badge className={online ? "border-0 bg-emerald-500/15 text-emerald-600" : "border-0 bg-muted text-muted-foreground"}>
                      {online ? "Connected" : d.last_seen_at ? `Last contact: ${localTime(d.last_seen_at)}` : "Waiting for first contact"}
                    </Badge>
                  </div>
                  <ConfirmDeleteDialog onConfirm={() => { void removeDevice(d.id); }} />
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <input
              ref={fileRef} type="file" accept=".dat,.txt,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={loading || !device}>
              <Upload className="mr-2 h-4 w-4" />Upload Attendance File
            </Button>
            <span className="text-xs text-muted-foreground">Accepts ZKTeco .dat, .txt or .csv exports</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="outline" onClick={() => { void loadPunches(); }} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
        <Button
          variant="outline"
          disabled={!device || linking}
          onClick={() => {
            setLinking(true);
            void runRemap()
              .then(() => { void loadPunches(); onImported?.(); toast({ title: "Attendance rebuilt" }); })
              .catch((e) => toast({ title: "Could not rebuild attendance", description: String(e), variant: "destructive" }))
              .finally(() => setLinking(false));
          }}
        >
          <Link2 className="mr-2 h-4 w-4" />Rebuild Attendance
        </Button>
        <span className="text-sm text-muted-foreground">{punches.length} punch record(s)</span>
      </div>

      {unmatchedIds.length > 0 && (
        <Card><CardContent className="space-y-3 p-4">
          <div>
            <p className="text-sm font-medium">Unknown device IDs</p>
            <p className="text-xs text-muted-foreground">
              These IDs punched on the machine but are not linked to any employee yet. Pick the right person for each ID.
            </p>
          </div>
          {employees.length === 0 && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              No employees added yet. Add employees in the Employees tab first, then link them here.
            </p>
          )}
          <div className="space-y-2">
            {unmatchedIds.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <Badge variant="secondary">ID {u.id}</Badge>
                <span className="text-xs text-muted-foreground">
                  {u.count} punch(es) · last {localTime(u.last)}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Select
                    value={linkChoice[u.id] || ""}
                    onValueChange={(v) => setLinkChoice((s) => ({ ...s, [u.id]: v }))}
                  >
                    <SelectTrigger className="w-56"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}{e.code ? ` (${e.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!linkChoice[u.id] || linking} onClick={() => { void linkEmployee(u.id); }}>
                    Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0 overflow-x-auto">
        <div className="border-b p-3">
          <p className="text-sm font-medium">Daily In / Out</p>
          <p className="text-xs text-muted-foreground">First punch of the day is check in, last punch is check out.</p>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Person</TableHead>
            <TableHead>Check In</TableHead><TableHead>Check Out</TableHead>
            <TableHead>Hours</TableHead><TableHead>Punches</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {daily.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No attendance in this period</TableCell></TableRow>}
            {daily.map((d) => (
              <TableRow key={`${d.date}-${d.who}`}>
                <TableCell>{localTime(`${d.date}T00:00:00Z`).split(", ")[0]}</TableCell>
                <TableCell className={d.unmatched ? "text-muted-foreground" : "font-medium"}>{d.who}</TableCell>
                <TableCell>{localTime(d.first).split(", ")[1]}</TableCell>
                <TableCell>{d.last ? localTime(d.last).split(", ")[1] : "-"}</TableCell>
                <TableCell>{d.hours ? `${d.hours} h` : "-"}</TableCell>
                <TableCell>{d.punches}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>


      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Sr #</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead>
            <TableHead>Device ID</TableHead><TableHead>Employee</TableHead>
            <TableHead>Type</TableHead><TableHead>Source</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {punches.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No punches in this period</TableCell></TableRow>}
            {punches.map((p, i) => {
              const t = localTime(p.punch_time);
              return (
                <TableRow key={p.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{t.split(", ")[0]}</TableCell>
                  <TableCell>{t.split(", ")[1]}</TableCell>
                  <TableCell>{p.device_user_id}</TableCell>
                  <TableCell className={p.employee_name ? "font-medium" : "text-muted-foreground"}>
                    {p.employee_name || "Unmatched"}
                  </TableCell>
                  <TableCell>{p.punch_type || "-"}</TableCell>
                  <TableCell className="capitalize">{p.source}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register Biometric Device</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Device Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Serial Number (from the machine)</Label><Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} placeholder="e.g. CGT9231500123" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={() => { void addDevice(); }}>Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
