import { NEXIA_LIVE_PROMPT, NEXIA_TOOL_DECLARATIONS } from "@/lib/nexiaLiveTools";

export type LiveStatus = "idle" | "connecting" | "listening" | "speaking" | "error";
export type LiveEvents = {
  onStatus: (s: LiveStatus) => void;
  onUserText: (text: string, final: boolean) => void;
  onAssistantText: (text: string, final: boolean) => void;
  onLevel: (level: number) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onClose: (reason?: string) => void;
};

const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
// Credit savers: only stream audio while someone is speaking, and end idle sessions.
const SPEECH_RMS = 0.012;
const HANGOVER_MS = 900;
const IDLE_END_MS = 60_000;

const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('nexia-mic',P);`;

function toB64(buf: ArrayBuffer) {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export class NexiaLiveSession {
  private ws: WebSocket | null = null;
  private micCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private playHead = 0;
  private sources: AudioBufferSourceNode[] = [];
  private gateOpenUntil = 0;
  private streaming = false;
  private lastActivity = Date.now();
  private idleTimer: number | null = null;
  private userBuf = ""; private botBuf = "";
  private closed = false;

  constructor(private ev: LiveEvents, private config: { prompt?: string; tools?: unknown[] } = {}) {}

  /** Must be called from a click so the browser allows mic and audio playback. */
  async start(token: string, model: string) {
    this.ev.onStatus("connecting");
    this.outCtx = new AudioContext({ sampleRate: 24000 });
    await this.outCtx.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    this.micCtx = new AudioContext({ sampleRate: 16000 });
    await this.micCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
    const src = this.micCtx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(this.micCtx, "nexia-mic");
    node.port.onmessage = (e) => this.onMic(e.data as Float32Array);
    src.connect(node);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(token)}`);
      this.ws = ws;
      let ready = false;
      ws.onopen = () => ws.send(JSON.stringify({ setup: {
        model,
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } },
        systemInstruction: { parts: [{ text: this.config.prompt || NEXIA_LIVE_PROMPT }] },
        tools: [{ functionDeclarations: this.config.tools || NEXIA_TOOL_DECLARATIONS }],
        inputAudioTranscription: {}, outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
        realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 700 } },
      } }));
      ws.onmessage = async (m) => {
        const text = typeof m.data === "string" ? m.data : await (m.data as Blob).text();
        let msg: any; try { msg = JSON.parse(text); } catch { return; }
        if (msg.setupComplete && !ready) { ready = true; this.ev.onStatus("listening"); resolve(); return; }
        void this.handle(msg);
      };
      ws.onerror = () => { if (!ready) reject(new Error("Could not connect to Gemini Live")); };
      ws.onclose = (e) => { if (!ready) reject(new Error(e.reason || "Gemini Live closed the connection")); else this.stop(e.reason || undefined); };
    });
    this.idleTimer = window.setInterval(() => {
      if (Date.now() - this.lastActivity > IDLE_END_MS) this.stop("Ended after 1 minute of silence to save credits");
    }, 5000);
  }

  private onMic(chunk: Float32Array) {
    let sum = 0; for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    const rms = Math.sqrt(sum / chunk.length);
    this.ev.onLevel(Math.min(1, rms * 12));
    const now = Date.now();
    if (rms > SPEECH_RMS) { this.gateOpenUntil = now + HANGOVER_MS; this.lastActivity = now; }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (now < this.gateOpenUntil) {
      this.streaming = true;
      const pcm = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) pcm[i] = Math.max(-1, Math.min(1, chunk[i])) * 0x7fff;
      this.ws.send(JSON.stringify({ realtimeInput: { audio: { data: toB64(pcm.buffer), mimeType: "audio/pcm;rate=16000" } } }));
    } else if (this.streaming) {
      this.streaming = false;
      this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
  }

  private async handle(msg: any) {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) this.clearPlayback();
      if (sc.inputTranscription?.text) { this.userBuf += sc.inputTranscription.text; this.ev.onUserText(this.userBuf, false); }
      if (sc.outputTranscription?.text) {
        if (this.userBuf) { this.ev.onUserText(this.userBuf, true); this.userBuf = ""; }
        this.botBuf += sc.outputTranscription.text; this.ev.onAssistantText(this.botBuf, false);
      }
      for (const p of sc.modelTurn?.parts || []) if (p.inlineData?.data) this.play(p.inlineData.data);
      if (sc.turnComplete) {
        if (this.userBuf) { this.ev.onUserText(this.userBuf, true); this.userBuf = ""; }
        if (this.botBuf) { this.ev.onAssistantText(this.botBuf, true); this.botBuf = ""; }
        this.lastActivity = Date.now();
      }
    }
    if (msg.toolCall?.functionCalls?.length) {
      this.lastActivity = Date.now();
      const functionResponses = await Promise.all(msg.toolCall.functionCalls.map(async (c: any) => {
        let result: unknown;
        try { result = await this.ev.onToolCall(c.name, c.args || {}); } catch (e) { result = { error: e instanceof Error ? e.message : "failed" }; }
        return { id: c.id, name: c.name, response: { result } };
      }));
      this.ws?.readyState === WebSocket.OPEN && this.ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
    }
    if (msg.goAway) this.stop("Session time limit reached — tap Live again to continue");
  }

  private play(b64: string) {
    if (!this.outCtx) return;
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const buf = this.outCtx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0); for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const s = this.outCtx.createBufferSource(); s.buffer = buf; s.connect(this.outCtx.destination);
    this.playHead = Math.max(this.playHead, this.outCtx.currentTime + 0.03);
    s.start(this.playHead); this.playHead += buf.duration;
    this.sources.push(s); this.ev.onStatus("speaking"); this.lastActivity = Date.now();
    s.onended = () => { this.sources = this.sources.filter((x) => x !== s); if (!this.sources.length && !this.closed) this.ev.onStatus("listening"); };
  }

  private clearPlayback() {
    for (const s of this.sources) { try { s.stop(); } catch { /* already stopped */ } }
    this.sources = []; this.playHead = 0;
    if (!this.closed) this.ev.onStatus("listening");
  }

  sendText(text: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.lastActivity = Date.now();
    this.ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } }));
    return true;
  }

  stop(reason?: string) {
    if (this.closed) return;
    this.closed = true;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.clearPlayback();
    try { this.ws?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.micCtx?.close().catch(() => {}); void this.outCtx?.close().catch(() => {});
    this.ev.onStatus("idle"); this.ev.onLevel(0); this.ev.onClose(reason);
  }
}
