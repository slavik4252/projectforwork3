import { useEffect, useState } from "react";
import { LayoutDashboard, Users, KanbanSquare, X, ShieldCheck, PanelRightClose, PanelLeftOpen } from "lucide-react";
import Dashboard from "./Dashboard";
import LeadsList from "./LeadsList";
import LeadDetail from "./LeadDetail";
import DealsBoard from "./DealsBoard";
import ManagerGate from "./ManagerGate";
import Managers from "./Managers";
import { supabase, type Lead } from "@/lib/supabase";

function LinkedLead({ id, onBack }: { id: string; onBack: () => void }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLead(null); setError("");
    supabase.from("leads").select("*").eq("id", id).single().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setError("Заявка удалена или у вас нет доступа к ней.");
      else setLead(data as Lead);
    }, () => { if (active) setError("Не удалось загрузить заявку. Попробуйте открыть ссылку ещё раз."); });
    return () => { active = false; };
  }, [id]);
  if (error) return <div className="space-y-3"><p role="alert">{error}</p><button className="text-[#2563eb] cursor-pointer" onClick={onBack}>К списку лидов</button></div>;
  if (!lead) return <p role="status">Открываем заявку…</p>;
  return <LeadDetail lead={lead} onBack={onBack} />;
}

type Tab = "dashboard" | "leads" | "deals" | "managers";

export default function CrmPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { if (open) setMinimized(false); }, [open]);
  useEffect(() => {
    if (!open || minimized) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open, minimized]);
  useEffect(() => {
    if (!open) return;
    const id = new URLSearchParams(window.location.search).get("lead");
    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { setLinkedId(id); setTab("leads"); }
  }, [open]);
  function clearLink() {
    setLinkedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("lead");
    window.history.replaceState(window.history.state, "", url);
  }
  // Reload fresh data every time the CRM is opened
  useEffect(() => { if (open) setOpenCount((c) => c + 1); }, [open]);

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
    { id: "leads", label: "Лиды", icon: Users },
    { id: "deals", label: "Сделки", icon: KanbanSquare },
    { id: "managers", label: "Менеджеры", icon: ShieldCheck },
  ];

  return (
    <>
      {open && minimized && <button
        onClick={() => setMinimized(false)}
        className="fixed right-0 top-1/2 z-[80] -translate-y-1/2 flex items-center gap-2 rounded-l-xl bg-[#2563eb] px-3 py-4 text-white shadow-lg hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
        aria-label="Развернуть CRM"
        title="Развернуть CRM"
      ><PanelLeftOpen className="h-5 w-5" /><span>CRM</span></button>}
    <div hidden={!open || minimized} className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 h-[100dvh] w-full overscroll-contain bg-page shadow-2xl overflow-y-auto"
      >
        <button onClick={() => setMinimized(true)}
          className="fixed right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-xl border border-c bg-panel p-2 sm:p-3 text-[#2563eb] shadow-md hover:bg-blue-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Свернуть CRM" title="Свернуть CRM">
          <PanelRightClose className="h-5 w-5" />
        </button>
        <div className="sticky top-0 z-10 bg-panel/95 backdrop-blur border-b border-c px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { clearLink(); setTab(t.id); setSelected(null); }}
                className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 sm:px-3.5 min-h-11 py-2 cursor-pointer rounded-lg transition-colors ${
                  tab === t.id ? "bg-[#2563eb]/10 text-[#2563eb]" : "text-dim hover:text-[#0b1626]"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 min-h-11 min-w-11 p-2 text-dim hover:text-[#0b1626] rounded-lg hover:bg-[#eef3fa] cursor-pointer"
            aria-label="Закрыть CRM"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div key={openCount} className="p-3 pr-12 sm:p-5 sm:pr-16 lg:p-7 lg:pr-20 min-w-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ManagerGate>
          {linkedId ? <LinkedLead id={linkedId} onBack={() => { clearLink(); setTab("leads"); }} /> : <>
          {tab === "dashboard" && <Dashboard onOpenLeads={() => setTab("leads")} />}
          {tab === "leads" && !selected && <LeadsList onOpen={(l) => setSelected(l)} />}
          {tab === "leads" && selected && <LeadDetail lead={selected} onBack={() => setSelected(null)} />}
          {tab === "deals" && <DealsBoard />}
          {tab === "managers" && <Managers />}
          </>}
          </ManagerGate>
        </div>
      </div>
    </div>
    </>
  );
}
