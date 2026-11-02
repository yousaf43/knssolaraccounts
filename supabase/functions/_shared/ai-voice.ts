import { readyAIProviders, markAIProviderFailure } from './ai-credentials.ts';
import { orderedFallback } from './ai-policy.ts';
function b64(bytes: Uint8Array) { let result = ''; for (let i = 0; i < bytes.length; i += 32768) result += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(result); }
export async function aiVoice(companyId: string, input: { file?: File; text?: string }, signal?: AbortSignal) {
  // Groq speech synthesis does not support Urdu; never silently substitute an English/Arabic voice.
  const providers = (await readyAIProviders(companyId)).filter(p => input.file || p.provider !== 'groq');
  let retryAfter: string | null = null;
  const result = await orderedFallback(providers.map(p => p.provider), async provider => {
    const state = providers.find(p => p.provider === provider);
    if (!state) throw new Error('Voice provider unavailable');
    let response: Response;
    if (provider === 'gemini') {
      const parts = input.file ? [{ inlineData: { mimeType: input.file.type, data: b64(new Uint8Array(await input.file.arrayBuffer())) } }, { text: 'Transcribe only spoken words. Write Urdu in Roman Urdu. Preserve numbers, names and prices. Do not answer the speaker.' }] : [{ text: `Say warmly in a natural Pakistani Urdu accent: ${input.text}` }];
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${input.file ? 'gemini-2.5-flash' : 'gemini-2.5-flash-preview-tts'}:generateContent`, { method: 'POST', signal, headers: { 'x-goog-api-key': state.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }], generationConfig: input.file ? { thinkingConfig: { thinkingBudget: 0 } } : { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } }) });
      if (response.ok) {
        const data = await response.json(); const parts = data.candidates?.[0]?.content?.parts || [];
        const audio = parts.find((p: any) => p.inlineData?.data)?.inlineData;
        if (!input.file && (!audio?.mimeType?.includes('audio/L16') || !audio.mimeType.includes('rate=24000'))) throw Object.assign(new Error('Unsupported spoken audio format'), { status: 502 });
        response = new Response(JSON.stringify(input.file ? { text: parts.map((p: any) => p.text || '').join('').trim() } : { audio: audio.data, pcm: true }));
      }
    } else if (input.file && provider === 'groq') {
      const form = new FormData(); form.append('file', input.file); form.append('model', 'whisper-large-v3');
      response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', signal, headers: { Authorization: `Bearer ${state.key}` }, body: form });
    } else {
      const format = input.file?.type.includes('wav') ? 'wav' : input.file?.type.includes('mpeg') ? 'mp3' : 'webm';
      response = await fetch(`https://openrouter.ai/api/v1/audio/${input.file ? 'transcriptions' : 'speech'}`, { method: 'POST', signal, headers: { Authorization: `Bearer ${state.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input.file ? { model: 'openai/whisper-large-v3', input_audio: { data: b64(new Uint8Array(await input.file.arrayBuffer())), format } } : { model: 'openai/gpt-4o-mini-tts', input: input.text, voice: 'coral', response_format: 'mp3' }) });
      if (response.ok && !input.file) response = new Response(JSON.stringify({ audio: b64(new Uint8Array(await response.arrayBuffer())), pcm: false }));
    }
    retryAfter = response.headers.get('Retry-After');
    return { status: response.status, value: response };
  }, async (provider, status) => { await markAIProviderFailure(companyId, provider, status, retryAfter); });
  if (!result) throw Object.assign(new Error(input.file ? 'No transcription provider is ready; check AI settings' : 'No Urdu speech provider is ready; your written reply is still available'), { status: 503 });
  if (!result.value.ok) { await result.value.body?.cancel(); throw Object.assign(new Error(`Voice provider unavailable (${result.status}); check AI settings`), { status: result.status }); }
  return { ...(await result.value.json()), provider: result.provider };
}
export function voiceEvents(result: { audio: string; pcm: boolean }) {
  return `data: ${JSON.stringify({ type: result.pcm ? 'speech.audio.delta' : 'speech.audio.encoded', audio: result.audio })}\n\ndata: ${JSON.stringify({ type: 'speech.audio.done' })}\n\n`;
}