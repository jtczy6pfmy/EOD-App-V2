import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Workbook} from '@fortune-sheet/react';
import {transformExcelToFortune} from '@corbe30/fortune-excel';
import '@fortune-sheet/react/dist/index.css';
import './editor.css';
import {request} from '../dropbox-auth.mjs';

export function mountWorksheet(container){
  const root=createRoot(container);
  root.render(<Worksheet/>);
  return ()=>root.unmount();
}
function Worksheet(){
  const ref=useRef(null);
  const [sheets,setSheets]=useState(null),[key,setKey]=useState(0),[status,setStatus]=useState('Open the original workbook from Dropbox.'),[busy,setBusy]=useState(false),[backup,setBackup]=useState(null);
  async function load(){
    setBusy(true);setStatus('Opening the original Dropbox workbook…');
    try{
      const blob=await request('download');
      const file=new File([blob],'Tire Audit Worksheet Aaron McMullen.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      await transformExcelToFortune(file,setSheets,setKey,ref);
      if(backup)URL.revokeObjectURL(backup);
      setBackup(URL.createObjectURL(blob));
      setStatus('Original workbook loaded. Preview only while save compatibility is checked.');
    }catch(error){setStatus(error.message||'Could not open the workbook.');}
    finally{setBusy(false);}
  }
  return <section className="eod-worksheet">
    <div className="eod-worksheet-actions"><button type="button" disabled={busy} onClick={load}>{busy?'OPENING…':'OPEN WORKSHEET'}</button>{backup&&<a href={backup} download="Tire Audit Worksheet Aaron McMullen.xlsx">Download original backup</a>}</div>
    <p role="status">{status}</p>
    {sheets&&<><div className="eod-sheet-frame"><Workbook key={key} ref={ref} data={sheets} lang="en" allowEdit={false} showToolbar={false}/></div>
    <details className="eod-workbook-details"><summary>Workbook contents</summary>{sheets.map(sheet=><section key={sheet.id||sheet.name}><h3>{sheet.name}</h3><p>{sheet.row} rows · {sheet.column} columns</p><pre>{JSON.stringify({config:sheet.config,validations:sheet.dataVerification,firstCells:sheet.celldata?.slice(0,250)||sheet.data?.slice(0,15)},null,2)}</pre></section>)}</details></>}
  </section>;
}
