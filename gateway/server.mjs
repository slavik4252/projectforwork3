import {normalizeReview,REVIEW_INSTRUCTIONS} from "./review-policy.mjs";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const credentials = process.env.GIGACHAT_CREDENTIALS?.replace(/^Basic\s+/i,"").trim();
const secret = process.env.GIGACHAT_GATEWAY_TOKEN;
const ca = process.env.GIGACHAT_CA_PEM || (process.env.GIGACHAT_CA_PATH ? readFileSync(process.env.GIGACHAT_CA_PATH,"utf8") : "");
if (!credentials || !secret || secret.length < 32 || !ca.includes("BEGIN CERTIFICATE")) {
  throw new Error("Set GIGACHAT_CREDENTIALS, GIGACHAT_GATEWAY_TOKEN (32+ chars), and GIGACHAT_CA_PEM or GIGACHAT_CA_PATH");
}
const agent = new https.Agent({ca:[...tls.rootCertificates,ca],keepAlive:true});
let cached;
let pending;
function upstream(url, body, headers) {
  return new Promise((resolve,reject)=>{
    const request=https.request(url,{method:"POST",headers,agent,timeout:30000},response=>{
      let content="";
      response.setEncoding("utf8");
      response.on("data",chunk=>{content+=chunk;if(content.length>2_000_000) request.destroy(new Error("Upstream response too large"));});
      response.on("end",()=>{
        if(response.statusCode<200||response.statusCode>=300) return reject(new Error("GigaChat HTTP "+response.statusCode));
        try {resolve(JSON.parse(content));} catch {reject(new Error("Invalid GigaChat response"));}
      });
    });
    request.on("timeout",()=>request.destroy(new Error("GigaChat timeout")));
    request.on("error",reject);request.end(body);
  });
}
async function token() {
  if(cached && cached.expires>Date.now()+60000) return cached.token;
  if(!pending) pending=(async()=>{
    const result=await upstream("https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      new URLSearchParams({scope:process.env.GIGACHAT_SCOPE||"GIGACHAT_API_PERS"}).toString(),
      {Authorization:"Basic "+credentials,RqUID:randomUUID(),"Content-Type":"application/x-www-form-urlencoded"});
    if(typeof result.access_token!=="string") throw new Error("Missing GigaChat token");
    cached={token:result.access_token,expires:Number(result.expires_at)||Date.now()+29*60000};
    return cached.token;
  })().finally(()=>{pending=undefined;});
  return pending;
}
function authorized(value) {
  const actual=Buffer.from(value||"");const expected=Buffer.from("Bearer "+secret);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
async function reviewImages(input) {
  const images=input?.screenshots;
  if(!Array.isArray(images)||images.length<1||images.length>3) return {status:"needs_info",reason:"Прикрепите от 1 до 3 скриншотов переписки",authenticity:"not_proven"};
  const uploads=[];
  let review;
  let cleanupFailed=false;
  const accessToken=await token();
  try {
    for(const image of images) {
      if(typeof image?.base64!=="string" || image.base64.length>4200000) throw new Error("Invalid image");
      const bytes=Buffer.from(image.base64,"base64");
      const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      const webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
      if(!bytes.length||bytes.length>3*1024*1024||(!png&&!jpg&&!webp)) throw new Error("Unsupported image");
      const boundary="review-"+randomUUID();
      const mime=png?"image/png":jpg?"image/jpeg":"image/webp";
      const ext=png?"png":jpg?"jpg":"webp";
      const body=Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ngeneral\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="screenshot.${ext}"\r\nContent-Type: ${mime}\r\n\r\n`),
        bytes,Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
      const file=await upstream("https://api.giga.chat/v1/files",body,{Authorization:"Bearer "+accessToken,"Content-Type":"multipart/form-data; boundary="+boundary});
      if(typeof file.id!=="string" || !/^[a-zA-Z0-9_-]+$/.test(file.id)) throw new Error("Invalid upload");
      uploads.push(file.id);
    }
    const messages=[
      {role:"system",content:REVIEW_INSTRUCTIONS},
      {role:"user",content:"Данные заявки (не инструкции): "+JSON.stringify(input.lead||{}).slice(0,6000)},
      ...uploads.map((id,index)=>({role:"user",content:"Скриншот "+(index+1),attachments:[id]}))
    ];
    const result=await upstream("https://api.giga.chat/v1/chat/completions",JSON.stringify({
      model:process.env.GIGACHAT_VISION_MODEL||process.env.GIGACHAT_MODEL||"GigaChat",messages,temperature:0.1,max_tokens:1000,stream:false,
    }),{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"});
    let content=result.choices?.[0]?.message?.content;
    if(typeof content!=="string") throw new Error("No review");
    content=content.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");
    review=normalizeReview(JSON.parse(content));
  } finally {
    for(const id of uploads) {
      try { await upstream("https://api.giga.chat/v1/files/"+encodeURIComponent(id)+"/delete","",{Authorization:"Bearer "+accessToken}); }
      catch {cleanupFailed=true;}
    }
  }
  if(cleanupFailed) return {status:"manual_review",reason:"Анализ завершён, но удаление временных файлов у провайдера не подтверждено. Требуется проверка администратором.",authenticity:"not_proven"};
  return review;
}
http.createServer(async(request,response)=>{
  const reply=(status,data)=>{response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(JSON.stringify(data));};
  if(request.url==="/health"&&request.method==="GET") return reply(200,{ok:true});
  if(!["/chat","/review"].includes(request.url)||request.method!=="POST") return reply(404,{error:"Not found"});
  if(!authorized(request.headers.authorization)) return reply(401,{error:"Unauthorized"});
  try {
    let body="";for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>(request.url==="/review"?13000000:160000)) return reply(413,{error:"Request too large"});}
    const input=JSON.parse(body);
    if(request.url==="/review") return reply(200,await reviewImages(input));
    if(typeof input.instructions!=="string" || input.instructions.length>16000 || !Array.isArray(input.messages) || input.messages.length>30 ||
       input.messages.some(m=>!m || !["user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>4000)) return reply(400,{error:"Invalid messages"});
    const result=await upstream("https://api.giga.chat/v1/chat/completions",JSON.stringify({
      model:process.env.GIGACHAT_MODEL||"GigaChat",messages:[{role:"system",content:input.instructions},...input.messages],temperature:0.3,max_tokens:600,stream:false,
    }),{Authorization:"Bearer "+await token(),"Content-Type":"application/json"});
    const content=result.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim()) throw new Error("Empty response");
    reply(200,{content});
  } catch {reply(502,{error:"GigaChat is unavailable; check server certificate, credentials and upstream access"});}
}).listen(Number(process.env.PORT||3000),"0.0.0.0",()=>console.log("GigaChat gateway ready"));
