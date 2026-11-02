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
  return Object.assign(db, { currentUser: user.data.user });
}
async function claimsDatabase() {
  const { reviewDb } = await import("./telegram-review.server");
  const { ensureClaimsTable } = await import("./lead-claims.core");
  const database = await reviewDb();
  await ensureClaimsTable(database);
  return database;
}
const leadIdValid = (id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
export const getReviewStates = createServerFn({method:"POST"})
  .inputValidator((data: {accessToken:string; leadIds:string[]}) => data)
  .handler(async ({data}) => {
    const db = await manager(data.accessToken);
    if (!Array.isArray(data.leadIds) || data.leadIds.length > 1000) throw new Error("Слишком много заявок");
    const states: Record<string,{status:string;label:string;reason?:string}> = {};
    if (!data.leadIds.length) return states;
    const { reviewDb } = await import("./telegram-review.server");
    const reviewDatabase = await reviewDb();
    for (let i=0;i<data.leadIds.length;i+=100) {
      const ids = data.leadIds.slice(i,i+100);
      const visible = await db.from("leads").select("id").in("id",ids);
      if (visible.error) throw new Error("Нет доступа к заявкам");
      const permitted = (visible.data || []).map(row => row.id);
      if (!permitted.length) continue;
      const result = await reviewDatabase.prepare(`SELECT lead_id,type,description FROM lead_reviews WHERE lead_id IN (${permitted.map(()=>"?").join(",")}) ORDER BY created_at DESC,id DESC`).bind(...permitted).all();
      for (const row of result.results) {
        if (states[row.lead_id]?.status === "accepted") continue;
        if (states[row.lead_id] && row.type !== "review_accepted") continue;
        const status = row.type === "review_accepted" ? "accepted" : row.type === "review_needs_info" ? "needs_info" : "pending";
        let reason="";
        try {const metadata=JSON.parse(row.description);reason=typeof metadata.aiReview?.reason==="string" ? metadata.aiReview.reason.slice(0,800) : "";} catch {}
        states[row.lead_id] = {status,reason,label:status === "accepted" ? "Выполнен · проверен" : status === "needs_info" ? "Нужна дополнительная информация" : "На проверке"};
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
    await reviewDb();
    await telegram("setWebhook", {url:"https://projectforwork3.vibetivyko.workers.dev/api/telegram-webhook",secret_token:secret,allowed_updates:["callback_query"],max_connections:1});
    return {ok:true};
  });

export const getLeadClaims = createServerFn({method:"POST"})
  .inputValidator((data: {accessToken:string; leadIds:string[]}) => data)
  .handler(async ({data}) => {
    await manager(data.accessToken);
    if (!Array.isArray(data.leadIds) || data.leadIds.length > 1000 || !data.leadIds.every(leadIdValid)) throw new Error("Некорректный список заявок");
    const { listClaimsCore } = await import("./lead-claims.core");
    return listClaimsCore(await claimsDatabase(), data.leadIds);
  });

export const claimLead = createServerFn({method:"POST"})
  .inputValidator((data: {accessToken:string; leadId:string}) => { if (!leadIdValid(data?.leadId)) throw new Error("Некорректная заявка"); return data; })
  .handler(async ({data}) => {
    const db = await manager(data.accessToken);
    const visible = await db.from("leads").select("id").eq("id", data.leadId).maybeSingle();
    if (visible.error || !visible.data) throw new Error("Заявка не найдена");
    const { claimLeadCore } = await import("./lead-claims.core");
    const user = db.currentUser;
    return claimLeadCore(await claimsDatabase(), data.leadId, user.id, user.email || user.id);
  });

export const releaseLead = createServerFn({method:"POST"})
  .inputValidator((data: {accessToken:string; leadId:string}) => { if (!leadIdValid(data?.leadId)) throw new Error("Некорректная заявка"); return data; })
  .handler(async ({data}) => {
    const db = await manager(data.accessToken);
    const { releaseLeadCore } = await import("./lead-claims.core");
    await releaseLeadCore(await claimsDatabase(), data.leadId, db.currentUser.id);
    return { ok: true };
  });
