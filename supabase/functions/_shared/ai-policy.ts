export const AI_PROVIDER_ORDER = ['gemini', 'groq', 'openrouter'] as const;
export type AIProvider = typeof AI_PROVIDER_ORDER[number];
export type ProviderState = { provider: AIProvider; enabled: boolean; configured: boolean; blocked_reason?: string | null; blocked_until?: string | null };
export function availableProviders(states: ProviderState[], now = Date.now()) {
  return AI_PROVIDER_ORDER.filter(provider => {
    const state = states.find(row => row.provider === provider);
    return state?.enabled && state.configured && (!state.blocked_reason || (state.blocked_reason === 'quota' && !!state.blocked_until && Date.parse(state.blocked_until) <= now));
  });
}
export function quotaFailure(status: number) { return status === 402 || status === 429; }
export function providerBlock(status: number) { return quotaFailure(status) ? 'quota' : status === 401 ? 'invalid_key' : status === 403 ? 'denied' : null; }
export function mayManageAI(roles: { role: string }[]) { return roles.some(row => row.role === 'admin'); }
export async function orderedFallback<T>(providers: AIProvider[], attempt: (provider: AIProvider) => Promise<{ status: number; value: T }>, onFailure: (provider: AIProvider, status: number) => Promise<void>) {
  let last: { status: number; value: T } | undefined;
  for (const provider of providers) {
    last = await attempt(provider);
    if (last.status >= 200 && last.status < 300) return { ...last, provider };
    await onFailure(provider, last.status);
    // Credit/quota exhaustion alone permits switching; invalid keys, refusals and denials stop this request.
    if (!quotaFailure(last.status)) return { ...last, provider };
  }
  return last ? { ...last, provider: providers[providers.length - 1] } : null;
}