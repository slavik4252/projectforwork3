import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/** Re-runs `reload` whenever leads/deals change in the database. */
export function useLeadsLive(reload: () => void) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const channel = supabase
      .channel(`crm-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => ref.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => ref.current())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
