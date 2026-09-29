import {describe,it,expect} from 'vitest';
import {copyBoardPages,cloneBoardElements} from '../teachingBoardReuse';
import {emptyBoard,BOARD_LIMIT} from '../teachingBoard';
import {packBoard,unpackBoard} from '../teachingBoardCloud';
import {boardPageSummary,readCard} from '../teachingBoardCard';

const row={id:'board-old',revision:'revision-old',day:'2026-09-09'};
const shape=(id,other={})=>({id,type:'rectangle',x:1,y:2,width:100,height:50,groupIds:[],...other});
const source=()=>({...emptyBoard('old'),pages:[{id:'old',elements:[
  shape('word',{groupIds:['word','outer'],frameId:'frame',boundElements:[{id:'text',type:'text'},{id:'arrow',type:'arrow'}],customData:{manabiExpression:{text:'学习',meaning:'배우다',reading:'xué xí',language:'Chinese',source:{materialId:'188',quote:'学习',tokenId:'t1'}}}}),
  shape('text',{type:'text',text:'学习',fontSize:20,containerId:'word',groupIds:['word','outer'],customData:{manabiField:'text',displayText:'学习',value:'学习'}}),
  shape('frame',{type:'frame'}),
  shape('arrow',{type:'arrow',points:[[0,0],[20,20]],startBinding:{elementId:'word',focus:0,gap:0,fixedPoint:[.5,1]},endBinding:{elementId:'deleted',focus:1,gap:5}}),
  shape('ink',{type:'freedraw',points:[[0,0],[10,4]],pressures:[.2,.7]}),shape('deleted',{isDeleted:true}),
],camera:{scrollX:200,scrollY:100,zoom:{value:2}}}]});
const sequence=()=>{let i=0;return()=>`new-${++i}`;};

describe('past board page reuse',()=>{
 it('copies full pages without changing source or destination ink and repairs every scene relationship',()=>{
  const past=source(),target=emptyBoard('today');target.pages[0].elements=[shape('existing')];
  const originals=structuredClone({past,target});const result=copyBoardPages(target,past,row,['old'],sequence());
  expect({past,target}).toEqual(originals);expect(result.document.pages[0]).toEqual(target.pages[0]);
  const page=result.document.pages[1], [word,text,frame,arrow,ink]=page.elements;
  expect(page.elements).toHaveLength(5);expect(page.elements.every(el=>!past.pages[0].elements.some(p=>p.id===el.id))).toBe(true);
  expect(word.groupIds[0]).toBe(word.id);expect(text.groupIds).toEqual(word.groupIds);expect(text.containerId).toBe(word.id);expect(word.frameId).toBe(frame.id);
  expect(word.boundElements).toEqual([{id:text.id,type:'text'},{id:arrow.id,type:'arrow'}]);expect(arrow.startBinding.elementId).toBe(word.id);expect(arrow.startBinding.fixedPoint).toEqual([.5,1]);expect(arrow.endBinding).toBeNull();
  expect(ink.points).toEqual([[0,0],[10,4]]);expect(ink.pressures).toEqual([.2,.7]);expect(readCard(word,page.elements).source).toEqual({materialId:'188',quote:'学习',tokenId:'t1'});
  expect(page.camera).toEqual({scrollX:0,scrollY:0,zoom:{value:1}});expect(result.document.activePage).toBe(page.id);
 });
 it('retains provenance through immutable account upload/download and refuses a duplicate after reload',async()=>{
  const {document}=copyBoardPages(emptyBoard('today'),source(),row,['old']);
  const packed=await packBoard(document),restored=await unpackBoard(packed.manifest,entry=>packed.files.find(f=>f.hash===entry.hash).text);
  expect(restored.pages[1].reusedFrom).toEqual({boardId:row.id,revision:row.revision,pageId:'old',day:row.day});
  expect(()=>copyBoardPages(restored,source(),row,['old'])).toThrow('이미');
  expect(copyBoardPages(restored,source(),{...row,revision:'new-version'},['old']).document.pages).toHaveLength(3);
 });
 it('copies only selected pages, in original order, skipping previously copied pages atomically',()=>{
  const past=source();past.pages.push({id:'second',elements:[]});
  const first=copyBoardPages(emptyBoard('today'),past,row,['second']);
  const next=copyBoardPages(first.document,past,row,['second','old','old']);expect(next.ids).toHaveLength(1);expect(next.document.pages).toHaveLength(3);
 });
 it('rejects unknown/empty selections and page overflow without touching either document',()=>{
  const target=emptyBoard('today'),past=source(),unchanged=JSON.stringify({target,past});
  expect(()=>copyBoardPages(target,past,row,[])).toThrow('선택');expect(()=>copyBoardPages(target,past,row,['missing'])).toThrow('선택');
  expect(()=>copyBoardPages(target,past,{...row,revision:null},['old'])).toThrow('저장 정보');expect(JSON.stringify({target,past})).toBe(unchanged);
  target.pages=Array.from({length:20},(_,i)=>({id:i?`p-${i}`:'today',elements:[]}));expect(()=>copyBoardPages(target,past,row,['old'])).toThrow('선택을 줄여');expect(target.pages).toHaveLength(20);
 });
 it('checks the combined byte limit before inserting pages',()=>{
  const target=emptyBoard('today');target.pages[0].elements=[shape('large',{type:'text',fontSize:20,text:'x'.repeat(BOARD_LIMIT/2)})];
  const past=emptyBoard('past');past.pages[0].elements=[shape('large-source',{type:'text',fontSize:20,text:'y'.repeat(BOARD_LIMIT/2)})];
  expect(()=>copyBoardPages(target,past,row,['past'])).toThrow('커졌어요');expect(target.pages).toHaveLength(1);
 });
 it('does not retain dangling container/frame/bound links, including to deleted elements',()=>{
  const [element]=cloneBoardElements([shape('a',{containerId:'gone',frameId:'gone',boundElements:[{id:'gone',type:'text'}]}),shape('gone',{isDeleted:true})]);
  expect(element.containerId).toBeNull();expect(element.frameId).toBeNull();expect(element.boundElements).toEqual([]);
 });
 it('summarizes edited expression text and free ink, ignoring deleted elements',()=>{
  const page=source().pages[0];page.elements[1].text='复习';page.elements[1].originalText='复习';expect(boardPageSummary(page)).toMatchObject({text:'复习',words:1,ink:1,count:5});
 });
});
