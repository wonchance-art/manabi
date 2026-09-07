// Synthetic local backend only; it cannot contact production or alter personal records.
// Start the E2E build/server with e2e/server-fetch-mock.mjs, then set COMPOSER_BASE_URL.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import config from '../../playwright.config.mjs';
const baseURL = process.env.COMPOSER_BASE_URL || 'http://localhost:8872';
assert.ok(['127.0.0.1','localhost'].includes(new URL(baseURL).hostname));
const screenshots = process.env.COMPOSER_SCREENSHOTS;
let browser;
const owner = '00000000-0000-4000-8000-000000000172';
const bytes = Object.fromEntries(await Promise.all(['pdf','epub'].map(async kind=>[kind,await readFile(new URL(`./composer/reading.${kind}`,import.meta.url))])));
const hashBytes = new Map(Object.entries(bytes).map(([kind,buffer])=>[createHash('sha256').update(buffer).digest('hex'),{kind,buffer}]));
before(async()=>{ browser=await chromium.launch(config.use.launchOptions);if(screenshots)await mkdir(screenshots,{recursive:true}); });
after(async()=>{await browser?.close();});

export async function fixture({width=1440,guest=false,schema=true}={}) {
 const context=await browser.newContext({baseURL,viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 const now=Math.floor(Date.now()/1000), user={id:owner,aud:'authenticated',role:'authenticated',email:'composer-fixture@example.com',email_confirmed_at:new Date().toISOString(),confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'E2E 학습자'},created_at:new Date().toISOString()};
 const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const session={access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:owner,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})}.e2e`,refresh_token:'e2e-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer',user};
 if(!guest)await context.addCookies([{name:'sb-e2e-auth-token',value:`base64-${enc(session)}`,url:baseURL,sameSite:'Lax'}]);
 const rows=[], objects=new Map(), errors=[];
 let failNextInsert=false,loseNextReply=false,failUpload=false,analysisCalls=0,loseEdit=false,failEdit=false;
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS,HEAD','access-control-expose-headers':'content-range'};
 const json=(route,value,status=200,extra={})=>route.fulfill({status,contentType:'application/json',headers:{...cors,...extra},body:JSON.stringify(value)});
 await context.route('**/auth/v1/**',r=>json(r,new URL(r.request().url()).pathname.endsWith('/user')?user:session));
 await context.route('**/api/analyze',r=>{analysisCalls++;return json(r,{error:'NO_AUTOMATIC_ANALYSIS'},500);});
 await context.route('**/rest/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(table==='profiles')return json(route,{id:owner,display_name:'E2E 학습자',role:'learner',onboarded:true,last_login_at:new Date().toISOString(),streak_count:1});
  if(table==='reading_materials'){
   if(req.method()==='POST'){
    if(failNextInsert){failNextInsert=false;return json(route,{message:'fixture write failure'},503);}
    const input=req.postDataJSON();const payload=Array.isArray(input)?input[0]:input;
    const duplicate=rows.find(row=>row.processed_json.metadata.importAttempt===payload.processed_json.metadata.importAttempt);
    if(duplicate)return json(route,{code:'23505'},409);
    const row={...(schema?{document_json:null}:{}),...payload,id:94000+rows.length,created_at:new Date().toISOString()};rows.push(row);
    if(loseNextReply){loseNextReply=false;return route.abort('failed');}
    return json(route,[{id:row.id}]);
   }
   let found=rows.filter(row=>[...url.searchParams].every(([key,value])=>{
    if(value==='is.null')return row[key]===null;
    if(!value.startsWith('eq.'))return true;
    if(key==='document_json->>revision')return row.document_json?.revision===value.slice(3);
    if(key.includes('importAttempt'))return row.processed_json.metadata.importAttempt===value.slice(3);
    if(key==='processed_json')return JSON.stringify(row.processed_json)===value.slice(3);
    return String(row[key])===value.slice(3);
   }));
   if(req.method()==='PATCH'){if(failEdit){failEdit=false;return json(route,{message:'write unavailable'},503);}found.forEach(row=>Object.assign(row,req.postDataJSON()));if(loseEdit){loseEdit=false;return route.abort('failed');}return json(route,found.map(row=>({id:row.id})));}
   if(req.method()==='HEAD')return route.fulfill({status:200,headers:{...cors,'content-range':`0-${Math.max(0,found.length-1)}/${found.length}`}});
   return json(route,req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found);
  }
  if(req.method()==='HEAD')return route.fulfill({status:200,headers:{...cors,'content-range':'*/0'}});
  return json(route,[]);
 });
 await context.route('**/storage/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(p.includes('/object/list/')){
   const {prefix}=req.postDataJSON();return json(route,[...objects].filter(([path])=>path.startsWith(prefix+'/')).map(([path,file])=>({name:path.split('/').pop(),metadata:{size:file.buffer.length}})));
  }
  if(p.includes('/object/sign/')&&req.method()==='POST')return json(route,{signedURL:`/object/sign/material-originals/${p.split('/material-originals/')[1]}?token=fixture`});
  const path=p.split('/material-originals/')[1],hash=path?.split('/').pop()?.split('.')[0];
  if(req.method()==='POST'){
   if(failUpload)return json(route,{message:'fixture upload failure'},503);
   objects.set(path,hashBytes.get(hash));return json(route,{Key:path});
  }
  const file=objects.get(path);
  return file?route.fulfill({status:200,headers:cors,contentType:file.kind==='pdf'?'application/pdf':'application/epub+zip',body:file.buffer}):json(route,{error:'missing original'},404);
 });
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push(err.message));
 page.on('dialog',dialog=>dialog.accept());
 return {context,page,rows,objects,errors,loseEdit:()=>{loseEdit=true;},failEdit:()=>{failEdit=true;},get analysisCalls(){return analysisCalls;},lose:()=>{loseNextReply=true;},failInsert:()=>{failNextInsert=true;},failUpload:()=>{failUpload=true;}};
}
