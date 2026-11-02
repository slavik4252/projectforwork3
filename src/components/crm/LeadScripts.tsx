import { useState } from "react";
import type { Lead } from "@/lib/supabase";
import { parseContacts, contactLinks, emailDraft, emailComposeLinks, emailKind } from "@/lib/contact-links";

const DEFAULTS = [
  {title:"1 · Первое сообщение",text:"Здравствуйте, {name}! Я представляю testrassilka. Подскажите, актуально ли для вашего бизнеса привлечение новых клиентов?"},
  {title:"2 · Предложение",text:"Мы помогаем обрабатывать обращения и передавать заинтересованных клиентов менеджерам. Можно кратко рассказать, как это может работать в вашей нише?"},
  {title:"3 · Напоминание",text:"Здравствуйте, {name}! Возвращаюсь к нашему предложению. Подскажите, оно вам актуально? Если нет — больше не буду беспокоить."},
];

export default function LeadScripts({lead, canContact = true, onTake}: {lead:Lead; canContact?: boolean; onTake?: (() => void) | undefined}) {
  const [active,setActive]=useState(0);
  const [texts,setTexts]=useState(()=>DEFAULTS.map(item=>item.text.replaceAll("{name}",lead.name?.trim()||"")));
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const parsed=parseContacts(lead.contact,lead.note,lead.name);
  const links=contactLinks(parsed);
  const phoneDisplay=parsed.phone ? "+"+parsed.phone : "";
  const draft=parsed.email ? emailDraft(parsed.email, lead.name||"", texts[active]||"") : null;
  const mail=draft ? emailComposeLinks(draft) : null;
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
      {!canContact ? (
        <div className="space-y-2">
          <p className="text-sm text-dim">Кнопки связи доступны менеджеру, который взял заявку. Так с одним клиентом не свяжутся несколько менеджеров.</p>
          {onTake&&<button type="button" onClick={onTake} className="min-h-11 bg-[#0d9488] text-white rounded-lg px-4 text-sm cursor-pointer hover:opacity-90">Взять заявку</button>}
        </div>
      ) : <>
      <div className="flex flex-wrap gap-2">
        {links.telegram&&<a href={links.telegram} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">Telegram</a>}
        {links.whatsapp&&<a href={links.whatsapp+"?text="+encodeURIComponent(texts[active]||"")} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">WhatsApp</a>}
        {links.max&&<button type="button" disabled={busy} onClick={()=>{void copy(phoneDisplay,"Номер "+phoneDisplay+" скопирован. В MAX: Контакты → «+» → «Найти по номеру» и вставьте его.");window.open(links.max,"_blank","noopener,noreferrer");}} className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">MAX</button>}
        {links.vk&&<button type="button" disabled={busy} onClick={()=>{if(parsed.vk){void copy(texts[active]||"","Текст сообщения скопирован — вставьте его в открывшийся чат ВКонтакте.");}else{void copy(phoneDisplay,"Номер "+phoneDisplay+" скопирован. ВКонтакте находит человека по номеру, только если он это разрешил. Если поиск пуст — в приложении VK: Друзья → «Добавить» → «Контакты» с этим номером в телефонной книге.");}window.open(links.vk,"_blank","noopener,noreferrer");}} className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">ВКонтакте</button>}
      </div>
      {draft&&mail&&<div className="space-y-2 rounded-xl border border-c bg-page p-3">
        <p className="text-sm font-medium">Письмо на {draft.to} · {emailKind(draft.to)==="work"?"рабочая почта":"личная почта"}</p>
        <p className="text-xs text-dim break-words">Тема: {draft.subject}</p>
        <div className="flex flex-wrap gap-2">
          <a href={mail.mailto} className="min-h-11 inline-flex items-center bg-[#2563eb] text-white rounded-lg px-3 text-sm">Написать письмо</a>
          <a href={mail.gmail} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">Gmail</a>
          <a href={mail.yandex} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">Яндекс Почта</a>
          <button type="button" disabled={busy} onClick={()=>void copy("Тема: "+draft.subject+"\n\n"+draft.body,"Письмо скопировано.")} className="min-h-11 inline-flex items-center border border-c rounded-lg px-3 text-sm cursor-pointer hover:bg-[#eef3fa]">Скопировать письмо</button>
        </div>
        <p className="text-xs text-dim">Откроется окно нового письма с адресом, темой и выбранным сообщением №{active+1}. Проверьте текст и нажмите «Отправить».</p>
      </div>}
      {(phoneDisplay||parsed.telegram||parsed.vk)&&<p className="text-xs text-dim">Найдено: {[phoneDisplay,parsed.telegram&&"@"+parsed.telegram,parsed.vk&&"vk.com/"+parsed.vk].filter(Boolean).join(" · ")}</p>}
      {!links.telegram&&!links.whatsapp&&!links.email&&!links.vk&&<p className="text-sm text-[#e11d48]">В заявке не найден телефон, Telegram, ВКонтакте или email.</p>}
      </>}
      <p className="text-xs text-dim">Наличие аккаунтов и частота использования ещё не проверены. Эти кнопки открывают канал для ручной проверки, а не подтверждают регистрацию человека. У MAX и ВКонтакте нет ссылки на чат по номеру, поэтому номер копируется и открывается MAX или поиск ВКонтакте.</p>
    </div>
  </section>;
}
