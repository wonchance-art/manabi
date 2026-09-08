import {describe,it,expect} from 'vitest';
import {createOriginalPositionSession,originalSyncKey,positionSourceKey,validPositionLocator,originalPositionSources} from '../originalReadingPosition';
const owner='00000000-0000-4000-8000-000000000001',pdf={kind:'pdf',assetHash:'a'.repeat(64)},epub={kind:'epub',assetHash:'b'.repeat(64)},body={kind:'body',revision:null};
const sources=[body,pdf,epub],point={chapter:2,spinePath:'ch2.xhtml',spineIndex:1,offset:12};
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
let sequence=0;const uuid=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
function backend(){
 const rows=new Map(),writes=[];let head=null,offline=false,lose=false,pause=null;
 const client={rpc:(name,args)=>({abortSignal:async()=>{
  if(offline)return {error:{message:'offline'}};
  if(name==='get_original_reading_positions')return {data:{head,records:[...rows.values()].filter(r=>args.p_keys.includes(r.source_key))}};
  writes.push(args);if(pause){const wait=pause;pause=null;await wait;}
  const key=positionSourceKey(args.p_source),old=rows.get(key);
  if(old?.write_id===args.p_write)return {data:{saved:true,record:old,head}};
  if((head?.version||0)!==args.p_version)return {data:{saved:false,record:head}};
  head={owner_id:owner,material_id:1,source_key:key,source:args.p_source,locator:args.p_locator,version:(head?.version||0)+1,write_id:args.p_write};rows.set(key,head);
  if(lose){lose=false;return {error:{message:'lost response'}};}
  return {data:{saved:true,record:head,head}};
 }})};
 return {client,writes,rows,get head(){return head;},offline:value=>{offline=value;},lose:()=>{lose=true;},pause:promise=>{pause=promise;}};
}
function session(server,storage=memory(),extra={}){return createOriginalPositionSession({client:server.client,ownerId:owner,materialId:1,sources,storage,uuid,delay:100000,...extra});}

describe('account original reading positions',()=>{
 it('validates source/locator shape and keeps revised text and changed files separate',()=>{
  expect(positionSourceKey(body)).toBe('body:original');expect(positionSourceKey({kind:'body',revision:'bad'})).toBeNull();
  expect(validPositionLocator(pdf,{page:'2'})).toBeNull();expect(validPositionLocator(pdf,{page:1000000})).toBeNull();expect(validPositionLocator(epub,{...point,offset:-1})).toBeNull();
  expect(originalPositionSources({raw_text:'hello',processed_json:{metadata:{composer:{version:1,assets:[{kind:'pdf',hash:pdf.assetHash}]}}}})).toEqual([body,pdf]);
 });
 it('does not write on load/focus and another clean device restores the confirmed position',async()=>{
  const server=backend(),a=session(server),b=session(server);await a.refresh();await a.refresh();expect(server.writes).toHaveLength(0);
  a.record(pdf,{page:8});await a.flush();await b.refresh();expect(b.selected().locator.page).toBe(8);expect(b.snapshot().phase).toBe('synced');expect(server.writes).toHaveLength(1);a.dispose();b.dispose();
 });
 it('newer cloud records replace old acknowledged cache at entry without replaying it',async()=>{
  const server=backend(),storage=memory(),a=session(server,storage);await a.refresh();a.record(pdf,{page:4});await a.flush();a.dispose();
  const b=session(server);await b.refresh();b.record(pdf,{page:2});await b.flush();
  const returned=session(server,storage);await returned.refresh();expect(returned.selected().locator.page).toBe(2);expect(server.writes).toHaveLength(2);b.dispose();returned.dispose();
 });
 it('an already open device offers a newer position without writing or changing its local point',async()=>{
  const server=backend(),a=session(server),b=session(server);await a.refresh();a.record(pdf,{page:2});await a.flush();await b.refresh();
  a.record(pdf,{page:7});await a.flush();await b.refresh();expect(b.snapshot().phase).toBe('conflict');expect(b.snapshot().remote.locator.page).toBe(7);expect(server.writes).toHaveLength(2);
  const accepted=b.acceptRemote();expect(accepted.locator.page).toBe(7);expect(b.snapshot().phase).toBe('synced');expect(server.writes).toHaveLength(2);a.dispose();b.dispose();
 });
 it('rejects an offline PDF overwrite after another device read an EPUB and preserves the local draft',async()=>{
  const server=backend(),storage=memory(),a=session(server,storage);await a.refresh();a.record(pdf,{page:2});await a.flush();server.offline(true);
  a.record(pdf,{page:9});await a.flush();expect(a.snapshot().phase).toBe('offline');server.offline(false);
  const b=session(server);await b.refresh();b.record(epub,point);await b.flush();await a.refresh();
  expect(a.snapshot().phase).toBe('conflict');expect(a.snapshot().local[positionSourceKey(pdf)].locator.page).toBe(9);expect(server.head.source.kind).toBe('epub');
  a.keepCurrent(pdf,{page:9});await a.flush();expect(server.head.locator.page).toBe(9);expect(server.head.version).toBe(3);expect(server.rows.size).toBe(2);a.dispose();b.dispose();
 });
 it('choosing the remote position discards only the pending local location',async()=>{
  const server=backend(),a=session(server),b=session(server);await a.refresh();await b.refresh();a.record(pdf,{page:4});b.record(epub,point);await b.flush();await a.flush();
  expect(a.snapshot().phase).toBe('conflict');a.acceptRemote();await a.flush();expect(server.writes).toHaveLength(2);expect(server.head.source.kind).toBe('epub');expect(a.snapshot().pending).toBe(false);a.dispose();b.dispose();
 });
 it('lost response retry reuses the write id and never creates another revision',async()=>{
  const server=backend(),storage=memory(),a=session(server,storage);await a.refresh();server.lose();a.record(pdf,{page:5});await a.flush();expect(a.snapshot().phase).toBe('offline');
  const id=server.writes[0].p_write;await a.flush();expect(server.writes[1].p_write).toBe(id);expect(server.head.version).toBe(1);expect(a.snapshot().pending).toBe(false);a.dispose();
 });
 it('retrying an uncertain save through refresh recognizes its own acknowledgement without a conflict',async()=>{
  const server=backend(),a=session(server);await a.refresh();server.lose();a.record(body,{offset:12});await a.flush();expect(a.snapshot().phase).toBe('offline');
  await a.refresh();expect(a.snapshot().phase).toBe('synced');expect(a.snapshot().pending).toBe(false);expect(server.head.version).toBe(1);expect(server.writes).toHaveLength(1);a.dispose();
 });
 it('a reload recognizes a saved response that was lost and does not send it again',async()=>{
  const server=backend(),storage=memory(),a=session(server,storage);await a.refresh();server.lose();a.record(pdf,{page:5});await a.flush();
  const returned=session(server,storage);await returned.refresh();expect(server.writes).toHaveLength(1);expect(returned.snapshot().pending).toBe(false);expect(returned.selected().locator.page).toBe(5);
  // Dispose the old pending session only after its idempotent retry is safe.
  await a.flush();a.dispose();returned.dispose();
 });
 it('serializes a slow write and keeps only the latest queued location',async()=>{
  const server=backend(),a=session(server);await a.refresh();let release;server.pause(new Promise(resolve=>{release=resolve;}));
  a.record(pdf,{page:2});const saving=a.flush();await turn();a.record(pdf,{page:3});a.record(pdf,{page:4});expect(server.writes).toHaveLength(1);release();await saving;
  expect(server.writes.map(w=>w.p_locator.page)).toEqual([2,4]);expect(server.head.version).toBe(2);a.dispose();
 });
 it('an old acknowledgement does not authorize queued writes over a newer source',async()=>{
  const server=backend(),a=session(server);await a.refresh();server.lose();a.record(pdf,{page:2});await a.flush();a.record(pdf,{page:3});
  const b=session(server);await b.refresh();b.record(epub,point);await b.flush();await a.flush();
  expect(a.snapshot().phase).toBe('conflict');expect(a.snapshot().pending).toBe(true);expect(server.head.source.kind).toBe('epub');expect(server.head.version).toBe(2);a.acceptRemote();a.dispose();b.dispose();
 });
 it('failed initial load remains readable and retries a new offline location with version zero',async()=>{
  const server=backend(),a=session(server);server.offline(true);await a.refresh();expect(a.snapshot().ready).toBe(true);a.record(body,{offset:12});await a.flush();server.offline(false);await a.refresh();
  expect(a.snapshot().phase).toBe('synced');expect(server.head.locator.offset).toBe(12);expect(server.head.version).toBe(1);a.dispose();
 });
 it('server access works without local storage and reports that offline persistence is unavailable',async()=>{
  const server=backend(),a=session(server,{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});await a.refresh();a.record(pdf,{page:3});await a.flush();
  expect(a.snapshot().localAvailable).toBe(false);expect(a.snapshot().phase).toBe('synced');expect(server.head.locator.page).toBe(3);a.dispose();
 });
 it('an older closing tab cannot overwrite a newer reader’s shared pending cache',async()=>{
  const server=backend(),storage=memory(),a=session(server,storage);await a.refresh();let release;server.pause(new Promise(resolve=>{release=resolve;}));
  a.record(pdf,{page:2});const saving=a.flush();await turn();a.dispose();
  const b=session(server,storage);await b.refresh();b.record(pdf,{page:3});await b.flush();release();await saving;
  const cache=JSON.parse(storage.getItem(originalSyncKey(owner,1)));expect(cache.pending).toBeNull();expect(cache.local[positionSourceKey(pdf)].locator.page).toBe(3);expect(cache.head.version).toBe(2);b.dispose();
 });
 it('a late initial read after unmount cannot replace the new reader cache',async()=>{
  const server=backend(),storage=memory();let release;
  const slow={rpc:()=>({abortSignal:()=>new Promise(resolve=>{release=resolve;})})};
  const a=session(server,storage,{client:slow}),loading=a.refresh();a.dispose();
  const b=session(server,storage);await b.refresh();b.record(pdf,{page:5});await b.flush();release({data:{head:null,records:[]}});await loading;
  const cache=JSON.parse(storage.getItem(originalSyncKey(owner,1)));expect(cache.head.locator.page).toBe(5);expect(cache.pending).toBeNull();b.dispose();
 });
 it('ignores another account’s cached confirmed rows and unknown source revisions',async()=>{
  const server=backend(),storage=memory();storage.setItem(originalSyncKey(owner,1),JSON.stringify({version:1,records:[{owner_id:'other',material_id:1,source_key:positionSourceKey(pdf),source:pdf,locator:{page:7},version:1,write_id:uuid()}],local:{'body:bad':{source:{kind:'body',revision:'bad'},locator:{offset:1}}},lastKey:'body:bad'}));
  const a=session(server,storage);await a.refresh();expect(a.selected()).toBeNull();expect(a.snapshot().records).toEqual([]);a.dispose();
 });
});
