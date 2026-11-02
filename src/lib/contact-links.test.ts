import { describe, it, expect } from "vitest";
import { parseContacts, contactLinks, emailKind, emailDraft, emailComposeLinks } from "./contact-links";

describe("parseContacts", () => {
  it.each([
    ["+7 (999) 123-45-67", "79991234567"],
    ["89991234567", "79991234567"],
    ["8 999 123 45 67", "79991234567"],
    ["9991234567", "79991234567"],
    ["Иван, мой номер +7-999-123-45-67, звоните после 18", "79991234567"],
    ["пишите в ватсап wa.me/79991234567", "79991234567"],
    ["+375 29 123-45-67", "375291234567"],
  ])("phone in %s", (input, phone) => expect(parseContacts(input).phone).toBe(phone));

  it("telegram variants", () => {
    expect(parseContacts("@ivan_petrov").telegram).toBe("ivan_petrov");
    expect(parseContacts("https://t.me/ivan_petrov").telegram).toBe("ivan_petrov");
    expect(parseContacts("тг: ivan_petrov").telegram).toBe("ivan_petrov");
  });

  it("does not treat email as telegram", () => {
    const c = parseContacts("ivan.petrov@mail.ru");
    expect(c).toEqual({ phone: "", telegram: "", email: "ivan.petrov@mail.ru", vk: "" });
  });

  it("mixed contact plus note fallback", () => {
    const c = parseContacts("Иван", "тел. 8 (912) 000-11-22, tg @ivan_shop");
    expect(c.phone).toBe("79120001122");
    expect(c.telegram).toBe("ivan_shop");
    expect(contactLinks(c).whatsapp).toBe("https://wa.me/79120001122");
    expect(contactLinks(c).telegram).toBe("https://t.me/ivan_shop");
  });

  it("phone-only gives telegram by phone", () => {
    expect(contactLinks(parseContacts("89991234567")).telegram).toBe("https://t.me/+79991234567");
  });

  it("vk links and phone fallback", () => {
    expect(contactLinks(parseContacts("vk.com/ivan_petrov")).vk).toBe("https://vk.me/ivan_petrov");
    expect(contactLinks(parseContacts("https://vk.com/id12345, +7 999 123-45-67")).vk).toBe("https://vk.me/id12345");
    expect(contactLinks(parseContacts("89991234567")).vk).toBe("https://vk.com/search/people?q=%2B79991234567");
    expect(parseContacts("vk.com/ivan_petrov").telegram).toBe("");
  });

  it("email kind and draft", () => {
    expect(emailKind("ivan@gmail.com")).toBe("personal");
    expect(emailKind("ivan@romashka-shop.ru")).toBe("work");
    const d = emailDraft("ivan@romashka-shop.ru", "Иван", "Здравствуйте, Иван! Подскажите, актуально ли?");
    expect(d.subject).toContain("компании");
    expect(d.body.startsWith("Здравствуйте, Иван!")).toBe(true);
    expect(d.body.match(/Здравствуйте/g)?.length).toBe(1);
    expect(emailComposeLinks(d).mailto.startsWith("mailto:ivan@romashka-shop.ru?subject=")).toBe(true);
  });
});
