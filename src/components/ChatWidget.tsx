import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, MessageCircle, Loader2 } from "lucide-react";
import { askAgent } from "@/lib/ai-chat.functions";
import { supabase, type ChatMessageRow } from "@/lib/supabase";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const WELCOME =
  "Здравствуйте! Я ИИ-агент testrassilka. Помогу подобрать канал лидогенерации под ваш бизнес. Расскажите коротко — чем занимается ваша компания?";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    const id = crypto.randomUUID();
    const { error: err } = await supabase.from("chat_sessions").insert({ id, status: "active" });
    if (err) throw new Error("Не удалось создать сессию");
    setSessionId(id);
    return id;
  }

  async function persist(role: ChatMessageRow["role"], content: string, sid: string) {
    await supabase.from("chat_messages").insert({ session_id: sid, role, content });
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError("");
    setBusy(true);
    const userMsg: Msg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");

    let sid = sessionId;
    let leadSaved = false;
    try {
      sid = await ensureSession();
      await persist("user", text, sid);

      // Save the lead first, independently of the AI reply, so it reaches the CRM even if GigaChat is down.
      if (/(?:\+?\d[\d\s\-()]{6,}|@[\w_]{3,}|[\w.+-]+@[\w-]+\.[\w.-]+)/.test(text)) {
        const { error: leadErr } = await supabase.from("leads").insert({
          name: "Из чата на сайте",
          contact: text.slice(0, 500),
          channel: "chat",
          source: "Чат-виджет",
          status: "new",
          note: history.filter((m) => m.role === "user").map((m) => m.content).join("\n").slice(-2000) || "Заявка из чата с ИИ-агентом",
        });
        if (leadErr) console.error("Не удалось сохранить заявку из чата", leadErr);
        else leadSaved = true;
      }


      const { content: reply } = await askAgent({
        data: { messages: history.map((m) => ({ role: m.role, content: m.content })) },
      });
      await persist("assistant", reply, sid);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка связи с ИИ";
      if (!leadSaved) setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: leadSaved
            ? "Спасибо! Ваш контакт передан менеджеру — он свяжется с вами в ближайшее время."
            : "Извините, не удалось связаться с сервером. Оставьте, пожалуйста, телефон, email или Telegram — менеджер свяжется с вами.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-[60] grid place-items-center w-14 h-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#0d9488] text-white shadow-lg hover:scale-105 transition-transform ${
          open ? "opacity-0 pointer-events-none" : ""
        }`}
        aria-label="Открыть чат"
      >
        <MessageCircle className="w-6 h-6" strokeWidth={2.2} />
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0d9488] border-2 border-white pulse-dot" />
      </button>

      <div
        className={`fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 sm:right-5 z-[60] w-[calc(100vw-1.5rem)] sm:w-[400px] max-w-[400px] origin-bottom-right transition-all duration-300 ${
          open ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-panel border border-c rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[560px] max-h-[calc(100dvh-6rem)]">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-c bg-gradient-to-r from-[#2563eb] to-[#0d9488]">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-white/20">
                <Bot className="w-5 h-5 text-white" strokeWidth={2.4} />
              </span>
              <div>
                <p className="font-display font-bold text-sm leading-tight text-white">ИИ-агент testrassilka</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white pulse-dot" />
                  онлайн
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/15"
              aria-label="Закрыть чат"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-page">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`break-words min-w-0 max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#2563eb] text-white rounded-br-sm"
                      : "bg-panel border border-c text-[#0b1626] rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-panel border border-c rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] pulse-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] pulse-dot" style={{ animationDelay: "0.2s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] pulse-dot" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
            {error && <p className="text-[11px] text-[#e11d48] text-center">{error}</p>}
          </div>

          {/* input */}
          <div className="px-3 py-3 border-t border-c bg-panel">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напишите сообщение…"
                disabled={busy}
                className="min-w-0 flex-1 bg-page border border-c rounded-xl px-3.5 py-2.5 text-base sm:text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#0d9488] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                aria-label="Отправить"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
            <p className="text-[10px] text-[#94a3b8] mt-2 text-center">
              ИИ-агент · данные в РФ
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
