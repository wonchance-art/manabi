import {it,expect} from 'vitest';
import {teachingWordCases,highRiskWordCases} from '../../../e2e/fixtures/teaching-word-cases.mjs';
import {splitRuby} from '../splitRuby';
import {wordSegments,teachingWordLayout} from '../teachingWordLayout';
import {emptyBoard,validateBoard} from '../teachingBoard';
import {wordCardSkeleton,readCard} from '../teachingBoardCard';
import {presentationElements} from '../teachingWorkspace';
import {japaneseReferenceForMeaning} from '../viewerJapaneseReference';
const palette={paper:'#fff',ink:'#222',muted:'#555',accent:'#356',line:'#ddd'};
it.each(teachingWordCases)('$id preserves spelling and uses only supported reading alignment',entry=>{
 const parts=wordSegments(entry.text,entry.reading,entry.language);
 expect(parts.map(p=>p.kanji||p.plain).join('')).toBe(entry.text);
 if(entry.mode==='group'){expect(parts).toEqual([{kanji:entry.text,reading:entry.reading}]);expect(splitRuby(entry.text,entry.reading)).toEqual(parts);}
 if(entry.mode==='aligned')expect(parts.map(p=>p.reading)).toEqual(entry.reading.split(' '));
 if(entry.mode==='anchored')expect(parts.map(p=>p.reading??p.plain).join('')).toBe(entry.reading);
 if(['plain','empty'].includes(entry.mode))expect(parts.every(p=>!p.reading)).toBe(true);
 for(const maxWidth of [280,360,620]){
  const layout=teachingWordLayout(entry,{fontSize:35,maxWidth});
  expect(layout.parts.filter(p=>p.role==='text').map(p=>p.text).join('')).toBe(entry.text);
  expect(layout.parts.filter(p=>p.role==='meaning').map(p=>p.text).join('')).toBe(entry.meaning.replaceAll('\n',''));
  expect(layout.width).toBeLessThanOrEqual(maxWidth+.01);
  for(const p of layout.parts){expect([p.x,p.y,p.width,p.height].every(Number.isFinite)).toBe(true);expect(p.x+p.width).toBeLessThanOrEqual(layout.width+.01);expect(p.y+p.height).toBeLessThanOrEqual(layout.height+.01);}
  const left=Math.max(...layout.parts.filter(p=>p.role==='text').map(p=>p.x+p.width));expect(layout.parts.filter(p=>p.role==='meaning').every(p=>p.x>left)).toBe(true);
  if(['French','English'].includes(entry.language))expect(layout.parts.some(p=>['reading','hun'].includes(p.role))).toBe(false);
 }
});
it.each(highRiskWordCases)('$id keeps native elements and surrounding ink fixed across eight visibility combinations and both appearances',entry=>{
 const base=teachingWordLayout(entry),geometry=layout=>layout.parts.map(({x,y,width,height})=>[x,y,width,height]);
 for(let mask=0;mask<8;mask++)for(const appearance of ['plain','card']){
  const value={...entry,appearance,showReading:!!(mask&1),showHun:!!(mask&2),showMeaning:!!(mask&4)},layout=teachingWordLayout(value);
  expect(geometry(layout)).toEqual(geometry(base));
  const elements=wordCardSkeleton(value,'word',{x:150,y:150},palette),ink={id:'ink',type:'freedraw',x:20,y:400,width:30,height:10,points:[[0,0],[30,10]]};
  const board=emptyBoard('page');board.pages[0].elements=[...elements,ink];const snapshot=JSON.stringify(board),restored=validateBoard(JSON.parse(snapshot));
  expect(JSON.stringify(board)).toBe(snapshot);expect(restored.pages[0].elements).toEqual(board.pages[0].elements);
  expect(readCard(elements[0],elements)).toMatchObject({text:entry.text,reading:entry.reading,meaning:entry.meaning,appearance});
  const shown=presentationElements(elements,{hun:false});expect(shown.filter(el=>el.customData?.manabiField==='hun').every(el=>el.opacity===0)).toBe(true);expect(JSON.stringify(board)).toBe(snapshot);
 }
});
it('never substitutes a Japanese equivalent from another sense or part of speech',()=>{
 const entry={meanings:[{meaning:'시험용 뜻',pos:'명사',ja:{form:'試験'}},{meaning:'시험용 뜻',pos:'동사',ja:{form:'試す'}}]};
 expect(japaneseReferenceForMeaning(entry,'시험용 뜻',{pos:'동사'}).form).toBe('試す');
 expect(japaneseReferenceForMeaning(entry,'사용자가 새로 고친 뜻',{pos:'명사'})).toBeNull();
 expect(japaneseReferenceForMeaning(entry,'시험용 뜻',{pos:'형용사'})).toBeNull();
 expect(japaneseReferenceForMeaning({meanings:[{meaning:'시험용 뜻',ja:{form:'同形',diff:true}}]},'시험용 뜻',{form:'同形'})).toBeNull();
});
