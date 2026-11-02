import { useState } from "react";
import type { Lead } from "@/lib/supabase";
import { parseContacts, contactLinks } from "@/lib/contact-links";

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
  const parsed=parseContacts(lead.contact,lead.note,lead.name);
  const links=contactLinks(parsed);
  const phoneDisplay=parsed.phone ? "+"+parsed.phone : "";
  async function copy(text:string, done="Текст скопирован. Вставьте его в переписку и отправьте вручную.") {
    setBusy(true);setMessage("");
    try { await navigator.clipboard.writeText(text);setMessage(done); }
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
        {links.telegram&&<a href={links.telegram} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">Telegram</a>}
        {links.whatsapp&&<a href={links.whatsapp+"?text="+encodeURIComponent(texts[active]||"")} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">WhatsApp</a>}
        {links.max&&<button type="button" disabled={busy} onClick={()=>{void copy(phoneDisplay,"Номер "+phoneDisplay+" скопирован. В MAX: Контакты → «+» → «Найти по номеру» и вставьте его.");window.open(links.max,"_blank","noopener,noreferrer");}} className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">MAX</button>}
        {links.email&&<a href={links.email+"?body="+encodeURIComponent(texts[active]||"")} className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">Создать письмо</a>}
      </div>
      {(phoneDisplay||parsed.telegram)&&<p className="text-xs text-dim">Найдено: {[phoneDisplay,parsed.telegram&&"@"+parsed.telegram].filter(Boolean).join(" · ")}</p>}
      {!links.telegram&&!links.whatsapp&&!links.email&&<p className="text-sm text-[#e11d48]">В заявке не найден телефон, Telegram или email.</p>}
      <p className="text-xs text-dim">Наличие аккаунтов и частота использования ещё не проверены. Эти кнопки открывают канал для ручной проверки, а не подтверждают регистрацию человека. У MAX нет ссылки на чат по номеру, поэтому номер копируется и открывается веб-версия MAX.</p>
    </div>
  </section>;
}
