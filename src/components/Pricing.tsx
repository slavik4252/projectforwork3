import { Check, ArrowRight } from "lucide-react";

const tiers = [
  {
    name: "Тест",
    subtitle: "Покажем, как сработает в вашей нише",
    price: "от 1 500",
    unit: "контактов",
    features: [
      "Один канал на выбор",
      "ИИ-агент квалифицирует лиды",
      "Отчёт со скриншотами",
      "Передача лидов в CRM",
    ],
    cta: "Запустить тест",
    highlight: false,
  },
  {
    name: "Стандарт",
    subtitle: "Стабильный поток лидов каждый день",
    price: "от 15 000",
    unit: "контактов / мес",
    features: [
      "До 3 каналов",
      "ИИ-агент + автоквалификация",
      "Ежедневный отчёт и статистика",
      "Сделки в CRM автоматически",
      "Поддержка в Telegram",
    ],
    cta: "Оставить заявку",
    highlight: true,
  },
  {
    name: "Объём",
    subtitle: "Чем больше объём — тем ниже цена",
    price: "от 50 000",
    unit: "контактов / мес",
    features: [
      "Все каналы",
      "Приоритетная очередь",
      "Выделенный менеджер",
      "Кастомный сценарий диалога",
      "API-интеграция с вашей CRM",
    ],
    cta: "Обсудить объём",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-24">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl mb-14">
          <span className="text-xs uppercase tracking-[0.2em] text-[#2563eb] font-semibold">Тарифы</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-3 leading-tight">
            Чем больше объём — тем ниже цена
          </h2>
          <p className="text-dim mt-3">
            Приоритет — стабильным долгосрочным проектам: на них держится команда и ежедневная работа.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl p-7 border ${
                t.highlight
                  ? "bg-gradient-to-b from-[#2563eb]/8 to-white border-[#2563eb]/40 glow-ring"
                  : "bg-panel border-c"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white">
                  Популярный
                </span>
              )}
              <h3 className="font-display font-bold text-lg">{t.name}</h3>
              <p className="text-dim text-sm mt-1 mb-5">{t.subtitle}</p>
              <div className="flex items-baseline gap-1.5 mb-6">
                <span className="font-display text-3xl font-extrabold">{t.price}</span>
                <span className="text-dim text-sm">{t.unit}</span>
              </div>
              <ul className="space-y-2.5 mb-7">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-[#0d9488] mt-0.5 shrink-0" />
                    <span className="text-dim">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#lead-form"
                className={`inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition ${
                  t.highlight
                    ? "bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white hover:opacity-90"
                    : "border border-c text-[#0b1626] hover:bg-[#eef3fa]"
                }`}
              >
                {t.cta}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
