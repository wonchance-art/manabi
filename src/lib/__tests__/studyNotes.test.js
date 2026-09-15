import {describe,expect,it} from 'vitest';
import {newStudyNote,validateStudyNote,noteMaterialRow,noteFromMaterial,noteScope,collectNoteExpressions,mergeNoteCandidates,noteCandidatePayload,sameStudyNote} from '../studyNotes';
import {boardExpression} from '../teachingBoard';
import {wordCardSkeleton} from '../teachingBoardCard';
import {sourceHref} from '../learningSources';

const id='11111111-1111-4111-8111-111111111111',page='page-1';
const text=(id,value)=>({id,type:'text',text:value,x:30,y:40,width:400,height:80,fontSize:24,groupIds:[]});
const stroke={id:'stroke',type:'freedraw',x:10,y:20,width:100,height:20,points:[[0,0],[40,12],[100,20]],pressures:[.4,.8,.3]};
function sample(){const note=newStudyNote(id,page);note.board.pages[0].elements=[text('line','はし → 다리\n復習 → 복습'),structuredClone(stroke)];return note;}

describe('private note to vocabulary',()=>{
 it('reuses the private library row without team metadata; preserves stroke pressure and geometry',()=>{
  const note=sample(),row=noteMaterialRow('owner','내 필기',note,id);
  expect(row).toMatchObject({owner_id:'owner',visibility:'private',direction:'write',title:'내 필기'});
  expect(row.processed_json.metadata.team).toBeUndefined();
  expect(noteFromMaterial(row)).toEqual(note);
  expect(row.raw_text).toBe('はし → 다리\n復習 → 복습');
  expect(noteScope('a',1)).not.toBe(noteScope('b',1));
 });
 it('extracts typed lines, not pen strokes, and retains the original text and coordinates',()=>{
  const note=sample(),before=JSON.stringify(note),rows=collectNoteExpressions(note,()=>id);
  expect(rows.map(row=>[row.text,row.meaning])).toEqual([['はし','다리'],['復習','복습']]);
  expect(rows[0]).toMatchObject({original:'はし → 다리',reviewed:false,pageId:page,elementIds:['line']});
  expect(JSON.stringify(note)).toBe(before);
 });
 it('collects a structured word exactly once, without making reading/meaning/hanja separate words',()=>{
  const note=newStudyNote(id,page),value=boardExpression({text:'図書館',reading:'としょかん',meaning:'도서관',layoutVersion:2},'Japanese');
  const palette={paper:'#fff',ink:'#111',line:'#ddd',muted:'#666',accent:'#900'};
  note.board.pages[0].elements=wordCardSkeleton(value,'word',{x:10,y:20},palette);
  const rows=collectNoteExpressions(note,()=>id);
  expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({text:'図書館',meaning:'도서관',reading:'としょかん'});
 });
 it('repeated organization keeps learner corrections, exclusions, review and saved IDs',()=>{
  const incoming=collectNoteExpressions(sample(),()=>id),edited={...incoming[0],text:'橋',reviewed:true,excluded:true,vocabularyId:id};
  const merged=mergeNoteCandidates([edited],incoming);
  expect(merged).toHaveLength(2);expect(merged[0]).toEqual(edited);
 });
 it('refuses unresolved or excluded entries and sends a private candidate reference',()=>{
  const row=collectNoteExpressions(sample(),()=>id)[0];
  expect(()=>noteCandidatePayload(1,row)).toThrow();
  expect(()=>noteCandidatePayload(1,{...row,reviewed:true,excluded:true})).toThrow();
  expect(noteCandidatePayload(1,{...row,reviewed:true}).source).toEqual({kind:'reading',materialId:'1',noteCandidateId:id});
 });
 it('rejects invalid input and oversized candidate collections before persistence',()=>{
  expect(()=>validateStudyNote({...sample(),key:'invalid'})).toThrow();
  expect(()=>validateStudyNote({...sample(),language:'Klingon'})).toThrow();
  expect(()=>validateStudyNote({...sample(),candidates:Array(301).fill({})})).toThrow();
  const note=sample();note.board.pages[0].elements[1].points=[[NaN,0]];
  expect(()=>validateStudyNote(note)).toThrow();
 });
 it('builds a vocabulary return URL from IDs, never a client-supplied destination',()=>{
  expect(sourceHref({kind:'reading',material_id:23,url:'https://evil.example',locator:{noteCandidate:id,notePage:'page&next=evil'}})).toBe(`/notes/23?candidate=${id}&page=page%26next%3Devil`);
 });
 it('recognizes a lost successful response after PostgreSQL JSONB reorders object keys',()=>{
  const document=sample(),reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,val])=>[key,reverse(val)])):value;
  expect(sameStudyNote({title:' 내 노트 ',document},{title:'내 노트',document:reverse(document)})).toBe(true);
  expect(sameStudyNote({title:'내 노트',document},{title:'다른 수정',document})).toBe(false);
 });
 it('preserves spaces while a learner types multiword expressions and meanings',()=>{
  const note=sample();note.candidates=[{...collectNoteExpressions(note,()=>id)[0],text:'take ',meaning:'시간을 '}];
  expect(validateStudyNote(note).candidates[0]).toMatchObject({text:'take ',meaning:'시간을 '});
 });
});
