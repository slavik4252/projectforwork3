import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Это рассылка или всё-таки диалог?",
    a: "Диалог. ИИ-агент пишет персонализированное первое сообщение, уточняет нишу и цели собеседника и квалифицирует его за 3 сообщения. Никакого спама «всем подряд».",
  },
  {
    q: "Где берём базу для обзвона и переписок?",
    a: "Из трёх источников: перехват лидов по вашей нише, парсинг аудитории в Telegram/Max, готовые базы под задачу. Если своя база есть — подключим её.",
  },
  {
    q: "Что падает в CRM?",
    a: "Заявка с именем, контактом, каналом, историей переписки и статусом квалификации. Менеджер видит её в канбан-доске и берёт в работу в один клик.",
  },
  {
    q: "Какой ИИ внутри?",
    a: "ИИ-агент работает на российских серверах, данные не уходят за пределы РФ.",
  },
  {
    q: "Сколько стоит тест?",
    a: "Тест — от 1500 контактов. Покажем, как сервис сработает именно в вашей нише, с отчётом и скриншотами переписок.",
  },
  {
    q: "Сколько времени на запуск?",
    a: "Тест запускаем за 1-2 дня после согласования сценария. Полноценный проект — в течение недели.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 bg-soft border-y border-c">
      <div className="max-w-3xl mx-auto px-5 lg:px-8">
        <div className="mb-14 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-[#2563eb] font-semibold">Вопросы</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-3">
            Частые вопросы
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="bg-panel border border-c rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
              >
                <span className="font-medium text-sm sm:text-base">{f.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-dim shrink-0 transition-transform ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ${
                  open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-dim text-sm leading-relaxed">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
