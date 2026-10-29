export const API='https://tjhsrydhkigvhlllnstm.supabase.co/functions/v1/eod-dropbox';
export const SESSION='eod_dropbox_session_v1';
const PENDING='eod_dropbox_pending_v1';
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function request(action,extra={}) {
  const session=localStorage.getItem(SESSION);
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(session?{'x-eod-session':session}:{})},body:JSON.stringify({action,...extra})});
  if(!response.ok){if(response.status===401)localStorage.removeItem(SESSION);const body=await response.json();throw Error(body.error||'Dropbox connection unavailable.');}
  return action==='download'?response.blob():response.json();
}
export async function begin() {
  const config=await request('config');
  if(!config.configured)throw Error('Dropbox needs one-time setup before you can connect.');
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(64)));
  const state=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  sessionStorage.setItem(PENDING,JSON.stringify({verifier,state,created:Date.now()}));
  const url=new URL('https://www.dropbox.com/oauth2/authorize');
  url.search=new URLSearchParams({client_id:config.appKey,response_type:'code',redirect_uri:config.redirect,state,code_challenge:b64url(new Uint8Array(digest)),code_challenge_method:'S256',token_access_type:'offline',scope:'account_info.read files.metadata.read files.content.read files.content.write'});
  location.assign(url.href);
}
export function consumePending(search,storage=sessionStorage,now=Date.now()) {
  const raw=storage.getItem(PENDING);storage.removeItem(PENDING);
  const params=new URLSearchParams(search);
  if(params.has('error'))throw Error('Dropbox sign-in was cancelled. Return to EOD V2 to try again.');
  const pending=JSON.parse(raw||'null');
  if(!pending||!params.get('code')||pending.state!==params.get('state')||!Number.isFinite(pending.created)||now-pending.created>600000||now<pending.created)throw Error('Sign-in expired or could not be verified. Return to EOD V2 and connect again.');
  return {code:params.get('code'),verifier:pending.verifier};
}
