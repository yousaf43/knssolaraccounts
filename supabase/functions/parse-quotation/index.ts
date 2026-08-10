import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

type Attachment = { name?: string; mimeType?: string; data?: string };

type ParsedComponent = { name?: string; qty?: unknown; rate?: unknown };
type ParsedItem = {
  description?: string;
  qty?: unknown;
  rate?: unknown;
  isBundle?: boolean;
  bundleTitle?: string;
  bundleDescription?: string;
  components?: ParsedComponent[];
};
type ParsedQuotation = {
  customer?: string;
  projectName?: string;
  documentNumber?: string;
  date?: string;
  dueDate?: string;
  notes?: string;
  taxPercent?: unknown;
  items?: ParsedItem[];
};

// ~15 MB of base64 across all attachments keeps us inside provider limits.
const MAX_ATTACH_B64 = 15_000_000;

const num = (v: unknown) => {
  if (typeof v === "number" && isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Normalise a product/customer name for fuzzy matching. */
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 1);

/** Score how well a candidate name matches a scanned label (0 = no match). */
function score(label: string, candidate: string): number {
  const a = norm(label);
  const b = norm(candidate);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  if (ta.length === 0) return 0;
  const hits = ta.filter((t) => tb.has(t)).length;
  return (hits / ta.length) * 70;
}

function bestMatch<T extends { id: string; name: string; sku?: string | null }>(
  label: string,
  rows: T[],
  min = 45,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const r of rows) {
    const s = Math.max(score(label, r.name || ""), r.sku ? score(label, r.sku) : 0);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return bestScore >= min ? best : null;
}

/** Pull the first JSON object out of a model reply (handles ``` fences / prose). */
function extractJson(raw: string): ParsedQuotation | null {
  const text = raw.replace(/```json/gi, "```").trim();
  const fenced = text.match(/```([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(Boolean) as string[];
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1)) as ParsedQuotation;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const rawAttachments: Attachment[] = Array.isArray(body?.attachments) ? body.attachments : [];
    const note = typeof body?.note === "string" ? body.note.slice(0, 1000) : "";

    if (rawAttachments.length === 0) {
      return json({ error: "Kam az kam ek quotation file (PDF ya image) bhejein." }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI configure nahin hai (LOVABLE_API_KEY missing)." }, 500);

    // ---- Build multimodal blocks ----
    let budget = MAX_ATTACH_B64;
    const blocks: ContentBlock[] = [];
    const skipped: string[] = [];
    for (const a of rawAttachments) {
      const data = typeof a?.data === "string" ? a.data : "";
      const name = String(a?.name || "file");
      const mime = String(a?.mimeType || "application/octet-stream");
      if (!data) {
        skipped.push(name);
        continue;
      }
      if (data.length > budget) {
        skipped.push(name);
        continue;
      }
      budget -= data.length;
      if (mime === "application/pdf") {
        blocks.push({ type: "file", file: { filename: name, file_data: `data:${mime};base64,${data}` } });
      } else if (mime.startsWith("image/")) {
        blocks.push({ type: "image_url", image_url: { url: `data:${mime};base64,${data}` } });
      } else {
        skipped.push(name);
      }
    }
    if (blocks.length === 0) {
      return json({ error: "Koi file parhi nahin ja saki — sirf PDF ya image support hai." }, 400);
    }

    // ---- Live catalog for matching (main inventory + customers) ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Pehle login karein." }, 401);

    const [invRes, custRes] = await Promise.all([
      supabase
        .from("inventory")
        .select("id,name,sku,category,sale_price,price,location")
        .eq("user_id", userId)
        .limit(1000),
      supabase.from("customers").select("id,name,company").eq("user_id", userId).limit(1000),
    ]);

    const seen = new Set<string>();
    const inventory = ((invRes.data ?? []) as Record<string, unknown>[])
      .filter((p) => String(p.location ?? "main") === "main")
      .filter((p) => {
        const key = String(p.sku || p.name || "").toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        sku: p.sku ? String(p.sku) : "",
        category: p.category ? String(p.category) : "",
        rate: num(p.sale_price) || num(p.price),
      }));

    const customers = ((custRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      company: c.company ? String(c.company) : "",
    }));

    const catalog = inventory
      .slice(0, 400)
      .map((p) => `${p.name}${p.sku ? ` [${p.sku}]` : ""}${p.category ? ` (${p.category})` : ""} = ${p.rate}`)
      .join("\n");

    const systemPrompt = `Tu ek expert data-entry assistant hai jo scanned/hard-form quotations ko structured JSON me convert karta hai.

KAAM: Di gayi file(s) ka poora content parho (scanned page ho to OCR ki tarah text nikalo, tables ko rows me samjho) aur EK quotation ka JSON banao.

BUNDLE RULE (bohot ahem):
- Accessories HAMESHA bundle honi chahiye.
- Agar quotation ki kisi line/section me ek se zyada products ka zikr ho (jaise "Accessories: DC cable, MC4 connectors, earthing kit"), to us poori line ko EK bundle item banao: isBundle=true, bundleTitle (jaise "Accessories"), aur har sub-product "components" array me alag entry ke sath (name, qty, rate).
- Single product wali line ko normal item rakho (isBundle=false, components khali).

QAWAID:
- Sirf wahi likho jo file me hai. Jo rate/qty na mile usay 0 rakho — apni taraf se number mat banao.
- qty aur rate sirf numbers (currency symbols, commas hata do).
- Product names bilkul waise likho jaise file me hain (baad me system khud match karega).
- date/dueDate ko YYYY-MM-DD me do; na mile to khali string.
- taxPercent sirf tab do jab file me GST/tax percent saaf likha ho, warna 0.
- notes me terms/validity/delivery jaisi ahem baatein short likho.

SIRF JSON output do (koi explanation nahin), is exact shape me:
{"customer":"","projectName":"","documentNumber":"","date":"","dueDate":"","notes":"","taxPercent":0,"items":[{"description":"","qty":0,"rate":0,"isBundle":false,"bundleTitle":"","bundleDescription":"","components":[{"name":"","qty":0,"rate":0}]}]}

SYSTEM PRODUCT CATALOG (naam match karne me madad ke liye — isme se milta julta naam ho to wahi likho):
${catalog || "(catalog khali hai)"}`;

    const userBlocks: ContentBlock[] = [
      {
        type: "text",
        text:
          (note ? `User note: ${note}\n\n` : "") +
          "Is quotation file ko parh kar upar bataye gaye JSON format me convert karo. Accessories / multi-product lines ko bundle banana mat bhoolna.",
      },
      ...blocks,
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userBlocks },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error:", res.status, text);
      if (res.status === 429) return json({ error: "Bohot zyada requests. Thori dair baad koshish karein." }, 429);
      if (res.status === 402) return json({ error: "AI credits khatam ho gaye hain." }, 402);
      return json({ error: "AI se jawab nahin mila. Dobara koshish karein." }, 502);
    }

    const aiJson = await res.json();
    const reply: string = aiJson?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(reply);
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return json({ error: "File se quotation ki lines nahin nikal sakin — shayad scan dhundla hai." }, 422);
    }

    // ---- Map parsed lines onto the app's document shape ----
    const unmatched: string[] = [];

    const items = parsed.items.slice(0, 100).map((raw) => {
      const description = String(raw.description ?? "").trim();
      const comps = Array.isArray(raw.components) ? raw.components : [];
      const isBundle = raw.isBundle === true || comps.length > 1;

      if (isBundle && comps.length > 0) {
        const resolved: { itemId: string; qty: number; rate: number }[] = [];
        const extra: string[] = [];
        for (const c of comps.slice(0, 50)) {
          const name = String(c?.name ?? "").trim();
          if (!name) continue;
          const qty = Math.max(num(c?.qty) || 1, 0);
          const match = bestMatch(name, inventory);
          const rate = num(c?.rate) || match?.rate || 0;
          if (match) resolved.push({ itemId: match.id, qty, rate });
          else {
            extra.push(`${name} × ${qty}${rate ? ` @ ${rate}` : ""}`);
            unmatched.push(name);
          }
        }
        const title = String(raw.bundleTitle || description || "Accessories").trim();
        const qty = Math.max(num(raw.qty) || 1, 1);
        const computed = resolved.reduce((s, l) => s + l.qty * l.rate, 0);
        const rate = num(raw.rate) || computed;
        const descLines = [String(raw.bundleDescription ?? "").trim(), ...extra].filter(Boolean);
        return {
          description: descLines.join("\n"),
          qty,
          rate,
          amount: qty * rate,
          bundleTitle: title,
          bundleDescription: descLines.join("\n"),
          adhocLines: resolved,
          bundleItemPrices: resolved.map((l) => ({ itemId: l.itemId, price: l.rate, qty: l.qty })),
        };
      }

      const match = description ? bestMatch(description, inventory) : null;
      if (description && !match) unmatched.push(description);
      const qty = Math.max(num(raw.qty) || 1, 0);
      const rate = num(raw.rate) || match?.rate || 0;
      return {
        description: match?.name || description,
        qty,
        rate,
        amount: qty * rate,
        ...(match ? { inventoryItemId: match.id } : {}),
      };
    });

    const customerLabel = String(parsed.customer ?? "").trim();
    const customerMatch = customerLabel
      ? bestMatch(
          customerLabel,
          customers.map((c) => ({ id: c.id, name: c.name, sku: c.company })),
          55,
        )
      : null;

    const total = items.reduce((s, i) => s + i.amount, 0);
    const taxPercent = Math.min(Math.max(num(parsed.taxPercent), 0), 100);

    return json({
      quotation: {
        customer: customerMatch?.name || customerLabel,
        selectedCustomerId: customerMatch?.id || "",
        customerMatched: !!customerMatch,
        projectName: String(parsed.projectName ?? "").trim(),
        documentNumber: String(parsed.documentNumber ?? "").trim(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date ?? "")) ? String(parsed.date) : "",
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.dueDate ?? "")) ? String(parsed.dueDate) : "",
        notes: String(parsed.notes ?? "").trim(),
        tax: taxPercent,
        items,
        total,
      },
      meta: {
        skippedFiles: skipped,
        unmatchedProducts: [...new Set(unmatched)].slice(0, 30),
        bundleCount: items.filter((i) => "bundleTitle" in i).length,
      },
    });
  } catch (e) {
    console.error("parse-quotation error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
