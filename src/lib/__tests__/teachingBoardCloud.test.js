import {describe,it,expect} from 'vitest';
import {emptyBoard} from '../teachingBoard';
import {cloudDocument,packBoard,unpackBoard,sameBoardContent,validateBoardManifest,restoreBoardCamera,validBoardDay,boardCloudLabel,cloudBoardScope} from '../teachingBoardCloud';
const note=()=>({...emptyBoard('page-1'),accountBoard:{revision:'secret',dirty:true}});
describe('private teacher board snapshots',()=>{
 it('stores only board semantics and does not sync viewport or local account state',()=>{
  const board=note();board.pages[0].camera.scrollX=900;const cloud=cloudDocument(board);
  expect(cloud.accountBoard).toBeUndefined();expect(cloud.pages[0].camera.scrollX).toBe(0);expect(sameBoardContent(board,emptyBoard('page-1'))).toBe(true);
  expect(restoreBoardCamera(cloud,board).pages[0].camera.scrollX).toBe(900);
 });
 it('uses deterministic immutable page hashes and validates them on restore',async()=>{
  const packed=await packBoard(note());expect(await packBoard(note())).toEqual(packed);
  expect(await unpackBoard(packed.manifest,p=>packed.files.find(x=>x.hash===p.hash).text)).toEqual(cloudDocument(note()));
  await expect(unpackBoard(packed.manifest,()=>packed.files[0].text+' ')).rejects.toThrow('확인');
 });
 it('deduplicates identical pages without changing their identity',async()=>{
  const b=note();b.pages.push({...b.pages[0],id:'other'});const a=await packBoard(b);b.pages[1].camera.scrollY=100;
  expect((await packBoard(b)).files.map(p=>p.hash)).toEqual(a.files.map(p=>p.hash));expect(a.files[0].hash).not.toEqual(a.files[1].hash);
 });
 it('rejects mismatched page identity, duplicate pages, missing active page and oversized manifests',async()=>{
  const p=await packBoard(note());
  for(const manifest of [{...p.manifest,activePage:'missing'},{...p.manifest,pages:[...p.manifest.pages,...p.manifest.pages]},{...p.manifest,pages:[{...p.manifest.pages[0],bytes:6291457}]},{...p.manifest,pages:[{...p.manifest.pages[0],hash:'../other'}]}])expect(()=>validateBoardManifest(manifest)).toThrow();
  await expect(unpackBoard({...p.manifest,activePage:'other',pages:[{...p.manifest.pages[0],id:'other'}]},()=>p.files[0].text)).rejects.toThrow('일치');
 });
 it('keeps existing boards larger than the personal-note limit without sending JSON through the API',async()=>{
  const b=note();b.pages[0].elements=[{id:'large',type:'text',x:0,y:0,width:100,height:100,fontSize:20,text:'한'.repeat(1100000)}];
  const p=await packBoard(b);expect(p.files[0].bytes).toBeGreaterThan(3*1024*1024);expect(JSON.stringify(p.manifest).length).toBeLessThan(1000);
  expect((await unpackBoard(p.manifest,()=>p.files[0].text)).pages[0].elements[0].text.length).toBe(1100000);
 });
 it('round-trips twenty pages without changing the existing page limit',async()=>{const b=note();b.pages=Array.from({length:20},(_,i)=>({id:`p${i}`,elements:[],camera:{scrollX:0,scrollY:0,zoom:{value:1}}}));b.activePage='p19';const packed=await packBoard(b);expect((await unpackBoard(packed.manifest,p=>packed.files.find(x=>x.hash===p.hash).text)).pages).toHaveLength(20);b.pages.push({...b.pages[0],id:'p20'});await expect(packBoard(b)).rejects.toThrow();});
 it('requires valid calendar dates and scopes by the stable root, account, and day',()=>{
  expect(validBoardDay('2026-02-30')).toBe(false);expect(validBoardDay('2024-02-29')).toBe(true);
  expect(cloudBoardScope('a',10,'2026-09-16')).not.toBe(cloudBoardScope('b',10,'2026-09-16'));
 });
 it('never claims account or local persistence on failure without a confirmed copy',()=>{
  expect(boardCloudLabel({error:'fail'})).toBe('저장 확인 필요');
  expect(boardCloudLabel({error:'fail',localSaved:true})).toContain('이 기기에 보관됨');
  expect(boardCloudLabel({cloudSaved:true})).toBe('계정에 저장됨');
 });
});
