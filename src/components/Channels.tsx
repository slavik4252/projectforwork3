import { Send, Mail, MessageCircle } from "lucide-react";

const channels = [
  {
    icon: Send,
    name: "Telegram",
    desc: "Холодные outreach в личные сообщения и по комментариям. ИИ-агент ведёт диалог и квалифицирует лид.",
    color: "#2563eb",
  },
  {
    icon: MessageCircle,
    name: "WhatsApp",
    desc: "Обработка входящих и исходящих. Голосовые и текст. Переписка сохраняется в CRM.",
    color: "#0d9488",
  },
  {
    icon: MessageCircle,
    name: "Max",
    desc: "Новый российский мессенджер. Ранний вход — дешёвые лиды в свежей нише.",
    color: "#f59e0b",
  },
  {
    icon: Mail,
    name: "Email",
    desc: "Письма под конкретного получателя, ответы автоматические квалифицируются.",
    color: "#6366f1",
  },
];

export default function Channels() {
  return (
    <section id="channels" className="relative py-24 bg-soft border-y border-c">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl mb-14">
          <span className="text-xs uppercase tracking-[0.2em] text-[#2563eb] font-semibold">Каналы</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-3 leading-tight">
Обработаем контакты в 3 каналах<br /> и передадим заявки в CRM
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((c) => (
            <div
              key={c.name}
              className="bg-panel border border-c rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#2563eb]/5 transition-all"
            >
              <span
                className="inline-grid place-items-center w-12 h-12 rounded-xl mb-4"
                style={{ background: `${c.color}1a`, color: c.color }}
              >
                <c.icon className="w-6 h-6" />
              </span>
              <h3 className="font-display font-bold text-lg mb-2">{c.name}</h3>
              <p className="text-dim text-sm leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
