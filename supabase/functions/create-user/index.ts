import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can manage users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // DELETE USER
    if (action === "delete") {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (userId === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST USERS (with emails from auth)
    if (action === "list") {
      const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, phone");
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const { data: authList, error: listErr } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const users = (profiles || []).map((p: any) => {
        const authU = authList.users.find((u: any) => u.id === p.user_id);
        const r = (roles || []).find((r: any) => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name || "",
          phone: p.phone || "",
          email: authU?.email || "",
          role: r?.role || "sales",
        };
      });
      return new Response(JSON.stringify({ success: true, users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE USER (email/password/full_name/phone)
    if (action === "update") {
      const { userId, email, password, fullName, phone } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (email) updates.email_confirm = true;

      if (email || password) {
        const { error } = await adminClient.auth.admin.updateUserById(userId, updates);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const profileUpdates: Record<string, unknown> = {};
      if (typeof fullName === "string") profileUpdates.full_name = fullName;
      if (typeof phone === "string") profileUpdates.phone = phone;
      if (Object.keys(profileUpdates).length > 0) {
        const { error: pErr } = await adminClient.from("profiles").update(profileUpdates).eq("user_id", userId);
        if (pErr) {
          return new Response(JSON.stringify({ error: pErr.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST USERS (merge auth emails + profiles + roles)
    if (action === "list") {
      const { data: authList, error: authErr } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, phone");
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      const users = (authList?.users || []).map((u: any) => ({
        user_id: u.id,
        email: u.email || "",
        full_name: profileMap.get(u.id)?.full_name || "",
        phone: profileMap.get(u.id)?.phone || "",
        role: roleMap.get(u.id) || "sales",
      }));
      return new Response(JSON.stringify({ success: true, users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // EXPORT ALL DATA
    if (action === "export") {
      const tables = ["customers", "suppliers", "inventory", "invoices", "sales_orders", "quotations", "receipts", "expenses", "purchase_orders", "bills", "purchase_payments", "stock_adjustments", "accounts", "ledger_entries", "other_payments", "other_receipts", "transfers", "reconcile_entries", "user_settings"];
      const exportData: Record<string, unknown[]> = {};
      for (const table of tables) {
        const { data } = await adminClient.from(table).select("*");
        exportData[table] = data || [];
      }
      return new Response(JSON.stringify({ success: true, data: exportData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER (default action)
    const { email, password, fullName, role } = body;

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set role
    await adminClient
      .from("user_roles")
      .update({ role })
      .eq("user_id", newUser.user.id);

    return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
