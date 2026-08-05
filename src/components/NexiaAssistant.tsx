import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Loader2, RotateCcw, Trash2, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

type Attachment = { name: string; mimeType: string; data: string; size: number };
type Msg = { role: "user" | "assistant"; content: string; error?: boolean; files?: string[] };

const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB per file
const MAX_FILES = 5;
const ACCEPTED = ".pdf,image/*";

/** Read a File as raw base64 (no data: prefix). */
const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File parhi nahin ja saki"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("File parhi nahin ja saki"));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });


const GREETING: Msg = {
  role: "assistant",
  content: "Assalam-o-Alaikum! Main **Nexia** hun — aap ka business assistant. Sales, stock, accounts ya reports — kuch bhi poochein 😊",
};

const SUGGESTIONS = [
  "Aaj tak ki total sales?",
  "Cash aur bank balance batao",
  "Low stock items kaunse hain?",
  "Sab se zyada udhaar kis customer ka hai?",
];

export function NexiaAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attaching, setAttaching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUserMsgRef = useRef<string>("");
  const lastAttachmentsRef = useRef<Attachment[]>([]);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Stop any playing audio when voice is turned off or panel closes.
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!voiceEnabled || !open) stopAudio();
  }, [voiceEnabled, open, stopAudio]);

  const speak = async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    try {
      // Strip markdown so TTS doesn't read asterisks/hashes aloud.
      const clean = text.replace(/[*_#`>-]/g, " ").replace(/\s{2,}/g, " ").trim();
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: clean.slice(0, 800) },
      });
      if (error || !data?.audio) return;
      stopAudio();
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch (e) {
      console.error("TTS error:", e);
    }
  };

  const extractError = async (error: unknown): Promise<string> => {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) return String(body.error);
      } catch {
        /* body not JSON */
      }
    }
    return error instanceof Error ? error.message : "Unknown error";
  };

  const runChat = async (history: Msg[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nexia-grok", {
        body: {
          messages: history
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      const reply = data?.reply?.trim();
      if (!reply) throw new Error("Khali jawab mila");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (e) {
      const detail = await extractError(e);
      console.error("nexia error:", detail);
      toast.error(detail);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${detail}`, error: true },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const sendMessage = (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    lastUserMsgRef.current = content;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    void runChat(next);
  };

  const retry = () => {
    if (loading) return;
    // Drop trailing error bubble and resend the last user message.
    const cleaned = messages.filter((m) => !m.error);
    if (!lastUserMsgRef.current) return;
    setMessages(cleaned);
    void runChat(cleaned);
  };

  const clearChat = () => {
    stopAudio();
    setMessages([GREETING]);
    lastUserMsgRef.current = "";
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1000) { toast.error("Recording bohot chhoti thi"); return; }
        setTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          const base64 = btoa(bin);
          const { data, error } = await supabase.functions.invoke("elevenlabs-stt", {
            body: { audio: base64, mimeType: mr.mimeType || "audio/webm" },
          });
          if (error) throw error;
          const text = data?.text?.trim();
          if (text) sendMessage(text);
          else toast.error("Awaaz samajh nahin ayi");
        } catch (err) {
          toast.error(await extractError(err));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access nahin mila");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const lastIsError = messages[messages.length - 1]?.error;
  const showSuggestions = messages.length === 1 && !loading;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Open Nexia assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(400px,calc(100vw-2rem))] h-[min(620px,calc(100vh-2rem))] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div>
              <div className="font-semibold text-sm">Nexia AI</div>
              <div className="text-[11px] opacity-80">Aap ka business assistant</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 rounded-md hover:bg-white/10"
                title="Nayi guftagu"
                aria-label="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVoiceEnabled((v) => !v)}
                className="p-1.5 rounded-md hover:bg-white/10"
                title={voiceEnabled ? "Voice on" : "Voice off"}
                aria-label="Toggle voice"
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                      : m.error
                        ? "bg-destructive/10 text-destructive rounded-bl-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" && !m.error ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {lastIsError && !loading && (
              <div className="flex justify-start">
                <Button size="sm" variant="outline" onClick={retry} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Dobara koshish karein
                </Button>
              </div>
            )}

            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Soch raha hun...
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t p-2 flex items-center gap-2 bg-card">
            <Button
              type="button"
              size="icon"
              variant={recording ? "destructive" : "outline"}
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing || loading}
              title={recording ? "Stop recording" : "Voice input"}
            >
              {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={recording ? "Recording..." : "Message likhein..."}
              disabled={loading || recording || transcribing}
              className="flex-1"
            />
            <Button size="icon" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
