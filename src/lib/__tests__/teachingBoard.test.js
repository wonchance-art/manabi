import {describe,it,expect} from 'vitest';
import {boardScope,boardExpression,emptyBoard,validateBoard,boardInsertion,replaceBoardPage,kanaCandidates} from '../teachingBoard';
import {cardSkeleton,readCard,wrapBoardText,rotateCardPart} from '../teachingBoardCard';
import index from '../data/jaYomiIndex.json';
const palette={paper:'#fff',ink:'#222',line:'#ddd',accent:'#456'};
const source={materialId:'10',quote:'图书馆',tokenId:'id_0_word',anchor:{type:'TextQuoteSelector',exact:'图书馆',prefix:'',suffix:'',start:0,end:3}};
const value=boardExpression({text:'图书馆',reading:'tú shū guǎn',meaning:'도서관',source},'Chinese');
const card=()=>cardSkeleton(value,'card',{x:0,y:0},palette);

describe('teacher board: isolated, durable semantic scenes',()=>{
 it('separates teacher, team and day without splitting a day by textbook',()=>{
  expect(new Set([boardScope('a','t','2026-09-12'),boardScope('b','t','2026-09-12'),boardScope('a','u','2026-09-12'),boardScope('a','t','2026-09-13')]).size).toBe(4);
  expect(()=>boardScope('', 't','2026-09-12')).toThrow();
 });
 it('preserves a textbook source snapshot and detaches changed text',()=>{
  expect(value.source).toEqual(source);
  expect(boardExpression({...value,text:'学校'},'Chinese').source).toEqual({kind:'manual'});
  const scene=card();scene[2]={...scene[2],text:'学校',originalText:'学校'};
  expect(readCard(scene[0],scene)).toMatchObject({text:'学校',source:{kind:'manual'}});
  expect(value.text).toBe('图书馆');
 });
 it('uses native shapes and text so ink can be layered over an expression',()=>{
  expect(card().map(el=>el.type)).toEqual(['rectangle','text','text','text']);
  expect(readCard(card()[0],card())).toEqual(value);
 });
 it('still resolves fields after native group duplication remaps IDs',()=>{
  const copy=card().map((el,i)=>({...el,id:`copy${i}`,groupIds:['new-group']}));
  expect(readCard(copy[0],copy)).toEqual(value);
 });
 it('round-trips source, hidden reading, ink and independent page cameras',()=>{
  const initial=emptyBoard('one');initial.pages.push({id:'two',elements:[],camera:{scrollX:0,scrollY:0,zoom:{value:1}}});
  const scene=card();scene[0].customData.manabiExpression={...value,showReading:false};
  const ink={id:'ink',type:'freedraw',x:1,y:2,width:3,height:4,points:[[0,0],[3,4]],pressures:[.2,.8],groupIds:['explanation']};
  const next=replaceBoardPage(initial,'one',[...scene,ink],{scrollX:30,scrollY:-80,zoom:{value:1.2}});
  const restored=validateBoard(JSON.parse(JSON.stringify(next)));
  expect(restored.pages[0].elements.at(-1)).toEqual(ink);
  expect(restored.pages[0].elements[0].customData.manabiExpression.showReading).toBe(false);
  expect(restored.pages[1]).toEqual(initial.pages[1]);expect(initial.pages[0].elements).toEqual([]);
 });
 it('rejects unsupported media, duplicate IDs and invalid backups',()=>{
  const doc=emptyBoard('one');doc.pages[0].elements=card();expect(()=>validateBoard(doc)).not.toThrow();
  for(const type of ['image','iframe','embeddable'])expect(()=>validateBoard({...doc,pages:[{...doc.pages[0],elements:[{...card()[0],type}]}]})).toThrow();
  expect(()=>validateBoard({...doc,pages:[doc.pages[0],doc.pages[0]]})).toThrow();
  expect(()=>validateBoard({...doc,version:999})).toThrow();
  expect(()=>validateBoard({...doc,activePage:'missing'})).toThrow();
  expect(()=>validateBoard({...doc,pages:[{...doc.pages[0],elements:[{id:'bad',type:'freedraw',x:0,y:0,width:10,height:10}]}]})).toThrow();
 });
 it('places additions clear of prior ink without moving existing elements',()=>{
  const original=card();const before=JSON.stringify(original);const point=boardInsertion(original,{width:800,zoom:{value:1}},320,220);
  expect(point.x>=320 || point.y>=original[0].height).toBe(true);expect(JSON.stringify(original)).toBe(before);
 });
 it('wraps long multilingual text without losing characters',()=>{
  for(const text of ['안녕하세요'.repeat(100),'This is a long phrase. '.repeat(20),'桥的那边是图书馆。'.repeat(30)])expect(wrapBoardText(text,12).replaceAll('\n','')).toBe(text);
 });
 it('retains rotation and scale when editing a card',()=>{
  const part=rotateCardPart({x:10,y:0,width:20,height:10},{x:0,y:0,width:100,height:100},Math.PI/2);
  expect(part.x).toBeCloseTo(85);expect(part.y).toBeCloseTo(15);
  expect(cardSkeleton(value,'large',{x:0,y:0},palette,640,2)[2].fontSize).toBe(84);
 });
 it('offers ambiguous kana candidates without silently choosing a kanji',()=>{
  expect(kanaCandidates(index,'ハシ').map(v=>v.text)).toEqual(expect.arrayContaining(['橋','箸','端']));
  expect(kanaCandidates(index,'かう').map(v=>v.text)).toEqual(expect.arrayContaining(['買う','飼う']));
  expect(kanaCandidates(index,'<script>')).toEqual([]);expect(kanaCandidates(index,'あ'.repeat(81))).toEqual([]);
 });
});
