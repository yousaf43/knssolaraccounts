import { createClient } from 'npm:@supabase/supabase-js@2';
import { AI_PROVIDER_ORDER, availableProviders, mayManageAI, providerBlock, type AIProvider } from './ai-policy.ts';
export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('AI service configuration is unavailable');
  return createClient(url, key);
}
export async function aiIdentity(req: Request, requireAdmin = false) {
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  if (error || !data.user) throw Object.assign(new Error('Please sign in'), { status: 401 });
  const { data: profile, error: profileError } = await admin.from('profiles').select('company_id').eq('user_id', data.user.id).single();
  if (profileError || !profile?.company_id) throw Object.assign(new Error('Company access is unavailable'), { status: 403 });
  if (requireAdmin) {
    const { data: roles, error: roleError } = await admin.from('user_roles').select('role').eq('user_id', data.user.id);
    if (roleError || !mayManageAI(roles || [])) throw Object.assign(new Error('Only administrators can manage AI keys'), { status: 403 });
  }
  return { admin, userId: data.user.id, companyId: profile.company_id as string };
}
async function encryptionKey() {
  const secret = Deno.env.get('AI_SETTINGS_ENCRYPTION_KEY');
  if (!secret) throw new Error('Secure AI key storage is not configured');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptAIKey(value: string, companyId: string, provider: AIProvider) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`${companyId}:${provider}`) }, await encryptionKey(), new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}
async function decryptAIKey(value: string, companyId: string, provider: AIProvider) {
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: new TextEncoder().encode(`${companyId}:${provider}`) }, await encryptionKey(), bytes.subarray(12));
  return new TextDecoder().decode(plain);
}
const envNames = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY' };
export async function loadAIProviders(companyId: string) {
  const admin = adminClient();
  const { data, error } = await admin.from('ai_provider_credentials').select('*').eq('company_id', companyId);
  if (error) throw new Error('AI settings are unavailable; contact your administrator');
  return Promise.all(AI_PROVIDER_ORDER.map(async provider => {
    const row = data?.find(item => item.provider === provider);
    const key = row?.key_ciphertext ? await decryptAIKey(row.key_ciphertext, companyId, provider) : (row ? '' : Deno.env.get(envNames[provider]) || '');
    return { provider, key, configured: !!key, enabled: row?.enabled ?? true, blocked_reason: row?.blocked_reason, blocked_until: row?.blocked_until };
  }));
}
export async function readyAIProviders(companyId: string) {
  const states = await loadAIProviders(companyId); const ready = availableProviders(states);
  return states.filter(state => ready.includes(state.provider));
}
export async function markAIProviderFailure(companyId: string, provider: AIProvider, status: number, retryAfter: string | null) {
  const reason = providerBlock(status);
  if (!reason) return;
  const states = await loadAIProviders(companyId); const state = states.find(item => item.provider === provider);
  if (!state?.key) return;
  const seconds = Number(retryAfter);
  const retryAt = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) : Date.now() + Math.max(60, Number.isFinite(seconds) && seconds > 0 ? seconds : status === 402 ? 86400 : 3600) * 1000;
  const { error } = await adminClient().from('ai_provider_credentials').upsert({ company_id: companyId, provider, key_ciphertext: await encryptAIKey(state.key, companyId, provider), enabled: state.enabled, blocked_reason: reason, blocked_until: reason === 'quota' ? new Date(Number.isFinite(retryAt) ? retryAt : Date.now() + 3600000).toISOString() : null }, { onConflict: 'company_id,provider' });
  if (error) throw new Error('Unable to pause the unavailable AI provider');
}