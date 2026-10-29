import {request,begin,SESSION} from './dropbox-auth.mjs';
const view=document.querySelector('[data-view="Tire Audits"]');
if(view){
  const card=document.createElement('section');card.className='card';
  card.innerHTML='<div class="card-header-styled"><h2>Dropbox workbook</h2></div><div class="card-body"><p>Tire Audit Worksheet Aaron McMullen.xlsx</p><p id="dropbox-status" role="status" aria-live="polite">Checking Dropbox connection…</p><button type="button" id="dropbox-connect">CONNECT DROPBOX</button><button type="button" id="dropbox-check" hidden>CHECK CONNECTION</button><button type="button" id="dropbox-disconnect" hidden>DISCONNECT DROPBOX</button><p>The workbook stays in Dropbox. Worksheet editing is being prepared; connecting does not change the file or add historical audits to today’s total.</p></div>';
  view.prepend(card);
  const worksheet=document.createElement('section');worksheet.className='card';view.append(worksheet);
  let worksheetMounted=false;
  async function openWorksheetEditor(){if(worksheetMounted)return;worksheetMounted=true;try{const editor=await import('./worksheet/dist/editor.js?v=4');editor.mountWorksheet(worksheet);}catch{worksheetMounted=false;worksheet.textContent='The worksheet editor could not load. Refresh EOD V2 and try again.';}}
  const nav=document.createElement('button');nav.type='button';nav.className='mm-nav mm-tire-audits-nav';nav.textContent='Tire Audits';
  document.querySelector('.mm-side')?.insertBefore(nav,document.querySelector('.mm-side .mm-footer'));
  nav.onclick=()=>{window.dispatchEvent(new Event('eod:open-tire-audits'));openWorksheetEditor();};
  window.addEventListener('eod:open-tire-audits',()=>{nav.classList.add('active');nav.setAttribute('aria-current','page');});
  document.querySelectorAll('.mm-side .mm-nav:not(.mm-tire-audits-nav)').forEach(button=>button.addEventListener('click',()=>{nav.classList.remove('active');nav.setAttribute('aria-current','false');},true));
  const status=card.querySelector('#dropbox-status'),connect=card.querySelector('#dropbox-connect'),check=card.querySelector('#dropbox-check'),disconnect=card.querySelector('#dropbox-disconnect');
  async function refresh(){
    connect.disabled=true;check.disabled=true;disconnect.disabled=true;
    try{
      const config=await request('config');
      if(!config.configured){status.textContent='Dropbox needs one-time setup. Your inspections and reports are ready to use.';return;}
      if(!localStorage.getItem(SESSION)){status.textContent='Not connected. Sign in with your Dropbox account.';return;}
      const data=await request('status');status.textContent='Connected · '+data.workbook;connect.hidden=true;check.hidden=false;disconnect.hidden=false;
    }catch(error){status.textContent=error.message;connect.hidden=false;}
    finally{connect.disabled=false;check.disabled=false;disconnect.disabled=false;}
  }
  connect.onclick=async()=>{connect.disabled=true;try{await begin();}catch(error){status.textContent=error.message;connect.disabled=false;}};
  check.onclick=refresh;
  disconnect.onclick=async()=>{disconnect.disabled=true;try{await request('disconnect');localStorage.removeItem(SESSION);connect.hidden=false;check.hidden=true;disconnect.hidden=true;status.textContent='Disconnected. The workbook is unchanged.';}catch(error){status.textContent=error.message;}finally{disconnect.disabled=false;}};
  if(sessionStorage.getItem('eod_open_tire_audits')){sessionStorage.removeItem('eod_open_tire_audits');nav.click();}
  refresh();
}
