/* Excel attachment import for Gmail-forwarded reports. No mailbox credentials in the browser. */
(()=>{
"use strict";
const button=document.getElementById("outlookSyncButton"),status=document.getElementById("outlookSyncStatus"),results=document.getElementById("outlookSyncResults");
if(!button||!status||!results)return;
const KEY="eod_combined_reports_v1";
const COMPLETED_KEY="eod_completed_assets_v1";
const assetKey=row=>String(row["Eq Init Nr"]||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
function completed(){try{return new Set(JSON.parse(localStorage.getItem(COMPLETED_KEY)||"[]"))}catch{return new Set()}}
function markCompleted(row){const ids=completed();ids.add(assetKey(row));localStorage.setItem(COMPLETED_KEY,JSON.stringify([...ids]));render(load())}
const outstanding=row=>allowedChassis(row)&&!completed().has(assetKey(row));
function uniqueOutstanding(rows){const seen=new Set();return (rows||[]).filter(row=>{if(!outstanding(row))return false;const id=assetKey(row);if(seen.has(id))return false;seen.add(id);return true})}
const HEADERS=["Lot Loc","Eq Init Nr","Mate Init Nr","Hold List","Hold Category","Dwell DD HH"];
let sortColumn="Lot Loc",sortDirection=1,selectedLots=null,reportView="all",selectedAsset="";
window.addEventListener("eod:report-view",event=>{reportView=["all","upcoming","bad"].includes(event.detail)?event.detail:"all";render(load())});
const sorter=new Intl.Collator(undefined,{numeric:true,sensitivity:"base"});
const allowedChassis=row=>/^(?:AIMZ|NSPZ|NSFZ)/i.test(String(row["Eq Init Nr"]||"").trim());
const fileInput=document.createElement("input");
fileInput.type="file";fileInput.accept=".xlsx,.xls";fileInput.multiple=true;fileInput.hidden=true;
const importButton=document.createElement("button");
importButton.type="button";importButton.textContent="Import Excel";
importButton.style.cssText="width:auto;background:#ffc107;color:#001338;padding:8px 12px;margin-left:8px";
button.after(fileInput);
button.setAttribute("aria-label","Refresh saved Upcoming and Bad Orders");

function get(row,...names){
 const entries=Object.entries(row);
 for(const name of names){
  const normalized=name.toUpperCase().replace(/[^A-Z0-9]/g,"");
  const match=entries.find(([key])=>key.toUpperCase().replace(/[^A-Z0-9]/g,"")===normalized);
  if(match)return String(match[1]??"").trim();
 }
 return "";
}
function normalize(row,kind){
 const out={};
 if(kind==="bad"){for(const h of HEADERS)out[h]=get(row,h)}
 else{
  out["Lot Loc"]=get(row,"LOT LOC");
  out["Eq Init Nr"]=get(row,"CHASSIS");
  out["Mate Init Nr"]=get(row,"EQUIPMENT");
  out["Hold List"]="FHWA";
  out["Hold Category"]=[get(row,"FHWA STATUS"),get(row,"FHWA Date")].filter(Boolean).join(" · ");
  out["Dwell DD HH"]=get(row,"DWELL TIME");
 }
 const chassis=out["Eq Init Nr"],equipment=out["Mate Init Nr"];
 if(!allowedChassis(out))return null;
 if(/^(?:NSPZ|NSFZ)(?:\b|(?=\d))/i.test(equipment)){
  out["Eq Init Nr"]=equipment;
  out["Mate Init Nr"]="";
 }
 return out;
}
function kindOf(rows,filename){
 const keys=new Set(rows.flatMap(r=>Object.keys(r).map(k=>k.toUpperCase().replace(/[^A-Z0-9]/g,""))));
 if(keys.has("HOLDLIST")&&keys.has("EQINITNR"))return "bad";
 if(keys.has("FHWASTATUS")&&keys.has("EQUIPMENT"))return "upcoming";
 if(/bad.order|chassis.bad/i.test(filename))return "bad";
 if(/fhwa|upcoming|inventory.due/i.test(filename))return "upcoming";
 return null;
}
function readFile(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Unable to read "+file.name));
  reader.onload=()=>{try{
   const workbook=XLSX.read(reader.result,{type:"array",cellDates:true});
   const rows=workbook.SheetNames.flatMap(name=>XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:"",raw:false}));
   resolve({rows,kind:kindOf(rows,file.name),name:file.name});
  }catch(error){reject(error)}};
  reader.readAsArrayBuffer(file);
 });
}
function render(data){
 results.replaceChildren();
 if(!data){status.textContent="No saved reports yet";results.textContent="Tap Sync to load your reports.";return}
 const upcoming=(data.upcoming||[]).filter(row=>outstanding(row));
 const bad=(data.bad||[]).filter(row=>outstanding(row));
 const allRows=[...(reportView==="bad"?[]:upcoming),...(reportView==="upcoming"?[]:bad)];
 const lots=[...new Set(allRows.map(row=>String(row["Lot Loc"]||"").trim()))].sort(sorter.compare);
 const rows=allRows.filter(row=>selectedLots===null||selectedLots.has(String(row["Lot Loc"]||"").trim())).sort((a,b)=>sortDirection*sorter.compare(String(a[sortColumn]??""),String(b[sortColumn]??"")));
 if(selectedAsset&&!allRows.some(row=>assetKey(row)===selectedAsset))selectedAsset="";
 const summary=document.createElement("p");summary.textContent=upcoming.length+" upcoming inspections · "+bad.length+" bad orders · "+rows.length+" shown"+(reportView==="all"?"":" · "+(reportView==="bad"?"Bad orders":"Upcoming")+" view");results.append(summary);
 const selectionBar=document.createElement("div");selectionBar.className="eod-selection-bar";selectionBar.setAttribute("role","status");const selectionLabel=document.createElement("span");selectionLabel.textContent=selectedAsset?"Selected chassis: "+selectedAsset:"Tap any row to select a chassis for inspection";const inspectSelected=document.createElement("button");inspectSelected.type="button";inspectSelected.textContent="INSPECT SELECTED →";inspectSelected.disabled=!selectedAsset;inspectSelected.addEventListener("click",()=>{if(!selectedAsset)return;window.dispatchEvent(new CustomEvent("eod:inspect-selected",{detail:{asset:selectedAsset}}))});const clearSelection=document.createElement("button");clearSelection.type="button";clearSelection.textContent="CLEAR";clearSelection.disabled=!selectedAsset;clearSelection.addEventListener("click",()=>{selectedAsset="";render(load())});selectionBar.append(selectionLabel,inspectSelected,clearSelection);results.append(selectionBar);
 const wrap=document.createElement("div");wrap.style.overflowX="auto";
 const table=document.createElement("table");table.style.cssText="width:100%;border-collapse:collapse;font-size:1rem";
 const head=document.createElement("tr");
 for(const h of HEADERS){const th=document.createElement("th");const sortButton=document.createElement("button");sortButton.type="button";sortButton.textContent=h+(sortColumn===h?(sortDirection===1?" ▲":" ▼"):" ⇅");sortButton.setAttribute("aria-label","Sort by "+h);sortButton.setAttribute("aria-pressed",String(sortColumn===h));sortButton.style.cssText="width:auto;background:transparent;color:inherit;border:0;padding:7px 4px;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap";sortButton.addEventListener("click",()=>{if(sortColumn===h)sortDirection*=-1;else{sortColumn=h;sortDirection=1}render(load())});th.append(sortButton);th.style.cssText="text-align:left;padding:2px;border-bottom:1px solid #cbd5e1";if(h==="Lot Loc"){
  const filterButton=document.createElement("button");filterButton.type="button";filterButton.textContent=selectedLots===null?" ▾":" ▾●";filterButton.setAttribute("aria-label","Filter Lot Loc like Excel");filterButton.style.cssText="width:auto;background:transparent;color:inherit;border:0;padding:6px;cursor:pointer;font-size:1rem";
  filterButton.addEventListener("click",()=>{
   const existing=document.getElementById("eodLotFilterPanel");if(existing){existing.remove();return}
   const panel=document.createElement("div");panel.id="eodLotFilterPanel";panel.style.cssText="position:absolute;z-index:20;background:#fff;color:#172033;border:1px solid #94a3b8;border-radius:8px;padding:12px;box-shadow:0 8px 24px #0003;width:260px;max-width:85vw;text-align:left;font-size:1rem";
   const search=document.createElement("input");search.type="search";search.placeholder="Search locations";search.setAttribute("aria-label","Search Lot Loc");search.style.cssText="width:100%;padding:7px;margin-bottom:8px;font-size:1rem";
   const options=document.createElement("div");options.style.cssText="max-height:230px;overflow:auto";
   const selected=new Set(selectedLots===null?lots:selectedLots);
   const paint=()=>{options.replaceChildren();const term=search.value.toLowerCase();for(const lot of lots.filter(x=>x.toLowerCase().includes(term))){const label=document.createElement("label");label.style.cssText="display:flex;align-items:center;gap:8px;padding:5px;cursor:pointer";const check=document.createElement("input");check.type="checkbox";check.checked=selected.has(lot);check.style.width="auto";check.addEventListener("change",()=>{if(check.checked)selected.add(lot);else selected.delete(lot)});label.append(check,document.createTextNode(lot||"(Blanks)"));options.append(label)}};
   search.addEventListener("input",paint);
   const controls=document.createElement("div");controls.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0";
   const all=document.createElement("button");all.type="button";all.textContent="Select All";all.style.cssText="width:auto;padding:5px";all.addEventListener("click",()=>{selected.clear();lots.forEach(x=>selected.add(x));paint()});
   const none=document.createElement("button");none.type="button";none.textContent="Clear";none.style.cssText="width:auto;padding:5px";none.addEventListener("click",()=>{selected.clear();paint()});controls.append(all,none);
   const apply=document.createElement("button");apply.type="button";apply.textContent="Apply";apply.style.cssText="width:auto;padding:7px 14px";apply.addEventListener("click",()=>{selectedLots=selected.size===lots.length?null:new Set(selected);render(load())});
   panel.append(search,controls,options,apply);th.style.position="relative";th.append(panel);paint();search.focus();
  });th.append(filterButton);
 }head.append(th)}
 const thead=document.createElement("thead");thead.append(head);table.append(thead);
 const tbody=document.createElement("tbody");
 for(const row of rows.slice(0,500)){const tr=document.createElement("tr");const id=assetKey(row);tr.className="eod-data-row"+(id===selectedAsset?" eod-row-selected":"");tr.tabIndex=0;tr.setAttribute("aria-selected",String(id===selectedAsset));const select=()=>{selectedAsset=selectedAsset===id?"":id;render(load())};tr.addEventListener("click",select);tr.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select()}});for(const h of HEADERS){const td=document.createElement("td");td.textContent=row[h]||"";td.style.cssText="padding:7px;border-bottom:1px solid #e2e8f0";tr.append(td)}tbody.append(tr)}
 table.append(tbody);wrap.append(table);results.append(wrap);
 status.textContent="Updated "+new Date(data.updated).toLocaleString()+(rows.length>500?" · First 500 shown":"");
}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
button.addEventListener("click",()=>render(load()));
fileInput.addEventListener("change",async()=>{
 if(!fileInput.files.length)return;
 if(!window.XLSX){status.textContent="Excel reader unavailable. Check your internet connection.";return}
 importButton.disabled=true;status.textContent="Reading Excel files…";
 try{
  const imported=await Promise.all([...fileInput.files].map(readFile));
  const unknown=imported.filter(f=>!f.kind);
  if(unknown.length)throw new Error("Unrecognized spreadsheet columns: "+unknown.map(f=>f.name).join(", "));
  const existing=load()||{bad:[],upcoming:[]};
  for(const file of imported)existing[file.kind]=uniqueOutstanding(file.rows.map(r=>normalize(r,file.kind)).filter(Boolean));
  existing.updated=Date.now();
  localStorage.setItem(KEY,JSON.stringify(existing));
  render(existing);window.dispatchEvent(new Event("eod:reports-updated"));
 }catch(error){status.textContent="Import failed: "+error.message}
 finally{importButton.disabled=false;fileInput.value=""}
});

const endpoint="https://tjhsrydhkigvhlllnstm.supabase.co/functions/v1/eod-mail-reports";
async function cloudRefresh(ask=false){
 
 try{
  const response=await fetch(endpoint,{cache:"no-store"});
  if(!response.ok){throw Error("Cloud reports unavailable ("+response.status+")")}
  const payload=await response.json(),reports=payload.reports||[];
  if(!reports.length){status.textContent="Cloud connected · Waiting for emailed reports";return}
  const data=load()||{upcoming:[],bad:[]};
  for(const report of reports)if(report.report_type==="bad"||report.report_type==="upcoming")data[report.report_type]=uniqueOutstanding(report.rows);
  data.updated=Date.now();localStorage.setItem(KEY,JSON.stringify(data));render(data);window.dispatchEvent(new Event("eod:reports-updated"));
  status.textContent="Updated "+new Date().toLocaleString();
 }catch(error){status.textContent=error.message}
}
button.addEventListener("click",()=>cloudRefresh(false));
cloudRefresh(false);

// The existing Add Inspection handler clears the chassis number only after a successful save.
// Observe that result without modifying index.html.
const addInspection=document.getElementById("addInspection");
const chassisNumber=document.getElementById("number");
const chassisPrefix=document.getElementById("prefix");
if(addInspection&&chassisNumber&&chassisPrefix){
 let pending="";
 addInspection.addEventListener("click",()=>{pending=(chassisPrefix.value+" "+chassisNumber.value).toUpperCase().replace(/[^A-Z0-9]/g,"")},true);
 addInspection.addEventListener("click",()=>{
  if(pending&&chassisNumber.value===""&&/^(?:AIMZ|NSPZ|NSFZ)/.test(pending)){
   const ids=completed();ids.add(pending);localStorage.setItem(COMPLETED_KEY,JSON.stringify([...ids]));
   const data=load();if(data){for(const kind of ["upcoming","bad"])data[kind]=(data[kind]||[]).filter(row=>assetKey(row)!==pending);localStorage.setItem(KEY,JSON.stringify(data))}
   render(load());window.dispatchEvent(new Event("eod:reports-updated"));
  }
  pending="";
 });
}
render(load());
})();
