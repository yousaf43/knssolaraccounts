import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user || !user.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate previous unused codes for this user
    await admin.from("otp_codes").update({ used: true }).eq("user_id", user.id).eq("used", false);

    const { error: insErr } = await admin.from("otp_codes").insert({
      user_id: user.id,
      email: user.email,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#ffffff">
        <div style="text-align:center;padding:16px 0;border-bottom:2px solid #2563eb">
          <h2 style="color:#2563eb;margin:0">K&amp;S Solar Energy</h2>
        </div>
        <div style="padding:24px 0;text-align:center">
          <p style="color:#333;font-size:15px">Your login verification code:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2563eb;background:#f0f7ff;padding:16px;border-radius:8px;margin:16px 0">
            ${code}
          </div>
          <p style="color:#666;font-size:13px">This code expires in 10 minutes.</p>
          <p style="color:#999;font-size:12px;margin-top:16px">If you didn't request this, please ignore this email or contact your admin.</p>
        </div>
        <div style="border-top:1px solid #eee;padding-top:12px;text-align:center;color:#999;font-size:11px">
          Design &amp; Developed by Yousuf Enterprises
        </div>
      </div>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "K&S Solar Energy <onboarding@resend.dev>",
        to: [user.email],
        subject: `Your login code: ${code}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      console.error("Resend error:", emailRes.status, body);
      return new Response(JSON.stringify({ error: "Failed to send email", details: body }), {
        status: emailRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, email: user.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
