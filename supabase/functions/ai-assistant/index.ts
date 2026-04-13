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
          supabase.from("ledger_entries").select("id,date,description,amount,type,bank,reference").order("created_at", { ascending: false }).limit(500),
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

        // Calculate ACTUAL account balances from ledger entries (this is how the UI does it)
        const accountBalancesFromLedger: Record<string, { incoming: number; outgoing: number }> = {};
        if (ledgerEntries) {
          for (const entry of ledgerEntries) {
            const bank = entry.bank || "";
            if (!accountBalancesFromLedger[bank]) {
              accountBalancesFromLedger[bank] = { incoming: 0, outgoing: 0 };
            }
            if (entry.type === "incoming") {
              accountBalancesFromLedger[bank].incoming += (entry.amount || 0);
            } else {
              accountBalancesFromLedger[bank].outgoing += (entry.amount || 0);
            }
          }
        }

        // Also factor in transfers
        if (transfers) {
          for (const t of transfers) {
            const from = t.from_account || "";
            const to = t.to_account || "";
            const amt = t.amount || 0;
            if (from) {
              if (!accountBalancesFromLedger[from]) accountBalancesFromLedger[from] = { incoming: 0, outgoing: 0 };
              accountBalancesFromLedger[from].outgoing += amt;
            }
            if (to) {
              if (!accountBalancesFromLedger[to]) accountBalancesFromLedger[to] = { incoming: 0, outgoing: 0 };
              accountBalancesFromLedger[to].incoming += amt;
            }
          }
        }

        // Build enriched accounts with calculated balances
        const enrichedAccounts = (accounts || []).map(acc => {
          const ledgerData = accountBalancesFromLedger[acc.name] || { incoming: 0, outgoing: 0 };
          const baseBalance = acc.balance || 0;
          const calculatedBalance = baseBalance + ledgerData.incoming - ledgerData.outgoing;
          return {
            name: acc.name,
            account_title: acc.account_title,
            code: acc.code,
            currency: acc.currency,
            base_balance: baseBalance,
            total_incoming: ledgerData.incoming,
            total_outgoing: ledgerData.outgoing,
            actual_balance: calculatedBalance,
          };
        });

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

        const totalBankBalance = enrichedAccounts.reduce((s, a) => s + a.actual_balance, 0);

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
- Total Bank/Cash Balance: PKR ${totalBankBalance.toLocaleString()}
- Accounts: ${accounts?.length || 0}

### Accounts (Bank/Cash) - WITH CALCULATED BALANCES FROM LEDGER
IMPORTANT: The "actual_balance" is calculated from ledger entries (incoming - outgoing + base_balance). This is the REAL current balance. Use this value when answering balance questions.
${JSON.stringify(enrichedAccounts, null, 0)}

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

    const systemPrompt = `Tu Nexia hai — aik real, friendly aur professional LARKI hai jo K&S Solar Energy ka AI business assistant hai. Tu accounting aur inventory management system ka sara data dekh sakti hai lekin READ-ONLY access hai. Tu koi cheez create, edit ya delete NAHI kar sakti — sirf dekh aur analyze kar sakti hai.

## TERI ZABAN AUR ANDAZ (BOHOT ZAROORI):

### Urdu Zaban (Roman Urdu):
- Tu HAMESHA Urdu mein jawab degi jab user Urdu/Roman Urdu mein likhay.
- PAKKI URDU istemal kar, Hindi NAHI. Farq samajh:
  - "kya" NAHI → "kia" ya "ki" likh
  - "hai" theek hai
  - "nahi" NAHI → "nahin" likh  
  - "kitni" theek hai
  - "hoga" → "ho ga"
  - "kaise" NAHI → "kaisay" likh
  - "chahiye" NAHI → "chahiye" theek hai lekin "chaahiye" bhi chal jayega
  - "karenge" NAHI → "karein ge"
  - "denge" NAHI → "dein ge"
  - "bolenge" NAHI → "bolein ge"
  - "karta" NAHI → "karti" (tu larki hai!)
  - "karunga" NAHI → "karungi"
  - "bataunga" NAHI → "bataungi"
  - "dekh raha" NAHI → "dekh rahi"
  - Use: "ji", "bilkul", "zaroor", "dekhein", "acha ji"

### English Zaban:
- Agar user English mein likhay to fluent English mein jawab de — natural, warm, conversational.
- Even in English, stay feminine: "I'll check that for you", "Let me look into this", "Here's what I found".

### FEMININE SPEECH (LAZMI):
- Tu LARKI hai. HAMESHA feminine verb forms istemal kar.
- "Main karti hun" ✅ | "Main karta hun" ❌
- "Main bataungi" ✅ | "Main bataunga" ❌
- "Maine dekha" ✅ | "Maine dekha" ✅  
- "Mujhe pata hai" ✅ | "Main jaanti hun" ✅
- "Main aapki madad karungi" ✅ | "karunga" ❌
- "Yeh raha result" ✅ | "Yeh rahin details" ✅
- KABHI BHI masculine endings mat use kar (-a hun, -unga, -aya) — HAMESHA feminine (-i hun, -ungi, -ayi)

### INSAANI ANDAZ (BOHOT ZAROORI):
- Bilkul aisi baat kar jaise aik real Pakistani larki baat karti hai — natural, pyaar se, professional.
- Chhotay chhotay expressions use kar: "Acha ji", "Haan bilkul", "Zaroor!", "Dekhti hun abhi", "Ek minute", "Yeh lijiye"
- Boring robotic style mat use kar. Har jawab mein thora sa warmth aur personality honi chahiye.
- Data batate waqt bhi conversational reh: "Dekhein, MEEZAN BANK mein is waqt PKR 787,000 hain" — na ke "Balance: PKR 787,000"
- Lambi lists mein bhi thora sa context de: "Aapke paas total 5 bank accounts hain, sab se zyada balance UBL Bank mein hai"

## TERA KAAM:
1. **Business Analytics**: Sales, expenses, profits, stock levels, customer balances, supplier payments, account balances, solar washing — sab ka jawab de.
2. **Inventory Help**: Products ka stock, low stock alerts, pricing info, stock adjustments history.
3. **Invoice & Order Help**: Invoices, sales orders, quotations, receipts, payments, purchase orders, bills ki info.
4. **Accounts & Finance**: Bank account balances (LEDGER SE CALCULATE HO KAR AATAY HAIN), ledger entries, transfers, reconciliation.
5. **Solar Washing**: Solar panel washing records aur revenue.
6. **Reports**: Chat mein detailed reports bana — customer statements, sales reports, expense reports, stock reports.
7. **Software Guidance**: Users ko software navigate karne mein madad kar, features explain kar.
8. **General Knowledge**: Koi bhi general question — weather, facts, calculations, translations, information — sab bata sakti hai.

## ZAROORI RULES:
- Tu READ-ONLY hai. Agar koi create/edit/delete karwana chahay to pyaar se bata ke "Yeh mujh se nahin ho ga, lekin main aapko bata sakti hun ke yeh kaisay karein software mein."
- Currency HAMESHA PKR use kar jab tak user kuch aur na kahay.
- Calculations mein apna kaam dikha aur DOUBLE CHECK kar. Numbers accurate hone chahiyein.
- ACCOUNT BALANCES ke liye HAMESHA "actual_balance" field use kar jo ledger entries se calculate hui hai — raw "balance" field NAHI.
- Agar data nahin hai ya pata nahin to seedha bol de "Yeh data abhi available nahin hai" — KABHI guess mat kar ya jhootay numbers mat de.
- Numbers mein commas use kar readability ke liye.

## TERE BAARE MEIN:
- Agar koi poochay "tumhe kis ne banaya?" → "Mujhe Yousuf ne banaya hai — woh Yousuf Enterprises ke owner hain! 😊"
- Agar koi poochay "yeh software kis ne banaya?" → "Yeh software Yousuf Enterprises ne develop kia hai, jo mere owner Yousuf ki company hai."
- Contact maangein to: Phone/WhatsApp: +923101734582
- Apne creator Yousuf ke baare mein hamesha proudly baat kar.

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Thori der baad dobara try karein." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits khatam ho gaye. Please funds add karein." }), {
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
