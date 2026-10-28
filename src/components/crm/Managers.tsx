import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Managers() {
  const [list, setList] = useState<{ email: string }[]>([]);
  const [me, setMe] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Менеджеры</h2>
        <button className="text-sm text-dim underline" onClick={() => supabase.auth.signOut()}>
          Выйти ({me})
        </button>
      </div>
      <p className="text-sm text-dim">
        Только эти почты могут входить в CRM по коду из письма.
      </p>
      <form onSubmit={add} className="flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="new.manager@company.ru"
          className="flex-1 rounded-lg border border-c bg-panel px-3.5 py-2.5 text-sm outline-none" />
        <button className="rounded-lg bg-[#2563eb] text-white text-sm font-medium px-4">Добавить</button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <ul className="divide-y divide-[#e3eaf3] rounded-lg border border-c bg-panel">
        {list.map((m) => (
          <li key={m.email} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{m.email}{m.email === me && <span className="text-dim"> (вы)</span>}</span>
            {m.email !== me && (
              <button onClick={() => remove(m.email)} aria-label="Удалить" className="text-dim hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
