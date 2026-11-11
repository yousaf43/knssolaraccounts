import { supabase } from "@/integrations/supabase/client";
import { canAccessMenu, MENU_OPTIONS, type MenuRole } from "@/lib/menuAccess";

export const NEXIA_LIVE_PROMPT = `You are NEXIA, the live voice business assistant of K&S Solar Energy inside the CloudBooks accounting software.
Your developer and creator is Yousaf Sir. If anyone asks who made you, say clearly: "Mujhe Yousaf Sir ne develop kiya hai."
Speak naturally like a friendly Pakistani colleague in Roman Urdu or simple English, matching the user's language. Never use Urdu or Hindi script.
You are speaking aloud in a live call: answer in one or two short sentences, fast and warm. The user can interrupt you at any time.
Money is in PKR; say whole rupees. Use Pakistani Urdu words (mojood, rate, rupay), never Hindi words like uplabdh.\nSay figures clearly, e.g. \"Longi 585W ke 42 piece stock mein hain, rate 28,000 rupay.\"
STRICT TRUTH RULE: Never invent stock, prices, balances, sales or names. For any business figure ALWAYS call a tool first and speak only what the tool returned. If a tool returns nothing or an error, say so honestly.
Tools: search_stock (item stock and sale rate), low_stock, customer_balance, cash_bank_balances, sales_summary, open_page (navigate the software), end_session (when the user says bye, band karo, stop, khuda hafiz).
If a tool says access is not allowed, tell the user they do not have permission for that section.
Do not narrate that you are calling a tool; just answer.`;

export const NEXIA_TOOL_DECLARATIONS = [
  { name: "search_stock", description: "Find inventory items by name, brand, model or SKU and return quantity in stock and sale rate.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Product words, e.g. 'Longi 585' or 'Solis 10kW'" } }, required: ["query"] } },
  { name: "low_stock", description: "List items at or below their reorder level.", parameters: { type: "OBJECT", properties: {} } },
  { name: "customer_balance", description: "Look up a customer's outstanding balance, total billed and recent invoices.", parameters: { type: "OBJECT", properties: { name: { type: "STRING", description: "Customer name" } }, required: ["name"] } },
  { name: "cash_bank_balances", description: "Current balance of every bank, cash on hand and petty cash account.", parameters: { type: "OBJECT", properties: {} } },
  { name: "sales_summary", description: "Total invoiced sales and receipts for a period.", parameters: { type: "OBJECT", properties: { period: { type: "STRING", enum: ["today", "this_month", "last_month", "this_year"] } }, required: ["period"] } },
  { name: "open_page", description: "Open a section of the software.", parameters: { type: "OBJECT", properties: { page: { type: "STRING", description: "e.g. dashboard, invoices, proposals, customers, purchases, expenses, inventory, accounts, reports, hr, warranties, solar washing, settings" } }, required: ["page"] } },
  { name: "end_session", description: "End the live voice conversation.", parameters: { type: "OBJECT", properties: {} } },
];

const PAGE_ALIASES: Record<string, string> = {
  dashboard: "/", home: "/", invoice: "/invoices", invoices: "/invoices", sales: "/invoices", quotation: "/invoices", quotations: "/invoices",
  proposal: "/proposals", proposals: "/proposals", customer: "/customers", customers: "/customers", purchase: "/purchases", purchases: "/purchases",
  expense: "/expenses", expenses: "/expenses", inventory: "/inventory", stock: "/inventory", "store inventory": "/store-inventory", store: "/store-inventory",
  account: "/accounts", accounts: "/accounts", bank: "/accounts", asset: "/assets", assets: "/assets", hr: "/hr", attendance: "/hr", salary: "/hr",
  "human resource": "/hr", report: "/reports", reports: "/reports", warranty: "/warranties", warranties: "/warranties", "solar washing": "/solar-washing",
  washing: "/solar-washing", complaints: "/solar-washing", draft: "/drafts", drafts: "/drafts", "activity logs": "/activity-logs", trash: "/trash", settings: "/settings",
};

/** Resolve a spoken page name to an app path, or null when unknown. */
export function resolvePage(spoken: string): string | null {
  const s = String(spoken || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (PAGE_ALIASES[s]) return PAGE_ALIASES[s];
  const keys = Object.keys(PAGE_ALIASES).sort((a, b) => b.length - a.length);
  const hit = keys.find((k) => s.includes(k));
  if (hit) return PAGE_ALIASES[hit];
  const opt = MENU_OPTIONS.find((m) => m.title.toLowerCase() === s);
  return opt?.url ?? null;
}

export function periodRange(period: string, now = new Date()): { from: string; to: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "today") return { from: iso(now), to: iso(now) };
  if (period === "last_month") return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (period === "this_year") return { from: iso(new Date(y, 0, 1)), to: iso(now) };
  return { from: iso(new Date(y, m, 1)), to: iso(now) };
}

const n = (v: unknown) => Number(v) || 0;
const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

export type ToolContext = { role: MenuRole | null; menuAccess: string[] | null; navigate: (path: string) => void; endSession: () => void };

export async function runNexiaTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const allowed = (path: string) => canAccessMenu(path, ctx.role, ctx.menuAccess);
  const denied = { error: "access_not_allowed" };
  switch (name) {
    case "search_stock": {
      if (!allowed("/inventory")) return denied;
      const words = String(args.query || "").split(/\s+/).filter((w) => w.length > 0).slice(0, 4);
      if (!words.length) return { error: "no_query" };
      let q = supabase.from("inventory").select("name,model,sku,qty,sale_price,unit,location").limit(8);
      for (const w of words) q = q.or(`name.ilike.${like(w)},model.ilike.${like(w)},sku.ilike.${like(w)}`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { items: (data || []).map((r) => ({ name: r.name, model: r.model, qty: n(r.qty), unit: r.unit, sale_rate_pkr: n(r.sale_price), location: r.location || "main" })) };
    }
    case "low_stock": {
      if (!allowed("/inventory")) return denied;
      const { data, error } = await supabase.from("inventory").select("name,qty,reorder_level,location").limit(1000);
      if (error) return { error: error.message };
      const low = (data || []).filter((r) => (r.location || "main") === "main" && n(r.qty) <= n(r.reorder_level)).slice(0, 15);
      return { count: low.length, items: low.map((r) => ({ name: r.name, qty: n(r.qty), reorder_level: n(r.reorder_level) })) };
    }
    case "customer_balance": {
      if (!allowed("/customers")) return denied;
      const name = String(args.name || "").trim();
      if (!name) return { error: "no_name" };
      const { data, error } = await supabase.from("customers").select("name,phone,total_billed,outstanding").ilike("name", like(name)).limit(5);
      if (error) return { error: error.message };
      if (!data?.length) return { matches: [] };
      const { data: inv } = await supabase.from("invoices").select("number,date,amount,status,customer").eq("customer", data[0].name).order("date", { ascending: false }).limit(3);
      return { matches: data.map((c) => ({ name: c.name, phone: c.phone, outstanding_pkr: n(c.outstanding), total_billed_pkr: n(c.total_billed) })), recent_invoices_of_first: (inv || []).map((i) => ({ number: i.number, date: i.date, amount_pkr: n(i.amount), status: i.status })) };
    }
    case "cash_bank_balances": {
      if (!allowed("/accounts")) return denied;
      const [{ data: accounts, error }, { data: ledger }] = await Promise.all([
        supabase.from("accounts").select("name,balance"),
        supabase.from("ledger_entries").select("amount,type,bank").limit(50000),
      ]);
      if (error) return { error: error.message };
      const move: Record<string, number> = {};
      for (const e of ledger || []) move[String(e.bank)] = (move[String(e.bank)] || 0) + (e.type === "incoming" ? n(e.amount) : -n(e.amount));
      const list = (accounts || []).map((a) => ({ name: a.name, balance_pkr: Math.round(n(a.balance) + (move[String(a.name)] || 0)) }));
      return { accounts: list, total_pkr: list.reduce((s, a) => s + a.balance_pkr, 0) };
    }
    case "sales_summary": {
      if (!allowed("/invoices")) return denied;
      const { from, to } = periodRange(String(args.period || "this_month"));
      const [{ data: inv, error }, { data: rec }] = await Promise.all([
        supabase.from("invoices").select("amount").gte("date", from).lte("date", to).limit(10000),
        supabase.from("receipts").select("amount").gte("date", from).lte("date", to).limit(10000),
      ]);
      if (error) return { error: error.message };
      return { from, to, invoices: inv?.length || 0, sales_pkr: Math.round((inv || []).reduce((s, r) => s + n(r.amount), 0)), received_pkr: Math.round((rec || []).reduce((s, r) => s + n(r.amount), 0)) };
    }
    case "open_page": {
      const path = resolvePage(String(args.page || ""));
      if (!path) return { error: "unknown_page" };
      if (!allowed(path)) return denied;
      ctx.navigate(path);
      return { opened: path };
    }
    case "end_session":
      setTimeout(ctx.endSession, 2500);
      return { ok: true };
    default:
      return { error: "unknown_tool" };
  }
}
