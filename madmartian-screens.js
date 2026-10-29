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
const views={};for(const name of ['Upcoming & Bad/Good Order','Add Inspection','Completed','Reports','Settings']){const section=document.createElement('div');section.className='mm-workspace-view';section.dataset.view=name;section.hidden=true;views[name]=section;workspace.append(section)}
const working=document.getElementById('upcomingBadOrders');const completed=document.getElementById('mm-completed')||document.getElementById('inspectionList')?.closest('section.card');const entry=app.querySelector('section.equipment-entry');const terminal=document.getElementById('terminal')?.closest('section.card');const sidebar=app.querySelector('.sidebar-stack');const notes=document.getElementById('generateEod')?.closest('section.card');const preview=document.getElementById('previewCard');
if(working){
 views['Upcoming & Bad/Good Order'].append(working);
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
const names=['Dashboard','Upcoming & Bad/Good Order','Add Inspection','Completed','Reports','Settings'];const tabs=[...document.querySelectorAll('.mm-side .mm-nav:not(.mm-imrs-nav)')];let active='Dashboard';
const inspectNav=tabs.find(b=>b.textContent.trim()==='INSPECT'||b.textContent.trim()==='Settings');
if(inspectNav){
 inspectNav.textContent='INSPECT';
 inspectNav.setAttribute('aria-label','Inspect selected chassis');
 inspectNav.classList.add('mm-inspect-nav');
 inspectNav.disabled=false;
 inspectNav.addEventListener('click',event=>{
  event.stopImmediatePropagation();
  const action=document.querySelector('.mm-inspect-dock .eod-selection-bar button');
  if(action&&!action.disabled)action.click();
  else show('Upcoming & Bad/Good Order');
 },true);
 const syncInspectNav=()=>{
  const action=document.querySelector('.mm-inspect-dock .eod-selection-bar button');
  inspectNav.disabled=false;
  inspectNav.textContent='INSPECT';
  inspectNav.title=action&&!action.disabled?'Inspect selected chassis':'Select a chassis from Upcoming & Bad/Good Order';
 };
 const layout=document.querySelector('.mm-orders-layout');
 if(layout)new MutationObserver(syncInspectNav).observe(layout,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 syncInspectNav();
}

function show(name){if(!names.includes(name))name='Dashboard';active=name;const home=name==='Dashboard';if(persistentHero){persistentHero.hidden=false;persistentHero.style.display='flex';}dashboard.hidden=!home;workspace.hidden=home;for(const [key,el] of Object.entries(views))el.hidden=home||key!==name;tabs.forEach((b,i)=>{b.classList.toggle('active',i!==5&&names[i]===name);b.setAttribute('aria-current',names[i]===name?'page':'false')});if(!home)document.getElementById('mm-workspace-heading').textContent=name;window.scrollTo({top:0,behavior:'instant'});document.documentElement.scrollTop=0;document.body.scrollTop=0}
tabs.forEach((b,i)=>{if(b===inspectNav)return;b.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();show(names[i])},true)});
document.getElementById('mm-back-dashboard').addEventListener('click',()=>show('Dashboard'));
document.getElementById('mm-settings-terminal').addEventListener('click',()=>{show('Add Inspection');document.getElementById('terminal')?.focus()});
document.querySelectorAll('.mm-board [data-go]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();show('Upcoming & Bad/Good Order');const view=button.dataset.go==='bad'?'bad':'upcoming';window.dispatchEvent(new CustomEvent('eod:report-view',{detail:view}))},true));
document.querySelectorAll('.mm-bottom [data-action]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const action=button.dataset.action;if(action==='inspection')show('Add Inspection');else if(action==='bad'){show('Upcoming & Bad/Good Order');window.dispatchEvent(new CustomEvent('eod:report-view',{detail:'bad'}))}else if(action==='report')show('Reports');else show('Completed')},true));
let milestoneTimer=null;
const milestoneOverlay=document.createElement('div');
milestoneOverlay.id='mm-milestone-transition';
milestoneOverlay.setAttribute('role','status');
milestoneOverlay.setAttribute('aria-live','polite');
milestoneOverlay.style.cssText='position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box;overflow:hidden;background:radial-gradient(circle at 50% 35%,#243149 0%,#0b1221 55%,#030712 100%);color:white;--mm-accent:#22b7f0;--mm-glow:#a8eeff;';
const milestoneStyle=document.createElement('style');
milestoneStyle.textContent=`@keyframes mmMilestonePop{0%{transform:scale(.55) rotate(-5deg);opacity:0}65%{transform:scale(1.12) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0)}}@keyframes mmMilestoneHalo{0%,100%{transform:scale(.94);opacity:.45}50%{transform:scale(1.1);opacity:.85}}@keyframes mmMilestoneBurst{0%{transform:translate(-50%,-50%) rotate(var(--angle)) translateY(0) scale(.2);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-50%) rotate(var(--angle)) translateY(-42vmin) scale(1.3);opacity:0}}@keyframes mmMilestoneShine{from{background-position:200% 0}to{background-position:-200% 0}}#mm-milestone-transition .mm-celebration{position:relative;z-index:2;width:min(640px,100%);animation:mmMilestonePop .65s cubic-bezier(.18,.85,.25,1.25) both}#mm-milestone-transition .mm-halo{position:absolute;inset:auto;width:min(78vmin,560px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,transparent 30%,var(--mm-accent) 52%,transparent 72%);filter:blur(35px);opacity:.5;animation:mmMilestoneHalo 1.4s ease-in-out infinite;pointer-events:none}#mm-milestone-transition .mm-particle{position:absolute;left:50%;top:50%;width:12px;height:25px;border-radius:4px;background:var(--mm-accent);box-shadow:0 0 16px var(--mm-glow);animation:mmMilestoneBurst 1.8s ease-out both;pointer-events:none}#mm-milestone-transition .mm-medal{font-size:clamp(56px,14vw,110px);filter:drop-shadow(0 0 22px var(--mm-accent));line-height:1.2}#mm-milestone-transition .mm-percent{font-size:clamp(58px,16vw,120px);font-weight:1000;letter-spacing:-.07em;line-height:1.05;color:var(--mm-glow);text-shadow:0 0 16px var(--mm-accent),0 0 60px var(--mm-accent)}#mm-milestone-transition .mm-progress-fill{height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--mm-accent),#fff,var(--mm-accent));background-size:200% 100%;box-shadow:0 0 25px var(--mm-accent);transition:width .8s ease;animation:mmMilestoneShine 1.6s linear infinite}@media(prefers-reduced-motion:reduce){#mm-milestone-transition *,#mm-milestone-transition *::before{animation:none!important;transition:none!important}}`;
milestoneStyle.textContent+="@keyframes mmOrbit{to{transform:rotate(360deg)}}@keyframes mmShockwave{from{transform:scale(.3);opacity:1}to{transform:scale(2.2);opacity:0}}@keyframes mmSparkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.4)}}#mm-milestone-transition .mm-orbit{position:absolute;width:min(82vmin,580px);aspect-ratio:1;border:3px dashed var(--mm-accent);border-radius:50%;box-shadow:0 0 28px var(--mm-accent);animation:mmOrbit 11s linear infinite;pointer-events:none}#mm-milestone-transition .mm-shockwave{position:absolute;width:240px;aspect-ratio:1;border:5px solid var(--mm-glow);border-radius:50%;animation:mmShockwave 1.3s ease-out both;pointer-events:none}#mm-milestone-transition .mm-sparkle{position:absolute;left:var(--x);top:var(--y);color:var(--mm-glow);font-size:32px;text-shadow:0 0 18px var(--mm-accent);animation:mmSparkle 1.3s ease-in-out infinite;animation-delay:var(--delay);pointer-events:none}#mm-milestone-transition .mm-particle:nth-child(3n){background:#fff;height:12px;border-radius:50%}#mm-milestone-transition .mm-particle:nth-child(4n){background:#ffd166;width:8px}#mm-milestone-transition[data-level=\"100\"] .mm-orbit{border-color:gold;box-shadow:0 0 45px gold}@media(prefers-reduced-motion:reduce){#mm-milestone-transition .mm-orbit,#mm-milestone-transition .mm-shockwave,#mm-milestone-transition .mm-sparkle{animation:none!important}#mm-milestone-transition .mm-shockwave{display:none}}";
document.head.append(milestoneStyle);
milestoneOverlay.innerHTML='<div class="mm-halo"></div><div class="mm-orbit"></div><div class="mm-shockwave"></div><div class="mm-celebration"><div id="mm-milestone-icon" class="mm-medal">🎯</div><div id="mm-transition-milestone" class="mm-percent">25%</div><div id="mm-milestone-title" style="font-size:clamp(22px,5vw,38px);font-weight:950;letter-spacing:.13em;margin:12px 0">QUARTER COMPLETE!</div><div id="mm-transition-count" style="font-size:clamp(20px,4vw,28px);font-weight:800;margin:18px 0;color:#e5e7eb"></div><div style="height:24px;background:#263347;border:2px solid #64748b;border-radius:99px;overflow:hidden;margin:24px auto;max-width:520px"><div id="mm-transition-fill" class="mm-progress-fill"></div></div><div style="font-size:14px;letter-spacing:.12em;color:#cbd5e1">RETURNING TO UPCOMING ORDERS…</div></div>';
for(let i=0;i<24;i++){const particle=document.createElement('span');particle.className='mm-particle';particle.style.setProperty('--angle',i*15+'deg');particle.style.animationDelay=(i%6)*.045+'s';milestoneOverlay.append(particle)}
for(let i=0;i<12;i++){const star=document.createElement('span');star.className='mm-sparkle';star.textContent='✦';star.style.setProperty('--x',(8+(i*37)%85)+'%');star.style.setProperty('--y',(9+(i*29)%80)+'%');star.style.setProperty('--delay',(i%5)*-.28+'s');milestoneOverlay.append(star)}
document.body.append(milestoneOverlay);
let lastMilestoneCount=Number(document.getElementById('count')?.textContent||0);
window.addEventListener('eod:inspection-removed',()=>{
 const count=Number(document.getElementById('count')?.textContent||0);
 const target=Math.max(1,Number(document.getElementById('targetDisplay')?.textContent||28));
 const milestones=[25,50,75,100];
 const previousPercent=lastMilestoneCount/target*100;
 const currentPercent=count/target*100;
 const reached=milestones.filter(level=>previousPercent<level&&currentPercent>=level).pop();
 lastMilestoneCount=count;
 const returnToOrders=()=>{show('Upcoming & Bad/Good Order');window.dispatchEvent(new Event('eod:show-bocz'));};
 if(!reached){returnToOrders();return;}
 if(milestoneTimer)clearTimeout(milestoneTimer);
 milestoneOverlay.querySelector('#mm-transition-count').textContent=count+' / '+target+' inspections';
 milestoneOverlay.querySelector('#mm-transition-fill').style.width=Math.min(100,Math.round(currentPercent))+'%';
 const themes={25:{icon:'🎯',title:'QUARTER COMPLETE!',accent:'#22b7f0',glow:'#a8eeff'},50:{icon:'👽',title:'HALFWAY THERE!',accent:'#65d64a',glow:'#c8ffb8'},75:{icon:'⚡',title:'FINAL STRETCH!',accent:'#ff7a35',glow:'#ffd0a8'},100:{icon:'🏆',title:'MISSION COMPLETE!',accent:'#f04b32',glow:'#ffb0a5'}};
 const theme=themes[reached];
 milestoneOverlay.dataset.level=String(reached);
 milestoneOverlay.style.setProperty('--mm-accent',theme.accent);
 milestoneOverlay.style.setProperty('--mm-glow',theme.glow);
 milestoneOverlay.querySelector('#mm-milestone-icon').textContent=theme.icon;
 milestoneOverlay.querySelector('#mm-milestone-title').textContent=theme.title;
 milestoneOverlay.querySelector('#mm-transition-milestone').textContent=reached+'%';
 milestoneOverlay.querySelector('.mm-celebration').style.animation='none';
 void milestoneOverlay.offsetWidth;
 milestoneOverlay.querySelector('.mm-celebration').style.animation='';
 milestoneOverlay.style.display='flex';
 milestoneTimer=setTimeout(()=>{milestoneOverlay.style.display='none';returnToOrders();milestoneTimer=null;},2500);
});
window.addEventListener('eod:inspect-selected',event=>{const asset=String(event.detail?.asset||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const match=asset.match(/^([A-Z]{4})([0-9]{5,6})$/);if(!match)return;show('Add Inspection');document.getElementById('tab-chassis')?.click();const prefix=document.getElementById('prefix');const number=document.getElementById('number');if(!prefix||!number)return;const option=[...prefix.options].find(x=>x.value===match[1]);if(option){prefix.value=match[1];prefix.dispatchEvent(new Event('change',{bubbles:true}))}else{const opt=new Option(match[1],match[1]);prefix.append(opt);prefix.value=match[1];prefix.dispatchEvent(new Event('change',{bubbles:true}))}number.value=match[2];number.dispatchEvent(new Event('input',{bubbles:true}));if(document.activeElement instanceof HTMLElement)document.activeElement.blur();requestAnimationFrame(()=>{document.getElementById("mm-workspace-heading")?.scrollIntoView({behavior:"smooth",block:"start"});});});show('Dashboard');
})();