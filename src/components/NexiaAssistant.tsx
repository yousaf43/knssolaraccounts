import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

export function NexiaAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Assalam-o-Alaikum! Main Nexia hun. Aap ka business assistant. Kya madad chahiye? 😊" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const speak = async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: text.slice(0, 800) },
      });
      if (error || !data?.audio) return;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch (e) {
      console.error("TTS error:", e);
    }
  };

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const newMessages: Msg[] = [...messages, { role: "user" as const, content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("nexia-grok", {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      const reply = data?.reply || "Maaf karein, jawab nahin mil paya.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (e: any) {
      console.error(e);
      toast.error("AI response mein error aya");
      setMessages((prev) => [...prev, { role: "assistant", content: "Maaf karein, abhi kuch technical issue hai." }]);
    } finally {
      setLoading(false);
    }
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
          console.error(err);
          toast.error("Transcription fail hui");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      toast.error("Microphone access nahin mila");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <>
      {/* Floating trigger */}
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
        <div className="fixed bottom-5 right-5 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(600px,calc(100vh-2rem))] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div>
              <div className="font-semibold text-sm">Nexia AI</div>
              <div className="text-[11px] opacity-80">Aap ki business assistant</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVoiceEnabled((v) => !v)}
                className="p-1.5 rounded-md hover:bg-white/10"
                title={voiceEnabled ? "Voice on" : "Voice off"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Soch rahi hun...
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
