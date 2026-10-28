import { Bot, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function Navbar({ onCrmClick }: { onCrmClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#how", label: "Как это работает" },
    { href: "#channels", label: "Каналы" },
    { href: "#pricing", label: "Тарифы" },
    { href: "#faq", label: "Вопросы" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-xl border-b border-c" : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#0d9488]">
            <Bot className="w-5 h-5 text-white" strokeWidth={2.5} />
          </span>
          <span className="font-display font-bold text-lg tracking-tight lowercase">
            testrassilka
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-dim hover:text-[#0b1626] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onCrmClick}
            className="text-sm font-medium text-dim hover:text-[#0b1626] transition-colors"
          >
            CRM
          </button>
          <a
            href="#lead-form"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white hover:opacity-90 transition-opacity"
          >
            Оставить заявку
          </a>
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-white border-b border-c px-5 py-4 space-y-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-dim hover:text-[#0b1626]"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { onCrmClick(); setOpen(false); }}
              className="flex-1 text-center text-sm font-medium text-dim border border-c rounded-lg py-2"
            >
              CRM
            </button>
            <a
              href="#lead-form"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white"
            >
              Заявка
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
