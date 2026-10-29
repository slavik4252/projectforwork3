import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const binding = {binding:"LEAD_REVIEWS",database_name:"lead-reviews",database_id:"f32a5e1a-dde0-47b5-a9e6-a5b0d951e0de"};
async function find(directory) {
  let entries;
  try { entries=await readdir(directory,{withFileTypes:true}); } catch { return []; }
  const found=[];
  for(const item of entries) {
    const target=path.join(directory,item.name);
    if(item.isDirectory()) found.push(...await find(target));
    else if(item.name==="wrangler.json" || item.name==="wrangler.jsonc") found.push(target);
  }
  return found;
}
const configs=await find(".output");
if(!configs.length) throw new Error("Generated Cloudflare Wrangler configuration not found in .output; D1 binding was not applied.");
for(const file of configs) {
  const config=JSON.parse(await readFile(file,"utf8"));
  config.keep_vars=true;
  config.d1_databases=[...(config.d1_databases||[]).filter(item=>item.binding!==binding.binding),binding];
  await writeFile(file,JSON.stringify(config,null,2)+"\n");
  console.log("Configured LEAD_REVIEWS and keep_vars in "+file);
}
