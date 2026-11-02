import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiIdentity, encryptAIKey, loadAIProviders } from '../_shared/ai-credentials.ts';
const Input = z.object({ action: z.enum(['status', 'save', 'remove', 'resume']), provider: z.enum(['gemini', 'groq', 'openrouter']).optional(), apiKey: z.string().trim().min(10).max(1024).optional(), enabled: z.boolean().optional() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { admin, companyId } = await aiIdentity(req, true);
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid AI settings request' }, 400);
    const { action, provider, apiKey, enabled } = parsed.data;
    if (action !== 'status') {
      if (!provider) return json({ error: 'Select an AI provider' }, 400);
      if (action === 'remove') {
        // A disabled tombstone prevents deleted keys falling back to environment credentials.
        const { error } = await admin.from('ai_provider_credentials').upsert({ company_id: companyId, provider, key_ciphertext: null, enabled: false, blocked_reason: null, blocked_until: null, updated_at: new Date().toISOString() });
        if (error) throw new Error('Unable to remove AI key');
      } else {
        const existing = await loadAIProviders(companyId); const current = existing.find(row => row.provider === provider);
        const key = apiKey || current?.key;
        if (!key) return json({ error: 'Enter an API key first' }, 400);
        const { error } = await admin.from('ai_provider_credentials').upsert({ company_id: companyId, provider, key_ciphertext: await encryptAIKey(key, companyId, provider), enabled: enabled ?? current?.enabled ?? true, blocked_reason: apiKey || action === 'resume' ? null : current?.blocked_reason, blocked_until: apiKey || action === 'resume' ? null : current?.blocked_until, updated_at: new Date().toISOString() });
        if (error) throw new Error('Unable to save AI settings');
      }
    }
    const providers = (await loadAIProviders(companyId)).map(({ provider, configured, enabled, blocked_reason, blocked_until }) => ({ provider, configured, enabled, blocked_reason: blocked_reason || null, blocked_until: blocked_until || null }));
    return json({ providers });
  } catch (e) { const err = e as Error & { status?: number }; return json({ error: err.status ? err.message : 'AI settings could not be saved or loaded' }, err.status || 500); }
});