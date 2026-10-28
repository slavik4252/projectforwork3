import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Channels from "@/components/Channels";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import CrmPanel from "@/components/crm/CrmPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "testrassilka — ИИ-лидогенерация под ключ" },
      {
        name: "description",
        content:
          "ИИ-агент пишет клиентам в Telegram, WhatsApp и Max, квалифицирует и передаёт тёплые заявки прямо в вашу CRM.",
      },
      { property: "og:title", content: "testrassilka — ИИ-лидогенерация под ключ" },
      { property: "og:description", content: "ИИ-агент пишет, квалифицирует и передаёт тёплые заявки в CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [crmOpen, setCrmOpen] = useState(false);
  return (
    <div className="min-h-screen bg-page text-[#0b1626]">
      <Navbar onCrmClick={() => setCrmOpen(true)} />
      <main>
        <Hero />
        <HowItWorks />
        <Channels />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
      <ChatWidget />
      <CrmPanel open={crmOpen} onClose={() => setCrmOpen(false)} />
    </div>
  );
}
