import {request} from '../../dropbox-auth.mjs';
export function mountWorksheet(root){
 root.replaceChildren();
 const button=document.createElement('button');button.textContent='LOAD WORKBOOK';button.type='button';
 const status=document.createElement('p');status.setAttribute('role','status');
 const save=document.createElement('button');save.textContent='SAVE TO DROPBOX';save.type='button';save.disabled=true;
 const note=document.createElement('p');note.textContent='Edit individual cells, then save. Saving may change complex Excel formatting or features; verify a copy of the workbook before using this editor for production.';
 let book=null,revision=null,dirty=false;
 const output=document.createElement('div');output.style.cssText='overflow:auto;max-height:65vh;background:white;color:#111';
 root.append(button,save,note,status,output);
 button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Loading Dropbox workbook…';
  try{
   if(!window.XLSX)throw Error('Excel reader unavailable');
   const file=await request('download');
   book=XLSX.read(await file.arrayBuffer(),{type:'array',cellStyles:true,cellFormula:true});
   const metadata=await request('status');revision=metadata.rev;dirty=false;save.disabled=true;
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
       td.style.cssText='border:1px solid #ddd;padding:5px;white-space:nowrap';td.contentEditable='true';
       const row=table.rows.length,col=tr.cells.length;
       td.addEventListener('blur',()=>{
        const address=XLSX.utils.encode_cell({r:row,c:col});
        const cell=book.Sheets[name][address]||{};
        const next=td.textContent||'';
        if(next===String(value??''))return;
        if(next.startsWith('=')){cell.f=next.slice(1);delete cell.v;cell.t='n';}
        else{delete cell.f;cell.v=next;cell.t='s';}
        book.Sheets[name][address]=cell;dirty=true;save.disabled=false;
        status.textContent='Unsaved changes — '+name;
       });tr.append(td);
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
 save.addEventListener('click',async()=>{
  if(!dirty||!revision)return;
  if(!confirm('Save edited workbook to Dropbox? Complex Excel formatting or features may change.'))return;
  save.disabled=true;status.textContent='Saving to Dropbox…';
  try{
   const bytes=XLSX.write(book,{type:'array',bookType:'xlsx',cellStyles:true});
   let binary='';const data=new Uint8Array(bytes);
   for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
   const result=await request('upload',{rev:revision,content:btoa(binary)});
   revision=result.rev;dirty=false;status.textContent='Saved to Dropbox successfully.';
  }catch(error){status.textContent=error.message||'Save failed. Changes remain in this page.';save.disabled=false;}
 });
}
