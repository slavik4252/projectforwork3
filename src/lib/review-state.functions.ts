import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
async function manager(accessToken: string) {
  if (typeof accessToken !== "string" || accessToken.length > 10000) throw new Error("Войдите в CRM");
  const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    global:{headers:{Authorization:`Bearer ${accessToken}`}},auth:{persistSession:false,autoRefreshToken:false},
  });
  const user = await db.auth.getUser(accessToken);
  const role = await db.rpc("is_manager");
  if (user.error || !user.data.user || role.error || !role.data) throw new Error("Нет доступа менеджера");
  return db;
}
export const getReviewStates = createServerFn({method:"POST"})
  .inputValidator((data: {accessToken:string; leadIds:string[]}) => data)
  .handler(async ({data}) => {
    const db = await manager(data.accessToken);
    if (!Array.isArray(data.leadIds) || data.leadIds.length > 1000) throw new Error("Слишком много заявок");
    const states: Record<string,{status:string;label:string}> = {};
    if (!data.leadIds.length || !process.env["TELEGRAM_WEBHOOK_SECRET"]) return states;
    const { REVIEW_TYPES, verifiedDecision } = await import("./telegram-review.server");
    for (let i=0;i<data.leadIds.length;i+=100) {
      const result = await db.from("activities").select("id,lead_id,type,description").in("lead_id",data.leadIds.slice(i,i+100)).in("type",REVIEW_TYPES).order("created_at",{ascending:false});
      if (result.error) throw new Error("Не удалось загрузить результаты проверки");
      for (const row of result.data || []) {
        if (!row.lead_id || states[row.lead_id]?.status === "accepted") continue;
        if (!await verifiedDecision(row)) continue;
        if (states[row.lead_id] && row.type !== "review_accepted") continue;
        const status = row.type === "review_accepted" ? "accepted" : row.type === "review_needs_info" ? "needs_info" : "pending";
        states[row.lead_id] = {status,label:status === "accepted" ? "Выполнен · проверен" : status === "needs_info" ? "Нужна дополнительная информация" : "На проверке"};
      }
    }
    return states;
  });

export const configureTelegramReview = createServerFn({method:"POST"})
  .inputValidator((data:{accessToken:string}) => data)
  .handler(async ({data}) => {
    await manager(data.accessToken);
    const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
    if (!secret || !/^[a-zA-Z0-9_-]{16,256}$/.test(secret)) throw new Error("Добавьте TELEGRAM_WEBHOOK_SECRET: случайную строку 16–256 символов A–Z, 0–9, _ и -");
    const {reviewDb,telegram} = await import("./telegram-review.server");
    reviewDb();
    await telegram("setWebhook", {url:"https://projectforwork3.vibetivyko.workers.dev/api/telegram-webhook",secret_token:secret,allowed_updates:["callback_query"],max_connections:1});
    return {ok:true};
  });
