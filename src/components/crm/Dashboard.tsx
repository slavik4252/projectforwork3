import { supabase, type Lead } from "@/lib/supabase";
import { Users, Flame, TrendingUp, Trophy, ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLeadsLive } from "./useLeadsLive";

interface Stats {
  total: number;
  new: number;
  qualified: number;
  won: number;
  today: number;
  trendUp: boolean;
}

export default function Dashboard({ onOpenLeads }: { onOpenLeads: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Lead[]>([]);

  const load = useCallback(async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      const all = (data ?? []) as Lead[];
      const now = new Date();
      const today = all.filter(
        (l) => new Date(l.created_at).toDateString() === now.toDateString()
      ).length;
      setStats({
        total: all.length,
        new: all.filter((l) => l.status === "new").length,
        qualified: all.filter((l) => l.status === "qualified").length,
        won: all.filter((l) => l.status === "won").length,
        today,
        trendUp: all.length > 0,
      });
      setRecent(all.slice(0, 6));
  }, []);

  useEffect(() => { load(); }, [load]);
  useLeadsLive(load);

  const cards = [
    { label: "Всего лидов", value: stats?.total ?? 0, icon: Users, color: "#2563eb" },
    { label: "Новые", value: stats?.new ?? 0, icon: Flame, color: "#f59e0b" },
    { label: "Квалифицировано", value: stats?.qualified ?? 0, icon: TrendingUp, color: "#0d9488" },
    { label: "Закрыто (выиграно)", value: stats?.won ?? 0, icon: Trophy, color: "#2563eb" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Дашборд</h2>
        <p className="text-dim text-sm mt-1">
          {stats?.today ?? 0} новых заявок сегодня
          {stats && stats.trendUp ? (
            <span className="inline-flex items-center gap-1 text-[#0d9488] ml-2">
              <ArrowUpRight className="w-3.5 h-3.5" /> идёт приток
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-panel border border-c rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span
                className="grid place-items-center w-10 h-10 rounded-xl"
                style={{ background: `${c.color}1a`, color: c.color }}
              >
                <c.icon className="w-5 h-5" />
              </span>
            </div>
            <p className="font-display text-3xl font-extrabold">{c.value}</p>
            <p className="text-dim text-xs mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-panel border border-c rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-c">
          <h3 className="font-display font-bold">Последние заявки</h3>
          <button onClick={onOpenLeads} className="text-xs text-[#2563eb] hover:underline">
            Все лиды →
          </button>
        </div>
        <div className="divide-c divide-y">
          {recent.length === 0 && (
            <p className="px-5 py-8 text-center text-dim text-sm">Заявок пока нет</p>
          )}
          {recent.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium">
                  {l.name || "Без имени"} · <span className="text-dim">{l.channel}</span>
                </p>
                <p className="text-xs text-dim mt-0.5">{l.contact || "—"}</p>
              </div>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    new: { bg: "#f59e0b1a", text: "#b45309", label: "Новый" },
    qualified: { bg: "#0d94881a", text: "#0f766e", label: "Квалифицирован" },
    in_progress: { bg: "#2563eb1a", text: "#1d4ed8", label: "В работе" },
    won: { bg: "#0d94881a", text: "#0f766e", label: "Выигран" },
    lost: { bg: "#e11d481a", text: "#be123c", label: "Проигран" },
  };
  const s = (map[status] ?? map["new"])!;
  return (
    <span
      className="text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}
