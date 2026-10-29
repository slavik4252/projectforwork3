import { createServerFn } from '@tanstack/react-start';
import type {WorkspaceDb} from './outreach-core.server';
import { createClient } from '@supabase/supabase-js';

export const workspaceAction = createServerFn({method:'POST'}).inputValidator((v:{accessToken:string;action:string;projectId?:string;payload?:any})=>v).handler(async({data})=>{
 const {reviewDb,telegram}=await import('./telegram-review.server');
 const core=await import('./outreach-core.server');
 const db=await reviewDb() as WorkspaceDb;
 const client=createClient(import.meta.env['VITE_SUPABASE_URL'],import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],{global:{headers:{Authorization:`Bearer ${data.accessToken}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await client.auth.getUser(data.accessToken);
 const email=auth.data.user?.email?.toLowerCase();
 if(auth.error||!email) throw new Error('Войдите в аккаунт');
 const schema1=(await import('../../d1-migrations/0001_outreach_workspace.sql?raw')).default;
 const schema2=(await import('../../d1-migrations/0002_outreach_operations.sql?raw')).default;
 // Prepared statements avoid D1 exec's line-oriented SQL parser and preserve atomic schema setup.
 const statements=(schema1+'\n'+schema2).replace(/^\s*--.*$/gm,'').split(';').map(s=>s.trim()).filter(s=>s&&!s.startsWith('PRAGMA'));
 await db.batch(statements.map(s=>db.prepare(s)));
 const p=data.payload||{}, pid=data.projectId||'',now=Date.now(),id=()=>crypto.randomUUID();
 if(data.action==='bootstrap'){
  const projects=await db.prepare('SELECT p.*,m.role FROM outreach_projects p JOIN outreach_members m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.created_at').bind(email).all();
  const manager=await client.rpc('is_manager');
  return {email,projects:projects.results,canCreate:!manager.error&&manager.data===true};
 }
 if(data.action==='create'){
  const manager=await client.rpc('is_manager');
  if(manager.error||manager.data!==true) throw new Error('Создавать проекты может действующий менеджер CRM');
  const name=String(p.name||'').trim().slice(0,100);if(!name)throw new Error('Укажите название');
  const projectId=id();
  await db.batch([
   db.prepare('INSERT INTO outreach_projects(id,name,owner_id,created_at) VALUES(?,?,?,?)').bind(projectId,name,email,now),
   db.prepare("INSERT INTO outreach_members(project_id,user_id,role) VALUES(?,?,'owner')").bind(projectId,email),
   db.prepare('INSERT INTO outreach_settings(project_id) VALUES(?)').bind(projectId),
   ...Object.entries(core.DEFAULT_TEMPLATES).map(([step,content])=>db.prepare('INSERT INTO outreach_templates(project_id,step,content) VALUES(?,?,?)').bind(projectId,step,content))]);
  return {projectId};
 }
 const member=await core.getMember(db,pid,email,undefined,true);
 const admin=['owner','moderator'].includes(member.role);
 const requireAdmin=()=>{if(!admin)throw new Error('Нужны права владельца или модератора');};
 if(data.action==='view'){
  const contacts=await db.prepare(`SELECT c.*,r.review_state,r.review_reason,r.summary,r.id AS report_id FROM outreach_contacts c LEFT JOIN outreach_reports r ON r.contact_id=c.id AND r.revision=(SELECT MAX(revision) FROM outreach_reports WHERE contact_id=c.id) WHERE c.project_id=? AND ${admin?'1=1':member.role==='client'?"c.state='accepted'":"(c.state='free' OR c.assigned_to=?)"} ORDER BY c.created_at DESC LIMIT 500`).bind(...(admin||member.role==='client'?[pid]:[pid,email])).all();
  const members=admin?await db.prepare("SELECT m.*, (SELECT COUNT(*) FROM outreach_contacts c WHERE c.project_id=m.project_id AND c.assigned_to=m.user_id) AS taken,(SELECT COUNT(*) FROM outreach_reports r JOIN outreach_contacts c ON c.id=r.contact_id WHERE c.project_id=m.project_id AND r.agent_id=m.user_id) AS reports FROM outreach_members m WHERE project_id=?").bind(pid).all():{results:[]};
  const templates=await db.prepare('SELECT step,content FROM outreach_templates WHERE project_id=?').bind(pid).all();
  const rewards=await db.prepare(`SELECT COALESCE(SUM(amount_kopecks),0) AS total FROM outreach_rewards r JOIN outreach_reports t ON t.id=r.report_id JOIN outreach_contacts c ON c.id=t.contact_id WHERE c.project_id=? ${admin?'':'AND r.agent_id=?'}`).bind(...(admin?[pid]:[pid,email])).first();
  return {member,contacts:contacts.results,members:members.results,templates:templates.results,rewards:rewards?.['total']||0};
 }
 if(data.action==='invite'){
  if(member.role!=='owner')throw new Error('Добавлять участников может владелец');
  const target=String(p.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)||!['agent','moderator','client','owner'].includes(p.role))throw new Error('Проверьте почту и роль');
  if(target===email)throw new Error('Свою роль здесь менять нельзя');
  const current=await db.prepare('SELECT role FROM outreach_members WHERE project_id=? AND user_id=?').bind(pid,target).first();
  if(current?.['role']==='owner'&&p.role!=='owner')throw new Error('Владельца нельзя понизить через приглашение');
  await db.prepare('INSERT INTO outreach_members(project_id,user_id,role) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role').bind(pid,target,p.role).run();return {ok:true};
 }
 if(data.action==='import'){
  requireAdmin();const rows=String(p.text||'').split(/\r?\n/).filter(Boolean);if(!rows.length||rows.length>500)throw new Error('Добавляйте от 1 до 500 строк');
  const parsed=rows.map((row:string)=>{const [phone='',name='',channel='unknown']=row.split(';').map(s=>s.trim());if(!['unknown','telegram','whatsapp','max','phone'].includes(channel))throw new Error('Неизвестный канал: '+channel);return {phone:core.normalizePhone(phone),name:name.slice(0,100),channel};});
  const result=await db.batch(parsed.map(r=>db.prepare("INSERT OR IGNORE INTO outreach_contacts(id,project_id,phone,name,channel,created_at) VALUES(?,?,?,?,?,?)").bind(id(),pid,r.phone,r.name,r.channel,now)));
  return {added:result.reduce((n,r)=>n+(r.meta?.changes||0),0)};
 }
 if(data.action==='claim')return core.claimContact(db,pid,String(p.id),email);
 if(data.action==='template'){
  requireAdmin();if(!['1','2','3','followup'].includes(p.step)||typeof p.content!=='string'||p.content.length>4000)throw new Error('Проверьте шаблон');
  await db.prepare('UPDATE outreach_templates SET content=? WHERE project_id=? AND step=?').bind(p.content,pid,p.step).run();return {ok:true};
 }
 if(data.action==='rate'){
  if(member.role!=='owner')throw new Error('Ставку устанавливает владелец');
  const rate=Number(p.rubles);if(!Number.isFinite(rate)||rate<0||rate>100000)throw new Error('Проверьте ставку');
  await db.prepare('UPDATE outreach_projects SET rate_kopecks=? WHERE id=?').bind(Math.round(rate*100),pid).run();return {ok:true};
 }
 if(data.action==='suspend'){
  requireAdmin();const target=await core.getMember(db,pid,String(p.email),undefined,true);
  if(target.role!=='agent')throw new Error('Ограничивать можно только агентов');
  await db.prepare('UPDATE outreach_members SET suspended_at=?,suspension_reason=? WHERE project_id=? AND user_id=?').bind(p.suspended?now:null,p.suspended?'Ручная проверка модератором':null,pid,p.email).run();return {ok:true};
 }
 if(data.action==='decide'){
  requireAdmin();if(!['accepted','needs_info','rejected'].includes(p.decision))throw new Error('Неизвестное решение');
  const report=await db.prepare('SELECT r.id FROM outreach_reports r JOIN outreach_contacts c ON c.id=r.contact_id WHERE r.id=? AND c.project_id=?').bind(p.id,pid).first();
  if(!report)throw new Error('Отчёт не найден');
  return core.decideReport(db,p.id,p.decision,String(p.reason||'').slice(0,2000),email);
 }
 if(data.action==='report'){
  if(!Array.isArray(p.files)||p.files.length<1||p.files.length>3)throw new Error('Приложите 1–3 скриншота');
  const files=p.files.map((file:any)=>{if(!['image/png','image/jpeg','image/webp'].includes(file.mime)||typeof file.base64!=='string'||file.base64.length>4194304)throw new Error('Только PNG, JPG, WebP до 3 МБ');const bytes=Uint8Array.from(atob(file.base64),(c)=>c.charCodeAt(0));const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!(file.mime==='image/png'?png:file.mime==='image/jpeg'?jpg:webp))throw new Error('Файл не похож на изображение');return {...file,bytes};});
  const chat=process.env['TELEGRAM_REVIEW_CHAT_ID'],token=process.env['TELEGRAM_BOT_TOKEN'];
  if(!chat||!token)throw new Error('Настройте TELEGRAM_BOT_TOKEN и TELEGRAM_REVIEW_CHAT_ID');
  if(!String(p.summary||'').trim())throw new Error('Опишите результат разговора');
  const reportId=id(),contact=await core.lockReport(db,pid,p.id,email,reportId,String(p.summary).slice(0,3000),p.category||'undetermined',p.responded===true);
  try{
   const message=await telegram('sendMessage',{chat_id:chat,text:`Отчёт агента\n${contact['name']||'Без имени'} · ${contact['phone']}\nАгент: ${email}\n${String(p.summary).slice(0,3000)}\nПроверить: https://projectforwork3.vibetivyko.workers.dev/workspace`});
   await db.prepare('UPDATE outreach_report_delivery SET chat_id=?,message_id=? WHERE report_id=?').bind(chat,message.message_id,reportId).run();
   for(let i=0;i<files.length;i++){
    const file=files[i],form=new FormData();form.set('chat_id',chat);form.set('document',new Blob([file.bytes],{type:file.mime}),`report-${i+1}.${file.mime==='image/png'?'png':file.mime==='image/jpeg'?'jpg':'webp'}`);form.set('reply_to_message_id',String(message.message_id));
    const response=await fetch(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',body:form,signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok||!result.ok)throw new Error('Не удалось доставить скриншот');
    await db.prepare('INSERT INTO outreach_report_files(report_id,position,telegram_file_id,mime,name) VALUES(?,?,?,?,?)').bind(reportId,i,result.result.document.file_id,file.mime,`Скриншот ${i+1}`).run();
   }
   await db.prepare("UPDATE outreach_reports SET review_state='manual_review',review_reason='Ожидает проверки модератором в кабинете' WHERE id=?").bind(reportId).run();
  }catch(error){await db.prepare("UPDATE outreach_reports SET review_state='needs_info',review_reason='Доставка не завершена. Отправьте отчёт заново.' WHERE id=?").bind(reportId).run();await db.prepare("UPDATE outreach_contacts SET state='needs_info' WHERE id=?").bind(contact['id']).run();throw new Error('Не все файлы доставлены. Отправьте отчёт повторно.');}
  return {ok:true};
 }
 throw new Error('Неизвестное действие');
});
