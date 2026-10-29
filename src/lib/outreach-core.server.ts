export type Statement = {
 bind(...values: unknown[]): Statement;
 first<T = Record<string, any>>(): Promise<T | null>;
 all<T = Record<string, any>>(): Promise<{results:T[]}>;
 run(): Promise<{meta:{changes:number}}>;
};
export type WorkspaceDb = {
 exec(sql:string):Promise<unknown>;
 prepare(sql:string):Statement;
 batch(statements:Statement[]):Promise<{results:Record<string,any>[];meta:{changes:number}}[]>;
};
export type Member = {project_id:string;user_id:string;role:string;suspended_at:number|null;suspension_reason:string|null};
export const CATEGORIES = ["application","question","later","declined","undetermined"] as const;
export const CATEGORY_LABELS: Record<string,string> = {application:"Заявка",question:"Вопрос",later:"Отложенный спрос",declined:"Отказ",undetermined:"Не определено"};
export const DEFAULT_TEMPLATES:Record<string,string> = {
 "1":"Здравствуйте, {name}! Я представляю {company}. Подскажите, актуально ли для вас привлечение новых клиентов?",
 "2":"Мы помогаем бизнесу обрабатывать обращения и получать заинтересованные заявки. Можно кратко рассказать, как это может работать в вашей нише?",
 "3":"Подскажите, удобно обсудить это сейчас или лучше вернуться к вопросу позже?",
 followup:"Здравствуйте, {name}! Возвращаюсь к нашему предложению. Подскажите, оно вам актуально? Если нет — больше не буду беспокоить.",
};
export function normalizePhone(value:string) {
 let digits=value.replace(/[^0-9]/g,"");
 if(digits.length===11&&digits.startsWith("8")) digits="7"+digits.slice(1);
 if(!/^[1-9][0-9]{9,14}$/.test(digits)) throw new Error("Нужен номер с кодом страны: +79991234567");
 return "+"+digits;
}
export function contactUrl(contact:{phone:string;channel:string}) {
 const digits=contact.phone.replace(/[^0-9]/g,"");
 return contact.channel==="whatsapp" ? "https://wa.me/"+digits : contact.channel==="telegram" ? "https://t.me/+"+digits : null;
}
export async function getMember(db:WorkspaceDb,projectId:string,email:string,roles?:string[],allowSuspended=false) {
 const member=await db.prepare("SELECT * FROM outreach_members WHERE project_id=? AND user_id=?").bind(projectId,email).first<Member>();
 if(!member || (roles&&!roles.includes(member.role))) throw new Error("Нет доступа к этому проекту");
 if(member.suspended_at&&!allowSuspended) throw new Error("Выдача контактов приостановлена: "+(member.suspension_reason||"нужна проверка модератора"));
 return member;
}
export async function inspectAgent(db:WorkspaceDb,projectId:string,email:string,now=Date.now()) {
 const settings=await db.prepare("SELECT * FROM outreach_settings WHERE project_id=?").bind(projectId).first();
 const cutoff=now-Number(settings?.['overdue_hours']||24)*3600000;
 const row=await db.prepare("SELECT COUNT(*) AS taken, SUM(CASE WHEN c.state='assigned' THEN 1 ELSE 0 END) AS overdue, SUM(CASE WHEN EXISTS(SELECT 1 FROM outreach_reports r WHERE r.contact_id=c.id) THEN 1 ELSE 0 END) AS reported FROM outreach_contacts c WHERE project_id=? AND assigned_to=? AND assigned_at<?")
  .bind(projectId,email,cutoff).first();
 const taken=Number(row?.['taken']||0),reported=Number(row?.['reported']||0),overdue=Number(row?.['overdue']||0);
 const minimum=Number(settings?.['anomaly_min_contacts']||10);
 const suspicious=taken>=minimum&&overdue>=minimum&&reported/taken<Number(settings?.['anomaly_min_ratio']??0.2);
 if(suspicious) {
  const reason="Много просроченных контактов без отчётов. Нужна ручная проверка.";
  await db.prepare("UPDATE outreach_members SET suspended_at=?,suspension_reason=? WHERE project_id=? AND user_id=? AND role='agent' AND suspended_at IS NULL")
   .bind(now,reason,projectId,email).run();
 }
 return {taken,reported,overdue,suspicious};
}
export async function claimContact(db:WorkspaceDb,projectId:string,id:string,email:string,now=Date.now()) {
 await getMember(db,projectId,email,["agent","owner","moderator"]);
 await inspectAgent(db,projectId,email,now);
 const row=await db.prepare("UPDATE outreach_contacts SET assigned_to=?,assigned_at=?,state='assigned' WHERE project_id=? AND id=? AND state='free' AND assigned_to IS NULL AND EXISTS(SELECT 1 FROM outreach_members m WHERE m.project_id=? AND m.user_id=? AND m.suspended_at IS NULL AND m.role IN ('agent','owner','moderator')) AND (SELECT COUNT(*) FROM outreach_contacts active WHERE active.project_id=? AND active.assigned_to=? AND active.state IN ('assigned','needs_info','submitted'))<COALESCE((SELECT claim_limit FROM outreach_settings WHERE project_id=?),20) RETURNING *")
  .bind(email,now,projectId,id,projectId,email,projectId,email,projectId).first();
 if(!row) throw new Error("Контакт уже занят, превышен лимит или выдача приостановлена. Обновите список.");
 await db.prepare("INSERT OR IGNORE INTO outreach_events(id,project_id,contact_id,agent_id,kind,created_at) VALUES(?,?,?,?,'claimed',?)")
  .bind("claim:"+id+":"+now,projectId,id,email,now).run();
 return row;
}
export async function lockReport(db:WorkspaceDb,projectId:string,contactId:string,email:string,reportId:string,summary:string,category:string,responded:boolean,now=Date.now()) {
 await getMember(db,projectId,email,["agent","owner","moderator"],true);
 if(!CATEGORIES.includes(category as any)) throw new Error("Неизвестная категория");
 const locked=await db.prepare("UPDATE outreach_contacts SET state='submitted' WHERE project_id=? AND id=? AND assigned_to=? AND state IN ('assigned','needs_info') RETURNING *").bind(projectId,contactId,email).first();
 if(!locked) throw new Error("Контакт не закреплён за вами или отчёт уже отправляется.");
 try {
  await db.batch([
   db.prepare("INSERT INTO outreach_reports(id,contact_id,agent_id,revision,category,summary,review_state,created_at) SELECT ?,?,?,COALESCE(MAX(revision),0)+1,?,?,'pending',? FROM outreach_reports WHERE contact_id=?")
    .bind(reportId,contactId,email,category,summary,now,contactId),
   db.prepare("INSERT INTO outreach_report_delivery(report_id,responded) VALUES(?,?)").bind(reportId,responded?1:0),
   db.prepare("INSERT INTO outreach_events(id,project_id,contact_id,agent_id,kind,channel,created_at) VALUES(?,?,?,?,'report_submitted',?,?)").bind("report:"+reportId,projectId,contactId,email,locked['channel'],now),
  ]);
 } catch(error) {
  await db.prepare("UPDATE outreach_contacts SET state='needs_info' WHERE id=? AND state='submitted'").bind(contactId).run();
  throw error;
 }
 return locked;
}
export async function decideReport(db:WorkspaceDb,reportId:string,decision:"accepted"|"needs_info"|"rejected",reason:string,reviewer:string,now=Date.now()) {
 const report=await db.prepare("SELECT r.*,c.project_id FROM outreach_reports r JOIN outreach_contacts c ON c.id=r.contact_id WHERE r.id=?").bind(reportId).first();
 if(!report) throw new Error("Отчёт не найден");
 const accepted=decision==="accepted";
 const nextState=accepted?"accepted":"needs_info";
 const settings=await db.prepare("SELECT crm_categories FROM outreach_settings WHERE project_id=?").bind(report['project_id']).first();
 let categories:string[]=["application"];
 try {categories=JSON.parse(settings?.['crm_categories']||'["application"]');} catch {}
 const statements=[
  db.prepare("UPDATE outreach_reports SET review_state=?,review_reason=?,decided_at=? WHERE id=? AND review_state IN ('pending','manual_review') AND revision=(SELECT MAX(revision) FROM outreach_reports WHERE contact_id=?) RETURNING id")
   .bind(decision,reason.slice(0,2000),now,reportId,report['contact_id']),
  db.prepare("UPDATE outreach_contacts SET state=? WHERE id=? AND state='submitted' AND EXISTS(SELECT 1 FROM outreach_reports WHERE id=? AND review_state=? AND decided_at=?)")
   .bind(nextState,report['contact_id'],reportId,decision,now),
  db.prepare("INSERT OR IGNORE INTO outreach_events(id,project_id,contact_id,agent_id,kind,created_at,detail) SELECT ?,?,?,?,'reviewed',?,? WHERE EXISTS(SELECT 1 FROM outreach_reports WHERE id=? AND review_state=? AND decided_at=?)")
   .bind("review:"+reportId,report['project_id'],report['contact_id'],report['agent_id'],now,JSON.stringify({decision,reviewer,reason}),reportId,decision,now),
 ];
 if(accepted) {
  statements.push(db.prepare("INSERT OR IGNORE INTO outreach_rewards(id,report_id,agent_id,amount_kopecks,state,created_at) SELECT ?,?,?,p.rate_kopecks,'earned',? FROM outreach_projects p JOIN outreach_contacts c ON c.project_id=p.id JOIN outreach_reports r ON r.contact_id=c.id WHERE r.id=? AND r.review_state='accepted'")
   .bind("reward:"+reportId,reportId,report['agent_id'],now,reportId));
  if(categories.includes(report['category'])) statements.push(db.prepare("INSERT OR IGNORE INTO outreach_crm(contact_id,report_id,project_id,stage,updated_at) SELECT ?,?,?,'new',? WHERE EXISTS(SELECT 1 FROM outreach_reports WHERE id=? AND review_state='accepted')")
   .bind(report['contact_id'],reportId,report['project_id'],now,reportId));
 }
 const result=await db.batch(statements);
 if(!result[0]?.results?.length) throw new Error("Отчёт уже проверен или загружена новая версия");
 return {decision};
}
