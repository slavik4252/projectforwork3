import { useState } from "react";
import type { Lead } from "@/lib/supabase";

const DEFAULTS = [
  {title:"1 · Первое сообщение",text:"Здравствуйте, {name}! Я представляю testrassilka. Подскажите, актуально ли для вашего бизнеса привлечение новых клиентов?"},
  {title:"2 · Предложение",text:"Мы помогаем обрабатывать обращения и передавать заинтересованных клиентов менеджерам. Можно кратко рассказать, как это может работать в вашей нише?"},
  {title:"3 · Напоминание",text:"Здравствуйте, {name}! Возвращаюсь к нашему предложению. Подскажите, оно вам актуально? Если нет — больше не буду беспокоить."},
];

export default function LeadScripts({lead}: {lead:Lead}) {
  const [active,setActive]=useState(0);
  const [texts,setTexts]=useState(()=>DEFAULTS.map(item=>item.text.replaceAll("{name}",lead.name?.trim()||"")));
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const contact=lead.contact?.trim()||"";
  const username=/^@[a-zA-Z0-9_]{5,32}$/.test(contact) ? contact.slice(1) : "";
  const digits=contact.replace(/[^0-9]/g,"");
  const isPhone=/^\+?[\d\s()-]+$/.test(contact)&&digits.length>=10&&digits.length<=15;
  const isEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const tg=username ? "https://t.me/"+username : isPhone ? "https://t.me/+"+digits : "";
  const wa=isPhone ? "https://wa.me/"+digits : "";
  async function copy(text:string) {
    setBusy(true);setMessage("");
    try { await navigator.clipboard.writeText(text);setMessage("Текст скопирован. Вставьте его в переписку и отправьте вручную."); }
    catch {setMessage("Буфер обмена недоступен. Выделите текст в поле и скопируйте вручную.");}
    finally {setBusy(false);}
  }
  return <section className="bg-panel border border-c rounded-2xl p-4 sm:p-5 space-y-4">
    <h3 className="font-display font-bold">Сообщения агенту</h3>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {DEFAULTS.map((item,index)=><button key={item.title} type="button" aria-pressed={active===index} onClick={()=>{setActive(index);setMessage("");}}
        className={`min-h-11 shrink-0 rounded-lg px-3 text-sm cursor-pointer ${active===index?"bg-[#2563eb] text-white":"border border-c bg-page"}`}>{item.title}</button>)}
    </div>
    <label className="block text-sm">
      Текст можно изменить перед отправкой
      <textarea aria-label="Шаблон сообщения" value={texts[active]||""} rows={5} maxLength={4000}
        onChange={event=>setTexts(previous=>previous.map((text,index)=>index===active?event.target.value:text))}
        className="mt-2 block w-full min-w-0 bg-page border border-c rounded-xl p-3 text-base sm:text-sm" />
    </label>
    <button type="button" disabled={busy||!texts[active]?.trim()} onClick={()=>void copy(texts[active]||"")}
      className="min-h-11 bg-[#2563eb] text-white rounded-lg px-4 cursor-pointer disabled:opacity-50">Скопировать сообщение №{active+1}</button>
    {message&&<p role="status" className="text-sm">{message}</p>}
    <p className="text-xs text-dim">Предложение — после ответа клиента. Напоминание — только если оно уместно и клиент не отказался. Копирование не означает отправку сообщения.</p>
    <div className="border-t border-c pt-4 space-y-3">
      <h4 className="text-sm font-semibold">Открыть канал связи</h4>
      <div className="flex flex-wrap gap-2">
        {tg&&<a href={tg} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm">Telegram</a>}
        {wa&&<a href={wa} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm">WhatsApp</a>}
        {isEmail&&<a href={`mailto:${encodeURIComponent(contact)}?body=${encodeURIComponent(texts[active]||"")}`} className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm">Создать письмо</a>}
        {isPhone&&<button type="button" disabled={busy} onClick={()=>void copy(contact)} className="min-h-11 border border-c rounded-lg px-3 text-sm cursor-pointer">Скопировать номер для поиска в MAX</button>}
      </div>
      <p className="text-xs text-dim">Наличие аккаунтов и частота использования ещё не проверены. Эти кнопки открывают канал для ручной проверки, а не подтверждают регистрацию человека.</p>
    </div>
  </section>;
}
