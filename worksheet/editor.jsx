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
class GridBoundary extends React.Component{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p>The grid could not display this workbook. Your original file is unchanged; its backup and worksheet details remain available below.</p>:this.props.children;}
}
function Worksheet(){
  const ref=useRef(null);
  const [showGrid,setShowGrid]=useState(false),[structure,setStructure]=useState(null);
  const [sheets,setSheets]=useState(null),[key,setKey]=useState(0),[status,setStatus]=useState('Open the original workbook from Dropbox.'),[busy,setBusy]=useState(false),[backup,setBackup]=useState(null);
  async function load(){
    setBusy(true);setStatus('Opening the original Dropbox workbook…');
    try{
      const blob=await request('download');
      if(backup)URL.revokeObjectURL(backup);setBackup(URL.createObjectURL(blob));
      const file=new File([blob],'Tire Audit Worksheet Aaron McMullen.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      await transformExcelToFortune(file, imported=>setSheets(imported.map((sheet,index)=>({
        ...sheet,id:String(sheet.id??index),status:index===0?1:0,calcChain:[],
        celldata:sheet.celldata?.map(cell=>{const value={...cell.v};delete value.f;return {...cell,v:value};})
      }))),setKey);
      if(backup)URL.revokeObjectURL(backup);
      setBackup(URL.createObjectURL(blob));
      setStatus('Original workbook loaded. Preview only while save compatibility is checked.');
    }catch(error){setStatus(error.message||'Could not open the workbook.');}
    finally{setBusy(false);}
  }
  return <section className="eod-worksheet">
    <div className="eod-worksheet-actions"><button type="button" disabled={busy} onClick={load}>{busy?'OPENING…':'OPEN WORKSHEET'}</button>{backup&&<a href={backup} download="Tire Audit Worksheet Aaron McMullen.xlsx">Download original backup</a>}</div>
    <p role="status">{status}</p>
    {sheets&&<><div className="eod-sheet-frame"><GridBoundary key={key}><Workbook key={key} ref={ref} data={sheets} lang="en" allowEdit={false} showToolbar={false}/></GridBoundary></div>
    <p>Showing saved Excel results. Original formulas, dropdowns and formatting remain in the Dropbox workbook.</p></>}
  </section>;
}
