import { readyAIProviders, markAIProviderFailure } from './ai-credentials.ts';
import { orderedFallback, type AIProvider } from './ai-policy.ts';
export type AIMessage = { role: string; content: string | unknown[] };
const endpoints = { gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions', openrouter: 'https://openrouter.ai/api/v1/chat/completions' };
const models = { gemini: 'gemini-2.5-flash', groq: 'llama-3.3-70b-versatile', openrouter: 'google/gemini-2.5-flash' };
function geminiContents(messages: AIMessage[]) {
  return messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: typeof m.content === 'string' ? [{ text: m.content }] : m.content.map((block: any) => {
    if (block.type === 'text') return { text: block.text };
    const match = /^data:([^;]+);base64,(.*)$/s.exec(block.image_url?.url || block.file?.file_data || '');
    return match ? { inlineData: { mimeType: match[1], data: match[2] } } : { text: '' };
  }) }));
}
export async function routeAI(companyId: string, messages: AIMessage[], options: { json?: boolean; stream?: boolean; signal?: AbortSignal; groqMessages?: AIMessage[] } = {}) {
  const hasFiles = messages.some(m => Array.isArray(m.content));
  const providers = (await readyAIProviders(companyId)).filter(p => !(p.provider === 'groq' && hasFiles));
  const result = await orderedFallback(providers.map(p => p.provider), async provider => {
    const state = providers.find(p => p.provider === provider);
    if (!state) throw new Error('AI provider is not configured');
    let response: Response;
    if (provider === 'gemini' && hasFiles) {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { method: 'POST', signal: options.signal, headers: { 'x-goog-api-key': state.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: messages.filter(m => m.role === 'system').map(m => ({ text: m.content })) }, contents: geminiContents(messages), generationConfig: { temperature: 0.1, ...(options.json ? { responseMimeType: 'application/json' } : {}) } }) });
      if (response.ok) {
        const body = await response.json();
        if (body.promptFeedback?.blockReason || body.candidates?.[0]?.finishReason === 'SAFETY') return { status: 403, value: new Response(JSON.stringify({ error: 'The provider declined this request' }), { status: 403 }) };
        const text = body.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
        response = new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { headers: { 'Content-Type': 'application/json' } });
      }
    } else {
      response = await fetch(endpoints[provider], { method: 'POST', signal: options.signal, headers: { Authorization: `Bearer ${state.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: models[provider], messages: provider === 'groq' ? options.groqMessages || messages : messages, temperature: 0.1, ...(provider === 'gemini' ? { reasoning_effort: 'none' } : {}), ...(options.json ? { response_format: { type: 'json_object' } } : {}), stream: options.stream || false }) });
    }
    return { status: response.status, value: response };
  }, async (provider, status) => {
    // Retry-After is persisted by the provider handler below; no immediate retry of the exhausted provider.
    await markAIProviderFailure(companyId, provider, status, null);
  });
  if (!result) throw Object.assign(new Error(hasFiles ? 'No configured AI provider can read this file; check AI settings' : 'No AI provider is ready; check credits and AI settings'), { status: 503 });
  if (!result.value.ok) {
    await result.value.body?.cancel();
    throw Object.assign(new Error(result.status === 402 || result.status === 429 ? 'Configured AI providers have exhausted credits or quota; update AI settings' : result.status === 401 ? 'AI API key was rejected; update AI settings' : result.status === 403 ? 'The AI provider declined access or this request' : `AI request failed (${result.status})`), { status: result.status });
  }
  return { response: result.value, provider: result.provider as AIProvider };
}