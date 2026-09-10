import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Local timezone offset used by the biometric device (Pakistan = UTC+5)
const TZ_OFFSET = "+05:00";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type Punch = { deviceUserId: string; time: string; type?: string; raw?: string };

const txt = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Normalise "2026-09-10 09:03:12" / ISO strings into { iso, date } using the device timezone. */
function parsePunchTime(value: string): { iso: string; date: string } | null {
  const v = (value || "").trim().replace("T", " ");
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ ]?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return { iso: d.toISOString(), date: d.toISOString().slice(0, 10) };
  }
  const [, y, mo, da, hh = "00", mi = "00", ss = "00"] = m;
  const iso = new Date(`${y}-${mo}-${da}T${hh}:${mi}:${ss}${TZ_OFFSET}`).toISOString();
  return { iso, date: `${y}-${mo}-${da}` };
}

async function findDevice(apiKey?: string | null, serial?: string | null) {
  if (apiKey) {
    const { data } = await admin.from("attendance_devices").select("*").eq("api_key", apiKey).maybeSingle();
    if (data) return data;
  }
  if (serial) {
    const { data } = await admin.from("attendance_devices").select("*").eq("serial", serial).maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Insert punches, map them to employees and rebuild the daily attendance rows. */
async function ingest(device: Record<string, unknown>, punches: Punch[], source: string) {
  const companyId = device.company_id as string | null;
  const { data: employees } = await admin
    .from("employees")
    .select("id,name,code,biometric_id")
    .eq("company_id", companyId);

  const matchEmployee = (deviceUserId: string) =>
    (employees || []).find(
      (e) =>
        (e.biometric_id && String(e.biometric_id).trim() === deviceUserId) ||
        (e.code && String(e.code).trim() === deviceUserId),
    ) || null;

  const rows = [];
  const touched = new Set<string>();
  for (const p of punches) {
    const parsed = parsePunchTime(p.time);
    const deviceUserId = String(p.deviceUserId || "").trim();
    if (!parsed || !deviceUserId) continue;
    const emp = matchEmployee(deviceUserId);
    rows.push({
      company_id: companyId,
      device_id: device.id,
      device_user_id: deviceUserId,
      employee_id: emp?.id ?? null,
      employee_name: emp?.name ?? null,
      punch_time: parsed.iso,
      punch_date: parsed.date,
      punch_type: p.type || null,
      source,
      raw: p.raw || null,
    });
    touched.add(`${deviceUserId}|${parsed.date}`);
  }
  if (rows.length === 0) return { inserted: 0, days: 0 };

  await admin.from("attendance_punches").upsert(rows, {
    onConflict: "company_id,device_user_id,punch_time",
    ignoreDuplicates: true,
  });

  // Rebuild attendance rows for every affected employee/day
  let days = 0;
  for (const key of touched) {
    const [deviceUserId, date] = key.split("|");
    const { data: dayPunches } = await admin
      .from("attendance_punches")
      .select("punch_time,employee_id,employee_name")
      .eq("company_id", companyId)
      .eq("device_user_id", deviceUserId)
      .eq("punch_date", date)
      .order("punch_time", { ascending: true });
    if (!dayPunches || dayPunches.length === 0) continue;

    const local = (t: string) =>
      new Date(new Date(t).getTime() + 5 * 3600 * 1000).toISOString().slice(11, 16);
    const checkIn = local(dayPunches[0].punch_time as string);
    const checkOut = dayPunches.length > 1 ? local(dayPunches[dayPunches.length - 1].punch_time as string) : "";
    const hours = checkOut
      ? Math.max(
          0,
          Math.round(
            ((new Date(dayPunches[dayPunches.length - 1].punch_time as string).getTime() -
              new Date(dayPunches[0].punch_time as string).getTime()) /
              3600000) * 100,
          ) / 100,
        )
      : 0;

    const emp = matchEmployee(deviceUserId);
    const employeeName = emp?.name || `Device ID ${deviceUserId}`;

    let query = admin.from("attendance").select("id,notes").eq("company_id", companyId).eq("date", date);
    query = emp?.id ? query.eq("employee_id", emp.id) : query.eq("employee_name", employeeName);
    const { data: existing } = await query.maybeSingle();

    const payload = {
      company_id: companyId,
      user_id: device.user_id ?? null,
      employee_id: emp?.id ?? null,
      employee_name: employeeName,
      date,
      check_in: checkIn,
      check_out: checkOut,
      status: "present",
      hours,
      notes: "Biometric device",
    };
    if (existing?.id) await admin.from("attendance").update(payload).eq("id", existing.id);
    else await admin.from("attendance").insert(payload);
    days++;
  }
  return { inserted: rows.length, days };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const serial = url.searchParams.get("SN");
  const apiKey = req.headers.get("x-api-key") || url.searchParams.get("key");

  try {
    // ---- ZKTeco ADMS / push protocol ----
    if (path.includes("/iclock/")) {
      const device = await findDevice(apiKey, serial);
      if (!device) return txt("Device not registered", 401);
      await admin.from("attendance_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

      if (path.includes("cdata") && req.method === "GET") {
        return txt(
          `GET OPTION FROM: ${serial ?? ""}\nStamp=0\nOpStamp=0\nErrorDelay=30\nDelay=10\nTransTimes=00:00;12:00\nTransInterval=1\nTransFlag=1111000000\nRealtime=1\nEncrypt=0\n`,
        );
      }
      if (path.includes("getrequest")) return txt("OK");
      if (path.includes("devicecmd")) return txt("OK");

      if (path.includes("cdata") && req.method === "POST") {
        const table = (url.searchParams.get("table") || "ATTLOG").toUpperCase();
        const body = await req.text();
        if (table !== "ATTLOG") return txt(`OK: 0`);
        const punches: Punch[] = body
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const parts = line.split(/\t|\s{2,}/).filter(Boolean);
            const deviceUserId = parts[0] || "";
            const time = parts[1] && parts[2] && /^\d{2}:/.test(parts[2]) ? `${parts[1]} ${parts[2]}` : parts[1] || "";
            return { deviceUserId, time, type: parts[3] || "", raw: line };
          });
        const res = await ingest(device, punches, "device");
        return txt(`OK: ${res.inserted}`);
      }
      return txt("OK");
    }

    // ---- JSON API (helper program / manual upload) ----
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const device = await findDevice(apiKey, serial);
    if (!device) return json({ error: "Invalid device key" }, 401);

    const body = await req.json().catch(() => null);
    const punches: Punch[] = Array.isArray(body?.punches) ? body.punches : [];
    if (punches.length === 0) return json({ error: "No punches provided" }, 400);
    if (punches.length > 5000) return json({ error: "Too many punches in one request (max 5000)" }, 400);

    await admin.from("attendance_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    const result = await ingest(device, punches, typeof body?.source === "string" ? body.source : "device");
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("zkteco-attendance error", e);
    return json({ error: String(e) }, 500);
  }
});
