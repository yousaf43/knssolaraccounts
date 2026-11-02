import { aiIdentity } from '../_shared/ai-credentials.ts';
import { routeAI } from '../_shared/ai-router.ts';
// Returns the current Pakistan (NEPRA / DISCO) electricity tariff and refreshes it
// automatically from a public tariff page when the stored copy is older than 7 days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ROW_ID = "pk-uniform";
const SOURCES = ["https://www.echeckbills.pk/tariff", "https://billhub.pk/tariff-rates-2026"];
const STALE_MS = 7 * 24 * 3600 * 1000;

const slab = {
  type: "object",
  additionalProperties: false,
  required: ["upTo", "rate", "fixed"],
  properties: {
    upTo: { type: ["number", "null"], description: "Upper unit limit of slab, null for the last 'above' slab" },
    rate: { type: "number", description: "PKR per kWh actually charged (GoP applicable rate)" },
    fixed: { type: "number", description: "Fixed charge PKR per month for this slab, 0 if none" },
  },
};
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["found", "effectiveLabel", "domesticProtected", "domesticUnprotected", "commercial", "industrial", "agricultural"],
  properties: {
    found: { type: "boolean", description: "true only if the page clearly lists the rates" },
    effectiveLabel: { type: "string", description: "Effective date of the tariff, e.g. 'Jan 2026'" },
    domesticProtected: { type: "array", items: slab },
    domesticUnprotected: { type: "array", items: slab },
    commercial: { type: "number", description: "Commercial A-2 rate PKR/kWh (load < 5 kW or average)" },
    industrial: { type: "number", description: "Industrial B-1/B-2 rate PKR/kWh (average)" },
    agricultural: { type: "number", description: "Agricultural tube-well D-1 rate PKR/kWh" },
  },
};

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(tr|p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 25000);
}

async function extractRates(pageText: string, companyId: string) {
  const { response } = await routeAI(companyId, [{ role: 'system', content: `Extract Pakistan electricity consumer tariff from page text. Use GoP applicable billed rates. Never guess; missing values mean found=false. Return JSON matching this schema: ${JSON.stringify(schema)}` }, { role: 'user', content: pageText }], { json: true });
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

const ok = (n: unknown, lo: number, hi: number) => typeof n === "number" && n >= lo && n <= hi;
function valid(x: any) {
  const s = (a: any) => Array.isArray(a) && a.length >= 2 && a.every((v: any) => ok(v.rate, 1, 200) && ok(v.fixed, 0, 10000));
  return x?.found && s(x.domesticProtected) && s(x.domesticUnprotected) && x.domesticUnprotected.length >= 5 &&
    ok(x.commercial, 10, 200) && ok(x.industrial, 10, 200) && ok(x.agricultural, 5, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const body = await req.json().catch(() => ({}));
    const { data: row } = await admin.from("electricity_tariffs").select("*").eq("id", ROW_ID).maybeSingle();

    const fresh = row && Date.now() - new Date(row.checked_at).getTime() < STALE_MS;
    if (fresh && !body.force) return json({ tariff: row, refreshed: false });

    const { companyId } = await aiIdentity(req);

    let lastError = "";
    for (const src of SOURCES) {
      try {
        const page = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0 (KnS Solar tariff checker)" } });
        if (!page.ok) { lastError = `${src} ${page.status}`; continue; }
        const x = await extractRates(htmlToText(await page.text()), companyId);
        if (!valid(x)) { lastError = `${src} returned incomplete rates`; continue; }
        const prev = (row?.rates ?? {}) as Record<string, unknown>;
        const rates = {
          fpa: 2, gst: 18, electricityDuty: 1.5, exportRate: 10, ...prev,
          domesticProtected: x.domesticProtected,
          domesticUnprotected: x.domesticUnprotected,
          commercial: x.commercial,
          industrial: x.industrial,
          agricultural: x.agricultural,
        };
        const changed = JSON.stringify(rates) !== JSON.stringify(row?.rates);
        const now = new Date().toISOString();
        const rec = {
          id: ROW_ID, rates, source: new URL(src).hostname, effective_label: x.effectiveLabel || row?.effective_label || "",
          checked_at: now, updated_at: changed || !row ? now : row.updated_at,
        };
        await admin.from("electricity_tariffs").upsert(rec);
        return json({ tariff: rec, refreshed: true, changed });
      } catch (e) {
        if ((e as { status?: number }).status) return json({ tariff: row, refreshed: false, error: (e as Error).message }, (e as { status: number }).status);
        lastError = `${src}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    // Could not refresh; remember we tried so we don't retry on every page load.
    if (row) await admin.from("electricity_tariffs").update({ checked_at: new Date().toISOString() }).eq("id", ROW_ID);
    return json({ tariff: row, refreshed: false, error: lastError });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
