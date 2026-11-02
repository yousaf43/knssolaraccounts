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
    const input = z.object({ text: z.string().min(1).max(3000) }).parse(await req.json());
    const result = await aiVoice(companyId, { text: input.text }, req.signal);
    if (result.pcm) {
      const bytes = Uint8Array.from(atob(result.audio), c => c.charCodeAt(0));
      const wav = new Uint8Array(44 + bytes.length); const view = new DataView(wav.buffer);
      for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as [number, string][]) for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i);
      view.setUint32(4, bytes.length + 36, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, bytes.length, true); wav.set(bytes, 44);
      let binary = ''; for (let i = 0; i < wav.length; i += 32768) binary += String.fromCharCode(...wav.subarray(i, i + 32768));
      return json({ audio: btoa(binary), mimeType: 'audio/wav', provider: result.provider });
    }
    return json({ audio: result.audio, mimeType: 'audio/mpeg', provider: result.provider });
  } catch (e) { const err = e as Error & { status?: number }; return json({ error: err instanceof z.ZodError ? 'Invalid voice request' : err.message }, err instanceof z.ZodError ? 400 : err.status || 500); }
});
