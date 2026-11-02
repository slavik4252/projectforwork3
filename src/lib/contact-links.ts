export interface ParsedContacts {
  /** Phone in international digits without "+", e.g. 79991234567 */
  phone: string;
  telegram: string;
  email: string;
  /** VK screen name or id12345 taken from a vk.com / vk.me link */
  vk: string;
}

export type EmailKind = "work" | "personal";
const PERSONAL_DOMAINS = new Set([
  "gmail.com","googlemail.com","mail.ru","bk.ru","list.ru","inbox.ru","internet.ru","yandex.ru","ya.ru","yandex.com",
  "yandex.by","yandex.kz","rambler.ru","icloud.com","me.com","outlook.com","hotmail.com","live.com","yahoo.com",
  "proton.me","protonmail.com","vk.com","tut.by","ukr.net","aol.com","gmx.com",
]);
export function emailKind(email: string): EmailKind {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return PERSONAL_DOMAINS.has(domain) ? "personal" : "work";
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const TG_LINK = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?!\+|joinchat)([a-zA-Z][a-zA-Z0-9_]{4,31})/i;
const TG_AT = /(?:^|[^\w@.])@([a-zA-Z][a-zA-Z0-9_]{4,31})\b/;
const TG_WORD = /(?:telegram|телеграм\w*|тг|tg)\s*[:\-–]?\s*@?([a-zA-Z][a-zA-Z0-9_]{4,31})\b/i;
const VK_LINK = /(?:https?:\/\/)?(?:m\.)?(?:vk\.com|vk\.ru|vk\.me)\/([a-zA-Z0-9_.]{2,64})/i;
const VK_SKIP = /^(search|im|feed|share\.php|away\.php|login|join|wall.*|club\d+|public\d+)$/i;
const PHONE = /(?:\+|\b)\d[\d\s().\-–]{8,20}\d/g;

/** Normalizes a phone number; Russian/Kazakh 8XXXXXXXXXX and 10-digit 9XXXXXXXXX become 7XXXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("9")) digits = "7" + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

export function parseContacts(...sources: Array<string | null | undefined>): ParsedContacts {
  const result: ParsedContacts = { phone: "", telegram: "", email: "", vk: "" };
  for (const source of sources) {
    let text = (source || "").trim();
    if (!text) continue;
    const email = text.match(EMAIL)?.[0];
    if (email && !result.email) result.email = email;
    text = text.replace(new RegExp(EMAIL.source, "g"), " ");
    if (!result.vk) {
      const vk = text.match(VK_LINK)?.[1]?.replace(/\.$/, "");
      if (vk && !VK_SKIP.test(vk)) result.vk = vk;
    }
    text = text.replace(new RegExp(VK_LINK.source, "gi"), " ");
    const wa = text.match(/wa\.me\/(\d{10,15})/i)?.[1];
    if (!result.phone && wa) result.phone = normalizePhone(wa);
    if (!result.telegram) {
      const tg = text.match(TG_LINK)?.[1] || text.match(TG_AT)?.[1] || text.match(TG_WORD)?.[1];
      if (tg) result.telegram = tg;
    }
    if (!result.phone) {
      for (const candidate of text.replace(/https?:\/\/\S+/g, " ").match(PHONE) || []) {
        const phone = normalizePhone(candidate);
        if (phone) { result.phone = phone; break; }
      }
    }
  }
  return result;
}

export function contactLinks(c: ParsedContacts) {
  return {
    telegram: c.telegram ? `https://t.me/${c.telegram}` : c.phone ? `https://t.me/+${c.phone}` : "",
    whatsapp: c.phone ? `https://wa.me/${c.phone}` : "",
    max: c.phone ? "https://web.max.ru/" : "",
    // VK has no public "chat by phone" link: open the chat directly when a profile link is known,
    // otherwise open people search with the number (finds only users who allow search by phone).
    vk: c.vk ? `https://vk.me/${c.vk}` : c.phone ? `https://vk.com/search/people?q=${encodeURIComponent("+" + c.phone)}` : "",
    email: c.email ? `mailto:${c.email}` : "",
  };
}

export interface EmailDraft { to: string; subject: string; body: string }
export function emailDraft(email: string, name: string, message: string): EmailDraft {
  const kind = emailKind(email);
  const clean = name.trim() && !/^из чата/i.test(name.trim()) ? name.trim() : "";
  const subject = kind === "work"
    ? "testrassilka — тестовый запуск лидогенерации для вашей компании"
    : "Ваша заявка на сайте testrassilka";
  const greeting = kind === "work"
    ? `Здравствуйте${clean ? ", " + clean : ""}!\n\nВы оставили заявку на сайте testrassilka.`
    : `Здравствуйте${clean ? ", " + clean : ""}!\n\nСпасибо за заявку на сайте testrassilka.`;
  const text = message.trim().replace(/^Здравствуйте[^!\n]*!\s*/i, "");
  const body = `${greeting}\n\n${text}\n\nС уважением,\nменеджер testrassilka`;
  return { to: email, subject, body };
}

export function emailComposeLinks(d: EmailDraft) {
  const q = (v: string) => encodeURIComponent(v);
  return {
    mailto: `mailto:${d.to}?subject=${q(d.subject)}&body=${q(d.body)}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${q(d.to)}&su=${q(d.subject)}&body=${q(d.body)}`,
    yandex: `https://mail.yandex.ru/compose?to=${q(d.to)}&subject=${q(d.subject)}&body=${q(d.body)}`,
  };
}
