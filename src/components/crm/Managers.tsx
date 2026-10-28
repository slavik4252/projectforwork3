import { useEffect, useState } from "react";
import { configureTelegramReview } from "@/lib/review-state.functions";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Managers() {
  const [connecting, setConnecting] = useState(false);
  const [botMessage, setBotMessage] = useState("");
  const [list, setList] = useState<{ email: string }[]>([]);
  const [me, setMe] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function connectBot() {
    setConnecting(true); setBotMessage("");
    try {
      const {data} = await supabase.auth.getSession();
      if (!data.session) throw new Error("Войдите в CRM");
      await configureTelegramReview({data:{accessToken:data.session.access_token}});
      setBotMessage("Telegram подключён. Отправьте новый тестовый лид на проверку.");
    } catch(e) { setBotMessage(e instanceof Error ? e.message : "Не удалось подключить бота"); }
    finally {setConnecting(false);}
  }
  async function load() {
    const { data } = await supabase.from("managers").select("email").order("created_at");
    setList(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email?.toLowerCase() ?? ""));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase.from("managers").insert({ email: email.trim().toLowerCase() });
    if (error) return setMsg(error.code === "23505" ? "Эта почта уже в списке" : error.message);
    setEmail(""); load();
  }
  async function remove(em: string) {
    await supabase.from("managers").delete().eq("email", em);
    load();
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Менеджеры</h2>
        <button className="text-sm text-dim underline" onClick={() => supabase.auth.signOut()}>
          Выйти ({me})
        </button>
      </div>
      <section className="border border-c rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">Проверка лидов в Telegram</h3>
        <p className="text-sm text-dim">После настройки D1 и секретов нажмите кнопку один раз. Получатель берётся из серверных настроек.</p>
        <button type="button" disabled={connecting} onClick={()=>void connectBot()} className="min-h-11 bg-[#2563eb] text-white rounded-lg px-4 cursor-pointer disabled:opacity-50">
          {connecting ? "Подключаем…" : "Подключить кнопки Telegram"}
        </button>
        {botMessage && <p role="status" className="text-sm">{botMessage}</p>}
      </section>
      <p className="text-sm text-dim">
        Только эти почты могут входить в CRM по коду из письма.
      </p>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="new.manager@company.ru"
          className="min-w-0 flex-1 rounded-lg border border-c bg-panel px-3.5 py-2.5 text-base sm:text-sm outline-none" />
        <button className="rounded-lg bg-[#2563eb] text-white text-sm font-medium px-4 min-h-11 cursor-pointer">Добавить</button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <ul className="divide-y divide-[#e3eaf3] rounded-lg border border-c bg-panel">
        {list.map((m) => (
          <li key={m.email} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="min-w-0 break-all">{m.email}{m.email === me && <span className="text-dim"> (вы)</span>}</span>
            {m.email !== me && (
              <button onClick={() => remove(m.email)} aria-label="Удалить" className="min-h-11 min-w-11 shrink-0 grid place-items-center text-dim hover:text-red-600 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
