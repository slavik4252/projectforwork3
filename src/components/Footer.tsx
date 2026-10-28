import { Bot } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative py-12 border-t border-c">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#0d9488]">
            <Bot className="w-4 h-4 text-white" strokeWidth={2.5} />
          </span>
          <span className="font-display font-bold tracking-tight lowercase">testrassilka</span>
        </div>
        <p className="text-xs text-[#94a3b8] text-center">
          Аутрич-лидогенерация с ИИ-агентом. © {new Date().getFullYear()}
        </p>
        <div className="flex gap-5 text-xs text-dim">
          <a href="#" className="hover:text-[#0b1626] transition-colors">Политика</a>
          <a href="#" className="hover:text-[#0b1626] transition-colors">Согласие</a>
        </div>
      </div>
    </footer>
  );
}
