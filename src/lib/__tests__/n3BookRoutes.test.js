import { beforeEach, describe, expect, it, vi } from 'vitest';

const state=vi.hoisted(()=>({preview:false,published:true,hashMismatch:false,denied:false}));
const spies=vi.hoisted(()=>({reading:vi.fn(),sections:vi.fn(),stamp:vi.fn(),candidate:vi.fn(),asset:vi.fn(),admin:vi.fn(),publicClient:vi.fn()}));
const edition='c'.repeat(24);
const bundle={bookId:'japanese-n3',editionId:edition,contentHash:'d'.repeat(64),artifactManifest:{bundleHash:'e'.repeat(64),media:{pdf:false}},assets:{'fonts/JP.woff':{sha256:'f'.repeat(64),type:'font/woff'}}};
vi.mock('@/lib/server/bookReading',()=>({
 publishedReading:async(...args)=>{spies.reading(...args);if(state.denied)throw Object.assign(new Error('unpublished'),{status:404});return {book:bundle,preview:state.preview};},
 readingSections:async(...args)=>{spies.sections(...args);return [42,48].flatMap(number=>['start','study1','study2','practice'].map(part=>({id:`u${number}-${part}`,unit:`u${number}`,html:`<p>${number}</p>`})));},
}));
vi.mock('@/lib/supabaseServer',()=>({
 createSupabasePublicClient:()=>{spies.publicClient();return {publicOnly:true};},
 requireAdmin:async()=>{spies.admin();return {error:'login required',status:401};},
}));
vi.mock('@/lib/textbook/server',async original=>({...await original(),
 readEditionStamp:async(...args)=>{spies.stamp(...args);return state.published?{content_hash:state.hashMismatch?'a'.repeat(64):bundle.contentHash,artifact_manifest:bundle.artifactManifest}:null;},
 cachedCandidate:async(...args)=>{spies.candidate(...args);return bundle;},
}));
vi.mock('@/lib/textbook/assetFile',()=>({verifiedAsset:async(...args)=>{spies.asset(...args);return {bytes:new Uint8Array([1,2,3]),type:'font/woff'};}}));
import { GET as n3Reading } from '@/app/api/books/japanese-n3/[edition]/reading/route';
import { GET as n4Reading } from '@/app/api/books/japanese-n4/[edition]/reading/route';
import { GET as n5Reading } from '@/app/api/books/japanese-n5/[edition]/reading/route';
import { GET as n3Asset } from '@/app/api/books/japanese-n3/[edition]/asset/route';
const context=()=>({params:Promise.resolve({edition})});
const read=(unit,headers={})=>new Request(`https://local.invalid/api/books/japanese-n3/${edition}/reading?unit=${unit}&book=japanese-n4`,{headers});
const asset=(file)=>new Request(`https://local.invalid/api/books/japanese-n3/${edition}/asset?file=${encodeURIComponent(file)}`,{headers:{Cookie:'untrusted-session=ignored'}});
beforeEach(()=>{Object.assign(state,{preview:false,published:true,hashMismatch:false,denied:false});Object.values(spies).forEach(spy=>spy.mockClear());});

describe('N3 routes keep the trusted book context and existing publication cache boundaries',()=>{
 it('serves the final unit through the N3 wrapper despite a different book query parameter',async()=>{
  const response=await n3Reading(read('u48'),context());
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-cache');
  expect(response.headers.has('set-cookie')).toBe(false);
  expect((await response.json()).sections).toHaveLength(4);
  expect(spies.reading).toHaveBeenCalledWith(edition,true,'japanese-n3');
  expect(spies.sections).toHaveBeenCalledWith(edition,'japanese-n3');
 });
 it('cannot widen the older books or accept N3 units beyond its own end',async()=>{
  expect((await n4Reading(read('u43'),context())).status).toBe(400);
  expect((await n5Reading(read('u43'),context())).status).toBe(400);
  expect((await n3Reading(read('u49'),context())).status).toBe(400);
  expect((await n3Reading(read('u48-practice'),context())).status).toBe(400);
  expect((await n5Reading(read('u42'),context())).status).toBe(200);
 });
 it('revalidates the publication before returning 304 and never caches a preview publicly',async()=>{
  const first=await n3Reading(read('u48'),context()),etag=first.headers.get('etag');
  expect((await n3Reading(read('u48',{'If-None-Match':etag}),context())).status).toBe(304);
  state.preview=true;
  const preview=await n3Reading(read('u48',{'If-None-Match':etag}),context());
  expect(preview.status).toBe(200);expect(preview.headers.get('cache-control')).toBe('private, no-store');
  state.denied=true;
  const denied=await n3Reading(read('u48',{'If-None-Match':etag}),context());
  expect(denied.status).toBe(404);expect(denied.headers.get('cache-control')).toBe('private, no-store');
 });
 it('serves N3 fonts using the cookie-free public lookup and N3 edition identity',async()=>{
  const response=await n3Asset(asset('fonts/JP.woff'),context());
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(spies.stamp).toHaveBeenCalledWith({publicOnly:true},edition,'japanese-n3');
  expect(spies.candidate).toHaveBeenCalledWith(edition,'japanese-n3');
  expect(spies.admin).not.toHaveBeenCalled();
 });
 it('rejects inherited asset keys and unpublished/mismatched N3 assets before disk access',async()=>{
  for(const file of ['__proto__','constructor','toString'])expect((await n3Asset(asset(file),context())).status).toBe(404);
  expect(spies.asset).not.toHaveBeenCalled();
  state.hashMismatch=true;
  expect((await n3Asset(asset('fonts/JP.woff'),context())).status).toBe(503);
  expect(spies.asset).not.toHaveBeenCalled();
  state.hashMismatch=false;state.published=false;
  expect((await n3Asset(asset('fonts/JP.woff'),context())).status).toBe(401);
  expect(spies.asset).not.toHaveBeenCalled();
 });
});
