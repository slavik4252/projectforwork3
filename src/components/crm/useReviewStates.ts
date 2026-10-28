import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStates } from "@/lib/review-state.functions";
export function useReviewStates(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");
  const [states,setStates] = useState<Record<string,{status:string;label:string}>>({});
  const [error,setError] = useState("");
  useEffect(() => {
    let active=true;
    async function refresh() {
      try {
        const {data} = await supabase.auth.getSession();
        if (!data.session) return;
        const leadIds = key ? key.split(",") : [];
        let result: Record<string,{status:string;label:string}> = {};
        for (let i=0;i<leadIds.length;i+=500) Object.assign(result,await getReviewStates({data:{accessToken:data.session.access_token,leadIds:leadIds.slice(i,i+500)}}));
        if (active) {setStates(result);setError("");}
      } catch { if(active) setError("Не удалось обновить результаты проверки. Проверьте подключение D1 LEAD_REVIEWS."); }
    }
    void refresh();
    const timer=setInterval(()=>void refresh(),15000);
    const focused=()=>void refresh();
    window.addEventListener("focus",focused);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener("focus",focused);};
  },[key]);
  return {states,error};
}
