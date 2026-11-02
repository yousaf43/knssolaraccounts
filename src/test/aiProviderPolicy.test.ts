import { describe, it, expect } from 'vitest';
import { availableProviders, orderedFallback, mayManageAI } from '../../supabase/functions/_shared/ai-policy';
describe('Shared AI provider rules', () => {
  const states = ['openrouter', 'gemini', 'groq'].map(provider => ({ provider: provider as 'gemini' | 'groq' | 'openrouter', enabled: true, configured: true }));
  it('always prioritizes Gemini, then Groq, then OpenRouter', () => { expect(availableProviders(states)).toEqual(['gemini', 'groq', 'openrouter']); });
  it('switches from exhausted Gemini and Groq to OpenRouter', async () => {
    const calls: string[] = [];
    const result = await orderedFallback(availableProviders(states), async provider => { calls.push(provider); return { status: provider === 'gemini' ? 429 : provider === 'groq' ? 402 : 200, value: provider }; }, async () => {});
    expect(calls).toEqual(['gemini', 'groq', 'openrouter']); expect(result?.value).toBe('openrouter');
  });
  it('never switches after a provider denial', async () => {
    const calls: string[] = [];
    const result = await orderedFallback(availableProviders(states), async provider => { calls.push(provider); return { status: 403, value: provider }; }, async () => {});
    expect(calls).toEqual(['gemini']); expect(result?.status).toBe(403);
  });
  it('skips disabled, missing and persistently denied credentials', () => {
    expect(availableProviders([{ ...states[0], enabled: false }, { ...states[1], blocked_reason: 'denied' }, { ...states[2], configured: false }])).toEqual([]);
  });
  it('keeps exhausted providers paused until the cooldown ends', () => {
    expect(availableProviders([{ ...states[1], blocked_reason: 'quota', blocked_until: '2026-11-03T00:00:00Z' }], Date.parse('2026-11-02T00:00:00Z'))).toEqual([]);
    expect(availableProviders([{ ...states[1], blocked_reason: 'quota', blocked_until: '2026-11-03T00:00:00Z' }], Date.parse('2026-11-04T00:00:00Z'))).toEqual(['gemini']);
  });
  it('only administrators can manage shared API keys', () => { expect(mayManageAI([{ role: 'sales' }, { role: 'accountant' }])).toBe(false); expect(mayManageAI([{ role: 'admin' }])).toBe(true); });
});