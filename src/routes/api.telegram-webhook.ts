import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/telegram-webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleTelegramWebhook } = await import("@/lib/telegram-review.server");
    return handleTelegramWebhook(request);
  } } },
});
