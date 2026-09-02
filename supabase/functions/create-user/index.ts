import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const RoleSchema = z.enum(["admin", "accountant", "sales"]);
const CompanySchema = z.object({ name: z.string().trim().min(1).max(200), contact_email: z.string().email().nullable().optional(), phone: z.string().max(80).nullable().optional(), address: z.string().max(500).nullable().optional(), plan: z.string().trim().min(1).max(50), status: z.enum(["active", "paused", "disabled"]), starts_at: z.string().date(), expires_at: z.string().date().nullable().optional(), notes: z.string().max(1000).nullable().optional() });
const AdminSchema = z.object({ fullName: z.string().trim().min(1).max(200), email: z.string().email(), password: z.string().min(6).max(200) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!supabaseUrl || !serviceRoleKey || !anonKey || !authHeader) return jsonResponse({ error: "Not authenticated" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return jsonResponse({ error: "Not authenticated" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: superAdmin }, { data: callerProfile }, { data: callerRole }] = await Promise.all([
      adminClient.from("super_admins").select("user_id").eq("user_id", caller.id).maybeSingle(),
      adminClient.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle(),
      adminClient.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle(),
    ]);
    const callerIsSuperAdmin = Boolean(superAdmin);
    const callerIsAdmin = callerRole?.role === "admin";
    const body = await req.json();
    const action = z.string().safeParse(body?.action);
    if (!action.success) return jsonResponse({ error: "Invalid action" }, 400);

    if (action.data === "create-company") {
      if (!callerIsSuperAdmin) return jsonResponse({ error: "Only the platform administrator can create companies" }, 403);
      const companyResult = CompanySchema.safeParse(body.company);
      const adminResult = AdminSchema.safeParse(body.admin);
      if (!companyResult.success || !adminResult.success) return jsonResponse({ error: "Company and first admin details are invalid" }, 400);
      const { data: company, error: companyError } = await adminClient.from("companies").insert(companyResult.data).select("id").single();
      if (companyError || !company) return jsonResponse({ error: companyError?.message || "Company could not be created" }, 400);
      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({ email: adminResult.data.email, password: adminResult.data.password, email_confirm: true, user_metadata: { full_name: adminResult.data.fullName, company_id: company.id, app_role: "admin" } });
      if (userError || !newUser.user) {
        await adminClient.from("companies").delete().eq("id", company.id);
        return jsonResponse({ error: userError?.message || "Company admin could not be created" }, 400);
      }
      return jsonResponse({ success: true, companyId: company.id, userId: newUser.user.id });
    }

    const requestedUserId = typeof body.userId === "string" ? body.userId : "";
    const targetProfile = requestedUserId ? (await adminClient.from("profiles").select("company_id").eq("user_id", requestedUserId).maybeSingle()).data : null;
    const sameCompany = Boolean(callerProfile?.company_id && targetProfile?.company_id === callerProfile.company_id);
    if (!callerIsSuperAdmin && (!callerIsAdmin || (targetProfile && !sameCompany))) return jsonResponse({ error: "Only company admins can manage users in their company" }, 403);

    if (action.data === "delete") {
      if (!requestedUserId) return jsonResponse({ error: "Missing userId" }, 400);
      if (requestedUserId === caller.id) return jsonResponse({ error: "Cannot delete your own account" }, 400);
      const { error } = await adminClient.auth.admin.deleteUser(requestedUserId);
      return error ? jsonResponse({ error: error.message }, 400) : jsonResponse({ success: true });
    }

    if (action.data === "list") {
      const { data: authList, error: authError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authError) return jsonResponse({ error: authError.message }, 400);
      const profileQuery = adminClient.from("profiles").select("user_id, full_name, phone, company_id");
      const { data: profiles } = callerIsSuperAdmin ? await profileQuery : await profileQuery.eq("company_id", callerProfile?.company_id || "");
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      const roleMap = new Map((roles || []).map((entry) => [entry.user_id, entry.role]));
      const users = (authList.users || []).filter((entry) => profileMap.has(entry.id)).map((entry) => ({ user_id: entry.id, email: entry.email || "", full_name: profileMap.get(entry.id)?.full_name || "", phone: profileMap.get(entry.id)?.phone || "", company_id: profileMap.get(entry.id)?.company_id || null, role: roleMap.get(entry.id) || "sales" }));
      return jsonResponse({ success: true, users });
    }

    if (action.data === "update") {
      if (!requestedUserId) return jsonResponse({ error: "Missing userId" }, 400);
      const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : undefined;
      const password = typeof body.password === "string" && body.password ? body.password : undefined;
      if (password && (password.length < 6 || password.length > 200)) return jsonResponse({ error: "Password must be 6 to 200 characters" }, 400);
      if (email || password) {
        const { error } = await adminClient.auth.admin.updateUserById(requestedUserId, { ...(email ? { email, email_confirm: true } : {}), ...(password ? { password } : {}) });
        if (error) return jsonResponse({ error: error.message }, 400);
      }
      const profileUpdates: Record<string, string> = {};
      if (typeof body.fullName === "string") profileUpdates.full_name = body.fullName.trim();
      if (typeof body.phone === "string") profileUpdates.phone = body.phone.trim();
      if (Object.keys(profileUpdates).length) {
        const { error } = await adminClient.from("profiles").update(profileUpdates).eq("user_id", requestedUserId);
        if (error) return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    if (action.data === "create-user") {
      const fullName = z.string().trim().min(1).max(200).safeParse(body.fullName);
      const email = z.string().email().safeParse(body.email);
      const password = z.string().min(6).max(200).safeParse(body.password);
      const role = RoleSchema.safeParse(body.role);
      if (!fullName.success || !email.success || !password.success || !role.success) return jsonResponse({ error: "User details are invalid" }, 400);
      const requestedCompanyId = typeof body.companyId === "string" ? body.companyId : null;
      const companyId = callerIsSuperAdmin ? requestedCompanyId : callerProfile?.company_id;
      if (!companyId) return jsonResponse({ error: "A company is required" }, 400);
      const { data: newUser, error } = await adminClient.auth.admin.createUser({ email: email.data, password: password.data, email_confirm: true, user_metadata: { full_name: fullName.data, company_id: companyId, app_role: role.data } });
      if (error || !newUser.user) return jsonResponse({ error: error?.message || "User could not be created" }, 400);
      await adminClient.from("user_roles").update({ role: role.data }).eq("user_id", newUser.user.id);
      return jsonResponse({ success: true, userId: newUser.user.id });
    }

    if (action.data === "export") {
      const tables = ["customers", "suppliers", "inventory", "invoices", "sales_orders", "quotations", "receipts", "expenses", "purchase_orders", "bills", "purchase_payments", "stock_adjustments", "accounts", "ledger_entries", "other_payments", "other_receipts", "transfers", "reconcile_entries", "user_settings"];
      const exportData: Record<string, unknown[]> = {};
      for (const table of tables) { const { data } = await adminClient.from(table).select("*").eq("company_id", callerProfile?.company_id || ""); exportData[table] = data || []; }
      return jsonResponse({ success: true, data: exportData });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
