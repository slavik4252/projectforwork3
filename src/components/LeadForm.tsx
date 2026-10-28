import { useEffect, useState } from "react";
import { supabase, type Lead } from "@/lib/supabase";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export default function LeadForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const channels = ["Telegram", "WhatsApp", "Email", "Max"];
  const [channel, setChannel] = useState(channels[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.from("leads").insert({
      name: name.trim(),
      contact: contact.trim(),
      channel: "landing",
      source: channel,
      status: "new",
      note: source.trim() ? `Интерес: ${source.trim()}` : "",
    } as Partial<Lead>);
    setLoading(false);
    if (err) {
      setError("Не удалось отправить. Попробуйте ещё раз.");
      return;
    }
    setDone(true);
    setName("");
    setContact("");
    setSource("");
  }

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 6000);
    return () => clearTimeout(t);
  }, [done]);

  if (done) {
    return (
      <div className="fade-up bg-panel border border-c rounded-2xl p-8 text-center glow-ring">
        <CheckCircle2 className="w-12 h-12 mx-auto text-[#0d9488] mb-3" />
        <h3 className="font-display text-xl font-bold mb-1">Заявка принята</h3>
        <p className="text-dim text-sm">
          Менеджер свяжется в течение дня и покажет, как сервис сработает в вашей нише.
        </p>
      </div>
    );
  }

  return (
    <form
      id="lead-form"
      onSubmit={submit}
      className="bg-panel border border-c rounded-2xl p-6 sm:p-7 space-y-4 glow-ring"
    >
      <div>
        <h3 className="font-display text-xl font-bold">Запустим тест в вашей нише</h3>
        <p className="text-dim text-sm mt-1">Расскажем, что сработает именно у вас. Тест — от 1500 контактов.</p>
      </div>

      <div className="space-y-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как вас зовут"
          className="w-full bg-input border border-c rounded-xl px-4 py-3 text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition"
        />
        <input
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Телефон, email или Telegram"
          className="w-full bg-input border border-c rounded-xl px-4 py-3 text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition"
        />
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="w-full bg-input border border-c rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563eb] transition"
        >
          {channels.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Коротко о бизнесе (ниша, что продаёте)"
          rows={2}
          className="w-full bg-input border border-c rounded-xl px-4 py-3 text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition resize-none"
        />
      </div>

      {error && <p className="text-[#e11d48] text-xs">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white font-semibold rounded-xl py-3.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Оставить заявку
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-[10px] text-center text-[#94a3b8] leading-relaxed">
        Нажимая кнопку, вы даёте согласие на обработку персональных данных
      </p>
    </form>
  );
}
