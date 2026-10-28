function parseDirectEmailLink(value: string) {
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

export async function parseManagerEmailLink(value: string) {
  const input = new URL(value.trim());
  if (input.origin !== "https://lnk.md.lovable-app.email") return parseDirectEmailLink(value);
  if (input.username || input.password || !/^\/c\/[A-Za-z0-9_-]{1,8192}$/.test(input.pathname)) {
    throw new Error("Неверная ссылка из письма");
  }
  const encoded = input.pathname.slice(3);
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 32768) throw new Error("Слишком длинная ссылка");
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  const decoded = new TextDecoder().decode(merged);
  let text = decoded;
  try { text += "\n" + decodeURIComponent(decoded); } catch { /* use literal payload */ }
  const candidates = text.match(/https:\/\/[^\s"'<>\\]+/g) || [];
  for (const candidate of candidates) {
    try { return parseDirectEmailLink(candidate); } catch { /* only accept validated auth URLs */ }
  }
  throw new Error("Не найдена ссылка подтверждения внутри письма. Запросите новое письмо");
}
