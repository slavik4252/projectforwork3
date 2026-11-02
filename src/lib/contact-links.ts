export interface ParsedContacts {
  /** Phone in international digits without "+", e.g. 79991234567 */
  phone: string;
  telegram: string;
  email: string;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const TG_LINK = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?!\+|joinchat)([a-zA-Z][a-zA-Z0-9_]{4,31})/i;
const TG_AT = /(?:^|[^\w@.])@([a-zA-Z][a-zA-Z0-9_]{4,31})\b/;
const TG_WORD = /(?:telegram|телеграм\w*|тг|tg)\s*[:\-–]?\s*@?([a-zA-Z][a-zA-Z0-9_]{4,31})\b/i;
const PHONE = /(?:\+|\b)\d[\d\s().\-–]{8,20}\d/g;

/** Normalizes a phone number; Russian/Kazakh 8XXXXXXXXXX and 10-digit 9XXXXXXXXX become 7XXXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("9")) digits = "7" + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

export function parseContacts(...sources: Array<string | null | undefined>): ParsedContacts {
  const result: ParsedContacts = { phone: "", telegram: "", email: "" };
  for (const source of sources) {
    let text = (source || "").trim();
    if (!text) continue;
    const email = text.match(EMAIL)?.[0];
    if (email && !result.email) result.email = email;
    text = text.replace(new RegExp(EMAIL.source, "g"), " ");
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
    email: c.email ? `mailto:${c.email}` : "",
  };
}
