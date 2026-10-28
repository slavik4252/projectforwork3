import { createServerFn } from "@tanstack/react-start";

const SYSTEM_PROMPT = `Ты — ИИ-агент лидогенерационного агентства «testrassilka». Твоя задача — общаться с посетителями сайта, квалифицировать их как потенциальных клиентов и собирать контакты для передачи тёплой заявки в CRM.

Стиль общения:
- Дружелюбный, деловой, на «вы», на русском языке.
- Короткие сообщения (2-4 предложения), без воды.
- Задавай уточняющие вопросы по одному, не кучей.

Сценарий квалификации:
1. Приветствие и вопрос о бизнесе посетителя (ниша, чем занимается).
2. Узнай, какие каналы сейчас использует (Telegram, WhatsApp, холодные звонки, email).
3. Узнай главную цель (больше заявок, дешевле лид, выход на новый рынок).
4. Узнай объём — сколько контактов в месяц хотел бы обрабатывать.
5. Предложи тестовый запуск в его нише (от 1500 контактов).
6. Попроси оставить контакт (телефон, email или Telegram) — «передам менеджеру, он свяжется и покажет, как сервис сработает в вашей нише».

После получения контакта поблагодари. Не утверждай, что заявка сохранена или менеджер уведомлён: у тебя нет подтверждения. Тариф Тест: от 1500 контактов, один канал, ИИ-квалификация, отчёт со скриншотами, передача в CRM. Стандарт: от 15000 контактов/месяц, до 3 каналов, ИИ и автоквалификация, ежедневные отчёты, сделки в CRM, поддержка в Telegram. Объём: от 50000 контактов/месяц, все каналы, приоритет, выделенный менеджер, кастомный сценарий, API CRM. Это объёмы контактов, не цены и не гарантированное число лидов. Стоимость уточняет менеджер. Не запрашивай пароли и платёжные реквизиты.

Никогда не обещай точных цифр результатов, не называй цену до согласования с менеджером, не упоминай конкурентов. Если вопрос вне темы — мягко возвращай к сути.`;

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export const askAgent = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMsg[] }) => {
    const messages = (Array.isArray(data?.messages) ? data.messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-30)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    return { messages };
  })
  .handler(async ({ data }) => {
    const gateway = process.env["GIGACHAT_GATEWAY_URL"];
    if (gateway) {
      const gatewayToken = process.env["GIGACHAT_GATEWAY_TOKEN"];
      if (!gatewayToken || !gateway.startsWith("https://")) throw new Error("Не настроен защищённый сервер GigaChat");
      const response = await fetch(new URL("/chat", gateway), {
        method:"POST",headers:{Authorization:`Bearer ${gatewayToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({instructions:SYSTEM_PROMPT,messages:data.messages}),signal:AbortSignal.timeout(55000),
      });
      if (!response.ok) throw new Error("GigaChat временно недоступен. Оставьте контакт в форме заявки.");
      const result = await response.json();
      if (typeof result.content !== "string" || !result.content.trim()) throw new Error("Пустой ответ GigaChat");
      return {content:result.content};
    }
    const key = process.env["GIGACHAT_CREDENTIALS"]?.trim();
    if (!key) throw new Error("Не настроен серверный ключ GigaChat");
    const auth = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      headers: { Authorization: `Basic ${key.replace(/^Basic\s+/i, "")}`, RqUID: crypto.randomUUID(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ scope: process.env["GIGACHAT_SCOPE"] || "GIGACHAT_API_PERS" }),
      signal: AbortSignal.timeout(20000),
    });
    if (auth.status === 526) throw new Error("GigaChat требует доверенный сертификат: подключите сервер GIGACHAT_GATEWAY_URL.");
    if (!auth.ok) throw new Error(`Ошибка авторизации GigaChat (${auth.status})`);
    const token = await auth.json();
    if (typeof token.access_token !== "string") throw new Error("Не получен токен GigaChat");
    const res = await fetch("https://api.giga.chat/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env["GIGACHAT_MODEL"] || "GigaChat", messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages], temperature: 0.3, max_tokens: 600, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429) throw new Error("Слишком много запросов, попробуйте через минуту");
    if (!res.ok) throw new Error(`Ошибка GigaChat (${res.status})`);
    const result = await res.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Пустой ответ от ИИ-агента");
    return { content };
  });
