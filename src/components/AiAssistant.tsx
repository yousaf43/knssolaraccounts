import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, Trash2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const SUGGESTIONS = [
  "Last month ki total sale kitni hui?",
  "Kon se products ka stock kam hai?",
  "Pending invoices kitni hain?",
  "Top 5 customers by sales",
  "Aaj ka sale summary",
  "Solar washing ki total earning?",
  "Bank accounts ka balance batao",
  "Supplier payments ka summary do",
];

// Improved speech synthesis - female voice with natural speech
function speakText(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  // Strip markdown for cleaner speech
  const cleanText = text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[~|>\-]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/•/g, "")
    .replace(/\d+\.\s/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();

  if (!cleanText) return;

  // Split into sentences for more natural speech
  const sentences = cleanText
    .split(/(?<=[.!?؟۔])\s+/)
    .filter(s => s.trim().length > 0);

  let currentIndex = 0;

  const speakNext = () => {
    if (currentIndex >= sentences.length) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentences[currentIndex]);

    // Try to find a good female voice
    const voices = window.speechSynthesis.getVoices();
    
    // Priority: Female English voices that sound natural
    const preferredVoices = [
      // Google female voices (best quality)
      voices.find(v => v.name.includes("Google") && v.name.includes("Female") && v.lang.startsWith("en")),
      voices.find(v => v.name.includes("Google UK English Female")),
      voices.find(v => v.name.includes("Google US English")),
      // Microsoft female voices
      voices.find(v => v.name.includes("Zira")),
      voices.find(v => v.name.includes("Jenny")),
      voices.find(v => v.name.includes("Aria")),
      voices.find(v => v.name.includes("Sara")),
      // Apple female voices
      voices.find(v => v.name.includes("Samantha")),
      voices.find(v => v.name.includes("Karen")),
      voices.find(v => v.name.includes("Victoria")),
      // Any female English voice
      voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")),
      // Hindi female (good for Urdu/Roman Urdu)
      voices.find(v => v.lang.startsWith("hi") && v.name.toLowerCase().includes("female")),
      voices.find(v => v.lang.startsWith("hi")),
      // Fallback: any English voice
      voices.find(v => v.lang.startsWith("en-US")),
      voices.find(v => v.lang.startsWith("en")),
    ];

    const selectedVoice = preferredVoices.find(v => v != null) || null;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = 0.92;
    utterance.pitch = 1.1; // Slightly higher pitch for female voice
    utterance.volume = 1.0;

    utterance.onend = () => {
      currentIndex++;
      speakNext();
    };

    utterance.onerror = () => {
      currentIndex++;
      speakNext();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Ensure voices are loaded
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      speakNext();
    };
  } else {
    speakNext();
  }
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Preload voices
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support speech recognition.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ur-PK";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => {
          if (transcript.trim()) {
            sendMessage(transcript.trim());
          }
        }, 300);
      }
    };

    recognition.start();
  }, [isListening]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);

    let assistantSoFar = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      headers["apikey"] = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "AI service error" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Auto-speak the response if voice is enabled
      if (voiceEnabled && assistantSoFar) {
        setIsSpeaking(true);
        speakText(assistantSoFar, () => setIsSpeaking(false));
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${e.message || "Something went wrong"}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 animate-bounce"
          style={{ animationDuration: "2s", animationIterationCount: 3 }}
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-[9999] w-[390px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-2rem)] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-xl">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <span className="font-semibold text-sm">Aisha - AI Assistant</span>
                {isSpeaking && (
                  <span className="flex items-center gap-1 text-[10px] opacity-80">
                    <Volume2 className="w-3 h-3 animate-pulse" /> Speaking...
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setVoiceEnabled(!voiceEnabled); if (isSpeaking) stopSpeaking(); }}
                className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
                title={voiceEnabled ? "Disable voice" : "Enable voice"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={() => { setMessages([]); stopSpeaking(); }} className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors" title="Clear chat">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => { setOpen(false); stopSpeaking(); }} className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-1 font-medium">Aisha - K&S Solar AI Assistant</p>
                <p className="text-xs text-muted-foreground mb-1">Mujhe business data, reports, accounts sab ka access hai!</p>
                <p className="text-xs text-muted-foreground mb-4">General questions bhi pooch saktay hain 🌐</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted transition-colors text-muted-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2 rounded-bl-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2"
            >
              <button
                type="button"
                onClick={toggleListening}
                disabled={isLoading}
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Bol rahay hain..." : "Apna sawal likhein..."}
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-lg shrink-0 h-9 w-9">
                <Send className="w-4 h-4" />
              </Button>
            </form>
            {isListening && (
              <p className="text-[10px] text-destructive mt-1 text-center animate-pulse">🎤 Listening... bolein aur automatically send ho jayega</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
