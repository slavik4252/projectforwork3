import { createClient } from "@supabase/supabase-js";
export const REVIEW_TYPES = ["telegram_review", "review_accepted", "review_needs_info"];
export function reviewDb() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Для проверки лидов нужен серверный SUPABASE_SERVICE_ROLE_KEY");
  return createClient(import.meta.env.VITE_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function telegram(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Не настроен Telegram");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Не удалось выполнить действие Telegram");
  return result.result;
}
async function signature(id: string, type: string) {
  const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (!secret) throw new Error("Не настроен TELEGRAM_WEBHOOK_SECRET");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + ":" + type));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
}
export async function signedDecision(id: string, type: string, info: Record<string, unknown>) {
  return JSON.stringify({ ...info, signature: await signature(id,type) });
}
export async function verifiedDecision(row: { id: string; type: string; description: string }) {
  try {
    const data = JSON.parse(row.description);
    return data.signature === await signature(row.id, row.type);
  } catch { return false; }
}

export async function handleTelegramWebhook(request: Request) {
  const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (!secret || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) return new Response("Forbidden", {status:403});
  let update;
  try { update = await request.json(); } catch { return new Response("Bad request", {status:400}); }
  const query = update.callback_query;
  if (!query) return new Response("OK");
  const answer = (text: string) => telegram("answerCallbackQuery", {callback_query_id:query.id,text,show_alert:true});
  const chatId = process.env["TELEGRAM_REVIEW_CHAT_ID"];
  const reviewer = process.env["TELEGRAM_REVIEW_USER_ID"] || chatId;
  if (String(query.from?.id) !== reviewer || String(query.message?.chat?.id) !== chatId) {
    await answer("Проверять лиды может только назначенный проверяющий"); return new Response("OK");
  }
  const match = /^lr:(a|i):([0-9a-f-]{36})$/i.exec(query.data || "");
  if (!match) { await answer("Неизвестная команда"); return new Response("OK"); }
  try {
    const db = reviewDb();
    const item = await db.from("activities").select("*").eq("id",match[2]).single();
    if (item.error || !item.data) { await answer("Заявка на проверку не найдена"); return new Response("OK"); }
    const record = item.data;
    let metadata;
    try { metadata = JSON.parse(record.description); } catch { await answer("Отправьте лид на проверку заново"); return new Response("OK"); }
    if (metadata.messageId !== query.message.message_id || String(metadata.chatId) !== chatId) {
      await answer("Сообщение не относится к этой проверке"); return new Response("OK");
    }
    const latest = await db.from("activities").select("id").eq("lead_id",record.lead_id).in("type", REVIEW_TYPES).order("created_at",{ascending:false}).limit(1).single();
    if (latest.error) throw new Error("Read failed");
    if (latest.data?.id !== record.id || record.type !== "telegram_review") {
      await answer("Эта проверка уже завершена или отправлена новая версия"); return new Response("OK");
    }
    const type = match[1] === "a" ? "review_accepted" : "review_needs_info";
    const description = await signedDecision(record.id,type,{...metadata, reviewer, decidedAt:new Date().toISOString()});
    const saved = await db.from("activities").update({type,description}).eq("id",record.id).eq("type","telegram_review").select("id").maybeSingle();
    if (saved.error) throw new Error("Save failed");
    if (!saved.data) { await answer("Решение уже принято"); return new Response("OK"); }
    await answer(type === "review_accepted" ? "Лид принят и перенесён в проверенные" : "Лид возвращён: нужна дополнительная информация");
    await telegram("editMessageReplyMarkup", {chat_id:chatId,message_id:query.message.message_id,reply_markup:{inline_keyboard:[[{text:type === "review_accepted" ? "✅ Принят · открыть заявку" : "📝 Нужна информация · открыть заявку",url:`https://projectforwork3.vibetivyko.workers.dev/?crm=1&lead=${record.lead_id}`}]]}});
    return new Response("OK");
  } catch { return new Response("Temporary error", {status:500}); }
}
