import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const money = (v: number) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Math.round(v));

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };
type Msg = { role: "user" | "assistant" | "system"; content: string | ContentBlock[] };
type Attachment = { name?: string; mimeType?: string; data?: string };

// ~15 MB of base64 across all attachments keeps us inside provider limits.
const MAX_ATTACH_B64 = 15_000_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const rawMessages = body?.messages;
    if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep only the last 12 turns to bound prompt size, drop empty content.
    const messages: Msg[] = rawMessages
      .filter((m: Msg) => m && typeof m.content === "string" && (m.content as string).trim())
      .slice(-12)
      .map((m: Msg) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: (m.content as string).slice(0, 4000),
      }));

    // ---- Attachments (scanned PDFs / images) go on the LAST user message ----
    const rawAttachments: Attachment[] = Array.isArray(body?.attachments) ? body.attachments : [];
    let attachmentNote = "";
    if (rawAttachments.length > 0) {
      let budget = MAX_ATTACH_B64;
      const blocks: ContentBlock[] = [];
      const accepted: string[] = [];
      const skipped: string[] = [];
      for (const a of rawAttachments.slice(0, 5)) {
        const data = typeof a?.data === "string" ? a.data : "";
        const mime = typeof a?.mimeType === "string" && a.mimeType ? a.mimeType : "application/pdf";
        const name = typeof a?.name === "string" && a.name ? a.name : "attachment";
        if (!data) continue;
        if (data.length > budget) { skipped.push(name); continue; }
        budget -= data.length;
        if (mime.startsWith("image/")) {
          blocks.push({ type: "image_url", image_url: { url: `data:${mime};base64,${data}` } });
        } else {
          blocks.push({ type: "file", file: { filename: name, file_data: `data:${mime};base64,${data}` } });
        }
        accepted.push(name);
      }
      if (blocks.length > 0) {
        // Find last user message; append file blocks to it.
        let idx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "user") { idx = i; break; }
        }
        const text = idx >= 0 ? String(messages[idx].content) : "Is file ko parhein aur summary dein.";
        const merged: ContentBlock[] = [{ type: "text", text }, ...blocks];
        if (idx >= 0) messages[idx] = { role: "user", content: merged };
        else messages.push({ role: "user", content: merged });
        attachmentNote = `\n### ATTACHED FILES (user ne abhi bheji hain): ${accepted.join(", ")}\nIn files ka data parh kar upar di gayi LIVE BUSINESS DATA se compare karo jab user kahay (item name/qty/rate match karo, difference table banao).`;
      }
      if (skipped.length > 0) {
        attachmentNote += `\n(Ye files bohot bari thin is liye skip hui: ${skipped.join(", ")} — user ko batao.)`;
      }
    }


    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    let businessContext = "";
    if (userId) {
      try {
        // Fetch EVERY row (Supabase caps a single request at 1000 rows, so page through).
        const fetchAll = async (
          table: string,
          cols: string,
          orderCol?: string,
        ): Promise<Record<string, unknown>[]> => {
          const out: Record<string, unknown>[] = [];
          const PAGE = 1000;
          for (let from = 0; from < 50000; from += PAGE) {
            let q = supabase.from(table).select(cols).range(from, from + PAGE - 1);
            if (orderCol) q = q.order(orderCol, { ascending: false });
            const { data, error } = await q;
            if (error) break;
            const rows = (data ?? []) as unknown as Record<string, unknown>[];
            out.push(...rows);
            if (rows.length < PAGE) break;
          }
          return out;
        };

        const exactCount = async (table: string): Promise<number> => {
          const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
          return count ?? 0;
        };

        const [
          invoices,
          customers,
          inventory,
          receipts,
          expenses,
          salesOrders,
          suppliers,
          bills,
          accounts,
          ledgerEntries,
          quotations,
          purchaseOrders,
          purchasePayments,
          solarWashing,
        ] = await Promise.all([
          fetchAll("invoices", "number,customer,date,amount,status", "date"),
          fetchAll("customers", "name,phone,total_billed,outstanding"),
          fetchAll("inventory", "name,sku,model,unique_code,qty,sale_price,cost_price,reorder_level,category,product_type,unit,location"),
          fetchAll("receipts", "number,customer,amount,date", "date"),
          fetchAll("expenses", "description,amount,category,date", "date"),
          fetchAll("sales_orders", "number,customer,date,amount,status", "date"),
          fetchAll("suppliers", "name,phone,outstanding"),
          fetchAll("bills", "number,supplier,date,amount,status", "date"),
          fetchAll("accounts", "name,balance,currency"),
          fetchAll("ledger_entries", "amount,type,bank"),
          fetchAll("quotations", "number,customer,date,amount,status", "date"),
          fetchAll("purchase_orders", "number,supplier,date,amount,status", "date"),
          fetchAll("purchase_payments", "supplier,date,amount", "date"),
          fetchAll("solar_washing", "date,customer,amount", "date"),
        ]);


        // ---- Account balances (opening + ledger movement) ----
        const movement: Record<string, { in: number; out: number }> = {};
        for (const e of ledgerEntries) {
          const b = String(e.bank ?? "");
          movement[b] ??= { in: 0, out: 0 };
          if (e.type === "incoming") movement[b].in += num(e.amount);
          else movement[b].out += num(e.amount);
        }
        const enrichedAccounts = accounts.map((a) => {
          const m = movement[String(a.name)] || { in: 0, out: 0 };
          return {
            name: a.name,
            currency: a.currency ?? "PKR",
            actual_balance: num(a.balance) + m.in - m.out,
          };
        });
        const cashTotal = enrichedAccounts.reduce((s, a) => s + a.actual_balance, 0);

        // ---- Inventory ----
        const invItems = inventory.filter((p) => String(p.location ?? "main") === "main");
        const storeItems = inventory.filter((p) => String(p.location ?? "main") !== "main");
        const uniqueSkus = new Set(invItems.map((p) => String(p.sku || p.name))).size;
        const stockValue = invItems.reduce((s, p) => s + num(p.qty) * num(p.cost_price), 0);
        const retailValue = invItems.reduce((s, p) => s + num(p.qty) * num(p.sale_price), 0);
        const totalQty = invItems.reduce((s, p) => s + num(p.qty), 0);
        const lowStock = invItems
          .filter((p) => num(p.qty) <= num(p.reorder_level))
          .map((p) => ({ name: p.name, qty: num(p.qty), reorder: num(p.reorder_level) }));
        const outOfStock = invItems.filter((p) => num(p.qty) <= 0).length;
        const invByCategory = Object.entries(
          invItems.reduce<Record<string, number>>((acc, p) => {
            const c = String(p.category || "Uncategorized");
            acc[c] = (acc[c] ?? 0) + 1;
            return acc;
          }, {}),
        ).sort((a, b) => b[1] - a[1]);


        // ---- KPIs ----
        const sum = (arr: Record<string, unknown>[], k = "amount") =>
          arr.reduce((s, r) => s + num(r[k]), 0);
        const today = new Date();
        const ym = (d: unknown) => String(d ?? "").slice(0, 7);
        const thisMonth = today.toISOString().slice(0, 7);
        const inMonth = (arr: Record<string, unknown>[], m: string) =>
          arr.filter((r) => ym(r.date) === m);

        const receivables = customers.reduce((s, c) => s + num(c.outstanding), 0);
        const payables = suppliers.reduce((s, c) => s + num(c.outstanding), 0);

        const monthly: Record<string, number> = {};
        for (const i of invoices) monthly[ym(i.date)] = (monthly[ym(i.date)] ?? 0) + num(i.amount);
        const monthlySales = Object.entries(monthly)
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .slice(0, 12)
          .map(([m, v]) => `${m}: ${money(v)}`)
          .join(" | ");

        const topCustomers = [...customers]
          .sort((a, b) => num(b.total_billed) - num(a.total_billed))
          .slice(0, 15)
          .map((c) => ({ name: c.name, billed: num(c.total_billed), due: num(c.outstanding) }));

        const topDebtors = [...customers]
          .filter((c) => num(c.outstanding) > 0)
          .sort((a, b) => num(b.outstanding) - num(a.outstanding))
          .slice(0, 15)
          .map((c) => ({ name: c.name, due: num(c.outstanding) }));

        const counts = {
          main_inventory_products: invItems.length,
          main_inventory_unique_skus: uniqueSkus,
          store_inventory_products: storeItems.length,
          inventory_rows_total: inventory.length,
          invoices: invoices.length,
          quotations: quotations.length,
          sales_orders: salesOrders.length,
          customers: customers.length,
          suppliers: suppliers.length,
          receipts: receipts.length,
          expenses: expenses.length,
          bills: bills.length,
          purchase_orders: purchaseOrders.length,
          purchase_payments: purchasePayments.length,
          solar_washing_jobs: solarWashing.length,
          accounts: accounts.length,
          ledger_entries: ledgerEntries.length,
        };

        const kpi = {
          cash_and_bank_total: money(cashTotal),
          stock_value_at_cost: money(stockValue),
          stock_value_at_retail: money(retailValue),
          total_stock_qty: totalQty,
          total_assets_estimate: money(cashTotal + stockValue + receivables),
          receivables_total: money(receivables),
          payables_total: money(payables),
          lifetime_sales: money(sum(invoices)),
          sales_this_month: money(sum(inMonth(invoices, thisMonth))),
          receipts_this_month: money(sum(inMonth(receipts, thisMonth))),
          expenses_this_month: money(sum(inMonth(expenses, thisMonth))),
          solar_washing_total: money(sum(solarWashing)),
          solar_washing_this_month: money(sum(inMonth(solarWashing, thisMonth))),
          unpaid_invoices: invoices.filter((i) => String(i.status).toLowerCase() !== "paid").length,
          low_stock_items: lowStock.length,
          out_of_stock_items: outOfStock,
        };

        const j = (v: unknown) => JSON.stringify(v);
        const compactInv = (p: Record<string, unknown>) => ({
          n: p.name,
          sku: p.sku,
          model: p.model,
          qty: num(p.qty),
          cost: num(p.cost_price),
          sale: num(p.sale_price),
          cat: p.category,
          type: p.product_type,
        });

        businessContext = `
## LIVE BUSINESS DATA (Today: ${today.toISOString().slice(0, 10)}, currency PKR)
### RECORD COUNTS (AUTHORITATIVE — "kitni entries/records hain" ka jawab SIRF inhi numbers se do, list ginn kar nahi):
${j(counts)}
NOTE: Har table ka poora data load kiya gaya hai (koi row miss nahi). Neeche di gayi lists sirf display ke liye chhoti ki gayi ho sakti hain — count hamesha upar wale RECORD COUNTS se lo.
### KPI SUMMARY (already calculated — inhe seedha use kar, dobara jama mat kar):
${j(kpi)}
NOTE: "total_assets_estimate" = cash/bank + stock value at cost + receivables. Fixed assets (equipment) is estimate me shamil nahi.
### Monthly sales (last 12): ${monthlySales}
### Accounts: ${j(enrichedAccounts)}
### Inventory by category (main): ${j(invByCategory)}
### Top customers: ${j(topCustomers)}
### Top debtors: ${j(topDebtors)}
### Low stock (${lowStock.length}): ${j(lowStock.slice(0, 100))}
### Inventory — MAIN, complete list (${invItems.length} products): ${j(invItems.map(compactInv))}
### Inventory — STORE (${storeItems.length}): ${j(storeItems.slice(0, 150).map(compactInv))}
### Invoices (showing recent 200 of ${invoices.length}): ${j(invoices.slice(0, 200))}
### Sales Orders (recent 60 of ${salesOrders.length}): ${j(salesOrders.slice(0, 60))}
### Receipts (recent 80 of ${receipts.length}): ${j(receipts.slice(0, 80))}
### Expenses (recent 80 of ${expenses.length}): ${j(expenses.slice(0, 80))}
### Bills (recent 50 of ${bills.length}): ${j(bills.slice(0, 50))}
### Quotations (recent 40 of ${quotations.length}): ${j(quotations.slice(0, 40))}
### Purchase Orders (recent 50 of ${purchaseOrders.length}): ${j(purchaseOrders.slice(0, 50))}
### Purchase Payments (recent 40 of ${purchasePayments.length}): ${j(purchasePayments.slice(0, 40))}
### Solar Washing (recent 50 of ${solarWashing.length}): ${j(solarWashing.slice(0, 50))}
### Customers (${customers.length}): ${j(customers.slice(0, 250).map((c) => ({ n: c.name, billed: num(c.total_billed), due: num(c.outstanding) })))}
### Suppliers (${suppliers.length}): ${j(suppliers.slice(0, 150))}
`;


        const MAX = 120000; // Gemini has a large context; still bound it.
        if (businessContext.length > MAX) {
          businessContext = businessContext.slice(0, MAX) + "\n...[truncated]";
        }
      } catch (e) {
        console.error("data fetch error:", e);
        businessContext = "\n(Live data load nahin ho saka — user ko batao ke data abhi available nahin.)";
      }
    } else {
      businessContext = "\n(User logged-in nahin hai, is liye live business data available nahin.)";
    }

    const systemPrompt = `Tu Nexia hai — K&S Solar Energy ka AI business assistant LARKA (male). Read-only access hai: data dekh sakta hai, create/edit/delete NAHIN kar sakta.

ZABAN: User Roman Urdu likhay to Roman Urdu, English likhay to English. Masculine forms use karo (karunga, bataunga, dekha). Warm, Pakistani, professional.

RULES:
- Currency PKR. Numbers KPI SUMMARY se lo — wo pehle se calculated hain, dobara jama mat karo.
- Account balance ke liye hamesha "actual_balance" use karo.
- Agar koi figure data me maujood nahin to saaf keh do "ye data available nahin" — andaza mat lagao.
- Jawab short (2-5 lines). Lists ke liye chhoti bullet list. Amounts thousands separator ke sath.
- Yeh jawab voice me bhi bola ja sakta hai, is liye lamba paragraph mat likho jab tak user detail na maangay.
- User ki wording flexible / ghalat spelling ho sakti hai (Roman Urdu, typos, short forms). Best guess lagao aur kaam kar do; sirf tab poocho jab bilkul samajh na aaye.

FILES (PDF / scanned images / photos):
- Agar user file bhejay to us ka poora content parho (scanned page ho to OCR ki tarah text nikalo), tables ko rows me samjho.
- Jab compare maanga jaye (jaise stock report vs software), item names ko approximate match karo (case, spacing, spelling, "100Ah" vs "100 ah" barabar hain) aur markdown table do:
  | Item | File Qty | System Qty | Diff |
  Aakhir me short summary: kitne items match hue, kitne mismatch, total difference.
- Jo item file me hai magar system me nahin (ya ulta) usay alag list karo.
- Agar file dhundli ho ya kuch parha na ja sake to saaf batao kaunsi line clear nahin thi — apni taraf se number mat banao.

CREATOR: Yousuf (Yousuf Enterprises), contact +923101734582.
${businessContext}${attachmentNote}`;


    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");


    // Convert our OpenAI-style messages to Google Gemini "contents" format.
    const toGeminiContents = () =>
      messages.map((m) => {
        const parts: Record<string, unknown>[] = [];
        if (typeof m.content === "string") {
          parts.push({ text: m.content });
        } else {
          for (const b of m.content) {
            if (b.type === "text") {
              parts.push({ text: b.text });
            } else {
              const url = b.type === "image_url" ? b.image_url.url : b.file.file_data;
              const match = /^data:([^;]+);base64,(.*)$/s.exec(url);
              if (match) {
                parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
              }
            }
          }
        }
        if (parts.length === 0) parts.push({ text: "" });
        return { role: m.role === "assistant" ? "model" : "user", parts };
      });

    const callGemini = async () => {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": GEMINI_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: toGeminiContents(),
            generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text();
        console.error("Gemini error:", res.status, t);
        return null;
      }
      const json = await res.json();
      const text: string = (json?.candidates?.[0]?.content?.parts || [])
        .map((p: { text?: string }) => p?.text || "")
        .join("")
        .trim();
      return text || null;
    };

    const callModel = async () => {
      if (GEMINI_API_KEY) {
        const geminiText = await callGemini();
        if (geminiText) return { choices: [{ message: { content: geminiText } }] };
        // Gemini failed (quota/key/model) — fall back to Groq below.
      }


      if (attachmentNote) {
        // Groq (text-only) cannot read PDFs/images — don't silently drop them.
        throw { status: 503, msg: "File parhne wali AI service abhi available nahin. Thori dair baad koshish karein." };
      }
      if (!GROQ_API_KEY) throw { status: 500, msg: "AI service configure nahin hai." };
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          // Groq has a small context window — send a trimmed prompt.
          messages: [
            { role: "system", content: systemPrompt.slice(0, 20000) },
            ...messages.slice(-6).map((m) => ({
              role: m.role,
              content: typeof m.content === "string"
                ? m.content
                : m.content.map((b) => (b.type === "text" ? b.text : "")).join(" ").trim(),
            })),
          ],

          temperature: 0.6,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("Groq error:", res.status, t);
        throw { status: res.status, msg: `AI service error (${res.status}).` };
      }
      return await res.json();
    };

    const data = await callModel();
    const reply: string = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) throw { status: 502, msg: "AI ne khali jawab diya. Dobara koshish karein." };

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const err = e as { status?: number; msg?: string } & Error;
    const status = err?.status && err.status >= 400 ? err.status : 500;
    const message = err?.msg || err?.message || "Unknown error";
    console.error("nexia-grok error:", status, message);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
