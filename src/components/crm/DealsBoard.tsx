import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Lead, type LeadStatus } from "@/lib/supabase";
import { useLeadsLive } from "./useLeadsLive";

const STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "new", label: "Новые", color: "#f59e0b" },
  { id: "qualified", label: "Тёплые", color: "#2563eb" },
  { id: "in_progress", label: "В работе", color: "#6366f1" },
  { id: "won", label: "Успешные", color: "#0d9488" },
  { id: "lost", label: "Отказ", color: "#e11d48" },
];

function niche(lead: Lead) {
  return lead.note?.replace(/^(Интерес|Ниша):\s*/i, "").trim() || "Не указана";
}
function contactChannel(lead: Lead) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact.trim())) return "Email";
  if (lead.contact.trim().startsWith("@")) return "Telegram";
  return lead.source || lead.channel || "Контакт";
}

export default function DealsBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const moving = useRef(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const version = ++request.current;
    try {
      const result = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (version !== request.current) return;
      if (result.error) throw result.error;
      setLeads((result.data ?? []) as Lead[]);
    } catch {
      if (version === request.current) setError("Не удалось загрузить лиды. Попробуйте обновить список.");
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); return () => { ++request.current; }; }, [load]);
  useLeadsLive(() => { void load(); });

  async function moveStage(id: string, status: LeadStatus) {
    if (moving.current || leads.find(lead => lead.id === id)?.status === status) return;
    moving.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await supabase.from("leads").update({ status }).eq("id", id).select("id,status").single();
      if (result.error || !result.data) throw result.error || new Error("Lead not updated");
      ++request.current;
      setLeads(previous => previous.map(lead => lead.id === id ? { ...lead, status } : lead));
    } catch {
      setError("Не удалось сохранить этап. Карточка не перемещена.");
    } finally {
      moving.current = false;
      setSaving(false);
      setDragId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Сделки и лиды</h2>
          <p className="text-dim text-sm mt-1">Все заявки на одной доске. Перетащите карточку или выберите этап в её меню.</p>
        </div>
        <button type="button" disabled={saving || refreshing || loading} aria-busy={refreshing}
          onClick={async () => { setError(""); setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }}
          className="shrink-0 inline-flex items-center justify-center rounded-lg border border-[#2563eb] bg-[#2563eb] px-4 py-2 text-sm font-medium text-white shadow-sm cursor-pointer transition-colors hover:bg-[#1d4ed8] active:bg-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {refreshing ? "Обновляем…" : "Обновить"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading && <p role="status" className="text-sm text-dim">Загрузка лидов…</p>}
      {!loading && leads.length === 0 && !error && <p className="text-sm text-dim">Заявок пока нет. Новые заявки появятся здесь.</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const items = leads.filter(lead => lead.status === stage.id);
          return (
            <section key={stage.id} aria-label={stage.label}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); if (dragId) void moveStage(dragId, stage.id); }}
              className="bg-soft border border-c rounded-2xl p-3 min-h-[240px] min-w-[220px] flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />{stage.label}
                </h3>
                <span className="text-xs text-dim">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map(lead => (
                  <article key={lead.id} draggable={!saving}
                    onDragStart={() => setDragId(lead.id)} onDragEnd={() => setDragId(null)}
                    className="bg-panel border border-c rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing">
                    <h4 className="text-sm font-semibold break-words">{lead.name || "Без имени"}</h4>
                    <p className="text-xs text-dim whitespace-pre-wrap break-words"><span className="font-medium">Ниша: </span>{niche(lead)}</p>
                    <p className="text-xs break-words"><span className="text-dim">{contactChannel(lead)}: </span>{lead.contact || "Не указан"}</p>
                    <label className="block text-xs text-dim">
                      Этап
                      <select value={lead.status} disabled={saving} aria-label={`Этап лида ${lead.name || "Без имени"}`}
                        onChange={event => void moveStage(lead.id, event.target.value as LeadStatus)}
                        className="block mt-1 w-full bg-panel border border-c rounded-lg px-2 py-2 text-xs">
                        {STAGES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
                {items.length === 0 && <p className="text-center text-xs text-dim py-4">Пусто</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
