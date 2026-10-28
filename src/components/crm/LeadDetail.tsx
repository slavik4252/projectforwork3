import { useEffect, useState } from "react";
import { supabase, type Lead, type LeadStatus, type Note, type Deal, type Activity } from "@/lib/supabase";
import { StatusBadge } from "./Dashboard";
import { ArrowLeft, Plus, Trash2, Phone, Mail, Send, MessageCircle, StickyNote } from "lucide-react";

const STATUS_OPTIONS: LeadStatus[] = ["new", "qualified", "in_progress", "won", "lost"];
const STATUS_LABELS: Record<string, string> = {
  new: "Новый", qualified: "Квалифицирован", in_progress: "В работе", won: "Выигран", lost: "Проигран",
};

const CHANNEL_ICON: Record<string, typeof Phone> = {
  telegram: Send, whatsapp: MessageCircle, max: MessageCircle,
  phone: Phone, chat: MessageCircle, landing: Mail, email: Mail,
};

export default function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
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

  useEffect(() => { load(); }, [lead.id]);

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
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-dim hover:text-[#0b1626] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Назад к лидам
      </button>

      <div className="bg-panel border border-c rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#2563eb]/10 text-[#2563eb] shrink-0">
              <ChIcon className="w-6 h-6" />
            </span>
            <div>
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
              className="flex-1 bg-page border border-c rounded-xl px-3 py-2 text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition"
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
                  className="opacity-0 group-hover:opacity-100 text-[#e11d48] hover:scale-110 transition"
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
