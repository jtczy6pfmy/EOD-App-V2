import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
const cors={"Access-Control-Allow-Origin":"https://jtczy6pfmy.github.io","Access-Control-Allow-Headers":"authorization,content-type,x-eod-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const headers={...cors,"Content-Type":"application/json","Cache-Control":"no-store"};
const fields=["Lot Loc","Eq Init Nr","Mate Init Nr","Hold List","Hold Category","Dwell DD HH"];
const norm=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]/g,"");
function val(row:Record<string,unknown>,name:string){const k=Object.keys(row).find(x=>norm(x)===norm(name));return k?String(row[k]??"").trim():""}
function convert(row:Record<string,unknown>,kind:string){
 const out:Record<string,string>={};
 if(kind==="bad"||kind==="good"){for(const k of fields)out[k]=val(row,k);out["Hold List"]=val(row,"Hold List")||val(row,"Holds")}
 else {out["Lot Loc"]=val(row,"LOT LOC");out["Eq Init Nr"]=val(row,"CHASSIS");out["Mate Init Nr"]=val(row,"EQUIPMENT");out["Hold List"]="FHWA";out["Hold Category"]=[val(row,"FHWA STATUS"),val(row,"FHWA Date")].filter(Boolean).join(" · ");out["Dwell DD HH"]=val(row,"DWELL TIME")}
 
 if(/^(NSPZ|NSFZ)/i.test(out["Mate Init Nr"])){out["Eq Init Nr"]=out["Mate Init Nr"];out["Mate Init Nr"]=""}
 if(!/^(AIMZ|NSPZ|NSFZ)/i.test(out["Eq Init Nr"]))return null;
 if(kind==="good"){
  const hours=val(row,"Dwell Hr"),dwell=out["Dwell DD HH"].match(/(\d+)\s*d/i);
  const oldEnough=hours!==""?Number(hours)>=19*24:Boolean(dwell&&Number(dwell[1])>=19);
  if(!/^(NSPZ|NSFZ)/i.test(out["Eq Init Nr"])||!oldEnough)return null;
  if(val(row,"Eq BO").toUpperCase()==="YES")return null;
 }
 return out;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 const token=Deno.env.get("EOD_REPORT_SYNC_TOKEN");
 if(req.method!=="GET"&&(!token||req.headers.get("x-eod-token")!==token))return new Response(JSON.stringify({error:"Not authorized or integration not configured"}),{status:401,headers});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 try{
 if(req.method==="GET"){const {data,error}=await db.from("eod_mail_reports").select("report_type,rows,updated_at");if(error)throw error;return new Response(JSON.stringify({reports:data}),{headers})}
 if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers});
 const body=await req.json();
 if(!["bad","good","upcoming"].includes(body.kind)||typeof body.base64!=="string"||body.base64.length>8_000_000)throw Error("Invalid attachment");
 // New importers send the subject; legacy Upcoming/Bad uploads remain compatible.
 if(body.subject){
  const subject=String(body.subject);
  const detected=/FHWA|inventory\s+due/i.test(subject)?"upcoming":/bad\s+order/i.test(subject)?"bad":/good\s+order|Measures\s*\{GO/i.test(subject)?"good":null;
  if(!detected||detected!==body.kind)throw Error("Email subject does not match report type");
 }
 const raw=Uint8Array.from(atob(body.base64),c=>c.charCodeAt(0));
 const wb=XLSX.read(raw,{type:"array",cellDates:true});
 const rows=wb.SheetNames.flatMap(name=>XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[name],{defval:"",raw:false})).map(r=>convert(r,body.kind)).filter(Boolean);
 if(!rows.length)throw Error("No report rows found");
 const {error}=await db.from("eod_mail_reports").upsert({report_type:body.kind,rows,source_message_id:String(body.messageId||"").slice(0,200),updated_at:new Date().toISOString()});
 if(error)throw error;
 return new Response(JSON.stringify({ok:true,kind:body.kind,count:rows.length}),{headers});
 }catch(e){return new Response(JSON.stringify({error:String(e instanceof Error?e.message:e)}),{status:400,headers})}
});
