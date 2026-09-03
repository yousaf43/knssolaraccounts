Deno.serve(async (req) => {
  const key = Deno.env.get("RESEND_API_KEY")!;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const target = id ? `https://api.resend.com/emails/${id}` : "https://api.resend.com/domains";
  const res = await fetch(target, { headers: { Authorization: `Bearer ${key}` } });
  return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
});
