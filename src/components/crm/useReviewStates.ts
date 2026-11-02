import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStates, getLeadClaims } from "@/lib/review-state.functions";
import type { LeadClaim } from "@/lib/lead-claims.core";
type ReviewState = { status: string; label: string; reason?: string };
export function useReviewStates(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");
  const [states, setStates] = useState<Record<string, ReviewState>>({});
  const [claims, setClaims] = useState<Record<string, LeadClaim>>({});
  const [me, setMe] = useState("");
  const [error, setError] = useState("");
  const active = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      if (active.current) setMe(data.session.user.id);
      const leadIds = key ? key.split(",") : [];
      const result: Record<string, ReviewState> = {};
      const owned: Record<string, LeadClaim> = {};
      for (let i = 0; i < leadIds.length; i += 500) {
        const chunk = leadIds.slice(i, i + 500);
        const [s, c] = await Promise.all([
          getReviewStates({ data: { accessToken: data.session.access_token, leadIds: chunk } }),
          getLeadClaims({ data: { accessToken: data.session.access_token, leadIds: chunk } }),
        ]);
        Object.assign(result, s); Object.assign(owned, c);
      }
      if (active.current) { setStates(result); setClaims(owned); setError(""); }
    } catch { if (active.current) setError("Не удалось обновить результаты проверки и закрепления. Проверьте подключение D1 LEAD_REVIEWS."); }
  }, [key]);
  useEffect(() => {
    active.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    const focused = () => void refresh();
    window.addEventListener("focus", focused);
    return () => { active.current = false; clearInterval(timer); window.removeEventListener("focus", focused); };
  }, [refresh]);
  return { states, claims, me, error, refresh };
}
