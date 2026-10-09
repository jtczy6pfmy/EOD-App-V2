/* Versioned report records. Deletions remain as tombstones for offline recovery. */
(function(root){
  "use strict";
  const TYPES={chassis:["5652","5900","5658"],containers:["5653","5900","5658"],racks:["5657"]};
  const section=type=>["5652","5653","5657"].includes(type)?"Pre-repair":type==="5900"?"Post-repair":"Add-on";
  const clone=value=>JSON.parse(JSON.stringify(value));
  const emptyData=()=>Object.fromEntries(Object.entries(TYPES).map(([category,types])=>[category,Object.fromEntries(types.map(type=>[type,{[section(type)]:[]}]))]).concat([["tireAudits",0]]));
  const flatten=data=>Object.keys(TYPES).flatMap(category=>Object.entries(data?.[category]||{}).flatMap(([type,groups])=>Object.values(groups).flatMap(items=>(Array.isArray(items)?items:[]).map(item=>({category,type,number:item[0],condition:item[1],note:item[2]||"",id:item[3]})))));
  const legacyId=r=>"legacy:"+JSON.stringify([r.category,r.type,r.number,r.condition,r.note]);
  const identity=r=>JSON.stringify([r.category,r.type,r.number.trim().toUpperCase().replace(/\s+/g," ")]);
  function reconcile(records){
    // An edit explicitly replaces earlier versions of its original equipment/type.
    // Keep tombstones so stale legacy backups cannot bring the error entry back.
    const sources=Object.values(records).filter(record=>!record.replacedBy);
    sources.forEach(source=>Object.entries(records).forEach(([id,candidate])=>{
      if(id===source.id||candidate.deleted)return;
      const replaced=!source.deleted&&source.replaces?.includes(identity(candidate));
      if(replaced&&choose(source,candidate)===source)records[id]={...candidate,deleted:true,updated:source.updated,replacedBy:source.id};
    }));
    return records;
  }
  function fingerprint(state){
    if(!state)return "";
    const sync={...normalize(state)._sync};delete sync.revision;
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    return JSON.stringify(canonical({terminal:state.terminal,date:state.date,_sync:sync}));
  }
  function materialize(state){
    const result=clone(state),data=emptyData();
    Object.entries(result._sync.records).sort(([aid,a],[bid,b])=>Number((a.created||a.updated).split(":")[0])-Number((b.created||b.updated).split(":")[0])||aid.localeCompare(bid)).forEach(([id,r])=>{
      if(!r.deleted&&TYPES[r.category]?.includes(r.type))data[r.category][r.type][section(r.type)].push([r.number,r.condition,r.note,id]);
    });
    data.tireAudits=result._sync.fields.tireAudits.value;
    result.data=data;result.notes=result._sync.fields.notes.value;
    return result;
  }
  function normalize(state){
    if(!state)return null;
    if(state._sync?.version===1)return materialize(state);
    const records={};
    flatten(state.data).forEach((r,index)=>{const id=r.id||legacyId(r);records[id]={...r,id,created:String(index),updated:"0",deleted:false};});
    return materialize({...state,_sync:{version:1,records,fields:{notes:{value:state.notes||"",updated:"0"},tireAudits:{value:Number(state.data?.tireAudits)||0,updated:"0"}}}});
  }
  function choose(a,b){
    if(!a)return b;if(!b)return a;
    // Logical clock plus client ID gives a deterministic ordering across devices.
    const [at,ac=""]=a.updated.split(":"),[bt,bc=""]=b.updated.split(":");
    return Number(at)!==Number(bt)?(Number(at)>Number(bt)?a:b):(ac>=bc?a:b);
  }
  function merge(a,b){
    a=normalize(a);b=normalize(b);if(!a)return b;if(!b)return a;
    if(a.terminal!==b.terminal||a.date!==b.date)throw new Error("Reports must belong to the same terminal and day.");
    const records={};
    new Set([...Object.keys(a._sync.records),...Object.keys(b._sync.records)]).forEach(id=>{records[id]=choose(a._sync.records[id],b._sync.records[id]);});
    const fields={};["notes","tireAudits"].forEach(key=>{fields[key]=choose(a._sync.fields[key],b._sync.fields[key]);});
    return materialize({...b,_sync:{version:1,records:reconcile(records),fields}});
  }
  function save(previous,draft,client,now=Date.now()){
    previous=normalize(previous)||normalize({...draft,data:emptyData(),notes:""});
    const sync=clone(previous._sync);
    const clocks=[...Object.values(sync.records),...Object.values(sync.fields)].map(r=>Number(r.updated.split(":")[0])||0);
    const updated=(Math.max(now,...clocks)+1)+":"+client;
    const live=new Set();
    flatten(draft.data).forEach(r=>{
      const id=r.id||root.crypto.randomUUID();live.add(id);
      const old=sync.records[id];
      const changed=!old||old.deleted||["category","type","number","condition","note"].some(key=>old[key]!==r[key]);
      sync.records[id]=changed?{...r,id,created:old?.created||updated,updated,deleted:false,replaces:old?[...new Set([...(old.replaces||[]),identity(old)])]:[]}:old;
    });
    Object.entries(sync.records).forEach(([id,r])=>{if(!r.deleted&&!live.has(id))sync.records[id]={...r,deleted:true,updated};});
    const values={notes:draft.notes||"",tireAudits:Number(draft.data.tireAudits)||0};
    Object.entries(values).forEach(([key,value])=>{if(sync.fields[key].value!==value)sync.fields[key]={value,updated};});
    reconcile(sync.records);
    return materialize({...draft,_sync:sync});
  }
  function validate(category,type,number,terminal,records=[],excludeId){
    if(!TYPES[category]?.includes(type))return "Choose an inspection type for this equipment.";
    const match=number.trim().toUpperCase().match(/^([A-Z]{4})\s+(\d+)$/);
    if(!match)return "Enter a 4-letter prefix followed by the equipment number.";
    const [,prefix,digits]=match;
    const expected=category==="chassis"&&terminal==="HARRISBURG"&&prefix==="AIMZ"?5:6;
    if(digits.length!==expected)return `Enter exactly ${expected} digits for this equipment number.`;
    const special=["CALUMET","LANDERS","CHGO 63RD","CHICAGO 47TH"].includes(terminal);
    const prefixes=terminal==="HARRISBURG"?["NSPZ","NSFZ","AIMZ"]:special?["NSPZ","NSFZ","TSXZ","LSFZ","TSFZ","TSNZ","PAHZ","PBRZ","UPDZ","UPHZ","DDRZ","DDTZ","DDGZ"]:["NSPZ","NSFZ"];
    if(category==="chassis"&&!prefixes.includes(prefix))return "Choose a chassis prefix available at this terminal.";
    if(category==="racks"&&prefix!=="ZNSU")return "Chassis racks must use the ZNSU prefix.";
    const normalized=prefix+" "+digits;
    if(records.some(r=>r.id!==excludeId&&r.category===category&&r.type===type&&r.number.trim().toUpperCase()===normalized))return "This equipment already has an inspection of this type.";
    return "";
  }
  root.EODState={TYPES,section,emptyData,flatten,normalize,merge,save,validate,fingerprint};
  if(typeof module!=="undefined")module.exports=root.EODState;
})(typeof window!=="undefined"?window:globalThis);
