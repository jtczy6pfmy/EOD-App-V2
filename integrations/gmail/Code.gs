/** Private Gmail -> Supabase importer. Keep token in Script Properties. */
function syncEodGmailReports() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return;
  try {
    const props=PropertiesService.getScriptProperties();
    const endpoint=props.getProperty('EOD_REPORT_ENDPOINT');
    const token=props.getProperty('EOD_REPORT_SYNC_TOKEN');
    if(!endpoint||!token)throw Error('Set endpoint and sync token in Script Properties');
    const reports=[
      {kind:'upcoming',query:'label:Lists subject:"FHWA Inventory Due" has:attachment filename:xlsx',matches:s=>/FHWA|inventory\s+due/i.test(s)},
      {kind:'bad',query:'label:Lists subject:"Chassis Bad Order" has:attachment filename:xlsx',matches:s=>/bad\s+order/i.test(s)},
      {kind:'good',query:'label:Lists subject:"IOD" subject:"HARRISBURG" subject:"Measures {GO" has:attachment filename:xlsx',matches:s=>/Measures\s*\{GO|good\s+order/i.test(s)}
    ];
    const failures=[];
    for(const report of reports){
      try{
        const messages=GmailApp.search(report.query,0,30).flatMap(t=>t.getMessages()).filter(m=>report.matches(m.getSubject())).sort((a,b)=>b.getDate()-a.getDate());
        const latest=messages.find(m=>m.getAttachments({includeInlineImages:false}).some(a=>/\.xlsx?$/i.test(a.getName())));
        if(!latest){console.log(report.kind+': no email; retaining saved report');continue;}
        const messageId=latest.getId(),digestKey='last_'+report.kind+'_v2';
        if(props.getProperty(digestKey)===messageId)continue;
        const attachments=latest.getAttachments({includeInlineImages:false}).filter(a=>/\.xlsx?$/i.test(a.getName()));
        let imported=false;
        for(const attachment of attachments){
          const response=UrlFetchApp.fetch(endpoint,{method:'post',contentType:'application/json',headers:{'x-eod-token':token},payload:JSON.stringify({kind:report.kind,messageId,subject:latest.getSubject(),base64:Utilities.base64Encode(attachment.getBytes())}),muteHttpExceptions:true});
          if(response.getResponseCode()!==200)throw Error(report.kind+' upload failed: '+response.getResponseCode()+' '+response.getContentText());
          const result=JSON.parse(response.getContentText());
          if(!result.ok||!result.count)throw Error(report.kind+': no validated rows');
          console.log(report.kind+': imported '+result.count+' rows from '+messageId);
          imported=true;break;
        }
        if(imported)props.setProperty(digestKey,messageId);
      }catch(error){failures.push(String(error));console.error(String(error));}
    }
    if(failures.length)throw Error(failures.join('; '));
  }finally{lock.releaseLock();}
}
