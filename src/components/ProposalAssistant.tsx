import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, Volume2, Loader2, Sparkles, RotateCcw, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type BillSummary } from '../../supabase/functions/_shared/proposal-planning';
import { Label } from '@/components/ui/label';
import { recordWav } from '@/lib/voice/record-wav';
import { streamSpeech } from '@/lib/voice/stream-speech';
import { validateAssistantPatch } from '../../supabase/functions/_shared/proposal-draft';
import type { Proposal } from '@/pages/Proposals';

type Draft = Omit<Proposal, 'id' | 'proposalNo'>;
type Message = { role: 'user' | 'assistant'; content: string };
async function connection() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Please sign in to use the proposal assistant');
  return { endpoint: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-assistant`, headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } };
}
async function responseError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error?.message || body.error || body.message || `Request failed (${response.status})`);
}
export function ProposalAssistant({ draft, onApply }: { draft: Draft; onApply: (patch: Partial<Draft>) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voice, setVoice] = useState(true);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('Nexia');
  const [pending, setPending] = useState<Partial<Draft> | null>(null);
  const [systemChoice, setSystemChoice] = useState<Draft['systemType'] | ''>('');
  const [priceMode, setPriceMode] = useState<'inventory' | 'manual'>('inventory');
  const [autoAccessories, setAutoAccessories] = useState(true);
  const [dailyYield, setDailyYield] = useState(4);
  const [bill, setBill] = useState<BillSummary | null>(draft.billSummary || null);
  const [billName, setBillName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const audioContext = useRef<AudioContext | null>(null);
  const inFlight = useRef(false);
  const finishRecording = useRef<() => void>(() => {});
  const historyEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); void recorder.current?.stop().catch(() => {}); void audioContext.current?.close(); }; }, []);
  useEffect(() => { historyEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);

  function unlockAudio() {
    if (!voice) return;
    try {
      if (!audioContext.current || audioContext.current.state === 'closed') audioContext.current = new AudioContext({ sampleRate: 24000 });
      void audioContext.current.resume().catch(() => {});
    } catch { /* A text reply remains available if audio is unsupported. */ }
  }

  function requestController() {
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(new DOMException('The assistant took too long. Please try again.', 'TimeoutError')), 65000);
    abort.signal.addEventListener('abort', () => window.clearTimeout(timer), { once: true });
    controller.current = abort;
    return { abort, clear: () => window.clearTimeout(timer) };
  }

  async function speak(reply: string) {
    setSpeaking(true);
    const { abort, clear } = requestController();
    try { const { endpoint, headers } = await connection(); await streamSpeech(endpoint, reply, abort.signal, headers, audioContext.current || undefined); }
    catch (e) { if (mounted.current && (!abort.signal.aborted || abort.signal.reason?.name === 'TimeoutError')) setError(`Spoken reply unavailable: ${e instanceof Error ? e.message : 'Please try reading the reply again'}`); }
    finally { clear(); if (mounted.current) setSpeaking(false); }
  }
  async function send(content: string) {
    if (!content.trim() || inFlight.current) return;
    inFlight.current = true;
    unlockAudio();
    setBusy(true); setError('');
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next); setText('');
    const { abort, clear } = requestController();
    try {
      const { endpoint, headers } = await connection();
      const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat', messages: next.slice(-40), draft: { ...draft, ...pending }, systemChoice: systemChoice || undefined, priceMode, autoAccessories, dailyYield, bill: bill || undefined }), signal: abort.signal });
      if (!response.ok) throw await responseError(response);
      const result = await response.json();
      if (typeof result.reply !== 'string') throw new Error('No assistant reply received');
      setProvider(result.provider === 'groq' ? 'Groq' : result.provider === 'openrouter' ? 'OpenRouter' : 'Gemini');
      const patch = validateAssistantPatch(result.patch) as Partial<Draft>;
      if (!mounted.current) return;
      if (patch.systemType) setSystemChoice(patch.systemType);
      setPending(previous => ({ ...previous, ...patch })); setMissing(result.missing || []);
      setMessages([...next, { role: 'assistant', content: result.reply }]);
      clear();
      // Keep confirmed changes in the conversation draft; apply only after explicit review.
      if (voice) await speak(result.reply);
    } catch (e) { if (mounted.current && (!abort.signal.aborted || abort.signal.reason?.name === 'TimeoutError')) { setError(e instanceof Error ? e.message : 'Assistant unavailable'); setText(content); } }
    finally { clear(); inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function uploadBill(file: File) {
    if (inFlight.current) return;
    if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8_000_000) { setError('Choose a PDF or image bill under 8 MB'); return; }
    inFlight.current = true; setBusy(true); setError('');
    const { abort, clear } = requestController();
    try {
      const { endpoint, headers } = await connection();
      const body = new FormData(); body.append('action', 'bill'); body.append('file', file);
      const response = await fetch(endpoint, { method: 'POST', headers, body, signal: abort.signal });
      if (!response.ok) throw await responseError(response);
      const result = await response.json();
      if (mounted.current) { setBill(result.bill); setBillName(file.name); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not read bill'); }
    finally { clear(); inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function microphone() {
    setError('');
    if (!recording) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone is unavailable in this browser; type your requirements instead');
        unlockAudio();
        recorder.current = await recordWav(() => finishRecording.current());
        if (!mounted.current) { await recorder.current.stop(); return; }
        setRecording(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'Microphone permission is required'); }
      return;
    }
    const current = recorder.current; recorder.current = null;
    if (!current) return;
    setRecording(false); setBusy(true); inFlight.current = true;
    const { abort, clear } = requestController();
    let transcript = '';
    try {
      const file = await current.stop();
      const { endpoint, headers } = await connection();
      const body = new FormData(); body.append('file', file);
      const response = await fetch(endpoint, { method: 'POST', headers, body, signal: abort.signal });
      if (!response.ok) throw await responseError(response);
      const result = await response.json();
      transcript = typeof result.text === 'string' ? result.text.trim() : '';
      if (!transcript) throw new Error('No clear speech detected; please record again');
    } catch (e) { if (mounted.current && (!abort.signal.aborted || abort.signal.reason?.name === 'TimeoutError')) setError(e instanceof Error ? e.message : 'Recording unavailable'); }
    finally { clear(); inFlight.current = false; if (mounted.current) setBusy(false); }
    if (transcript && mounted.current && !abort.signal.aborted) await send(transcript);
  }
  finishRecording.current = () => { if (recorder.current) void microphone(); };
  return <section aria-label="Gemini proposal assistant" className="border-b border-border pb-5 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Proposal AI Assistant</h3>
      <div className="flex items-center gap-2"><Switch id="proposal-assistant-voice" checked={voice} onCheckedChange={setVoice} /><Label htmlFor="proposal-assistant-voice">Spoken replies</Label>
        <Button type="button" size="icon" variant="ghost" aria-label="Start new conversation" title="Start new conversation" disabled={busy || recording || speaking} onClick={() => { setMessages([]); setPending(null); setMissing([]); setError(''); setSystemChoice(''); setBill(null); setBillName(''); }}><RotateCcw className="h-4 w-4" /></Button></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div><Label>System choice</Label><Select value={systemChoice} onValueChange={v => setSystemChoice(v as Draft['systemType'])} disabled={busy || recording || speaking}><SelectTrigger aria-label="Assistant system choice"><SelectValue placeholder="Choose system" /></SelectTrigger><SelectContent>{(['on-grid','off-grid','hybrid'] as const).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Quotation prices</Label><Select value={priceMode} onValueChange={v => setPriceMode(v as 'inventory' | 'manual')} disabled={busy}><SelectTrigger aria-label="Quotation price source"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inventory">Inventory selling prices</SelectItem><SelectItem value="manual">Prices I provide</SelectItem></SelectContent></Select></div>
      <div><Label htmlFor="proposal-yield">Estimated daily yield (kWh/kWp)</Label><Input id="proposal-yield" type="number" min={1} max={7} step={0.1} value={dailyYield} onChange={e => setDailyYield(Math.min(7, Math.max(1, Number(e.target.value) || 1)))} disabled={busy} /></div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Switch id="proposal-accessories" checked={autoAccessories} onCheckedChange={setAutoAccessories} disabled={busy} /><Label htmlFor="proposal-accessories">Estimate breakers & accessories</Label>
      <input ref={fileInput} type="file" className="hidden" aria-label="Electricity bill" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadBill(file); e.target.value = ''; }} />
      <Button type="button" variant="outline" size="sm" disabled={busy || recording || speaking} onClick={() => fileInput.current?.click()}><Paperclip className="h-4 w-4 mr-2" /> Electricity bill</Button>
    </div>
    {bill && <div className="border border-border rounded-md p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2"><strong className="break-all">{billName || 'Electricity bill'}</strong><Button type="button" variant="ghost" size="icon" aria-label="Remove bill" disabled={busy} onClick={() => { setBill(null); setBillName(''); }}><X className="h-4 w-4" /></Button></div>
      <p>{bill.customerName || 'Customer not readable'} · {bill.disco || 'DISCO not readable'}</p>
      <p>Consumption: {bill.monthlyKwh ?? 'Not readable'} kWh · Bill: PKR {bill.billAmount ?? 'Not readable'} · History: {bill.history.length} months</p>
      <Button type="button" size="sm" disabled={busy || speaking || recording} onClick={() => void send(systemChoice ? `Prepare an estimated ${systemChoice} proposal from the attached bill. Ask for missing details and backup requirements. Use ${priceMode} prices.` : 'Use my electricity bill for a proposal. Ask which system type I want first.')}>Prepare from bill</Button>
    </div>}
    <div role="log" aria-live="polite" className="max-h-64 overflow-y-auto space-y-3 text-sm">
      {!messages.length && <p className="text-muted-foreground">Assalam-o-Alaikum! Kis customer ke liye proposal banana hai, aur kaunsa solar system chahiye?</p>}
      {messages.map((message, i) => <div key={i} className={message.role === 'user' ? 'bg-muted p-3 rounded-md' : 'py-1'}><span className="block text-xs font-semibold text-muted-foreground mb-1">{message.role === 'user' ? 'You' : provider}</span><p className="whitespace-pre-wrap break-words" dir="auto">{message.content}</p></div>)}
      <div ref={historyEnd} />
    </div>
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    {pending && Object.keys(pending).length > 0 && <div className="space-y-2 text-sm">
      <p className="font-medium">Confirmed details</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-1">{Object.entries(pending).map(([key, value]) => <div key={key} className="break-words"><dt className="inline text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}: </dt><dd className="inline">{key === 'items' && Array.isArray(value) ? value.map((item: any) => `${item.description} × ${item.qty} — PKR ${item.unitPrice}${item.estimated ? ' (estimated)' : ''}${item.priceSource === 'missing' ? ' (price required)' : ''}`).join('; ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
      {missing.length > 0 && <p className="text-muted-foreground">Still needed: {missing.join(', ')}</p>}
      <Button type="button" size="sm" variant="outline" disabled={busy || recording} onClick={() => { onApply(pending); setPending(null); }}>Apply confirmed details</Button>
    </div>}
    <div className="flex gap-2 items-end">
      <Textarea aria-label="Proposal requirements" placeholder="Your requirements or answer…" value={text} onChange={e => setText(e.target.value)} rows={2} disabled={recording} className="min-w-0" />
      <Button type="button" variant={recording ? 'destructive' : 'outline'} size="icon" aria-label={recording ? 'Finish recording' : 'Record requirements'} title={recording ? 'Finish recording' : 'Record requirements'} disabled={busy || speaking} onClick={() => void microphone()}>{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
      {(busy || speaking) ? <Button type="button" variant="outline" size="icon" aria-label="Stop assistant" title="Stop assistant" onClick={() => controller.current?.abort()}><Square className="h-4 w-4" /></Button> : <Button type="button" size="icon" aria-label="Send requirements" title="Send requirements" disabled={!text.trim() || recording} onClick={() => void send(text)}><Send className="h-4 w-4" /></Button>}
    </div>
    {(busy || recording || speaking) && <p className="text-xs text-muted-foreground flex gap-2 items-center"><Loader2 className="h-3 w-3 animate-spin" />{recording ? 'Listening…' : speaking ? 'Speaking…' : 'Preparing reply…'}</p>}
    {!busy && !speaking && !recording && messages.some(m => m.role === 'assistant') && <Button type="button" size="sm" variant="ghost" onClick={() => { unlockAudio(); const last = [...messages].reverse().find(m => m.role === 'assistant'); if (last) void speak(last.content); }}><Volume2 className="h-4 w-4 mr-1" /> Read last reply</Button>}
  </section>;
}