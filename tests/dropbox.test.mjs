import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,WORKBOOK} from '../supabase/functions/eod-dropbox/handler.mjs';
import {consumePending} from '../dropbox-auth.mjs';
const vars={DROPBOX_APP_KEY:'public-key',DROPBOX_OWNER_ACCOUNT_ID:'dbid:owner',DROPBOX_TOKEN_ENCRYPTION_KEY:btoa('a'.repeat(32)),SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-secret'};
const post=(action,extra={},session)=>new Request('https://test/functions/v1/eod-dropbox',{method:'POST',headers:{origin:'https://jtczy6pfmy.github.io','Content-Type':'application/json',...(session?{'x-eod-session':session}:{})},body:JSON.stringify({action,...extra})});
const json=data=>Response.json(data);
test('unconfigured backend fails closed without contacting Dropbox or DB',async()=>{
  const handler=createHandler({env:()=>undefined,fetcher:()=>{throw Error('Unexpected fetch');}});
  assert.equal((await (await handler(post('config'))).json()).configured,false);
  assert.equal((await handler(post('connect',{code:'x',verifier:'v'.repeat(43)}))).status,503);
});
test('owner mismatch never stores a connection',async()=>{
  const calls=[];const handler=createHandler({env:k=>vars[k],fetcher:async(url)=>{calls.push(url);if(url.endsWith('/oauth2/token'))return json({access_token:'dropbox-private',refresh_token:'refresh-private'});if(url.endsWith('users/get_current_account'))return json({account_id:'dbid:someone-else'});if(url.endsWith('token/revoke'))return new Response(null,{status:200});throw Error('Unexpected call');}});
  assert.equal((await handler(post('connect',{code:'x',verifier:'v'.repeat(43)}))).status,403);
  assert.equal(calls.some(url=>url.includes('/rest/v1/')),false);
});
test('valid owner connection encrypts refresh token, hashes session, never returns Dropbox credentials',async()=>{
  const writes=[];
  const handler=createHandler({env:k=>vars[k],fetcher:async(url,options)=>{
    if(url.endsWith('/oauth2/token'))return json({access_token:'dropbox-private',refresh_token:'refresh-private'});
    if(url.endsWith('users/get_current_account'))return json({account_id:'dbid:owner'});
    if(url.endsWith('files/get_metadata')){assert.equal(JSON.parse(options.body).path,WORKBOOK);return json({id:'id:original',name:'Tire Audit Worksheet Aaron McMullen.xlsx'});}
    if(url.includes('/rest/v1/')){if(options.body)writes.push(JSON.parse(options.body));return json([]);}
    throw Error('Unexpected call');
  }});
  const response=await handler(post('connect',{code:'x',verifier:'v'.repeat(43)}));
  assert.equal(response.status,200);const result=await response.json();
  assert.match(result.session,/^[a-f0-9]{64}$/);
  assert.notEqual(writes[0].refresh_encrypted,'refresh-private');
  assert.equal(writes[0].refresh_encrypted.includes('refresh-private'),false);
  assert.notEqual(writes[1].session_hash,result.session);
  assert.equal(JSON.stringify(result).includes('dropbox-private'),false);
  assert.equal(JSON.stringify(result).includes('refresh-private'),false);
});
test('missing or expired sessions cannot download a workbook',async()=>{
  const handler=createHandler({env:k=>vars[k],fetcher:async url=>{assert.match(url,/eod_dropbox_sessions/);assert.match(url,/expires_at=gt/);return json([]);}});
  assert.equal((await handler(post('download'))).status,401);
  assert.equal((await handler(post('download',{},'a'.repeat(64)))).status,401);
});
test('OAuth state mismatch, expiry, and replay are rejected',()=>{
  const now=1000000;let raw=JSON.stringify({state:'expected',verifier:'v'.repeat(43),created:now});
  const storage={getItem:()=>raw,removeItem:()=>{raw=null;}};
  assert.throws(()=>consumePending('?code=x&state=wrong',storage,now));assert.equal(raw,null);
  raw=JSON.stringify({state:'expected',created:0});assert.throws(()=>consumePending('?code=x&state=expected',storage,now));
  raw=JSON.stringify({state:'expected',verifier:'v'.repeat(43),created:now});assert.equal(consumePending('?code=x&state=expected',storage,now).code,'x');
  assert.throws(()=>consumePending('?code=x&state=expected',storage,now));
});
test('unexpected origins and upload actions are rejected',async()=>{
  const handler=createHandler({env:k=>vars[k],fetcher:()=>{throw Error('Unexpected call');}});
  assert.equal((await handler(new Request('https://test',{method:'POST',headers:{origin:'https://other.example'},body:'{}'}))).status,403);
  assert.equal((await handler(post('upload'))).status,400);
});
