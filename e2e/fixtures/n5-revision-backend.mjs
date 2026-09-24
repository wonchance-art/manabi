// Local, synthetic roles only. Does not contact Supabase or use real credentials.
import http from 'node:http';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const revision='e44cd7230ef94ff7f6293e2d';
const base=JSON.parse(fs.readFileSync(new URL('../../src/content/textbookEditions/7f572327dc67893e9453246c/bundle.json',import.meta.url),'utf8'));
const uid='00000000-0000-4000-8000-000000000042';
export function fixtureSession(role='admin'){
 const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const user={id:uid,email:'n5-fixture@example.invalid',email_confirmed_at:'2026-09-25T00:00:00Z',aud:'authenticated',role:'authenticated',user_metadata:{name:'교재 검수'},app_metadata:{provider:'email'},created_at:'2026-09-25T00:00:00Z'};
 const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,role,exp:now+86400,iat:now})}.synthetic`,refresh_token:'local-fixture',expires_at:now+86400,expires_in:86400,token_type:'bearer'};
 return 'base64-'+enc(session);
}
export function revisionBackend({port=48992,app='http://127.0.0.1:48991'}={}){
 const writes=[];
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  const send=(data,status=200)=>{res.writeHead(status,headers);res.end(JSON.stringify(data));};
  if(req.method==='OPTIONS'){res.writeHead(204,headers);return res.end();}
  if(url.pathname==='/__qa'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
   return res.end('<html lang="ko"><h1>로컬 교재 검수</h1><p>실제 계정·DB를 사용하지 않는 합성 관리자입니다.</p><a href="/__qa/login">개정 교재 열기</a></html>');
  }
  if(url.pathname==='/__qa/login'){
   res.writeHead(302,{'Set-Cookie':`sb-127-auth-token=${fixtureSession()}; Path=/; SameSite=Lax`,Location:`${app}/books/japanese-n5?edition=${revision}#u42-route`});return res.end();
  }
  let role='guest';
  try{role=JSON.parse(Buffer.from((req.headers.authorization||'').split('.')[1],'base64url')).role;}catch{/* anonymous */}
  if(url.pathname==='/auth/v1/user'){
   if(role==='guest')return send({message:'no local session'},401);
   return send({id:uid,email:'n5-fixture@example.invalid',email_confirmed_at:'2026-09-25T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{name:'교재 검수'}});
  }
  // An explicit visit to the original published edition logs only that read.
  if(req.method==='POST'&&url.pathname==='/rest/v1/library_reading_activity'){
   let raw='';req.on('data',chunk=>{raw+=chunk;});req.on('end',()=>{
    const body=JSON.parse(raw);writes.push({method:req.method,path:url.pathname,body});
    if(body.owner_id!==uid||body.target_kind!=='edition'||body.target_id!==base.editionId)return send({message:'unexpected read event'},400);
    send(body);
   });return;
  }
  if(req.method!=='GET'&&!(url.pathname==='/rest/v1/rpc/is_admin'&&req.method==='POST')){writes.push({method:req.method,path:url.pathname});return send({message:'fixture is read only'},405);}
  if(url.pathname==='/rest/v1/rpc/is_admin')return send(role==='admin');
  if(url.pathname==='/rest/v1/textbook_book_releases')return send({book_id:'japanese-n5',edition_id:base.editionId,version:1});
  if(url.pathname==='/rest/v1/textbook_book_editions'){
   const id=url.searchParams.get('edition_id')?.replace(/^eq\./,'');
   return send(id===base.editionId?{book_id:'japanese-n5',edition_id:id,content_hash:base.contentHash,artifact_manifest:base.artifactManifest,manuscript:base.manuscript}:null);
  }
  if(url.pathname==='/rest/v1/profiles')return send({id:uid,role:role==='admin'?'admin':'student',display_name:'교재 검수',last_login_at:new Date().toISOString(),streak_count:1,avatar_url:null});
  if(url.pathname.startsWith('/rest/v1/'))return send(req.headers.accept?.includes('vnd.pgrst.object')?null:[]);
  return send({message:'unknown fixture route'},404);
 });
 return {server,writes,start:()=>new Promise(resolve=>server.listen(port,'127.0.0.1',resolve)),close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const fixture=revisionBackend();await fixture.start();console.log('N5 synthetic backend ready on 48992');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await fixture.close();process.exit(0);});
}
