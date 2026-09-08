import {describe,it,expect} from 'vitest';
import {libraryResume,materialActivity,originalPositionKey,legacyPdfPositionKey,recordLibraryOpen} from '../libraryActivity';
const owner='own',hash='a'.repeat(64);
const storage=values=>({getItem:key=>values[key]??null});
describe('reading context is separate from progress and grading',()=>{
 it('returns the study child with its stable source instead of current writing',()=>{
  const source={id:222,owner_id:owner,processed_json:{metadata:{composer:{role:'study',parentId:'221'}}}};
  expect(materialActivity(source,'study')).toEqual({target_kind:'material',target_id:'221',context:{materialId:'222',mode:'study'}});
  expect(libraryResume({target_kind:'material',target_id:'221',context:{materialId:'222',mode:'study'}},owner,storage({}))).toEqual({href:'/viewer/222?study=1',label:'학습하던 본문'});
 });
 it('reopens the immutable selected source, including retained attachments, without rewriting position',()=>{
  const row={target_kind:'material',target_id:'221',context:{materialId:'224',mode:'original'}};
  expect(libraryResume(row,owner,storage({}))).toEqual({href:'/viewer/221?passage=224',label:'원본의 학습 구간 열기'});
 });
 it('asks the original reader for the account position instead of forcing an older device attachment',()=>{
  const row={target_kind:'material',target_id:'221',assets:[{hash,kind:'epub'}],context:{materialId:'221',mode:'original',assetHash:hash}};
  expect(libraryResume(row,owner,storage({[originalPositionKey(owner,'221',hash)]:'3'}))).toEqual({href:`/viewer/221?resume=1&asset=${hash}`,label:'읽던 위치에서 이어 읽기'});
 });
 it('restores the exact attachment hash and account-local location',()=>{
  const row={target_kind:'material',target_id:'221',assets:[{hash,kind:'epub'}],context:{assetHash:hash}};
  expect(libraryResume(row,owner,storage({[originalPositionKey(owner,'221',hash)]:'3'}))).toEqual({href:`/viewer/221?asset=${hash}`,label:'3장부터 · 이 기기'});
  expect(libraryResume(row,'other',storage({[originalPositionKey(owner,'221',hash)]:'3'})).label).toBe('첨부 원본 열기');
 });
 it('does not apply a replaced file position to a new file',()=>{
  expect(libraryResume({target_kind:'material',target_id:'221',assets:[{hash:'b'.repeat(64)}],context:{assetHash:hash}},owner,storage({}))).toEqual({href:'/viewer/221',label:'자료 열기'});
 });
 it('does not call an extracted PDF range a read position',()=>{
  const row={target_kind:'pdf',target_id:'p',context:{pdfPage:42}};
  expect(libraryResume(row,owner,storage({}))).toEqual({href:'/pdf/p?pdfjs=1',label:'PDF 열기'});
  expect(libraryResume(row,owner,storage({[legacyPdfPositionKey(owner,'p')]:'7'})).label).toBe('7쪽부터 · 이 기기');
 });
 it('keeps textbook edition and only uses valid stored page shapes',()=>{
  const row={target_kind:'edition',target_id:'old-edition',context:{page:'u03-study1'}};
  const value=libraryResume(row,owner,{getItem:()=>JSON.stringify({page:'u42-study1',completed:[]})});expect(value.href).toContain('edition=old-edition#u42-study1');
  expect(libraryResume(row,owner,{getItem:()=>{throw Error('blocked');}}).href).toContain('#u03-study1');
 });
 it('a public chapter owned by somebody else remains an accessible material',()=>{
  expect(materialActivity({id:7,owner_id:'other',processed_json:{metadata:{book:{key:'other-book'}}}},'text',null,null,owner).target_kind).toBe('material');
 });
 it('a public PDF excerpt resumes its accessible text without linking another owner’s file',()=>{
  expect(materialActivity({id:8,owner_id:'other',source_pdf_id:'private-file'},'text',null,null,owner)).toEqual({target_kind:'material',target_id:'8',context:{materialId:'8',mode:'text'}});
 });
 it('writes only a recent reference, never a clock, position, FSRS or content payload',async()=>{
  const writes=[];await recordLibraryOpen({from:table=>({upsert:async row=>{writes.push({table,row});return{};}})},owner,{target_kind:'material',target_id:'1',context:{materialId:'1',mode:'original'}});
  expect(writes).toHaveLength(1);expect(writes[0].table).toBe('library_reading_activity');expect(Object.keys(writes[0].row)).toEqual(['owner_id','target_kind','target_id','context']);
 });
 it('serializes body and attachment opens for one root even when the first network reply is slow',async()=>{
  const calls=[];let release;const firstReply=new Promise(resolve=>{release=resolve;});
  const client={from:()=>({upsert:async row=>{calls.push(row.context.mode);if(calls.length===1)await firstReply;return{};}})};
  const body=recordLibraryOpen(client,owner,{target_kind:'material',target_id:'1',context:{mode:'text'}});
  const asset=recordLibraryOpen(client,owner,{target_kind:'material',target_id:'1',context:{mode:'original'}});
  await new Promise(resolve=>setTimeout(resolve,0));expect(calls).toEqual(['text']);release();await Promise.all([body,asset]);expect(calls).toEqual(['text','original']);
 });

});
