import { Search, MessageSquareText, ClipboardCheck, FolderInput } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Собираем базу",
    text: "Нет своей базы? Соберём из трёх источников: перехват лидов, парсинг по нише, готовые аудитории под вашу задачу.",
  },
  {
    icon: MessageSquareText,
    title: "ИИ-агент пишет",
    text: "ИИ-агент ведёт диалог из трёх сообщений — не рассылку. Адаптирует тон под канал и квалифицирует собеседника.",
  },
  {
    icon: ClipboardCheck,
    title: "Квалифицирует",
    text: "Агент узнаёт нишу, цели, объём и собирает контакт. Тёплый лид — готов к передаче.",
  },
  {
    icon: FolderInput,
    title: "Падает в CRM",
    text: "Заявка автоматически создаётся в CRM со всей перепиской. Менеджер берёт её в работу в один клик.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-24">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl mb-14">
          <span className="text-xs uppercase tracking-[0.2em] text-[#2563eb] font-semibold">Этапы работы</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-3 leading-tight">
            Аутрич — это не рассылка.<br /> Это диалог, который ведёт ИИ
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative bg-panel border border-c rounded-2xl p-6 hover:border-[#2563eb]/40 hover:shadow-lg hover:shadow-[#2563eb]/5 transition-all group"
            >
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-lg bg-[#eef3fa] border border-c grid place-items-center text-xs font-bold text-dim">
                {i + 1}
              </div>
              <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563eb]/15 to-[#0d9488]/15 text-[#2563eb] mb-4 group-hover:scale-105 transition-transform">
                <s.icon className="w-5 h-5" />
              </span>
              <h3 className="font-display font-bold text-base mb-2">{s.title}</h3>
              <p className="text-dim text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
