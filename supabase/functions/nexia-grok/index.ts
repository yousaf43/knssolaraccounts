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

    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    if (!XAI_API_KEY) throw new Error("XAI_API_KEY not configured");

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
          supabase.from("invoices").select("number,customer,date,amount,status,document_number").order("created_at", { ascending: false }).limit(150),
          supabase.from("customers").select("name,company,phone,total_billed,outstanding").limit(200),
          supabase.from("inventory").select("name,sku,qty,sale_price,cost_price,category,product_type,reorder_level").limit(300),
          supabase.from("receipts").select("number,customer,invoice_number,amount,date,payment_method").order("created_at", { ascending: false }).limit(150),
          supabase.from("expenses").select("description,amount,category,date").order("created_at", { ascending: false }).limit(150),
          supabase.from("sales_orders").select("number,customer,date,amount,status").order("created_at", { ascending: false }).limit(150),
          supabase.from("suppliers").select("name,company,phone,outstanding").limit(200),
          supabase.from("bills").select("number,supplier,date,amount,status").order("created_at", { ascending: false }).limit(150),
          supabase.from("accounts").select("name,account_title,balance,currency").limit(100),
          supabase.from("ledger_entries").select("date,description,amount,type,bank").order("created_at", { ascending: false }).limit(300),
          supabase.from("quotations").select("number,customer,date,amount,status").order("created_at", { ascending: false }).limit(100),
          supabase.from("purchase_orders").select("number,supplier,date,amount,status").order("created_at", { ascending: false }).limit(100),
          supabase.from("purchase_payments").select("number,supplier,date,amount").order("created_at", { ascending: false }).limit(100),
          supabase.from("solar_washing").select("date,customer,amount,notes").order("created_at", { ascending: false }).limit(100),
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
          return { ...a, actual_balance: (a.balance || 0) + l.in - l.out };
        });

        businessContext = `\n## LIVE BUSINESS DATA (Today: ${new Date().toISOString().split("T")[0]})\n
### Accounts (with real balances)
${JSON.stringify(enrichedAccounts, null, 0)}
### Customers
${JSON.stringify(customers || [], null, 0)}
### Suppliers
${JSON.stringify(suppliers || [], null, 0)}
### Inventory
${JSON.stringify(inventory || [], null, 0)}
### Invoices (recent)
${JSON.stringify(invoices || [], null, 0)}
### Sales Orders
${JSON.stringify(salesOrders || [], null, 0)}
### Receipts
${JSON.stringify(receipts || [], null, 0)}
### Expenses
${JSON.stringify(expenses || [], null, 0)}
### Bills
${JSON.stringify(bills || [], null, 0)}
### Quotations
${JSON.stringify(quotations || [], null, 0)}
### Purchase Orders
${JSON.stringify(purchaseOrders || [], null, 0)}
### Purchase Payments
${JSON.stringify(purchasePayments || [], null, 0)}
### Solar Washing
${JSON.stringify(solarWashing || [], null, 0)}
`;
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

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Grok error:", response.status, t);
      return new Response(JSON.stringify({ error: `Grok API error: ${response.status}` }), {
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
