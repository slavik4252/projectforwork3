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
http.createServer(async(request,response)=>{
  const reply=(status,data)=>{response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(JSON.stringify(data));};
  if(request.url==="/health"&&request.method==="GET") return reply(200,{ok:true});
  if(request.url!=="/chat"||request.method!=="POST") return reply(404,{error:"Not found"});
  if(!authorized(request.headers.authorization)) return reply(401,{error:"Unauthorized"});
  try {
    let body="";for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>160000) return reply(413,{error:"Request too large"});}
    const input=JSON.parse(body);
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
