export function parseManagerEmailLink(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Вставьте полную ссылку с кнопки в письме"); }
  const backend = "https://c--3c60d75e-0086-4943-80cb-981558f73401-prod.lovable.cloud";
  const isVerify = url.origin === backend && url.pathname === "/auth/v1/verify";
  const isCallback = url.origin === "https://projectforwork.lovable.app" && url.pathname === "/auth/confirm";
  if (url.protocol !== "https:" || url.username || url.password || (!isVerify && !isCallback)) {
    throw new Error("Нужна исходная ссылка подтверждения из письма этого сервиса");
  }
  const tokenHash = url.searchParams.get("token_hash") || (isVerify ? url.searchParams.get("token") : null);
  const type = url.searchParams.get("type");
  if (!tokenHash || !/^[a-zA-Z0-9_-]{20,512}$/.test(tokenHash) ||
      (type !== "email" && type !== "magiclink" && type !== "signup")) {
    throw new Error("В ссылке нет подходящего токена входа. Запросите новое письмо");
  }
  return { token_hash: tokenHash, type };
}
