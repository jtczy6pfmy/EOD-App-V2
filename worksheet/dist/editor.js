import {request} from '../../dropbox-auth.mjs';
export function mountWorksheet(root){
 root.replaceChildren();
 const button=document.createElement('button');button.textContent='LOAD WORKBOOK';button.type='button';
 const status=document.createElement('p');status.setAttribute('role','status');
 const output=document.createElement('div');output.style.cssText='overflow:auto;max-height:65vh;background:white;color:#111';
 root.append(button,status,output);
 button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Loading Dropbox workbook…';
  try{
   if(!window.XLSX)throw Error('Excel reader unavailable');
   const file=await request('download');
   const book=XLSX.read(await file.arrayBuffer(),{type:'array'});
   output.replaceChildren();
   const tabs=document.createElement('div');const sheetArea=document.createElement('div');
   for(const name of book.SheetNames){
    const tab=document.createElement('button');tab.type='button';tab.textContent=name;tab.style.width='auto';
    tab.addEventListener('click',()=>{
     sheetArea.replaceChildren();
     const table=document.createElement('table');table.style.cssText='border-collapse:collapse;font-size:14px';
     const rows=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false});
     for(const cells of rows.slice(0,1000)){
      const tr=document.createElement('tr');
      for(const value of cells.slice(0,60)){
       const td=document.createElement('td');td.textContent=String(value??'');
       td.style.cssText='border:1px solid #ddd;padding:5px;white-space:nowrap';tr.append(td);
      }
      table.append(tr);
     }
     sheetArea.append(table);status.textContent='Read-only preview: '+name;
    });
    tabs.append(tab);
   }
   output.append(tabs,sheetArea);tabs.firstChild?.click();
  }catch(error){status.textContent=error.message||'Workbook unavailable. Connect Dropbox first.'}
  finally{button.disabled=false}
 });
}
