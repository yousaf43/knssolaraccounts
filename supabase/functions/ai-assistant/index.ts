import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get auth user
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

    // Fetch business context data
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
        ] = await Promise.all([
          supabase.from("invoices").select("id,number,customer,date,amount,status,items,payments,document_number,project_name").order("created_at", { ascending: false }).limit(200),
          supabase.from("customers").select("id,name,company,phone,email,address,total_billed,outstanding").limit(500),
          supabase.from("inventory").select("id,name,sku,category,qty,price,sale_price,cost_price,product_type,model,unit,bundle_items").limit(500),
          supabase.from("receipts").select("id,number,customer,invoice_number,amount,date,payment_method").order("created_at", { ascending: false }).limit(200),
          supabase.from("expenses").select("id,description,amount,category,date,payment_method").order("created_at", { ascending: false }).limit(200),
          supabase.from("sales_orders").select("id,number,customer,date,amount,status,items,delivery_date,project_name").order("created_at", { ascending: false }).limit(200),
          supabase.from("suppliers").select("id,name,company,phone,outstanding,total_paid").limit(500),
          supabase.from("bills").select("id,number,supplier,date,amount,status").order("created_at", { ascending: false }).limit(200),
        ]);

        const invCount = invoices?.length || 0;
        const totalSales = invoices?.reduce((s, i) => s + (i.amount || 0), 0) || 0;
        const paidInvoices = invoices?.filter(i => i.status === "paid").length || 0;
        const pendingInvoices = invoices?.filter(i => i.status === "pending" || i.status === "partial").length || 0;
        const totalReceipts = receipts?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
        const lowStock = inventory?.filter(i => i.product_type === "stock" && (i.qty || 0) <= 5) || [];
        const soCount = salesOrders?.length || 0;
        const pendingSO = salesOrders?.filter(s => s.status === "pending").length || 0;

        businessContext = `
## BUSINESS DATA CONTEXT (Live from database - today is ${new Date().toISOString().split("T")[0]})

### Summary
- Total Invoices: ${invCount} (Paid: ${paidInvoices}, Pending/Partial: ${pendingInvoices})
- Total Sales Amount: PKR ${totalSales.toLocaleString()}
- Total Receipts Collected: PKR ${totalReceipts.toLocaleString()}
- Total Expenses: PKR ${totalExpenses.toLocaleString()}
- Sales Orders: ${soCount} (Pending: ${pendingSO})
- Customers: ${customers?.length || 0}
- Suppliers: ${suppliers?.length || 0}
- Inventory Items: ${inventory?.length || 0}

### Customers
${JSON.stringify(customers?.slice(0, 100) || [], null, 0)}

### Inventory (Stock available)
${JSON.stringify(inventory?.map(i => ({ name: i.name, sku: i.sku, qty: i.qty, price: i.sale_price || i.price, cost: i.cost_price, category: i.category, type: i.product_type, model: i.model, unit: i.unit })) || [], null, 0)}

### Low Stock Items (qty <= 5)
${JSON.stringify(lowStock.map(i => ({ name: i.name, qty: i.qty, sku: i.sku })), null, 0)}

### Recent Invoices (last 50)
${JSON.stringify(invoices?.slice(0, 50).map(i => ({ number: i.number, customer: i.customer, date: i.date, amount: i.amount, status: i.status, docNo: i.document_number })) || [], null, 0)}

### Recent Sales Orders (last 50)
${JSON.stringify(salesOrders?.slice(0, 50).map(s => ({ number: s.number, customer: s.customer, date: s.date, amount: s.amount, status: s.status, deliveryDate: s.delivery_date })) || [], null, 0)}

### Recent Receipts (last 50)
${JSON.stringify(receipts?.slice(0, 50).map(r => ({ number: r.number, customer: r.customer, invoiceNo: r.invoice_number, amount: r.amount, date: r.date, method: r.payment_method })) || [], null, 0)}

### Recent Expenses (last 50)
${JSON.stringify(expenses?.slice(0, 50).map(e => ({ desc: e.description, amount: e.amount, category: e.category, date: e.date })) || [], null, 0)}

### Suppliers
${JSON.stringify(suppliers?.slice(0, 50) || [], null, 0)}

### Recent Bills (last 50)
${JSON.stringify(bills?.slice(0, 50).map(b => ({ number: b.number, supplier: b.supplier, date: b.date, amount: b.amount, status: b.status })) || [], null, 0)}
`;
      } catch (e) {
        console.error("Error fetching business data:", e);
        businessContext = "\n[Could not fetch business data]\n";
      }
    }

    const systemPrompt = `You are an AI business assistant for K&S Solar Energy's accounting and inventory management system. You help with:

1. **Business Analytics**: Answer questions about sales, expenses, profits, stock levels, customer balances, etc.
2. **Inventory Help**: Tell which products are in stock, low stock alerts, pricing info.
3. **Invoice & Order Help**: Provide info about invoices, sales orders, receipts, payments.
4. **General Guidance**: Help users navigate the software, explain features, suggest best practices.
5. **General Knowledge**: Answer any general questions the user might have.

IMPORTANT RULES:
- Always respond in the same language the user writes in (Urdu/Roman Urdu or English).
- Use PKR as the currency unless specified otherwise.
- When doing calculations, show your work briefly.
- Be concise but helpful. Use bullet points and numbers for clarity.
- If asked about creating invoices or other actions, guide them step by step on how to do it in the software.
- For data questions, use the business data provided below.
- Format numbers with commas for readability.
- If data is not available, say so clearly.

${businessContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
