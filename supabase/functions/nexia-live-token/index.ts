import { aiIdentity, markAIProviderFailure, readyAIProviders } from '../_shared/ai-credentials.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

/**
 * Mints a short-lived, single-use Gemini Live token so the browser can stream audio
 * directly without ever receiving the company's private Gemini key.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { companyId } = await aiIdentity(req);
    const gemini = (await readyAIProviders(companyId)).find((p) => p.provider === 'gemini');
    if (!gemini?.key) return json({ error: 'Gemini is not available for live voice. Add or re-enable the Gemini key in Settings, or use normal chat.' }, 409);

    const now = Date.now();
    const res = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini.key },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
      }),
    });
    if (!res.ok) {
      await markAIProviderFailure(companyId, 'gemini', res.status, res.headers.get('retry-after')).catch(() => {});
      const detail = await res.text();
      console.error('live token failed', res.status, detail.slice(0, 300));
      const msg = res.status === 429 || res.status === 402
        ? 'Gemini credits/quota are finished for now. Use normal chat until it resets.'
        : res.status === 401 || res.status === 403
          ? 'The Gemini key was refused. Please check it in Settings.'
          : 'Could not start the live voice session.';
      return json({ error: msg }, res.status === 429 || res.status === 402 ? 429 : 502);
    }
    const data = await res.json();
    if (!data?.name) return json({ error: 'Could not start the live voice session.' }, 502);
    return json({ token: data.name, model: LIVE_MODEL });
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, status);
  }
});
