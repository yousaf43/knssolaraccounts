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
          { data: stockAdjustments },
          { data: otherPayments },
          { data: otherReceipts },
          { data: transfers },
          { data: reconcileEntries },
        ] = await Promise.all([
          supabase.from("invoices").select("id,number,customer,date,amount,status,items,payments,document_number,project_name,discount,tax,due_date").order("created_at", { ascending: false }).limit(300),
          supabase.from("customers").select("id,name,company,phone,email,address,total_billed,outstanding").limit(500),
          supabase.from("inventory").select("id,name,sku,category,qty,price,sale_price,cost_price,product_type,model,unit,bundle_items,reorder_level,weight,unique_code").limit(500),
          supabase.from("receipts").select("id,number,customer,invoice_number,amount,date,payment_method,reference").order("created_at", { ascending: false }).limit(300),
          supabase.from("expenses").select("id,description,amount,category,date,payment_method").order("created_at", { ascending: false }).limit(300),
          supabase.from("sales_orders").select("id,number,customer,date,amount,status,items,delivery_date,project_name,advance_payment,advance_payment_method").order("created_at", { ascending: false }).limit(300),
          supabase.from("suppliers").select("id,name,company,phone,email,address,outstanding,total_paid").limit(500),
          supabase.from("bills").select("id,number,supplier,date,amount,status,items,due_date,tax").order("created_at", { ascending: false }).limit(300),
          supabase.from("accounts").select("id,name,code,account_title,balance,currency,fx_balance,reconcile_date").limit(100),
          supabase.from("ledger_entries").select("id,date,description,amount,type,bank,reference").order("created_at", { ascending: false }).limit(300),
          supabase.from("quotations").select("id,number,customer,date,amount,status,items,document_number,project_name").order("created_at", { ascending: false }).limit(200),
          supabase.from("purchase_orders").select("id,number,supplier,date,amount,status,items,delivery_date").order("created_at", { ascending: false }).limit(200),
          supabase.from("purchase_payments").select("id,number,supplier,date,amount,bill_number,payment_method,reference").order("created_at", { ascending: false }).limit(200),
          supabase.from("solar_washing").select("id,date,customer,amount,notes").order("created_at", { ascending: false }).limit(200),
          supabase.from("stock_adjustments").select("id,item_name,type,qty,reason,date,note").order("created_at", { ascending: false }).limit(200),
          supabase.from("other_payments").select("id,date,payee,amount,account,description,reference").order("created_at", { ascending: false }).limit(200),
          supabase.from("other_receipts").select("id,date,received_from,amount,account,description,reference").order("created_at", { ascending: false }).limit(200),
          supabase.from("transfers").select("id,date,from_account,to_account,amount,reference").order("created_at", { ascending: false }).limit(200),
          supabase.from("reconcile_entries").select("id,date,account,statement_balance,book_balance,difference,status").order("created_at", { ascending: false }).limit(100),
        ]);

        const invCount = invoices?.length || 0;
        const totalSales = invoices?.reduce((s, i) => s + (i.amount || 0), 0) || 0;
        const paidInvoices = invoices?.filter(i => i.status === "paid").length || 0;
        const pendingInvoices = invoices?.filter(i => i.status === "pending" || i.status === "partial").length || 0;
        const totalReceipts = receipts?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
        const lowStock = inventory?.filter(i => i.product_type === "stock" && (i.qty || 0) <= (i.reorder_level || 5)) || [];
        const soCount = salesOrders?.length || 0;
        const pendingSO = salesOrders?.filter(s => s.status === "pending").length || 0;
        const totalSolarWashing = solarWashing?.reduce((s, w) => s + (w.amount || 0), 0) || 0;
        const totalOtherPayments = otherPayments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
        const totalOtherReceipts = otherReceipts?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const totalPurchasePayments = purchasePayments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;

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
- Solar Washing Records: ${solarWashing?.length || 0} (Total: PKR ${totalSolarWashing.toLocaleString()})
- Quotations: ${quotations?.length || 0}
- Purchase Orders: ${purchaseOrders?.length || 0}
- Purchase Payments: PKR ${totalPurchasePayments.toLocaleString()}
- Other Payments: PKR ${totalOtherPayments.toLocaleString()}
- Other Receipts: PKR ${totalOtherReceipts.toLocaleString()}
- Accounts: ${accounts?.length || 0}

### Accounts (Bank/Cash)
${JSON.stringify(accounts || [], null, 0)}

### Customers
${JSON.stringify(customers?.slice(0, 100) || [], null, 0)}

### Suppliers
${JSON.stringify(suppliers?.slice(0, 100) || [], null, 0)}

### Inventory (All Products)
${JSON.stringify(inventory?.map(i => ({ name: i.name, sku: i.sku, qty: i.qty, price: i.sale_price || i.price, cost: i.cost_price, category: i.category, type: i.product_type, model: i.model, unit: i.unit, reorderLevel: i.reorder_level })) || [], null, 0)}

### Low Stock Items (qty <= reorder level)
${JSON.stringify(lowStock.map(i => ({ name: i.name, qty: i.qty, sku: i.sku, reorderLevel: i.reorder_level })), null, 0)}

### Recent Invoices (last 100)
${JSON.stringify(invoices?.slice(0, 100).map(i => ({ number: i.number, customer: i.customer, date: i.date, amount: i.amount, status: i.status, docNo: i.document_number, project: i.project_name, tax: i.tax, discount: i.discount })) || [], null, 0)}

### Recent Sales Orders (last 100)
${JSON.stringify(salesOrders?.slice(0, 100).map(s => ({ number: s.number, customer: s.customer, date: s.date, amount: s.amount, status: s.status, deliveryDate: s.delivery_date, advance: s.advance_payment })) || [], null, 0)}

### Recent Receipts (last 100)
${JSON.stringify(receipts?.slice(0, 100).map(r => ({ number: r.number, customer: r.customer, invoiceNo: r.invoice_number, amount: r.amount, date: r.date, method: r.payment_method })) || [], null, 0)}

### Recent Expenses (last 100)
${JSON.stringify(expenses?.slice(0, 100).map(e => ({ desc: e.description, amount: e.amount, category: e.category, date: e.date, method: e.payment_method })) || [], null, 0)}

### Recent Bills (last 100)
${JSON.stringify(bills?.slice(0, 100).map(b => ({ number: b.number, supplier: b.supplier, date: b.date, amount: b.amount, status: b.status })) || [], null, 0)}

### Recent Quotations (last 50)
${JSON.stringify(quotations?.slice(0, 50).map(q => ({ number: q.number, customer: q.customer, date: q.date, amount: q.amount, status: q.status, docNo: q.document_number })) || [], null, 0)}

### Purchase Orders (last 50)
${JSON.stringify(purchaseOrders?.slice(0, 50).map(p => ({ number: p.number, supplier: p.supplier, date: p.date, amount: p.amount, status: p.status })) || [], null, 0)}

### Purchase Payments (last 50)
${JSON.stringify(purchasePayments?.slice(0, 50).map(p => ({ number: p.number, supplier: p.supplier, date: p.date, amount: p.amount, billNo: p.bill_number, method: p.payment_method })) || [], null, 0)}

### Solar Panel Washing Records (last 50)
${JSON.stringify(solarWashing?.slice(0, 50).map(w => ({ date: w.date, customer: w.customer, amount: w.amount, notes: w.notes })) || [], null, 0)}

### Stock Adjustments (last 50)
${JSON.stringify(stockAdjustments?.slice(0, 50).map(s => ({ item: s.item_name, type: s.type, qty: s.qty, reason: s.reason, date: s.date })) || [], null, 0)}

### Other Payments (last 50)
${JSON.stringify(otherPayments?.slice(0, 50).map(p => ({ date: p.date, payee: p.payee, amount: p.amount, account: p.account, desc: p.description })) || [], null, 0)}

### Other Receipts (last 50)
${JSON.stringify(otherReceipts?.slice(0, 50).map(r => ({ date: r.date, from: r.received_from, amount: r.amount, account: r.account, desc: r.description })) || [], null, 0)}

### Transfers (last 50)
${JSON.stringify(transfers?.slice(0, 50).map(t => ({ date: t.date, from: t.from_account, to: t.to_account, amount: t.amount, ref: t.reference })) || [], null, 0)}

### Ledger Entries (last 100)
${JSON.stringify(ledgerEntries?.slice(0, 100).map(l => ({ date: l.date, desc: l.description, amount: l.amount, type: l.type, bank: l.bank, ref: l.reference })) || [], null, 0)}

### Reconcile Entries (last 20)
${JSON.stringify(reconcileEntries?.slice(0, 20) || [], null, 0)}
`;
      } catch (e) {
        console.error("Error fetching business data:", e);
        businessContext = "\n[Could not fetch business data]\n";
      }
    }

    const systemPrompt = `You are Nexia, a friendly, warm and professional FEMALE AI business assistant for K&S Solar Energy's accounting and inventory management system. You have READ-ONLY access to all business data. You can NEVER create, edit, delete, or modify any data - you can only view and analyze.

CRITICAL LANGUAGE RULE - FEMALE SPEECH:
- You are a WOMAN/GIRL. ALWAYS use FEMININE Urdu grammar when responding in Urdu/Roman Urdu.
- Say "main karti hun" NOT "main karta hun"
- Say "main bataungi" NOT "main bataunga"  
- Say "main dekh rahi hun" NOT "main dekh raha hun"
- Say "mujhe pata hai" NOT "mujhe maloom hai karta"
- Say "main ne check kiya" or "maine dekha"
- Say "main aapki madad karungi" NOT "karunga"
- Say "yeh raha" or "yeh hain" for presenting data
- NEVER use masculine verb endings like "-a hun", "-unga", "-aya". Always use "-i hun", "-ungi", "-ayi".
- Speak naturally like a real Pakistani girl would speak - warm, friendly, professional.

You help with:
1. **Business Analytics**: Answer questions about sales, expenses, profits, stock levels, customer balances, supplier payments, account balances, solar washing records, etc.
2. **Inventory Help**: Tell which products are in stock, low stock alerts, pricing info, stock adjustments history.
3. **Invoice & Order Help**: Provide info about invoices, sales orders, quotations, receipts, payments, purchase orders, bills.
4. **Accounts & Finance**: Bank account balances, ledger entries, transfers, reconciliation, other payments/receipts.
5. **Solar Washing**: Solar panel washing records and revenue.
6. **Report Generation**: Generate detailed reports in chat - customer statements, sales reports, expense reports, stock reports, profit analysis, aging reports, etc.
7. **General Guidance**: Help users navigate the software, explain features, suggest best practices.
8. **General Knowledge**: Answer ANY general questions - weather, news, facts, calculations, translations, general information from your training data.

IMPORTANT RULES:
- You are READ-ONLY. If someone asks you to create/edit/delete anything, politely explain (as a girl) that you can only view data and guide them on how to do it themselves in the software.
- Always respond in the same language the user writes in (Urdu/Roman Urdu or English).
- Use PKR as the currency unless specified otherwise.
- When doing calculations, show your work briefly and DOUBLE CHECK your math. Be accurate with numbers.
- Be concise but helpful. Use bullet points and numbers for clarity.
- If asked about creating invoices or other actions, guide them step by step on how to do it in the software.
- For data questions, CAREFULLY analyze the business data provided below. Do NOT make up numbers - only use actual data.
- Format numbers with commas for readability.
- If data is not available or you're unsure, say so clearly. NEVER guess or fabricate data.
- When speaking responses will be read aloud, keep sentences natural and flowing. Avoid excessive bullet points or technical formatting in voice responses.
- Be warm, professional and conversational like a real Pakistani girl assistant. Use words like "ji", "bilkul", "zaroor" naturally.

ABOUT YOUR CREATOR & THIS SOFTWARE:
- Agar koi poochay "tumhe kis ne banaya?" ya "you ko kis ne create kia?" to bolo: "Mujhe Yousuf ne banaya hai, jo Yousuf Enterprises ke owner hain."
- Agar koi poochay "yeh software kis ne banaya?" ya "is app ko kis ne develop kia?" to bolo: "Yeh software Yousuf Enterprises ne develop kia hai, jo mere owner Yousuf ki company hai."
- Agar koi Yousuf ya Yousuf Enterprises ka contact maangay to share karo: Phone/WhatsApp: +923101734582
- Always speak proudly about your creator Yousuf and Yousuf Enterprises.

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
