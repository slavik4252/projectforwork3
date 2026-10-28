import { useEffect, useState } from "react";
import { LayoutDashboard, Users, KanbanSquare, X, ShieldCheck } from "lucide-react";
import Dashboard from "./Dashboard";
import LeadsList from "./LeadsList";
import LeadDetail from "./LeadDetail";
import DealsBoard from "./DealsBoard";
import ManagerGate from "./ManagerGate";
import Managers from "./Managers";
import type { Lead } from "@/lib/supabase";

type Tab = "dashboard" | "leads" | "deals" | "managers";

export default function CrmPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [openCount, setOpenCount] = useState(0);
  // Reload fresh data every time the CRM is opened
  useEffect(() => { if (open) setOpenCount((c) => c + 1); }, [open]);

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
    { id: "leads", label: "Лиды", icon: Users },
    { id: "deals", label: "Сделки", icon: KanbanSquare },
    { id: "managers", label: "Менеджеры", icon: ShieldCheck },
  ];

  return (
    <div
      className={`fixed inset-0 z-[70] transition-all duration-300 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-[#0b1626]/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-5xl bg-page border-l border-c shadow-2xl overflow-y-auto transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 bg-panel/95 backdrop-blur border-b border-c px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSelected(null); }}
                className={`inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors ${
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
            className="p-2 text-dim hover:text-[#0b1626] rounded-lg hover:bg-[#eef3fa]"
            aria-label="Закрыть CRM"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div key={openCount} className="p-5 lg:p-7">
          <ManagerGate>
          {tab === "dashboard" && <Dashboard onOpenLeads={() => setTab("leads")} />}
          {tab === "leads" && !selected && <LeadsList onOpen={(l) => setSelected(l)} />}
          {tab === "leads" && selected && <LeadDetail lead={selected} onBack={() => setSelected(null)} />}
          {tab === "deals" && <DealsBoard />}
          {tab === "managers" && <Managers />}
          </ManagerGate>
        </div>
      </div>
    </div>
  );
}
