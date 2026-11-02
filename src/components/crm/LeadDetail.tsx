import { useEffect, useState } from "react";
import { supabase, type Lead, type LeadStatus, type Note, type Deal, type Activity } from "@/lib/supabase";
import { useReviewStates } from "./useReviewStates";
import LeadScripts from "./LeadScripts";
import LeadEvidence from "./LeadEvidence";
import { StatusBadge } from "./Dashboard";
import { sendLeadToTelegram } from "@/lib/telegram-review.functions";
import { claimLead, releaseLead } from "@/lib/review-state.functions";
import { ArrowLeft, Plus, Trash2, Phone, Mail, Send, MessageCircle, StickyNote, Hand, Lock, Archive } from "lucide-react";

const STATUS_OPTIONS: LeadStatus[] = ["new", "qualified", "in_progress", "won", "lost"];
const STATUS_LABELS: Record<string, string> = {
  new: "Новый", qualified: "Квалифицирован", in_progress: "В работе", won: "Выигран", lost: "Проигран",
};

const CHANNEL_ICON: Record<string, typeof Phone> = {
  telegram: Send, whatsapp: MessageCircle, max: MessageCircle,
  phone: Phone, chat: MessageCircle, landing: Mail, email: Mail,
};

export default function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const { states: reviewStates, claims, me, error: reviewError, refresh: refreshReview } = useReviewStates([lead.id]);
  const accepted = reviewStates[lead.id]?.status === "accepted";
  const claim = claims[lead.id];
  const mine = !!claim && !!me && claim.managerId === me;
  const takenByOther = !!claim && !mine;
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newNote, setNewNote] = useState("");
  const [status, setStatus] = useState<LeadStatus>(lead.status);

  async function load() {
    const [n, d, a] = await Promise.all([
      supabase.from("notes").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
      supabase.from("deals").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
      supabase.from("activities").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
    ]);
    setNotes((n.data ?? []) as Note[]);
    setDeals((d.data ?? []) as Deal[]);
    setActivities((a.data ?? []) as Activity[]);
  }

  useEffect(() => { setScreenshots([]); load(); }, [lead.id]);

  // A report accepted by the AI or manually in Telegram completes the lead and moves it to the archive.
  useEffect(() => {
    if (!accepted || status === "won") return;
    setStatus("won");
    void (async () => {
      await supabase.from("leads").update({ status: "won" }).eq("id", lead.id);
      await supabase.from("activities").insert({ lead_id: lead.id, type: "status", description: "Отчёт принят — заявка выполнена и перенесена в архив" });
      load();
    })();
  }, [accepted]);

  async function token() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Сначала войдите в CRM");
    return data.session.access_token;
  }

  async function take() {
    if (claiming) return;
    setClaiming(true); setClaimMessage("");
    try {
      const result = await claimLead({ data: { accessToken: await token(), leadId: lead.id } });
      if (result.created) {
        await supabase.from("activities").insert({ lead_id: lead.id, type: "claim", description: `Заявку взял в работу ${result.claim.managerEmail}` });
        if (status === "new" || status === "qualified") await changeStatus("in_progress");
        else load();
      }
      await refreshReview();
    } catch (error) {
      setClaimMessage(error instanceof Error ? error.message : "Не удалось взять заявку");
      await refreshReview();
    } finally { setClaiming(false); }
  }

  async function release() {
    if (claiming || !window.confirm("Отказаться от заявки? Её смогут взять другие менеджеры.")) return;
    setClaiming(true); setClaimMessage("");
    try {
      await releaseLead({ data: { accessToken: await token(), leadId: lead.id } });
      await supabase.from("activities").insert({ lead_id: lead.id, type: "claim", description: `Менеджер ${claim?.managerEmail || ""} отказался от заявки` });
      if (status === "in_progress") await changeStatus("new"); else load();
      await refreshReview();
    } catch (error) {
      setClaimMessage(error instanceof Error ? error.message : "Не удалось отказаться от заявки");
    } finally { setClaiming(false); }
  }

  async function sendForReview() {
    if (sendingTelegram || accepted || takenByOther) return;
    setSendingTelegram(true);
    setTelegramMessage("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Сначала войдите в CRM");
      const encoded = await Promise.all(screenshots.map(file => new Promise<{ name: string; base64: string }>((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, base64: String(reader.result).split(",")[1] || "" });
        reader.onerror = () => reject(new Error("Не удалось прочитать скриншот"));
        reader.readAsDataURL(file);
      })));
      const result = await sendLeadToTelegram({ data: { accessToken: data.session.access_token, leadId: lead.id, screenshots: encoded } });
      setScreenshots(previous => previous.slice(result.attachmentsSent));
      if (result.attachmentError) {
        setTelegramMessage("Карточка отправлена, но не все скриншоты подтверждены. Проверьте Telegram перед повторной отправкой. Неотправленные файлы оставлены в форме.");
        await load();
        return;
      }
      const verdict=result.aiReview.status==="passed" ? "ИИ: проверка пройдена." : result.aiReview.status==="needs_info" ? "Нужна дополнительная информация." : "Требуется ручная проверка.";
      setTelegramMessage(verdict+" "+result.aiReview.reason+(result.logged ? " Отчёт отправлен в Telegram." : " Отчёт отправлен, но запись истории не сохранилась."));
      if (!result.registered) setTelegramMessage("Отчёт отправлен, но результат проверки на сайте не подтверждён. Проверьте D1 и секреты; не считайте лид автоматически выполненным.");
      else if (result.archived) { setStatus("won"); setTelegramMessage(verdict+" "+result.aiReview.reason+" Заявка выполнена и перенесена в архив."); }
      await refreshReview();
      await load();
    } catch (error) {
      setTelegramMessage(error instanceof Error ? error.message : "Не удалось отправить лид");
    } finally { setSendingTelegram(false); }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const { data } = await supabase
      .from("notes")
      .insert({ lead_id: lead.id, content: newNote.trim() })
      .select()
      .single();
    if (data) setNotes((prev) => [data as Note, ...prev]);
    await supabase.from("activities").insert({
      lead_id: lead.id, type: "note", description: "Добавлена заметка",
    });
    setNewNote("");
    load();
  }

  async function changeStatus(s: LeadStatus) {
    setStatus(s);
    await supabase.from("leads").update({ status: s }).eq("id", lead.id);
    await supabase.from("activities").insert({
      lead_id: lead.id, type: "status", description: `Статус изменён на «${STATUS_LABELS[s]}»`,
    });
    load();
  }

  async function deleteNote(id: string) {
    await supabase.from("notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const ChIcon = CHANNEL_ICON[lead.channel] ?? Mail;

  return (
    <div className="space-y-6 min-w-0 break-words">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-dim hover:text-[#0b1626] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Назад к лидам
      </button>

      {reviewStates[lead.id] && <p role="status" className="rounded-xl bg-amber-50 text-amber-900 p-4 font-medium">{reviewStates[lead.id].label}{reviewStates[lead.id].reason && <span className="block mt-2 text-sm font-normal">{reviewStates[lead.id].reason}</span>}</p>}
      {reviewError && <p role="alert" className="text-red-600 text-sm">{reviewError}</p>}
      <div className="bg-panel border border-c rounded-2xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#2563eb]/10 text-[#2563eb] shrink-0">
              <ChIcon className="w-6 h-6" />
            </span>
            <div className="min-w-0 break-words">
              <h2 className="font-display text-xl font-bold">{lead.name || "Без имени"}</h2>
              <p className="text-dim text-sm mt-1">{lead.contact || "—"}</p>
              <p className="text-xs text-[#94a3b8] mt-1">
                {lead.channel} · {lead.source || "без источника"} ·{" "}
                {new Date(lead.created_at).toLocaleString("ru-RU", {
                  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {lead.note && <p className="mt-4 pt-4 border-t border-c text-sm text-dim">{lead.note}</p>}

        <div className="mt-5 rounded-xl border border-c bg-page p-3 sm:p-4 space-y-2">
          {accepted ? (
            <p className="flex items-center gap-2 text-sm font-medium text-[#0f766e]"><Archive className="w-4 h-4" /> Заявка выполнена и находится в архиве{claim ? ` · ${claim.managerEmail}` : ""}</p>
          ) : mine ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[#2563eb]"><Hand className="w-4 h-4" /> Вы взяли эту заявку — другие менеджеры не могут её взять</p>
              <button type="button" onClick={() => void release()} disabled={claiming} className="text-xs border border-c rounded-lg px-3 py-2 cursor-pointer hover:bg-[#eef3fa] disabled:opacity-50">Отказаться</button>
            </div>
          ) : takenByOther ? (
            <p className="flex items-center gap-2 text-sm font-medium text-[#b45309]"><Lock className="w-4 h-4" /> Заявку взял {claim.managerEmail}. Работать с ней может только он.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void take()} disabled={claiming} className="inline-flex items-center gap-2 bg-[#0d9488] text-white rounded-lg px-4 py-2 text-sm cursor-pointer hover:opacity-90 disabled:opacity-50">
                <Hand className="w-4 h-4" /> {claiming ? "Закрепляем…" : "Взять заявку"}
              </button>
              <p className="text-xs text-dim">Заявка свободна. После того как вы её возьмёте, другие менеджеры не смогут с ней работать.</p>
            </div>
          )}
          {claimMessage && <p role="alert" className="text-sm text-[#e11d48]">{claimMessage}</p>}
        </div>

        <div className="mt-5 space-y-2">
          <button type="button" onClick={() => void sendForReview()} disabled={sendingTelegram || accepted || takenByOther}
            className="inline-flex items-center gap-2 bg-[#2563eb] text-white rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" />
            {sendingTelegram ? "Отправляем…" : "Отправить в Telegram на проверку"}
          </button>
          <p className="text-xs text-dim">Будут переданы имя, контакт, канал и информация из карточки лида.</p>
          {telegramMessage && <p role="status" className="text-sm">{telegramMessage}</p>}
        </div>
        <div className="mt-5">
          <p className="text-xs text-dim mb-2">Статус</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  status === s
                    ? "bg-[#2563eb] text-white"
                    : "bg-page border border-c text-dim hover:text-[#0b1626]"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LeadScripts key={lead.id+"-scripts"} lead={lead} canContact={mine && !accepted} onTake={claim || accepted ? undefined : () => void take()} />

      <LeadEvidence files={screenshots} onChange={setScreenshots} disabled={sendingTelegram} />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-panel border border-c rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-bold flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-[#2563eb]" /> Заметки
          </h3>
          <div className="flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Добавить заметку…"
              className="min-w-0 flex-1 bg-page border border-c rounded-xl px-3 py-2 text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition"
            />
            <button
              onClick={addNote}
              className="grid place-items-center w-9 h-9 rounded-xl bg-[#2563eb] text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {notes.length === 0 && <p className="text-center text-dim text-xs py-4">Заметок нет</p>}
            {notes.map((n) => (
              <div key={n.id} className="group flex items-start justify-between gap-3 bg-page border border-c rounded-xl p-3">
                <div>
                  <p className="text-sm">{n.content}</p>
                  <p className="text-[10px] text-[#94a3b8] mt-1">
                    {new Date(n.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="p-2 min-h-11 min-w-11 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-[#e11d48] hover:scale-110 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-panel border border-c rounded-2xl p-5">
            <h3 className="font-display font-bold mb-3">Сделки</h3>
            {deals.length === 0 ? (
              <p className="text-center text-dim text-xs py-4">Сделок нет</p>
            ) : (
              <div className="space-y-2">
                {deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between bg-page border border-c rounded-xl p-3">
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-[10px] text-[#94a3b8] mt-0.5">Этап: {d.stage}</p>
                    </div>
                    <span className="text-sm font-bold text-[#0d9488]">
                      {Number(d.value).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-panel border border-c rounded-2xl p-5">
            <h3 className="font-display font-bold mb-3">Активность</h3>
            {activities.length === 0 ? (
              <p className="text-center text-dim text-xs py-4">Пока пусто</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm">{a.description}</p>
                      <p className="text-[10px] text-[#94a3b8] mt-0.5">
                        {new Date(a.created_at).toLocaleString("ru-RU")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
