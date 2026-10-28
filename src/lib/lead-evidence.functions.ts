import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type Input = { accessToken: string; leadId: string };
type Bucket = {
  put(key: string, data: Uint8Array, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<unknown>;
  list(options: { prefix: string; limit: number }): Promise<{ objects: { key: string; customMetadata?: Record<string, string> }[] }>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
};
async function authorize(data: Input) {
  if (!data || typeof data.accessToken !== "string" || data.accessToken.length > 10000 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.leadId)) throw new Error("Некорректный запрос");
  const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await db.auth.getUser(data.accessToken);
  if (user.error || !user.data.user) throw new Error("Войдите в CRM");
  const manager = await db.rpc("is_manager");
  if (manager.error || !manager.data) throw new Error("Нет доступа менеджера");
  const lead = await db.from("leads").select("id").eq("id", data.leadId).single();
  if (lead.error || !lead.data) throw new Error("Нет доступа к заявке");
  // Cloudflare runtime binding is resolved only inside the server handler.
  // @ts-ignore Cloudflare supplies this module in the Worker runtime.
  const { env } = await import("cloudflare:workers");
  const bucket = env.LEAD_EVIDENCE as Bucket | undefined;
  if (!bucket) throw new Error("Подключите закрытый R2 bucket с binding LEAD_EVIDENCE");
  return { bucket, db, userId: user.data.user.id };
}
export const listEvidence = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => data)
  .handler(async ({ data }) => {
    const { bucket } = await authorize(data);
    const result = await bucket.list({ prefix: `leads/${data.leadId}/`, limit: 100 });
    return result.objects.map(item => ({ key: item.key, name: item.key.split("/").pop() || "Скриншот" }));
  });

export const uploadEvidence = createServerFn({ method: "POST" })
  .inputValidator((data: Input & { name: string; base64: string }) => data)
  .handler(async ({ data }) => {
    const { bucket, db, userId } = await authorize(data);
    if (typeof data.base64 !== "string" || data.base64.length > 7000000 || typeof data.name !== "string") throw new Error("Файл слишком большой");
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0)); }
    catch { throw new Error("Не удалось прочитать файл"); }
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new Error("Максимальный размер — 5 МБ");
    const matches = (offset: number, values: number[]) => values.every((v, i) => bytes[offset + i] === v);
    const mime = matches(0, [137,80,78,71,13,10,26,10]) ? "image/png" :
      matches(0, [255,216,255]) ? "image/jpeg" :
      matches(0, [82,73,70,70]) && matches(8, [87,69,66,80]) ? "image/webp" : "";
    if (!mime) throw new Error("Поддерживаются PNG, JPG и WebP");
    const name = data.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, "_").slice(-100) || "screenshot";
    const key = `leads/${data.leadId}/${crypto.randomUUID()}-${name}`;
    await bucket.put(key, bytes, { httpMetadata: { contentType: mime }, customMetadata: { uploadedBy: userId } });
    const log = await db.from("activities").insert({ lead_id: data.leadId, type: "evidence", description: `Добавлен скриншот: ${name}` });
    return { key, logged: !log.error };
  });

export const readEvidence = createServerFn({ method: "POST" })
  .inputValidator((data: Input & { key: string }) => data)
  .handler(async ({ data }) => {
    const { bucket } = await authorize(data);
    if (typeof data.key !== "string" || !data.key.startsWith(`leads/${data.leadId}/`) || data.key.includes("..")) throw new Error("Нет доступа к файлу");
    const file = await bucket.get(data.key);
    if (!file) throw new Error("Скриншот не найден");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Файл слишком большой");
    const mime = file.httpMetadata?.contentType;
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime || "")) throw new Error("Неподдерживаемый файл");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { url: `data:${mime};base64,${btoa(binary)}` };
  });
