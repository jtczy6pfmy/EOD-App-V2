export const WORKBOOK = '/McMullenAaron/Tire Audit Worksheet Aaron McMullen.xlsx';
export const REDIRECT = 'https://jtczy6pfmy.github.io/EOD-App-V2/dropbox-callback.html';
const ORIGIN = 'https://jtczy6pfmy.github.io';
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export async function hash(value) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
export function createHandler({ env, fetcher = fetch, clock = Date.now }) {
  // Dropbox app keys identify a public OAuth client; passwords/secrets never ship here.
  const appKey = env('DROPBOX_APP_KEY') || 'phh7lctr5ht56b2';
  const cors = {'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type,x-eod-session,apikey', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store'};
  const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {...cors, 'Content-Type': 'application/json'}});
  const configured = () => ['DROPBOX_OWNER_ACCOUNT_ID','DROPBOX_TOKEN_ENCRYPTION_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].every(k => env(k));
  async function db(table, query, method = 'GET', body) {
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const response = await fetcher(`${env('SUPABASE_URL')}/rest/v1/${table}?${query}`, {method, headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation,resolution=merge-duplicates'}, body: body === undefined ? undefined : JSON.stringify(body)});
    if (!response.ok) throw Error('Connection storage unavailable.');
    return response.status === 204 ? [] : response.json();
  }
  async function crypt(value, decrypt = false) {
    const raw = unb64(env('DROPBOX_TOKEN_ENCRYPTION_KEY'));
    if (raw.length !== 32) throw Error('Connection setup incomplete.');
    const key = await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
    if (decrypt) { const [iv, data] = value.split('.'); return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)}, key, unb64(data))); }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(value))));
  }
  async function oauth(params) {
    const response = await fetcher('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:appKey})});
    if (!response.ok) throw Error('Dropbox authorization expired or was declined. Connect again.');
    return response.json();
  }
  async function api(token, endpoint, body) {
    const response = await fetcher('https://api.dropboxapi.com/2/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (!response.ok) throw Error('Dropbox could not access the workbook. Check file permissions and reconnect.');
    return response.json();
  }
  return async req => {
    if (req.headers.get('origin') && req.headers.get('origin') !== ORIGIN) return json({error:'Origin not allowed.'},403);
    if (req.method === 'OPTIONS') return new Response(null,{headers:cors});
    if (req.method !== 'POST') return json({error:'Method not allowed.'},405);
    try {
      if (Number(req.headers.get('content-length')) > 12000) return json({error:'Request too large.'},413);
      const text = await req.text();
      if (text.length > 12000) return json({error:'Request too large.'},413);
      const body = JSON.parse(text);
      if (body.action === 'config') return json({configured:!!configured(),appKey: configured() ? appKey : null,redirect:REDIRECT,workbook:WORKBOOK});
      if (!configured()) return json({error:'Dropbox connection needs one-time setup.'},503);
      if (body.action === 'connect') {
        if (typeof body.code !== 'string' || !body.code || body.code.length > 2000 || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.verifier || '')) return json({error:'Invalid sign-in request.'},400);
        const tokens = await oauth({grant_type:'authorization_code',code:body.code,code_verifier:body.verifier,redirect_uri:REDIRECT});
        const account = await api(tokens.access_token,'users/get_current_account',null);
        if (account.account_id !== env('DROPBOX_OWNER_ACCOUNT_ID')) {
          await fetcher('https://api.dropboxapi.com/2/auth/token/revoke',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token}});
          return json({error:'This EOD app is restricted to its owner’s Dropbox account.'},403);
        }
        if (!tokens.refresh_token) throw Error('Dropbox did not grant a saved connection. Connect again.');
        // Verify the original file exists before replacing any saved connection.
        const file = await api(tokens.access_token,'files/get_metadata',{path:WORKBOOK});
        const encrypted = await crypt(tokens.refresh_token);
        await db('eod_dropbox_connection','on_conflict=id','POST',{id:1,account_id:account.account_id,refresh_encrypted:encrypted,file_id:file.id,updated_at:new Date(clock()).toISOString()});
        await db('eod_dropbox_sessions','expires_at=lt.'+encodeURIComponent(new Date(clock()).toISOString()),'DELETE');
        const session = hex(crypto.getRandomValues(new Uint8Array(32)));
        await db('eod_dropbox_sessions','','POST',{session_hash:await hash(session),account_id:account.account_id,expires_at:new Date(clock()+30*86400000).toISOString()});
        return json({connected:true,session,workbook:file.name});
      }
      if (!['status','download','disconnect'].includes(body.action)) return json({error:'Unknown action.'},400);
      const session = req.headers.get('x-eod-session') || '';
      if (!/^[0-9a-f]{64}$/.test(session)) return json({error:'Sign in to Dropbox first.'},401);
      const sessions = await db('eod_dropbox_sessions',`session_hash=eq.${await hash(session)}&expires_at=gt.${encodeURIComponent(new Date(clock()).toISOString())}&select=account_id`);
      if (sessions[0]?.account_id !== env('DROPBOX_OWNER_ACCOUNT_ID')) return json({error:'Sign in to Dropbox again.'},401);
      const connections = await db('eod_dropbox_connection','id=eq.1&select=account_id,refresh_encrypted,file_id');
      const connection = connections[0];
      if (connection?.account_id !== env('DROPBOX_OWNER_ACCOUNT_ID')) return json({error:'Connect Dropbox again.'},401);
      const tokens = await oauth({grant_type:'refresh_token',refresh_token:await crypt(connection.refresh_encrypted,true)});
      if (body.action === 'disconnect') {
        const revoked = await fetcher('https://api.dropboxapi.com/2/auth/token/revoke',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token}});
        if (!revoked.ok) throw Error('Dropbox could not revoke the connection. Try again.');
        await db('eod_dropbox_sessions','account_id=eq.'+encodeURIComponent(connection.account_id),'DELETE');
        await db('eod_dropbox_connection','id=eq.1','DELETE');
        return json({connected:false});
      }
      // Use the verified file ID so a renamed/moved workbook is still the same file.
      const file = await api(tokens.access_token,'files/get_metadata',{path:connection.file_id});
      if (body.action === 'status') return json({connected:true,workbook:file.name,modified:file.server_modified});
      const response = await fetcher('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token,'Dropbox-API-Arg':JSON.stringify({path:connection.file_id})}});
      if (!response.ok) throw Error('Workbook download failed.');
      return new Response(response.body,{headers:{...cors,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Tire Audit Worksheet Aaron McMullen.xlsx"'}});
    } catch { return json({error:'Dropbox connection failed. Check setup or reconnect. Your workbook has not been changed.'},400); }
  };
}
