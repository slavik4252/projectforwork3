import { useEffect, useState } from "react";
import { supabase, type Deal, type DealStage } from "@/lib/supabase";
import { useLeadsLive } from "./useLeadsLive";

const STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: "new", label: "Новые", color: "#f59e0b" },
  { id: "qualified", label: "Квалифицированы", color: "#2563eb" },
  { id: "proposal", label: "Предложение", color: "#6366f1" },
  { id: "negotiation", label: "Переговоры", color: "#0d9488" },
  { id: "won", label: "Выиграны", color: "#0d9488" },
  { id: "lost", label: "Проиграны", color: "#e11d48" },
];

export default function DealsBoard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    const d = (data ?? []) as Deal[];
    setDeals(d);
    const leadIds = [...new Set(d.map((x) => x.lead_id))];
    if (leadIds.length) {
      const { data: leads } = await supabase.from("leads").select("id,name").in("id", leadIds);
      const map: Record<string, string> = {};
      (leads ?? []).forEach((l: { id: string; name: string }) => { map[l.id] = l.name || "Без имени"; });
      setLeadNames(map);
    }
  }

  useEffect(() => { load(); }, []);
  useLeadsLive(() => load());

  async function moveStage(id: string, stage: DealStage) {
    await supabase.from("deals").update({ stage }).eq("id", id);
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Сделки</h2>
        <p className="text-dim text-sm mt-1">Перетащите карточку между колонками, чтобы изменить этап</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-2">
        {STAGES.map((s) => {
          const stageDeals = deals.filter((d) => d.stage === s.id);
          const total = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);
          return (
            <div
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && moveStage(dragId, s.id)}
              className="bg-soft border border-c rounded-2xl p-3 min-h-[200px]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <p className="text-xs font-semibold">{s.label}</p>
                </div>
                <span className="text-[10px] text-[#94a3b8]">{stageDeals.length}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8] mb-2">{total.toLocaleString("ru-RU")} ₽</p>
              <div className="space-y-2">
                {stageDeals.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className="bg-panel border border-c rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-[#2563eb]/40 hover:shadow-sm transition"
                  >
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-[11px] text-dim mt-0.5 truncate">{leadNames[d.lead_id] ?? "—"}</p>
                    <p className="text-sm font-bold text-[#0d9488] mt-1.5">
                      {Number(d.value).toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <p className="text-center text-[10px] text-[#94a3b8] py-4">Пусто</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
