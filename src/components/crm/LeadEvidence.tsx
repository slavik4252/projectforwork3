import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listEvidence, readEvidence, uploadEvidence } from "@/lib/lead-evidence.functions";

export default function LeadEvidence({ leadId }: { leadId: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  async function credentials() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Войдите в CRM");
    return { accessToken: data.session.access_token, leadId };
  }
  const load = useCallback(async () => {
    const version = ++generation.current;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Войдите в CRM");
      const result = await listEvidence({ data: { accessToken: data.session.access_token, leadId } });
      if (version === generation.current) setFiles(result);
    } catch (e) { if (version === generation.current) setMessage(e instanceof Error ? e.message : "Не удалось загрузить скриншоты"); }
  }, [leadId]);
  useEffect(() => { setFiles([]); setPreview(""); setMessage(""); void load(); return () => { ++generation.current; }; }, [load]);

  async function upload(incoming: File[]) {
    if (locked.current || !incoming.length) return;
    locked.current = true; setBusy(true); setMessage("");
    let count = 0;
    try {
      if (incoming.length > 10) throw new Error("Выберите не больше 10 скриншотов за раз");
      const auth = await credentials();
      for (const file of incoming) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Можно прикрепить PNG, JPG или WebP");
        if (file.size > 5 * 1024 * 1024 || !file.size) throw new Error("Размер одного файла должен быть от 1 байта до 5 МБ");
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
          reader.readAsDataURL(file);
        });
        await uploadEvidence({ data: { ...auth, name: file.name || "screenshot.png", base64: encoded } });
        count++;
      }
      setMessage(`Сохранено скриншотов: ${count}`);
    } catch (e) {
      setMessage(`${count ? `Сохранено: ${count}. ` : ""}${e instanceof Error ? e.message : "Загрузка не подтверждена. Обновите список перед повтором."}`);
    } finally { await load(); setBusy(false); locked.current = false; }
  }
  async function view(key: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    try { const result = await readEvidence({ data: { ...await credentials(), key } }); setPreview(result.url); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Не удалось открыть файл"); }
    finally { locked.current = false; setBusy(false); }
  }
  return (
    <section className="bg-panel border border-c rounded-2xl p-5 space-y-4">
      <h3 className="font-display font-bold">Скриншоты переписки</h3>
      <div tabIndex={0} role="group" aria-label="Вставка скриншотов переписки"
        onPaste={event => {
          const images = Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => !!file);
          if (images.length) { event.preventDefault(); void upload(images); }
        }}
        className="border-2 border-dashed border-[#93b4ed] rounded-xl bg-[#2563eb]/5 p-6 text-center space-y-3 focus:outline-none focus:ring-2 focus:ring-[#2563eb]">
        <p className="text-sm font-medium">Нажмите внутри рамки и вставьте скриншот через Ctrl+V</p>
        <p className="text-xs text-dim">Или выберите изображения с компьютера. PNG, JPG, WebP — до 5 МБ каждый.</p>
        <input ref={picker} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple
          onChange={event => { void upload(Array.from(event.target.files || [])); event.target.value = ""; }} />
        <button type="button" disabled={busy} onClick={() => picker.current?.click()}
          className="bg-[#2563eb] text-white rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? "Подождите…" : "Выбрать скриншоты"}
        </button>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <ul className="space-y-2">
        {files.map(file => <li key={file.key} className="flex items-center justify-between gap-3 border border-c rounded-lg p-3 text-sm">
          <span className="break-all">{file.name.replace(/^[0-9a-f-]{36}-/i, "")}</span>
          <button type="button" disabled={busy} onClick={() => void view(file.key)} className="text-[#2563eb] underline cursor-pointer disabled:opacity-50">Просмотреть</button>
        </li>)}
      </ul>
      {preview && <div className="border border-c rounded-xl p-3 space-y-2">
        <button type="button" onClick={() => setPreview("")} className="text-sm text-[#2563eb] cursor-pointer underline">Закрыть просмотр</button>
        <img src={preview} alt="Скриншот переписки по заявке" className="max-w-full max-h-[700px] object-contain mx-auto" />
      </div>}
    </section>
  );
}
