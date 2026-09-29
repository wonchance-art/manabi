import {describe,it,expect} from 'vitest';
import {emptyBoard,BOARD_LIMIT,BOARD_ELEMENT_LIMIT} from '../teachingBoard';
import {fragmentUnits,fragmentSelection,fragmentAtPoint,fragmentInArea,fragmentOrigin,findFragment,cloneFragment,fragmentPosition,insertBoardFragment} from '../teachingBoardFragment';
import {packBoard,unpackBoard} from '../teachingBoardCloud';
import {readCard} from '../teachingBoardCard';

const shape=(id,extra={})=>({id,type:'rectangle',x:10,y:10,width:100,height:60,groupIds:[],...extra});
const field=(id,role,text,extra={})=>shape(id,{type:'text',text,fontSize:20,groupIds:['word','outer'],customData:{manabiField:role,value:text,displayText:text},...extra});
const source=()=>[
  shape('word',{groupIds:['word','outer'],frameId:'frame',customData:{manabiExpression:{text:'学习',reading:'xué xí',meaning:'배우다',language:'Chinese',showMeaning:false,source:{materialId:'188',quote:'学习'}}}}),
  field('text','text','学习'),field('reading','reading','xué xí'),field('meaning','meaning','배우다',{opacity:0}),
  shape('ink',{x:140,type:'freedraw',points:[[0,0],[10,30]],pressures:[.2,.9],groupIds:['outer']}),
  shape('arrow',{x:200,type:'arrow',points:[[0,0],[100,50]],startBinding:{elementId:'word'},endBinding:{elementId:'other'}}),
  shape('other',{x:320,groupIds:['outer']}),shape('frame',{type:'frame',x:0,y:0,width:500,height:300}),
  shape('gone',{isDeleted:true}),
];
const bounds=els=>[Math.min(...els.map(e=>e.x)),Math.min(...els.map(e=>e.y)),Math.max(...els.map(e=>e.x+e.width)),Math.max(...els.map(e=>e.y+e.height))];
const row={id:'source-board',day:'2026-09-09'},page={id:'source-page'};

describe('partial board reuse',()=>{
 it('selects an expression atomically, including hidden fields, without guessing nearby ink',()=>{
  const elements=source(),units=fragmentUnits(elements,bounds),chosen=fragmentSelection(elements,units,['word']);
  expect(units.filter(u=>u.kind==='expression')).toHaveLength(1);
  expect(chosen.map(el=>el.id)).toEqual(['word','text','reading','meaning']);
  expect(chosen.find(el=>el.id==='meaning').opacity).toBe(0);
  expect(fragmentAtPoint(units,{x:20,y:20})).toBe('word');
  expect(fragmentInArea(units,[5,5,115,75])).toEqual(['word']);
  expect(fragmentInArea(units,[140,10,150,40])).not.toContain('ink');
 });
 it('completes frames and bound labels, excludes deleted elements and supports ink-only selection',()=>{
  const elements=source(),units=fragmentUnits(elements,bounds);
  expect(fragmentSelection(elements,units,['frame']).map(el=>el.id)).toEqual(['word','text','reading','meaning','frame']);
  expect(fragmentSelection(elements,units,['ink']).map(el=>el.id)).toEqual(['ink']);
  const labelled=[shape('box'),field('label','text','안내',{groupIds:[],containerId:'box'})];
  expect(fragmentUnits(labelled,bounds)).toHaveLength(1);
  expect(fragmentSelection(labelled,fragmentUnits(labelled,bounds),['box'])).toHaveLength(2);
 });
 it('remaps complete expression groups, drops partial outer groups and dangling arrows while preserving source and pressure',async()=>{
  const elements=source(),before=structuredClone(elements),chosen=fragmentSelection(elements,fragmentUnits(elements,bounds),['word','ink','arrow']);
  const origin=await fragmentOrigin(row,page,chosen);let n=0;
  const cloned=cloneFragment(elements,chosen,origin,()=>`new-${++n}`),[word,text,reading,meaning,ink,arrow]=cloned;
  expect(elements).toEqual(before);expect(word.groupIds).toEqual([word.id]);expect(text.groupIds).toEqual(word.groupIds);
  expect(ink.groupIds).toEqual([]);expect(ink.points).toEqual(elements[4].points);expect(ink.pressures).toEqual([.2,.9]);
  expect(word.frameId).toBeNull();expect(arrow.startBinding.elementId).toBe(word.id);expect(arrow.endBinding).toBeNull();
  expect(meaning.opacity).toBe(0);expect(readCard(word,cloned)).toMatchObject({reading:'xué xí',showMeaning:false,source:{materialId:'188',quote:'学习'}});
  expect(reading.customData.manabiReuse.sourceId).toBe('reading');
 });
 it('retains a user group only when every live member was copied',async()=>{
  const elements=source(),chosen=fragmentSelection(elements,fragmentUnits(elements,bounds),['word','ink','other']);
  const cloned=cloneFragment(elements,chosen,await fragmentOrigin(row,page,chosen));
  expect(cloned[0].groupIds).toHaveLength(2);expect(cloned[4].groupIds[0]).toBe(cloned[0].groupIds[1]);
 });
 it('identifies contents independently of unrelated page edits or save bookkeeping',async()=>{
  const elements=source(),units=fragmentUnits(elements,bounds),chosen=fragmentSelection(elements,units,['word']);
  const first=await fragmentOrigin(row,page,chosen);
  const same=await fragmentOrigin({...row,revision:'later'},page,chosen.map(el=>({...el,version:99,versionNonce:3,updated:100})));
  expect(same).toEqual(first);
  const edited=structuredClone(chosen);edited[3].text='학습하다';expect((await fragmentOrigin(row,page,edited)).batch).not.toBe(first.batch);
 });
 it('survives cloud round-trip and distinguishes complete, partial and undone copies',async()=>{
  const elements=source(),chosen=fragmentSelection(elements,fragmentUnits(elements,bounds),['word','ink']),origin=await fragmentOrigin(row,page,chosen);
  const target=emptyBoard('today'),cloned=cloneFragment(elements,chosen,origin),inserted=insertBoardFragment(target,'today',cloned,{x:500,y:0});
  const packed=await packBoard(inserted.document),restored=await unpackBoard(packed.manifest,e=>packed.files.find(f=>f.hash===e.hash).text);
  expect(findFragment(restored,origin).kind).toBe('all');
  restored.pages[0].elements[0].isDeleted=true;expect(findFragment(restored,origin).kind).toBe('partial');
  restored.pages[0].elements.forEach(el=>{el.isDeleted=true;});expect(findFragment(restored,origin).kind).toBe('none');
  expect(target.pages[0].elements).toEqual([]);
 });
 it('moves the whole fragment with one delta, retaining rotation, spacing and existing objects',()=>{
  const target=emptyBoard('today');target.pages[0].elements=[shape('existing')];const before=structuredClone(target);
  const items=[shape('rotated',{angle:Math.PI/3}),shape('a',{x:210,y:60})];
  const result=insertBoardFragment(target,'today',items,{x:300,y:80});
  expect(target).toEqual(before);expect(result.document.pages[0].elements[0]).toEqual(before.pages[0].elements[0]);
  expect(result.elements[0]).toMatchObject({x:310,y:90,angle:Math.PI/3});expect(result.elements[1].x-result.elements[0].x).toBe(200);
 });
 it('uses complete rotated bounds for collision checks and falls back below the current content',()=>{
  const rotatedBounds=[-40,-40,140,140];const offset=fragmentPosition([0,0,100,80],[rotatedBounds],[0,0,500,300]);
  expect(offset.x).toBe(168);expect(offset.y).toBe(0);
  expect(fragmentPosition([50,20,150,100],[[0,0,500,300]],[0,0,500,300])).toEqual({x:-50,y:308});
 });
 it('checks page, element and aggregate byte capacity atomically before changing the board',()=>{
  const target=emptyBoard('today');target.pages=Array.from({length:20},(_,i)=>({id:i?`page${i}`:'today',elements:[]}));
  const before=structuredClone(target);
  expect(()=>insertBoardFragment(target,'today',[shape('new')],{x:0,y:0},{fresh:true})).toThrow('20');expect(target).toEqual(before);
  expect(insertBoardFragment(target,'today',[shape('new')],{x:0,y:0}).document.pages).toHaveLength(20);
  const full=emptyBoard('today');full.pages[0].elements=Array.from({length:BOARD_ELEMENT_LIMIT},(_,i)=>shape(`e${i}`));
  expect(()=>insertBoardFragment(full,'today',[shape('new')],{x:0,y:0})).toThrow();expect(full.pages[0].elements).toHaveLength(BOARD_ELEMENT_LIMIT);
  const large=emptyBoard('today');large.pages[0].elements=[field('big','meaning','x'.repeat(BOARD_LIMIT/4))];
  expect(()=>insertBoardFragment(large,'today',[field('more','meaning','y'.repeat(BOARD_LIMIT/4))],{x:0,y:0})).toThrow('커졌어요');
  expect(()=>insertBoardFragment(emptyBoard('today'),'missing',[shape('new')],{x:0,y:0})).toThrow('페이지');
 });
});
