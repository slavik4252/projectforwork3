import { useEffect, useState } from "react";
import { supabase, type Lead, type LeadStatus } from "@/lib/supabase";
import { StatusBadge } from "./Dashboard";
import { useLeadsLive } from "./useLeadsLive";
import { Search, Filter, Inbox } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  all: "Все",
  new: "Новые",
  qualified: "Квалифицированные",
  in_progress: "В работе",
  won: "Выигранные",
  lost: "Проигранные",
};

const STATUSES = Object.keys(STATUS_LABELS);

export default function LeadsList({ onOpen }: { onOpen: (lead: Lead) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter as LeadStatus);
    const { data } = await q;
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);
  useLeadsLive(() => load());

  const filtered = query
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(query.toLowerCase()) ||
          l.contact.toLowerCase().includes(query.toLowerCase()) ||
          l.source.toLowerCase().includes(query.toLowerCase())
      )
    : leads;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Лиды</h2>
        <p className="text-dim text-sm mt-1">{leads.length} заявок в CRM</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, контакту, нише…"
            className="w-full bg-panel border border-c rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition"
          />
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-[#94a3b8] shrink-0" />
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs font-medium px-3 py-2 min-h-11 rounded-lg whitespace-nowrap transition-colors ${
                filter === s
                  ? "bg-[#2563eb] text-white"
                  : "bg-panel border border-c text-dim hover:text-[#0b1626]"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-panel border border-c rounded-2xl overflow-hidden">
        {loading ? (
          <p className="px-5 py-10 text-center text-dim text-sm">Загрузка…</p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-dim">
            <Inbox className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Лидов нет</p>
          </div>
        ) : (
          <div className="divide-c divide-y">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => onOpen(l)}
                className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-4 cursor-pointer hover:bg-[#eef3fa] transition-colors text-left"
              >
                <div className="min-w-0 w-full flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{l.name || "Без имени"}</p>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="text-xs text-dim break-words">
                    {l.contact || "—"} · {l.channel} · {l.source || "без источника"}
                  </p>
                </div>
                <span className="text-xs text-[#94a3b8] whitespace-nowrap">
                  {new Date(l.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
