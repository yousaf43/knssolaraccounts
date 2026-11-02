// Legacy endpoint name retained for existing clients; uses shared AI provider settings.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiIdentity } from '../_shared/ai-credentials.ts';
import { aiVoice } from '../_shared/ai-voice.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { companyId } = await aiIdentity(req);
    const input = z.object({ audio: z.string().min(1).max(19000000), mimeType: z.string().regex(/^audio\//).default('audio/webm') }).parse(await req.json());
    const bytes = Uint8Array.from(atob(input.audio), c => c.charCodeAt(0));
    const result = await aiVoice(companyId, { file: new File([bytes], 'recording.webm', { type: input.mimeType }) }, req.signal);
    return json({ text: result.text, provider: result.provider });
  } catch (e) { const err = e as Error & { status?: number }; return json({ error: err instanceof z.ZodError ? 'Invalid voice request' : err.message }, err instanceof z.ZodError ? 400 : err.status || 500); }
});
