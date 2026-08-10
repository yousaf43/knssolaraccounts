import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Loader2, RotateCcw, Trash2, Paperclip, FileText, Image as ImageIcon, FilePlus2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { saveDraft } from "@/lib/drafts";


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
  const [creatingDraft, setCreatingDraft] = useState(false);
  const navigate = useNavigate();


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

  const runChat = async (history: Msg[], files: Attachment[] = []) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nexia-grok", {
        body: {
          messages: history
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.content })),
          attachments: files.map((f) => ({ name: f.name, mimeType: f.mimeType, data: f.data })),
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

  const pickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setAttaching(true);
    try {
      const current = [...attachments];
      for (const file of Array.from(list)) {
        if (current.length >= MAX_FILES) {
          toast.error(`Zyada se zyada ${MAX_FILES} files bhej sakte hain`);
          break;
        }
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const isImage = file.type.startsWith("image/");
        if (!isPdf && !isImage) {
          toast.error(`${file.name}: sirf PDF ya image support hai`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: file 12 MB se bari hai`);
          continue;
        }
        try {
          const data = await fileToBase64(file);
          current.push({
            name: file.name,
            mimeType: isPdf ? "application/pdf" : file.type,
            data,
            size: file.size,
          });
        } catch {
          toast.error(`${file.name}: parhi nahin ja saki`);
        }
      }
      setAttachments(current);
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const removeAttachment = (name: string) =>
    setAttachments((prev) => prev.filter((f) => f.name !== name));

  /** Scan attached company quotation(s) and turn them into a resumable draft. */
  const createQuotationDraft = async () => {
    if (attachments.length === 0 || creatingDraft || loading) return;
    const files = attachments;
    setCreatingDraft(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: "Is quotation file se draft quotation bana do (accessories bundle me).",
        files: files.map((f) => f.name),
      },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke("parse-quotation", {
        body: {
          attachments: files.map((f) => ({ name: f.name, mimeType: f.mimeType, data: f.data })),
          note: input.trim(),
        },
      });
      if (error) throw error;
      const q = data?.quotation;
      if (!q || !Array.isArray(q.items) || q.items.length === 0) {
        throw new Error("File se koi line item nahin mila");
      }

      const draftId = `quotation:ai-${Date.now()}`;
      const today = new Date().toISOString().split("T")[0];
      saveDraft({
        id: draftId,
        kind: "quotation",
        label: q.documentNumber || "Scanned Quotation",
        summary: `${q.customer || "Unknown customer"} • ${q.items.length} lines • PKR ${Math.round(q.total || 0).toLocaleString()}`,
        data: {
          customNumber: "",
          documentNumber: q.documentNumber || "",
          projectName: q.projectName || "",
          customer: q.customer || "",
          selectedCustomerId: q.selectedCustomerId || "",
          date: q.date || today,
          dueDate: q.dueDate || "",
          status: "pending",
          tax: q.tax || 0,
          discount: 0,
          notes: q.notes || "",
          items: q.items,
          advanceAmount: 0,
          advanceMethod: "Cash on Hand",
          advanceRef: "",
        },
      });

      const unmatched: string[] = data?.meta?.unmatchedProducts ?? [];
      const bundles: number = data?.meta?.bundleCount ?? 0;
      const summary = [
        `✅ Draft quotation ban gaya — **${q.items.length}** lines${bundles ? `, jin me **${bundles}** bundle` : ""}.`,
        q.customer ? `Customer: **${q.customer}**${q.customerMatched ? "" : " (system me match nahin mila — form me select kar lein)"}` : "",
        `Total: **PKR ${Math.round(q.total || 0).toLocaleString()}**`,
        unmatched.length
          ? `⚠️ Ye products inventory se match nahin hue, form me manually chunein: ${unmatched.join(", ")}`
          : "",
        "Neeche **Draft kholein** button se Quotation form me continue karein.",
      ]
        .filter(Boolean)
        .join("\n\n");

      setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
      setAttachments([]);
      setInput("");
      toast.success("Draft quotation ban gaya");
      setTimeout(() => {
        navigate(`/invoices?draft=${encodeURIComponent(draftId)}`);
        setOpen(false);
      }, 400);
    } catch (e) {
      const detail = await extractError(e);
      console.error("parse-quotation error:", detail);
      toast.error(detail);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${detail}`, error: true }]);
    } finally {
      setCreatingDraft(false);
    }
  };


  const sendMessage = (text: string) => {
    const content = text.trim();
    const files = attachments;
    if ((!content && files.length === 0) || loading) return;
    const prompt = content || "Ye file parh kar batao is me kya hai, aur software ke data se compare karo.";
    lastUserMsgRef.current = prompt;
    lastAttachmentsRef.current = files;
    const next: Msg[] = [
      ...messages,
      { role: "user", content: prompt, files: files.map((f) => f.name) },
    ];
    setMessages(next);
    setInput("");
    setAttachments([]);
    void runChat(next, files);
  };

  const retry = () => {
    if (loading) return;
    // Drop trailing error bubble and resend the last user message.
    const cleaned = messages.filter((m) => !m.error);
    if (!lastUserMsgRef.current) return;
    setMessages(cleaned);
    void runChat(cleaned, lastAttachmentsRef.current);
  };

  const clearChat = () => {
    stopAudio();
    setMessages([GREETING]);
    setAttachments([]);
    lastUserMsgRef.current = "";
    lastAttachmentsRef.current = [];
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
                  {m.files && m.files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {m.files.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/15 max-w-[160px]"
                        >
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{f}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && !m.error ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_table]:text-[11px] [&_table]:w-full [&_th]:border [&_td]:border [&_th]:px-1 [&_td]:px-1 overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
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

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="border-t px-2 pt-2 flex flex-wrap gap-1.5 bg-card">
              {attachments.map((f) => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-muted max-w-[180px]"
                >
                  {f.mimeType.startsWith("image/") ? (
                    <ImageIcon className="w-3 h-3 shrink-0" />
                  ) : (
                    <FileText className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{f.name}</span>
                  <button
                    onClick={() => removeAttachment(f.name)}
                    className="shrink-0 hover:text-destructive"
                    aria-label={`Remove ${f.name}`}
                    disabled={loading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[11px] gap-1.5"
                onClick={() => void createQuotationDraft()}
                disabled={loading || creatingDraft || attaching}
                title="Scanned quotation se draft quotation banayein"
              >
                {creatingDraft ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePlus2 className="w-3 h-3" />}
                Quotation draft banayein
              </Button>
            </div>
          )}


          {/* Composer */}
          <div className="border-t p-2 flex items-center gap-2 bg-card">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => void pickFiles(e.target.files)}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || attaching || recording}
              title="PDF ya image attach karein"
            >
              {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
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
              placeholder={recording ? "Recording..." : attachments.length ? "File ke bara me poochein..." : "Message likhein..."}
              disabled={loading || recording || transcribing}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && attachments.length === 0)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

        </div>
      )}
    </>
  );
}
