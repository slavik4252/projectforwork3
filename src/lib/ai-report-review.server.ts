export type AiReportReview = { status:"passed"|"needs_info"|"manual_review"; reason:string; authenticity:"not_proven" };
export async function analyzeLeadReport(lead: {name:string;contact:string;source:string;note:string}, screenshots: {name:string;base64:string}[]): Promise<AiReportReview> {
  if (!screenshots.length) return {status:"needs_info",reason:"Прикрепите скриншоты, на которых видны контакт клиента и его ответ.",authenticity:"not_proven"};
  const url=process.env["GIGACHAT_GATEWAY_URL"];
  const token=process.env["GIGACHAT_GATEWAY_TOKEN"];
  const fallback: AiReportReview={status:"manual_review",reason:"Автопроверка ИИ недоступна. Отчёт требует ручной проверки; автоматического одобрения нет.",authenticity:"not_proven"};
  if(!url?.startsWith("https://")||!token) return fallback;
  try {
    const response=await fetch(new URL("/review",url),{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({lead,screenshots}),signal:AbortSignal.timeout(55000)});
    if(!response.ok) return fallback;
    const result=await response.json();
    if(!["passed","needs_info","manual_review"].includes(result.status)||typeof result.reason!=="string"||!result.reason.trim()||result.authenticity!=="not_proven") return fallback;
    return {status:result.status,reason:result.reason.slice(0,800),authenticity:"not_proven"};
  } catch {return fallback;}
}
