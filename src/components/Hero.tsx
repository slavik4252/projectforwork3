import LeadForm from "./LeadForm";
import { MessageSquareText, ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section id="top" className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden">
      {/* glow backdrop */}
      <div className="absolute inset-0 grid-bg opacity-70" />
      <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#2563eb]/15 blur-[120px]" />
      <div className="absolute -top-20 right-0 w-[460px] h-[460px] rounded-full bg-[#0d9488]/15 blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div className="fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2563eb]/10 border border-[#2563eb]/25 text-xs text-[#2563eb] mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            ИИ-агент квалифицирует заявки за вас
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.08] font-extrabold tracking-tight">
            Лидогенерация под ключ: ИИ-агент пишет клиентам, квалифицирует и
            передаёт <span className="bg-gradient-to-r from-[#2563eb] to-[#0d9488] bg-clip-text text-transparent">тёплые заявки</span> в вашу CRM
          </h1>

          <p className="text-dim text-lg mt-6 max-w-xl leading-relaxed">
            Обрабатываем контакты в Telegram, WhatsApp и Max.
            Каждый ответ — со скрипшотом и сделкой в CRM.
            Не рассылка — диалог из трёх сообщений, который ведёт ИИ.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <a
              href="#lead-form"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white font-semibold px-6 py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              Запустить тест
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 border border-c text-[#0b1626] font-medium px-6 py-3.5 rounded-xl text-sm hover:bg-[#eef3fa] transition-colors"
            >
              Как это работает
            </a>
          </div>

          <div className="flex items-center gap-6 mt-10 text-xs text-dim">
            <div className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-[#2563eb]" />
              3 канала связи
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0d9488] pulse-dot" />
              Работаем каждый день
            </div>
          </div>
        </div>

        <div className="fade-up" style={{ animationDelay: "0.1s" }}>
          <LeadForm />
        </div>
      </div>
    </section>
  );
}
