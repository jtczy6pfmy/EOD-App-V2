(()=>{'use strict';const app=document.querySelector('main.app');if(!app)return;
const persistentHero=app.querySelector('.mm-hero');if(persistentHero){persistentHero.classList.add('mm-persistent-hero');document.body.insertBefore(persistentHero,app)}const dashboard=document.createElement('div');dashboard.className='mm-screen mm-dashboard';dashboard.id='mm-dashboard';for(const selector of ['.mm-hero','.mm-metrics','.mm-board']){const el=app.querySelector(selector);if(el)dashboard.append(el)}
// Place the original live inspection progress (including milestone feedback) between dashboard rows 1 and 2.
const terminalProgress=document.getElementById('count')?.closest('.card-body');
const dashboardProgress=app.querySelector('.mm-daily-progress');
if(terminalProgress&&dashboardProgress){dashboardProgress.replaceChildren();dashboardProgress.classList.add('mm-original-progress');const heading=document.createElement('div');heading.className='mm-daily-progress-head';heading.innerHTML='<strong>DAILY INSPECTION PROGRESS</strong>';dashboardProgress.append(heading);const counter=terminalProgress.querySelector('.status-progress-number');const bar=terminalProgress.querySelector('.progressbar');const milestone=terminalProgress.querySelector('#milestonePopup');const complete=terminalProgress.querySelector('#completeMessage');for(const element of [counter,bar,milestone,complete])if(element)dashboardProgress.append(element)}
if(dashboardProgress){const board=dashboard.querySelector('.mm-board');if(board)dashboard.insertBefore(dashboardProgress,board);else dashboard.append(dashboardProgress)}
const dashboardBottom=app.querySelector('.mm-bottom');if(dashboardBottom)dashboard.append(dashboardBottom);
const workspace=document.createElement('div');workspace.className='mm-screen mm-workspace';workspace.id='mm-workspace';
const heading=document.createElement('div');heading.className='mm-workspace-title';heading.innerHTML='<span>OPERATIONS / WORKSPACE</span><h2 id="mm-workspace-heading">Inspections</h2><button type="button" id="mm-back-dashboard">← BACK TO DASHBOARD</button>';workspace.append(heading);const buildTag=document.createElement('small');buildTag.textContent='BUILD 2026.10.16-R2';buildTag.className='mm-build-tag';buildTag.style.cssText='display:inline-block;padding:5px 9px;border:1px solid #26d9ec;border-radius:7px;color:#26d9ec;font-size:11px;font-weight:800;letter-spacing:.5px';heading.append(buildTag);
const views={};for(const name of ['Upcoming & Bad Orders','Add Inspection','Completed','Reports','Settings']){const section=document.createElement('div');section.className='mm-workspace-view';section.dataset.view=name;section.hidden=true;views[name]=section;workspace.append(section)}
const working=document.getElementById('upcomingBadOrders');const completed=document.getElementById('mm-completed')||document.getElementById('inspectionList')?.closest('section.card');const entry=app.querySelector('section.equipment-entry');const terminal=document.getElementById('terminal')?.closest('section.card');const sidebar=app.querySelector('.sidebar-stack');const notes=document.getElementById('generateEod')?.closest('section.card');const preview=document.getElementById('previewCard');
if(working){
 views['Upcoming & Bad Orders'].append(working);
 const listLayout=document.createElement('div');
 listLayout.className='mm-orders-layout';
 working.parentNode.insertBefore(listLayout,working);
 listLayout.append(working);
 const dock=document.createElement('aside');
 dock.className='mm-inspect-dock';
 dock.setAttribute('aria-label','Selected chassis actions');
 dock.innerHTML='';
 listLayout.append(dock);
 // Let Inspect scroll naturally until it reaches the bottom of the visible header.
 const positionInspect=()=>{
  const hero=document.querySelector('.mm-persistent-hero');
  const rect=hero?.getBoundingClientRect();
  const bottom=rect&&rect.bottom>0&&rect.top<window.innerHeight?rect.bottom:0;
  dock.style.setProperty('--mm-inspect-sticky-top',Math.max(12,Math.round(bottom+12))+'px');
 };
 window.addEventListener('scroll',positionInspect,{passive:true});
 window.addEventListener('resize',positionInspect,{passive:true});
 window.addEventListener('orientationchange',positionInspect);
 requestAnimationFrame(positionInspect);

 const results=working.querySelector('#outlookSyncResults');
 if(results){
  const relocate=()=>{
   const bar=results.querySelector('.eod-selection-bar');
   if(bar)dock.replaceChildren(bar);
  };
  new MutationObserver(relocate).observe(results,{childList:true});
  relocate();
 }
}
if(sidebar)views['Add Inspection'].append(sidebar);
if(entry)views['Add Inspection'].append(entry);
// Row 3: keep the existing live Tire Audits and Tallies controls together below the equipment entry.
const auditTallies=sidebar?.querySelector('.audit-tally-row');
if(auditTallies){auditTallies.classList.add('mm-inspection-row-three');views['Add Inspection'].append(auditTallies)}
if(completed)views.Completed.append(completed);
if(notes)views.Reports.append(notes);
if(preview)views.Reports.append(preview);
const settingsInfo=document.createElement('section');settingsInfo.className='card';settingsInfo.innerHTML='<div class="card-header-styled"><h2>Settings</h2></div><div class="card-body"><p>Choose your terminal from Add Inspection. Terminal settings also determine which inspections are saved and reported.</p><button type="button" id="mm-settings-terminal">OPEN TERMINAL SETTINGS</button></div>';views.Settings.append(settingsInfo);
// Show the same live daily progress at the top of every workspace page.
if(dashboardProgress){
 const progressPanels=[];
 for(const [name,view] of Object.entries(views)){
  const panel=document.createElement('section');
  panel.className='mm-daily-progress mm-workspace-progress';
  panel.setAttribute('aria-label','Daily inspection progress');
  panel.innerHTML='<div class="mm-daily-progress-head"><strong>DAILY INSPECTION PROGRESS</strong><span class="mm-workspace-progress-count">0 / 28</span></div><div class="progressbar" role="progressbar" aria-label="Daily inspection progress" aria-valuemin="0" aria-valuemax="28" aria-valuenow="0"><div class="fill"></div></div>';
  view.prepend(panel);
  progressPanels.push(panel);
 }
 const syncWorkspaceProgress=()=>{
  const current=Number(document.getElementById('count')?.textContent)||0;
  const target=Math.max(1,Number(document.getElementById('targetDisplay')?.textContent)||28);
  for(const panel of progressPanels){
   panel.querySelector('.mm-workspace-progress-count').textContent=current+' / '+target;
   panel.querySelector('.fill').style.width=Math.min(100,current/target*100)+'%';
   const bar=panel.querySelector('[role="progressbar"]');
   bar.setAttribute('aria-valuenow',String(current));
   bar.setAttribute('aria-valuemax',String(target));
  }
 };
 window.addEventListener('eod:inspection-data-changed',syncWorkspaceProgress);
 window.addEventListener('eod:recovered',()=>setTimeout(syncWorkspaceProgress,0));
 syncWorkspaceProgress();
}
app.replaceChildren(dashboard,workspace);
const names=['Dashboard','Upcoming & Bad Orders','Add Inspection','Completed','Reports','Settings'];const tabs=[...document.querySelectorAll('.mm-side .mm-nav')];let active='Dashboard';
function show(name){if(!names.includes(name))name='Dashboard';active=name;const home=name==='Dashboard';if(persistentHero){persistentHero.hidden=false;persistentHero.style.display='flex';}dashboard.hidden=!home;workspace.hidden=home;for(const [key,el] of Object.entries(views))el.hidden=home||key!==name;tabs.forEach((b,i)=>{b.classList.toggle('active',names[i]===name);b.setAttribute('aria-current',names[i]===name?'page':'false')});if(!home)document.getElementById('mm-workspace-heading').textContent=name;window.scrollTo({top:0,behavior:'instant'});document.documentElement.scrollTop=0;document.body.scrollTop=0}
tabs.forEach((b,i)=>b.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();show(names[i])},true));
document.getElementById('mm-back-dashboard').addEventListener('click',()=>show('Dashboard'));
document.getElementById('mm-settings-terminal').addEventListener('click',()=>{show('Add Inspection');document.getElementById('terminal')?.focus()});
document.querySelectorAll('.mm-board [data-go]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();show('Upcoming & Bad Orders');const view=button.dataset.go==='bad'?'bad':'upcoming';window.dispatchEvent(new CustomEvent('eod:report-view',{detail:view}))},true));
document.querySelectorAll('.mm-bottom [data-action]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const action=button.dataset.action;if(action==='inspection')show('Add Inspection');else if(action==='bad'){show('Upcoming & Bad Orders');window.dispatchEvent(new CustomEvent('eod:report-view',{detail:'bad'}))}else if(action==='report')show('Reports');else show('Completed')},true));
window.addEventListener('eod:inspection-removed',()=>{show('Upcoming & Bad Orders');window.dispatchEvent(new Event('eod:show-bocz'));});
window.addEventListener('eod:inspect-selected',event=>{const asset=String(event.detail?.asset||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const match=asset.match(/^([A-Z]{4})([0-9]{5,6})$/);if(!match)return;show('Add Inspection');document.getElementById('tab-chassis')?.click();const prefix=document.getElementById('prefix');const number=document.getElementById('number');if(!prefix||!number)return;const option=[...prefix.options].find(x=>x.value===match[1]);if(option){prefix.value=match[1];prefix.dispatchEvent(new Event('change',{bubbles:true}))}else{const opt=new Option(match[1],match[1]);prefix.append(opt);prefix.value=match[1];prefix.dispatchEvent(new Event('change',{bubbles:true}))}number.value=match[2];number.dispatchEvent(new Event('input',{bubbles:true}));number.focus({preventScroll:true});requestAnimationFrame(()=>{document.getElementById("mm-workspace-heading")?.scrollIntoView({behavior:"smooth",block:"start"});});});show('Dashboard');
})();