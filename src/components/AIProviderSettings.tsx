import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Save, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
type Provider = 'gemini' | 'groq' | 'openrouter';
type State = { provider: Provider; configured: boolean; enabled: boolean; blocked_reason: string | null; blocked_until: string | null };
const names = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
const providers: Provider[] = ['gemini', 'groq', 'openrouter'];
export function AIProviderSettings() {
  const [states, setStates] = useState<State[]>([]);
  const [keys, setKeys] = useState<Record<Provider, string>>({ gemini: '', groq: '', openrouter: '' });
  const [busy, setBusy] = useState<string | null>('status');
  const [error, setError] = useState('');
  async function request(body: Record<string, unknown>) {
    const { data, error: failure } = await supabase.functions.invoke('ai-settings', { body });
    if (failure) {
      const context = (failure as unknown as { context?: Response }).context;
      const details = context ? await context.json().catch(() => ({})) : null;
      throw new Error(details?.error || 'AI settings are unavailable. Please try again.');
    }
    if (data?.error) throw new Error(data.error);
    setStates(data.providers || []);
  }
  useEffect(() => { void request({ action: 'status' }).catch(e => setError(e.message)).finally(() => setBusy(null)); }, []);
  async function update(provider: Provider, action: string, enabled?: boolean) {
    if (action === 'remove' && !window.confirm(`Remove the ${names[provider]} API key?`)) return;
    setBusy(provider); setError('');
    try {
      await request({ action, provider, ...(action === 'save' && keys[provider].trim() ? { apiKey: keys[provider].trim() } : {}), ...(enabled !== undefined ? { enabled } : {}) });
      setKeys(old => ({ ...old, [provider]: '' }));
      toast.success(action === 'remove' ? 'API key removed' : 'AI settings saved');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save AI settings'); }
    finally { setBusy(null); }
  }
  return <section className="space-y-5 py-4" aria-label="AI provider settings">
    <h2 className="text-lg font-semibold">AI Assistants</h2>
    <div className="flex gap-2 items-center flex-wrap text-sm font-medium"><span>1. Gemini</span><span className="text-muted-foreground">→</span><span>2. Groq</span><span className="text-muted-foreground">→</span><span>3. OpenRouter</span><Badge variant="secondary">Automatic fallback</Badge></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy === 'status' && <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading AI settings" />}
    {providers.map((provider, i) => {
      const state = states.find(row => row.provider === provider);
      const paused = !!state?.blocked_reason && (!state.blocked_until || Date.parse(state.blocked_until) > Date.now());
      return <div key={provider} className="border-b border-border py-4 space-y-3">
        <div className="flex items-center justify-between gap-3"><div className="flex gap-2 items-center flex-wrap"><h3 className="font-semibold">{i + 1}. {names[provider]}</h3><Badge variant={paused ? 'destructive' : 'outline'}>{paused ? state?.blocked_reason === 'quota' ? 'Quota paused' : 'Needs attention' : state?.configured ? state.enabled ? 'Configured' : 'Disabled' : 'Not configured'}</Badge></div><Switch aria-label={`Enable ${names[provider]}`} checked={state?.enabled && state?.configured || false} disabled={!!busy || !state?.configured} onCheckedChange={enabled => void update(provider, 'save', enabled)} /></div>
        <div className="flex items-end gap-2"><div className="flex-1 min-w-0 space-y-1"><Label htmlFor={`ai-key-${provider}`}>{names[provider]} API key</Label><Input id={`ai-key-${provider}`} type="password" autoComplete="new-password" spellCheck={false} value={keys[provider]} disabled={!!busy || !!error && !states.length} placeholder={state?.configured ? 'Enter a replacement key' : 'Enter API key'} onChange={e => setKeys(old => ({ ...old, [provider]: e.target.value }))} /></div>
          <Button size="icon" title={`Save ${names[provider]} key`} aria-label={`Save ${names[provider]} key`} disabled={!!busy || !keys[provider].trim()} onClick={() => void update(provider, 'save', true)}>{busy === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
          <Button size="icon" variant="outline" title={`Resume ${names[provider]}`} aria-label={`Resume ${names[provider]}`} disabled={!!busy || !paused} onClick={() => void update(provider, 'resume', true)}><RotateCcw className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" title={`Remove ${names[provider]} key`} aria-label={`Remove ${names[provider]} key`} disabled={!!busy || !state?.configured} onClick={() => void update(provider, 'remove')}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>;
    })}
  </section>;
}