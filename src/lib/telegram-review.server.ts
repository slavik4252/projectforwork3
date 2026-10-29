export const REVIEW_TYPES = ["telegram_review", "review_accepted", "review_needs_info"];
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, any>>(): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<{results: T[]}>;
  run(): Promise<{meta:{changes:number}}>;
};
type ReviewDatabase = { exec(sql:string): Promise<unknown>; prepare(sql:string):Statement };
export async function reviewDb() {
  // @ts-ignore Provided by Cloudflare Workers at runtime.
  const {env} = await import("cloudflare:workers");
  const db = env.LEAD_REVIEWS as ReviewDatabase | undefined;
  if (!db) throw new Error("Подключите D1 binding LEAD_REVIEWS");
  await db.exec("CREATE TABLE IF NOT EXISTS lead_reviews (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS lead_reviews_lead ON lead_reviews(lead_id, created_at)");
  return db;
}
export async function registerReview(id:string, leadId:string, metadata:Record<string,unknown>) {
  const db = await reviewDb();
  const accepted = await db.prepare("SELECT id FROM lead_reviews WHERE lead_id=? AND type='review_accepted' LIMIT 1").bind(leadId).first();
  if (accepted) throw new Error("Этот лид уже принят");
  const ai=metadata.aiReview as {status?:string}|undefined;
  const type=ai?.status==="passed" ? "review_accepted" : ai?.status==="needs_info" ? "review_needs_info" : "telegram_review";
  await db.prepare("INSERT INTO lead_reviews(id,lead_id,type,description,created_at) VALUES(?,?,?,?,?)").bind(id,leadId,type,JSON.stringify(metadata),Date.now()).run();
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
    const db = await reviewDb();
    const item = await db.prepare("SELECT * FROM lead_reviews WHERE id=?").bind(match[2]).first();
    if (!item) { await answer("Заявка на проверку не найдена"); return new Response("OK"); }
    const record = item;
    let metadata;
    try { metadata = JSON.parse(record.description); } catch { await answer("Отправьте лид на проверку заново"); return new Response("OK"); }
    if (metadata.messageId !== query.message.message_id || String(metadata.chatId) !== chatId) {
      await answer("Сообщение не относится к этой проверке"); return new Response("OK");
    }
    const latest = await db.prepare("SELECT id FROM lead_reviews WHERE lead_id=? ORDER BY created_at DESC, id DESC LIMIT 1").bind(record.lead_id).first();
    if (latest?.id !== record.id || record.type !== "telegram_review") {
      await answer("Эта проверка уже завершена или отправлена новая версия"); return new Response("OK");
    }
    const type = match[1] === "a" ? "review_accepted" : "review_needs_info";
    const description = JSON.stringify({...metadata,reviewer,decidedAt:new Date().toISOString()});
    const saved = await db.prepare("UPDATE lead_reviews SET type=?,description=? WHERE id=? AND type='telegram_review' AND id=(SELECT id FROM lead_reviews WHERE lead_id=? ORDER BY created_at DESC,id DESC LIMIT 1)")
      .bind(type,description,record.id,record.lead_id).run();
    if (!saved.meta.changes) { await answer("Решение уже принято"); return new Response("OK"); }
    await answer(type === "review_accepted" ? "Лид принят и перенесён в проверенные" : "Лид возвращён: нужна дополнительная информация");
    await telegram("editMessageReplyMarkup", {chat_id:chatId,message_id:query.message.message_id,reply_markup:{inline_keyboard:[[{text:type === "review_accepted" ? "✅ Принят · открыть заявку" : "📝 Нужна информация · открыть заявку",url:`https://projectforwork3.vibetivyko.workers.dev/?crm=1&lead=${record.lead_id}`}]]}});
    return new Response("OK");
  } catch { return new Response("Temporary error", {status:500}); }
}
