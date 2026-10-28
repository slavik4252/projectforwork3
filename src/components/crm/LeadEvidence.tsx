import { useEffect, useRef, useState } from "react";

export default function LeadEvidence({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  function add(incoming: File[]) {
    if (disabled) return;
    setError("");
    if (files.length + incoming.length > 3) { setError("Можно выбрать до 3 скриншотов"); return; }
    if (incoming.some(file => !["image/png","image/jpeg","image/webp"].includes(file.type) || !file.size || file.size > 3*1024*1024)) {
      setError("Нужны PNG, JPG или WebP до 3 МБ каждый"); return;
    }
    onChange([...files, ...incoming]);
  }
  return <section className="bg-panel border border-c rounded-2xl p-4 sm:p-5 space-y-4">
    <h3 className="font-display font-bold">Скриншоты переписки</h3>
    <div tabIndex={0} role="group" aria-label="Вставить скриншоты переписки"
      onPaste={event => {
        const incoming = Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => !!file);
        if (incoming.length) { event.preventDefault(); add(incoming); }
      }} className="rounded-xl border-2 border-dashed border-[#93b4ed] bg-[#2563eb]/5 p-4 sm:p-6 text-center space-y-3 focus:outline-none focus:ring-2 focus:ring-[#2563eb]">
      <p className="text-sm">Нажмите в рамку и вставьте Ctrl+V или выберите изображения</p>
      <p className="text-xs text-dim">До 3 файлов по 3 МБ. Они уйдут в Telegram вместе с заявкой. На сайте не сохраняются; при закрытии карточки выбор пропадёт.</p>
      <input ref={picker} hidden type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={event => { add(Array.from(event.target.files || [])); event.target.value = ""; }} />
      <button type="button" disabled={disabled} onClick={() => picker.current?.click()} className="min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-white cursor-pointer disabled:opacity-50">Выбрать скриншоты</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {files.map((file,index) => <div key={index} className="min-w-0 border border-c rounded-xl p-2 space-y-2">
        <img src={previews[index]} alt={`Скриншот ${index+1}`} className="h-36 w-full object-contain" />
        <p className="text-xs break-all">{file.name}</p>
        <button type="button" disabled={disabled} onClick={() => onChange(files.filter((_,i) => i !== index))} className="min-h-11 text-red-600 text-sm cursor-pointer disabled:opacity-50">Убрать</button>
      </div>)}
    </div>
  </section>;
}
