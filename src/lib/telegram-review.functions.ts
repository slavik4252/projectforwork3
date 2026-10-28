import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export const sendLeadToTelegram = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; leadId: string }) => {
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
    const lead = leadResult.data;
    const text = [
      "Лид на проверку",
      `Имя: ${lead.name || "Не указано"}`,
      `Связь: ${lead.contact || "Не указана"}`,
      `Канал: ${lead.source || "Не указан"}`,
      `Ниша и информация: ${lead.note || "Не указана"}`,
      `Менеджер: ${user.data.user.email || user.data.user.id}`,
      `ID лида: ${lead.id}`,
    ].join("\n").slice(0, 4000);
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new Error("Нет подтверждения доставки Telegram. Перед повтором проверьте чат, чтобы не отправить дубль."); }
    if (!response.ok) throw new Error("Telegram отклонил отправку. Проверьте /start, токен и chat ID.");
    const result = await response.json();
    if (!result.ok) throw new Error("Telegram не подтвердил отправку");
    const logged = await db.from("activities").insert({
      lead_id: lead.id, type: "telegram_review",
      description: `Лид отправлен в Telegram на проверку. Менеджер: ${user.data.user.email || user.data.user.id}`,
    });
    return { sent: true, logged: !logged.error };
  });
