import {describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {claimContact,lockReport,decideReport,type WorkspaceDb} from './outreach-core.server';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 for(const f of ['0001_outreach_workspace.sql','0002_outreach_operations.sql'])sqlite.exec(readFileSync(new URL('../../d1-migrations/'+f,import.meta.url),'utf8'));
 const prepare=(sql:string)=>{let params:any[]=[];const statement:any={bind(...v:any[]){params=v;return statement;},async first(){return sqlite.prepare(sql).get(...params)||null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}};},async execute(){return /RETURNING/i.test(sql)?{results:sqlite.prepare(sql).all(...params),meta:{changes:0}}:{results:[],...await statement.run()};}};return statement;};
 const db={prepare,async exec(sql:string){sqlite.exec(sql);},async batch(items:any[]){sqlite.exec('BEGIN');try{const rows=[];for(const item of items)rows.push(await item.execute());sqlite.exec('COMMIT');return rows;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as WorkspaceDb;
 sqlite.exec("INSERT INTO outreach_projects VALUES('p','Test','owner',1,15000); INSERT INTO outreach_settings(project_id) VALUES('p'); INSERT INTO outreach_members(project_id,user_id,role) VALUES('p','a','agent'),('p','b','agent'); INSERT INTO outreach_contacts(id,project_id,phone,created_at) VALUES('c','p','+79991234567',1);");
 return {db,sqlite};
}
describe('shared agent queue',()=>{
 it('allows exactly one claimant and rejects a different agent report',async()=>{const {db}=fixture();const result=await Promise.allSettled([claimContact(db,'p','c','a'),claimContact(db,'p','c','b')]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);const c=await db.prepare("SELECT assigned_to FROM outreach_contacts WHERE id='c'").first<any>();await expect(lockReport(db,'p','c',c.assigned_to==='a'?'b':'a','r','test','application',true)).rejects.toThrow();});
 it('does not pay twice and does not accept a stale report revision',async()=>{const {db,sqlite}=fixture();await claimContact(db,'p','c','a');await lockReport(db,'p','c','a','r1','test','application',true);await decideReport(db,'r1','needs_info','More','owner',10);await lockReport(db,'p','c','a','r2','fixed','application',true);await expect(decideReport(db,'r1','accepted','','owner',20)).rejects.toThrow();await decideReport(db,'r2','accepted','','owner',30);await expect(decideReport(db,'r2','accepted','','owner',40)).rejects.toThrow();expect(sqlite.prepare('SELECT COUNT(*) AS n,SUM(amount_kopecks) AS amount FROM outreach_rewards').get()).toEqual({n:1,amount:15000});expect(sqlite.prepare('SELECT COUNT(*) AS n FROM outreach_crm').get()).toEqual({n:1});});
 it('enforces project membership and suspension',async()=>{const {db,sqlite}=fixture();await expect(claimContact(db,'other','c','a')).rejects.toThrow();sqlite.exec("UPDATE outreach_members SET suspended_at=1 WHERE user_id='a'");await expect(claimContact(db,'p','c','a')).rejects.toThrow();});
});
