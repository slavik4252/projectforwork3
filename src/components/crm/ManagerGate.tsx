import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { parseManagerEmailLink } from "@/lib/manager-email-link";

type State = "loading" | "signedOut" | "notManager" | "manager";

export function useManager() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const check = async (s: Session | null) => {
      setSession(s);
      if (!s) return setState("signedOut");
      const { data } = await supabase.rpc("is_manager");
      setState(data ? "manager" : "notManager");
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => check(s), 0);
    });
    supabase.auth.getSession().then(({ data }) => check(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, state };
}

const input =
  "w-full rounded-lg border border-c bg-panel px-3.5 py-2.5 text-sm outline-none focus:border-[#2563eb]";
const btn =
  "w-full rounded-lg bg-[#2563eb] text-white text-sm font-medium px-4 py-2.5 disabled:opacity-50";

export default function ManagerGate({ children }: { children: ReactNode }) {
  const { session, state } = useManager();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const value = code.trim();
      const credentials = /^https?:/i.test(value)
        ? await parseManagerEmailLink(value)
        : { email: email.trim().toLowerCase(), token: value, type: "email" as const };
      const { error } = await supabase.auth.verifyOtp(credentials);
      setCode("");
      if (error) setMsg("Ссылка или код недействительны либо уже использованы. Запросите новое письмо и скопируйте ссылку, не открывая её.");
    } catch (error) {
      setCode("");
      setMsg(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-dim text-sm">Загрузка…</p>;
  if (state === "manager") return <>{children}</>;

  return (
    <div className="max-w-sm mx-auto mt-10 space-y-4">
      <h2 className="text-xl font-semibold">Вход для менеджеров</h2>
      {state === "notManager" ? (
        <>
          <p className="text-sm text-dim">
            {session?.user.email} — нет доступа к CRM. Попросите менеджера добавить эту почту.
          </p>
          <button className={btn} onClick={() => supabase.auth.signOut()}>Выйти</button>
        </>
      ) : step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <p className="text-sm text-dim">Введите почту — мы пришлём код для входа.</p>
          <input className={input} type="email" required placeholder="you@company.ru"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btn} disabled={busy}>Получить код</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-dim">Письмо отправлено на {email}. Если кнопка ведёт на старый сайт, нажмите на неё правой кнопкой, выберите «Копировать ссылку» и вставьте ниже, не открывая её. Также можно ввести код из письма.</p>
          <input className={input} type="password" autoComplete="off" spellCheck={false} required maxLength={4096} aria-label="Код или ссылка входа из письма" placeholder="Код или ссылка из письма"
            value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={btn} disabled={busy}>Войти</button>
          <button type="button" className="text-sm text-dim underline" onClick={() => setStep("email")}>
            Другая почта
          </button>
        </form>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}
