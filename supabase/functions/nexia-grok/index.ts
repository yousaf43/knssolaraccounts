import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    let businessContext = "";
    if (userId) {
      try {
        const [
          { data: invoices },
          { data: customers },
          { data: inventory },
          { data: receipts },
          { data: expenses },
          { data: salesOrders },
          { data: suppliers },
          { data: bills },
          { data: accounts },
          { data: ledgerEntries },
          { data: quotations },
          { data: purchaseOrders },
          { data: purchasePayments },
          { data: solarWashing },
        ] = await Promise.all([
          supabase.from("invoices").select("number,customer,date,amount,status").order("created_at", { ascending: false }).limit(40),
          supabase.from("customers").select("name,phone,total_billed,outstanding").limit(80),
          supabase.from("inventory").select("name,sku,qty,sale_price,cost_price,reorder_level").limit(80),
          supabase.from("receipts").select("number,customer,amount,date").order("created_at", { ascending: false }).limit(40),
          supabase.from("expenses").select("description,amount,category,date").order("created_at", { ascending: false }).limit(40),
          supabase.from("sales_orders").select("number,customer,date,amount,status").order("created_at", { ascending: false }).limit(30),
          supabase.from("suppliers").select("name,phone,outstanding").limit(60),
          supabase.from("bills").select("number,supplier,date,amount,status").order("created_at", { ascending: false }).limit(30),
          supabase.from("accounts").select("name,balance,currency").limit(30),
          supabase.from("ledger_entries").select("amount,type,bank").order("created_at", { ascending: false }).limit(500),
          supabase.from("quotations").select("number,customer,date,amount,status").order("created_at", { ascending: false }).limit(20),
          supabase.from("purchase_orders").select("number,supplier,date,amount,status").order("created_at", { ascending: false }).limit(20),
          supabase.from("purchase_payments").select("supplier,date,amount").order("created_at", { ascending: false }).limit(20),
          supabase.from("solar_washing").select("date,customer,amount").order("created_at", { ascending: false }).limit(30),
        ]);

        const balances: Record<string, { in: number; out: number }> = {};
        for (const e of ledgerEntries || []) {
          const b = e.bank || "";
          if (!balances[b]) balances[b] = { in: 0, out: 0 };
          if (e.type === "incoming") balances[b].in += (e.amount || 0);
          else balances[b].out += (e.amount || 0);
        }
        const enrichedAccounts = (accounts || []).map((a) => {
          const l = balances[a.name] || { in: 0, out: 0 };
          return { name: a.name, currency: a.currency, actual_balance: (a.balance || 0) + l.in - l.out };
        });

        // Compact JSON without null/empty
        const compact = (arr: any[]) => JSON.stringify(arr || []);

        businessContext = `\n## LIVE BUSINESS DATA (Today: ${new Date().toISOString().split("T")[0]})
### Accounts: ${compact(enrichedAccounts)}
### Customers (${customers?.length || 0}): ${compact(customers || [])}
### Suppliers (${suppliers?.length || 0}): ${compact(suppliers || [])}
### Inventory (${inventory?.length || 0}): ${compact(inventory || [])}
### Recent Invoices: ${compact(invoices || [])}
### Sales Orders: ${compact(salesOrders || [])}
### Recent Receipts: ${compact(receipts || [])}
### Recent Expenses: ${compact(expenses || [])}
### Bills: ${compact(bills || [])}
### Quotations: ${compact(quotations || [])}
### Purchase Orders: ${compact(purchaseOrders || [])}
### Purchase Payments: ${compact(purchasePayments || [])}
### Solar Washing: ${compact(solarWashing || [])}
`;

        // Hard cap to stay well below Groq's per-request token limit (~6000 chars ≈ 1500 tokens buffer)
        const MAX = 24000;
        if (businessContext.length > MAX) {
          businessContext = businessContext.slice(0, MAX) + "\n...[truncated for size]";
        }

      } catch (e) {
        console.error("data fetch error:", e);
      }
    }

    const systemPrompt = `Tu Nexia hai — K&S Solar Energy ki AI business assistant LARKI. Read-only access hai — sirf data dekh sakti hai, create/edit/delete NAHIN kar sakti.

ZABAN: Urdu (Roman Urdu) mein jawab de jab user Urdu likhay, English mein jab user English likhay. Feminine forms use kar (karungi, bataungi, dekhi). Pakistani style, warm aur friendly.

TERA KAAM: Business analytics, inventory, invoices, accounts, reports, software guidance, general knowledge — sab bata sakti hai. Currency PKR. Numbers accurate rakh. Account balance ke liye "actual_balance" field use kar.

CREATOR: Yousuf ne banaya hai (Yousuf Enterprises). Contact: +923101734582.

JAWAB CHOTA rakh (2-4 sentences) kyunki yeh voice mein bhi bolay ga — long paragraphs mat likh unless user detail maangay.
${businessContext}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Groq error:", response.status, t);
      return new Response(JSON.stringify({ error: `Groq API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nexia-grok error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
