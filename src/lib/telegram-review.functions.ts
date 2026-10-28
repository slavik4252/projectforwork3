import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export const sendLeadToTelegram = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; leadId: string; screenshots?: { name: string; base64: string }[] }) => {
    if (!data || typeof data.accessToken !== "string" || data.accessToken.length > 10000 ||
        typeof data.leadId !== "string" || !/^[0-9a-f-]{36}$/i.test(data.leadId)) {
      throw new Error("Некорректный запрос");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"];
    const chatId = process.env["TELEGRAM_REVIEW_CHAT_ID"];
    if (!botToken || !chatId || !/^-?\d+$/.test(chatId)) {
      throw new Error("Не настроены TELEGRAM_BOT_TOKEN и TELEGRAM_REVIEW_CHAT_ID");
    }
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const db = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const user = await db.auth.getUser(data.accessToken);
    if (user.error || !user.data.user) throw new Error("Войдите в CRM");
    const manager = await db.rpc("is_manager");
    if (manager.error || !manager.data) throw new Error("Нет доступа менеджера");
    const leadResult = await db.from("leads").select("id,name,contact,source,note").eq("id", data.leadId).single();
    if (leadResult.error || !leadResult.data) throw new Error("Лид не найден");
    const images = data.screenshots || [];
    if (!Array.isArray(images) || images.length > 3) throw new Error("Не больше 3 скриншотов");
    const prepared: { name: string; bytes: Uint8Array; mime: string }[] = [];
    let total = 0;
    for (const image of images) {
      if (!image || typeof image.base64 !== "string" || image.base64.length > 4200000 || typeof image.name !== "string") throw new Error("Некорректный скриншот");
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(image.base64), ch => ch.charCodeAt(0)); } catch { throw new Error("Не удалось прочитать скриншот"); }
      total += bytes.length;
      if (!bytes.length || bytes.length > 3 * 1024 * 1024 || total > 9 * 1024 * 1024) throw new Error("Максимум 3 МБ на скриншот");
      const sig = (offset: number, values: number[]) => values.every((v, i) => bytes[offset + i] === v);
      const mime = sig(0,[137,80,78,71,13,10,26,10]) ? "image/png" : sig(0,[255,216,255]) ? "image/jpeg" : sig(0,[82,73,70,70]) && sig(8,[87,69,66,80]) ? "image/webp" : "";
      if (!mime) throw new Error("Поддерживаются PNG, JPG и WebP");
      prepared.push({ bytes, mime, name: image.name.slice(0,100) });
    }
    const lead = leadResult.data;
    const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const field = (value: string | null | undefined, limit = 300) => escape((value?.trim() || "Не указано").slice(0, limit));
    const info = (lead.note || "").replace(/^(Интерес|Ниша):\s*/i, "").trim();
    const text = [
      "📥 <b>Новый лид на проверку</b>",
      "",
      `👤 <b>${field(lead.name, 200)}</b>`,
      `📌 <b>Канал:</b> ${field(lead.source, 60)}`,
      `📞 <b>Контакт:</b> <code>${field(lead.contact, 500)}</code>`,
      "",
      "💬 <b>О клиенте и его запросе</b>",
      field(info, 1400),
      "",
      "━━━━━━━━━━━━━━━━━━",
      `👨‍💼 <b>Передал:</b> ${field(user.data.user.email, 200)}`,
      "🕓 <i>Ожидает проверки</i>",
      "",
      "Проверьте потребность клиента и результат общения в CRM.",
    ].join("\n");
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📋 Открыть заявку", url: `https://projectforwork3.vibetivyko.workers.dev/?crm=1&lead=${encodeURIComponent(lead.id)}` }]] }, link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new Error("Нет подтверждения доставки Telegram. Перед повтором проверьте чат, чтобы не отправить дубль."); }
    if (!response.ok) throw new Error("Telegram отклонил отправку. Проверьте /start, токен и chat ID.");
    const result = await response.json();
    if (!result.ok) throw new Error("Telegram не подтвердил отправку");
    let attachmentsSent = 0;
    let attachmentError = false;
    for (const image of prepared) {
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set("document", new Blob([image.bytes as BlobPart], { type: image.mime }), image.name);
      form.set("caption", `Скриншот ${attachmentsSent + 1}/${prepared.length} • ${lead.name || "Лид"}`.slice(0,900));
      form.set("reply_parameters", JSON.stringify({ message_id: result.result.message_id }));
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
        if (!response.ok || !(await response.json()).ok) { attachmentError = true; break; }
        attachmentsSent++;
      } catch { attachmentError = true; break; }
    }
    const reviewEnabled = !!process.env["TELEGRAM_WEBHOOK_SECRET"];
    const logId = crypto.randomUUID();
    let description = `Лид отправлен в Telegram на проверку. Менеджер: ${user.data.user.email || user.data.user.id}`;
    const logged = await db.from("activities").insert({
      id:logId, lead_id: lead.id, type:"telegram_review", description,
    });
    let buttonsReady = false;
    if (reviewEnabled && !logged.error && !attachmentError) {
      try {
        const {telegram,registerReview} = await import("./telegram-review.server");
        await registerReview(logId,lead.id,{messageId:result.result.message_id,chatId});
        await telegram("editMessageReplyMarkup", {chat_id:chatId,message_id:result.result.message_id,reply_markup:{inline_keyboard:[
          [{text:"✅ Принять",callback_data:`lr:a:${logId}`},{text:"📝 Нужна информация",callback_data:`lr:i:${logId}`}],
          [{text:"📋 Открыть заявку",url:`https://projectforwork3.vibetivyko.workers.dev/?crm=1&lead=${lead.id}`}]
        ]}});
        buttonsReady = true;
      } catch { /* card and files were already delivered; report configuration issue */ }
    }
    return { sent: true, logged: !logged.error, attachmentsSent, attachmentError, buttonsReady };
  });
