import { describe, it, expect } from 'vitest';
import { createComposerSave, newComposerDraft, shouldReadComposerOriginal, removeComposerOriginals } from '../materialComposer';
import { createDocumentSave, documentOf, documentListRow, editDraft, editableMaterial, isStudySnapshot, openDocumentStudy, readEditableMaterial, saveDocumentOnce } from '../materialDocument';
import { sourceHref, tokenContext } from '../learningSources';
const owner = '00000000-0000-4000-8000-000000000123';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const file = { name:'reading.pdf',hash:'a'.repeat(64),kind:'pdf',size:10,type:'application/pdf',blob:new Blob(['%PDF-file']) };
function original() {
  const save = createComposerSave(owner,{...newComposerDraft(uuid(1)),title:'Before',body:'Hello.\nOriginal line.',language:'English',files:[file]});
  return {...save.attempt.row,id:42,document_json:null};
}
function backend(seed=original()) {
  const rows=[structuredClone(seed)], writes=[], uploads=[];
  let lose=false, failRead=false, conflict=false;
  const pathValue=(row,key)=> key==='document_json->>revision' ? row.document_json?.revision : key.includes('importAttempt') ? row.processed_json.metadata.importAttempt : row[key];
  const client={storage:{from(){return {list:async()=>({data:[{name:`${file.hash}.pdf`,metadata:{size:file.size}}]}),upload:async(path)=>{uploads.push(path);return{};},remove:async(paths)=>{uploads.push(...paths);return{};}};}},from(){
    let mode='read',patch,filters=[],single=false;
    const chain={select(){return chain;},eq(k,v){filters.push(r=>typeof pathValue(r,k)==='object'?JSON.stringify(pathValue(r,k))===v:String(pathValue(r,k))===String(v));return chain;},is(k,v){filters.push(r=>pathValue(r,k)===v);return chain;},limit(){return chain;},maybeSingle(){single=true;return chain;},update(v){mode='update';patch=v;return chain;},insert(v){mode='insert';patch=v[0];return chain;},then(resolve,reject){return Promise.resolve().then(()=>{
      if(mode==='read'&&failRead)throw new Error('offline');
      if(mode==='update'&&conflict){conflict=false;rows[0].document_json={...documentOf(rows[0]),revision:uuid(99),body:'Other device'};}
      let found=rows.filter(r=>filters.every(f=>f(r)));
      if(mode==='update'){found.forEach(r=>Object.assign(r,structuredClone(patch)));writes.push(patch);}
      if(mode==='insert'){
        if(rows.some(r=>r.processed_json.metadata.importAttempt===patch.processed_json.metadata.importAttempt))return {error:{code:'23505'}};
        const row={...structuredClone(patch),id:rows.length+42};rows.push(row);found=[row];writes.push(patch);
      }
      if(mode!=='read'&&lose){lose=false;throw new Error('lost reply');}
      return {data:single?structuredClone(found[0]||null):structuredClone(found)};
    }).then(resolve,reject);}};return chain;
  }};
  return {client,rows,writes,uploads,lose:()=>{lose=true;},failRead:()=>{failRead=true;},conflict:()=>{conflict=true;}};
}
const edited=(row,id=uuid(2))=>({...editDraft(row,id),title:'After',body:'Bonjour.\n\nNew line.',language:'French'});

describe('saved document edits',()=>{
 it('maps list summaries without fetching or inventing a current body',()=>{
  const row=documentListRow({...original(),document_revision:uuid(5),document_language:'French',document_excerpt:'new preview',document_assets:[],document_has_body:true});
  expect(documentOf(row)).toMatchObject({revision:uuid(5),language:'French',excerpt:'new preview',hasBody:true});
  expect(documentOf(row).body).toBeUndefined();
 });
 it('reads v1 originals and restricts editing to private owned composer documents',()=>{
  const row=original();expect(documentOf(row).body).toBe(row.raw_text);expect(editableMaterial(row,owner)).toBe(true);
  expect(editableMaterial(row,'another')).toBe(false);expect(editableMaterial({...row,visibility:'public'},owner)).toBe(false);
  expect(documentOf({raw_text:'legacy'})).toBeNull();
 });
 it('updates current title/body/language without changing original text, tokens, edition or expression source',async()=>{
  const row=original();row.processed_json.sequence=['id_0_0'];row.processed_json.dictionary={id_0_0:{text:'Hello'}};
  const db=backend(row),before=structuredClone(db.rows[0]);
  await saveDocumentOnce(db.client,createDocumentSave(owner,edited(row)));
  expect(db.rows[0].raw_text).toBe(before.raw_text);expect(db.rows[0].processed_json).toEqual(before.processed_json);
  const source = {kind:'reading',material_id:42,locator:{tokenId:'id_0_0',surface:'Hello'}};
  expect(sourceHref(source)).toBe('/viewer/42?sourceToken=id_0_0&sourceText=Hello');
  expect(tokenContext(db.rows[0].processed_json,'id_0_0').quote).toBe('Hello');
  expect(documentOf(db.rows[0])).toMatchObject({body:'Bonjour.\n\nNew line.',language:'French',revision:uuid(2)});
  expect(Object.keys(db.writes[0]).sort()).toEqual(['document_json','title']);
  expect(shouldReadComposerOriginal(db.rows[0],new URLSearchParams('sourceToken=id_0_0&sourceText=Hello'))).toBe(false);
 });
 it('keeps detached originals available for cleanup, and does not delete them while editing',async()=>{
  const db=backend(),draft={...edited(db.rows[0]),files:[]};
  await saveDocumentOnce(db.client,createDocumentSave(owner,draft));
  expect(db.rows[0].document_json.assets).toEqual([]);expect(db.rows[0].document_json.retainedAssets).toHaveLength(1);expect(db.uploads).toEqual([]);
  await removeComposerOriginals(db.client,db.rows[0]);expect(db.uploads).toEqual([original().processed_json.metadata.composer.assets[0].path]);
 });
 it('reuses attachment bytes and serializes double submit',async()=>{
  const db=backend(),save=createDocumentSave(owner,edited(db.rows[0]));
  await Promise.all([saveDocumentOnce(db.client,save),saveDocumentOnce(db.client,save)]);
  expect(db.uploads).toEqual([]);expect(db.writes).toHaveLength(1);
 });
 it('reconciles a lost response after refresh without overwriting newer analysis',async()=>{
  const db=backend(),draft=edited(db.rows[0]);db.lose();
  await expect(saveDocumentOnce(db.client,createDocumentSave(owner,draft))).rejects.toThrow('lost reply');
  db.rows[0].processed_json.status='completed';
  await saveDocumentOnce(db.client,createDocumentSave(owner,draft));
  expect(db.writes).toHaveLength(1);expect(db.rows[0].processed_json.status).toBe('completed');
 });
 it('rejects a stale draft before upload',async()=>{
  const db=backend(),old=edited(db.rows[0],uuid(3));
  await saveDocumentOnce(db.client,createDocumentSave(owner,edited(db.rows[0])));
  await expect(saveDocumentOnce(db.client,createDocumentSave(owner,old))).rejects.toThrow('EDIT_CONFLICT');expect(db.writes).toHaveLength(1);
 });
 it('compares revision in the write itself when a second writer wins after the initial read',async()=>{
  const db=backend(),draft=edited(db.rows[0]);db.conflict();
  await expect(saveDocumentOnce(db.client,createDocumentSave(owner,draft))).rejects.toThrow('EDIT_CONFLICT');
  expect(db.rows[0].document_json.body).toBe('Other device');
 });
 it('requires owner, existing document and schema before any upload or mutation',async()=>{
  const db=backend();await expect(readEditableMaterial(db.client,42,'another')).rejects.toThrow('MATERIAL_NOT_EDITABLE');
  await expect(readEditableMaterial(db.client,99,owner)).rejects.toThrow('MATERIAL_NOT_EDITABLE');
  delete db.rows[0].document_json;
  await expect(saveDocumentOnce(db.client,createDocumentSave(owner,edited(db.rows[0])))).rejects.toThrow('EDIT_SCHEMA_PENDING');
  expect(db.writes).toEqual([]);expect(db.uploads).toEqual([]);
 });
 it('does not mutate when reconciliation read fails',async()=>{
  const db=backend(),draft=edited(db.rows[0]);db.failRead();
  await expect(saveDocumentOnce(db.client,createDocumentSave(owner,draft))).rejects.toThrow('offline');expect(db.writes).toEqual([]);
 });
 it('uploads new originals only under the established owner/import/hash namespace',async()=>{
  const db=backend(),draft={...edited(db.rows[0]),files:[{...file,hash:'b'.repeat(64)}]};
  await saveDocumentOnce(db.client,createDocumentSave(owner,draft));
  expect(db.uploads).toEqual([`${owner}/${uuid(1)}/${'b'.repeat(64)}.pdf`]);expect(documentOf(db.rows[0]).retainedAssets).toHaveLength(1);
 });
});

describe('learning source snapshots',()=>{
 it('keeps the existing learning material for unchanged text/language',async()=>{
  const db=backend();expect((await openDocumentStudy(db.client,db.rows[0],'English')).id).toBe(42);expect(db.writes).toEqual([]);
 });
 it('creates one private learning source for changed text, reuses it after title-only edits, and keeps old tokens',async()=>{
  const db=backend();const before=structuredClone(db.rows[0]);
  await saveDocumentOnce(db.client,createDocumentSave(owner,edited(db.rows[0])));
  const first=await openDocumentStudy(db.client,db.rows[0],'French');const again=await openDocumentStudy(db.client,db.rows[0],'French');
  expect(first.id).toBe(again.id);expect(db.rows).toHaveLength(2);expect(db.rows[0].raw_text).toBe(before.raw_text);
  expect(first).toMatchObject({raw_text:'Bonjour.\n\nNew line.',owner_id:owner,visibility:'private',processed_json:{metadata:{composer:{parentId:'42',role:'study'}}}});
  expect(isStudySnapshot(first)).toBe(true);expect(editableMaterial(first,owner)).toBe(false);expect(shouldReadComposerOriginal(first,new URLSearchParams())).toBe(false);
  const title={...editDraft(db.rows[0],uuid(4)),title:'Title only'};await saveDocumentOnce(db.client,createDocumentSave(owner,title));
  expect((await openDocumentStudy(db.client,db.rows[0],'French')).id).toBe(first.id);expect(db.rows).toHaveLength(2);
 });
 it('does not mix different study languages',async()=>{
  const db=backend();const first=await openDocumentStudy(db.client,db.rows[0],'French');
  expect(first.id).not.toBe(42);expect(db.rows[0].processed_json.metadata.language).toBe('English');
 });
 it('preserves the first unclassified source address using exact analysis JSON comparison',async()=>{
  const row=original();row.processed_json.metadata.language=null;const db=backend(row);
  const first=await openDocumentStudy(db.client,db.rows[0],'French');expect(first.id).toBe(42);expect(db.rows).toHaveLength(1);
  expect(db.rows[0].processed_json.metadata.language).toBe('French');
 });
 it('reconciles a lost snapshot insert and never analyzes or grades automatically',async()=>{
  const db=backend();db.lose();await expect(openDocumentStudy(db.client,db.rows[0],'French')).rejects.toThrow('lost reply');
  const row=await openDocumentStudy(db.client,db.rows[0],'French');expect(db.rows).toHaveLength(2);expect(row.id).toBe(43);
  expect(row.processed_json.status).toBe('pending');
 });
 it('does not study stale or empty current text',async()=>{
  const db=backend(),stale=structuredClone(db.rows[0]);await saveDocumentOnce(db.client,createDocumentSave(owner,edited(db.rows[0])));
  await expect(openDocumentStudy(db.client,stale,'English')).rejects.toThrow('EDIT_CONFLICT');
  db.rows[0].document_json.body='';await expect(openDocumentStudy(db.client,db.rows[0],'French')).rejects.toThrow('BODY_REQUIRED');
 });
});
