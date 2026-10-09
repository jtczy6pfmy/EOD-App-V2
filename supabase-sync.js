/* Durable reports: record corrections, deletion tombstones and conditional writes. */
(()=>{
  "use strict";
  const URL="https://tjhsrydhkigvhlllnstm.supabase.co/rest/v1/eod_daily";
  const KEY="sb_publishable_nB2sQ-lTf9mJrmb6UWn4vw_gLlsnYbv";
  const HEADERS={apikey:KEY,Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"};
  const S=window.EODState,client=crypto.randomUUID(),now=new Date();
  const iso=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const date=`${now.getMonth()+1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}`;
  const prefix=`eodInspectionReport_v14_${iso}_`,legacyKey=`eodInspectionReport_v13_shared_${iso}`;
  let syncing=false,queued=false,timer,activeTerminal="",status={state:"idle",message:"Choose a terminal"};
  const volatile=new Map(),storageFailed=new Set(),key=terminal=>prefix+encodeURIComponent(terminal);
  function parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
  function read(terminal){
    if(!terminal)return null;
    if(volatile.has(terminal))return volatile.get(terminal);
    let state;try{state=parse(localStorage.getItem(key(terminal)));}catch{}
    if(!state){
      let legacy;try{legacy=parse(localStorage.getItem(legacyKey));}catch{}
      if(legacy?.terminal===terminal&&legacy.date===date)state=legacy;
    }
    if(!state)return null;
    state=S.normalize(state);volatile.set(terminal,state);return state;
  }
  function setStatus(state,message){
    if(storageFailed.has(activeTerminal)){state="error";message="Device storage unavailable — keep this page open";}
    status={state,message};
    const icon=document.getElementById("cloudStatus"),label=document.getElementById("cloudStatusText");
    if(icon){icon.dataset.state=state;icon.title=message;icon.setAttribute("aria-label",message);}
    if(label)label.textContent=message;
  }
  function write(state){
    volatile.set(state.terminal,state);
    try{localStorage.setItem(key(state.terminal),JSON.stringify(state));storageFailed.delete(state.terminal);return true;}
    catch{storageFailed.add(state.terminal);setStatus("error","Device storage unavailable — keep this page open");return false;}
  }
  function publish(state){window.dispatchEvent(new CustomEvent("eod:recovered",{detail:state}));}
  function schedule(delay=300){clearTimeout(timer);timer=setTimeout(syncNow,delay);}
  function persist(draft){
    const state=S.save(read(draft.terminal),draft,client),durable=write(state);
    if(draft.terminal===activeTerminal&&durable)setStatus(navigator.onLine?"pending":"offline",navigator.onLine?"Saved on this iPad · backing up":"Saved on this iPad · offline");
    schedule();return state;
  }
  function select(terminal){
    activeTerminal=terminal;
    setStatus(terminal?(navigator.onLine?"pending":"offline"):"idle",terminal?(navigator.onLine?"Checking cloud backup":"Saved on this iPad · offline"):"Choose a terminal");
    schedule(0);
  }
  const baseQuery=terminal=>`report_date=eq.${iso}&terminal=eq.${encodeURIComponent(terminal)}`;
  async function request(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{return await fetch(url,{headers:HEADERS,cache:"no-store",...options,signal:controller.signal});}
    finally{clearTimeout(timeout);}
  }
  async function fetchCloud(terminal){
    const response=await request(`${URL}?${baseQuery(terminal)}&select=app_state`);
    if(!response.ok)throw new Error(`Cloud read failed (${response.status})`);
    const rows=await response.json();return rows[0]?.app_state||null;
  }
  function signature(state){
    return S.fingerprint(state);
  }
  async function upload(state,cloud){
    const revision=crypto.randomUUID(),next={...state,_sync:{...state._sync,revision}};
    // Only update the revision read earlier. A competing writer triggers a merge/retry.
    const filter=cloud?`&app_state->_sync->>revision=${cloud._sync?.revision?"eq."+encodeURIComponent(cloud._sync.revision):"is.null"}`:"";
    const response=await request(cloud?`${URL}?${baseQuery(state.terminal)}${filter}`:URL,{
      method:cloud?"PATCH":"POST",headers:{...HEADERS,Prefer:"return=representation"},
      body:JSON.stringify(cloud?{app_state:next}:{report_date:iso,terminal:state.terminal,app_state:next})
    });
    if(response.status===409)return null;
    if(!response.ok)throw new Error(`Cloud write failed (${response.status})`);
    const rows=await response.json();return rows[0]?.app_state?next:null;
  }
  async function syncNow(){
    clearTimeout(timer);
    if(syncing){queued=true;return;}
    const terminal=activeTerminal;if(!terminal)return;
    if(!navigator.onLine){setStatus("offline","Saved on this iPad · offline");return;}
    syncing=true;if(status.state!=="saved")setStatus("pending","Backing up to cloud");
    try{
      for(let attempt=0;attempt<4;attempt++){
        const cloud=await fetchCloud(terminal);if(activeTerminal!==terminal)return;
        const local=read(terminal),combined=S.merge(cloud,local);
        if(!combined){setStatus("idle","Ready for your first inspection");return;}
        const before=signature(local),durable=write(combined);
        if(signature(combined)!==before)publish(combined);
        if(cloud?._sync?.version===1&&signature(cloud)===signature(combined)){
          if(durable)setStatus("saved","Cloud backup complete");return;
        }
        setStatus("pending","Backing up to cloud");
        const uploaded=await upload(combined,cloud);if(activeTerminal!==terminal)return;
        if(!uploaded)continue;
        const current=read(terminal),latest=S.merge(uploaded,current);write(latest);
        if(signature(current)!==signature(latest))publish(latest);
        // Read back before showing the check mark; changes during upload stay pending.
        const confirmed=await fetchCloud(terminal);if(activeTerminal!==terminal)return;
        const merged=S.merge(confirmed,read(terminal)),old=signature(read(terminal)),saved=write(merged);
        if(old!==signature(merged))publish(merged);
        if(signature(confirmed)===signature(merged)){
          if(saved)setStatus("saved","Cloud backup complete");return;
        }
      }
      setStatus("pending","Changes saved here · retrying cloud backup");schedule(1500);
    }catch(error){
      if(activeTerminal===terminal){
        setStatus(navigator.onLine?"error":"offline",navigator.onLine?"Saved here · cloud unavailable · tap to retry":"Saved on this iPad · offline");schedule(5000);
      }
      console.warn("EOD backup will retry",error.message);
    }finally{syncing=false;if(queued||activeTerminal!==terminal){queued=false;schedule(0);}}
  }
  window.addEventListener("online",()=>{setStatus("pending","Connection restored · backing up");schedule(0);});
  window.addEventListener("offline",()=>setStatus("offline","Saved on this iPad · offline"));
  window.addEventListener("storage",event=>{
    if(event.key===key(activeTerminal)){
      const remote=parse(event.newValue);
      if(remote){
        const before=signature(read(activeTerminal)),combined=S.merge(read(activeTerminal),remote);
        // Avoid bouncing equivalent writes between two tabs through storage events.
        if(signature(combined)===signature(remote))volatile.set(activeTerminal,combined);
        else write(combined);
        if(before!==signature(combined)){publish(combined);setStatus("pending","Checking cloud backup");schedule(0);}
      }
    }
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule(0);});
  window.EODCloud={read,persist,select,syncNow,backupCurrentState:syncNow,getStatus:()=>status};
  document.addEventListener("DOMContentLoaded",()=>{
    document.getElementById("cloudStatus")?.addEventListener("click",syncNow);
    setInterval(()=>{if(!document.hidden)syncNow();},10000);
  },{once:true});
})();
