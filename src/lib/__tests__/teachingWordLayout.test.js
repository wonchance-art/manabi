import {describe,it,expect} from 'vitest';
import {teachingWordLayout,wordSegments,normalizeWordAppearance} from '../teachingWordLayout';
import {boardExpression,validateBoard,emptyBoard} from '../teachingBoard';
import {wordCardSkeleton,readCard,arrangeExpressionGroups} from '../teachingBoardCard';
import {presentationElements} from '../teachingWorkspace';
const value=boardExpression({text:'学习',reading:'xué xí',meaning:'배우다, 공부하다',...normalizeWordAppearance()},'Chinese');
const palette={paper:'#fff',ink:'#222',muted:'#555',accent:'#356',line:'#ddd'};
describe('multiple teaching expressions with annotations and ink',()=>{
 it('places pinyin above each character, Korean labels below, and meaning on the right',()=>{
  const {parts}=teachingWordLayout(value),text=parts.filter(p=>p.role==='text'),read=parts.filter(p=>p.role==='reading'),hun=parts.filter(p=>p.role==='hun'),meaning=parts.find(p=>p.role==='meaning');
  expect(read.map(p=>p.text)).toEqual(['xué','xí']);expect(hun.map(p=>p.text).join('')).toContain('배울 학');
  expect(read[0].x).toBe(text[0].x);expect(read[0].y).toBeLessThan(text[0].y);expect(hun[0].y).toBeGreaterThan(text[0].y);
  expect(meaning.x).toBeGreaterThan(Math.max(...text.map(p=>p.x+p.width)));
 });
 it('preserves geometry across all eight visibility combinations',()=>{
  const geometry=layout=>layout.parts.map(({x,y,width,height})=>({x,y,width,height}));
  for(let mask=0;mask<8;mask++)expect(geometry(teachingWordLayout({...value,showReading:!!(mask&1),showHun:!!(mask&2),showMeaning:!!(mask&4)}))).toEqual(geometry(teachingWordLayout(value)));
 });
 it('keeps Japanese grouped readings and gives each kanji its own lower annotation',()=>{
  expect(wordSegments('今日','きょう','Japanese')).toEqual([{kanji:'今日',reading:'きょう'}]);
  expect(wordSegments('食べる','たべる','Japanese')).toEqual([{kanji:'食',reading:'た'},{plain:'べる'}]);
  const layout=teachingWordLayout({...value,text:'学習',reading:'がくしゅう',language:'Japanese'});
  expect(layout.parts.filter(p=>p.role==='reading')).toHaveLength(1);expect(layout.parts.filter(p=>p.role==='hun')).toHaveLength(2);
 });
 it('does not invent aligned syllables or annotate Latin languages',()=>{
  expect(wordSegments('T恤','T xù','Chinese')).toEqual([{kanji:'T恤',reading:'T xù'}]);
  for(const language of ['French','English'])expect(teachingWordLayout({...value,language,text:'table',reading:'ignored'}).parts.some(p=>['reading','hun'].includes(p.role))).toBe(false);
 });
 it('creates a borderless native group, keeps metadata after duplication and preserves old boards',()=>{
  const card=wordCardSkeleton(value,'a',{x:10,y:20},palette);
  expect(card[0].strokeColor).toBe('transparent');expect(card[0].backgroundColor).toBe('transparent');
  const copy=card.map((el,i)=>({...el,id:`copy-${i}`,groupIds:['copy']}));expect(readCard(copy[0],copy)).toEqual(value);
  const board=emptyBoard('one');board.pages[0].elements=[...card,{id:'ink',type:'freedraw',x:0,y:200,width:50,height:30,points:[[0,0],[50,30]]}];
  expect(validateBoard(JSON.parse(JSON.stringify(board))).pages[0].elements).toEqual(board.pages[0].elements);
 });
 it('leaves handwriting untouched when arranging chosen words',()=>{
  const a=wordCardSkeleton(value,'a',{x:100,y:20},palette),b=wordCardSkeleton({...value,text:'学校'},'b',{x:600,y:230},palette),ink={id:'ink',x:200,y:200,width:100,height:20};
  const elements=[...a,...b,ink],before=JSON.stringify(elements),moves=arrangeExpressionGroups([a[0],b[0]],elements);
  expect(moves.has('ink')).toBe(false);expect(moves.get('a').y).toBe(moves.get('b').y);expect(JSON.stringify(elements)).toBe(before);
 });
 it('keeps student display hiding separate from saved hun labels',()=>{
  const original=wordCardSkeleton(value,'a',{x:0,y:0},palette),before=JSON.stringify(original);
  expect(presentationElements(original,{hun:false}).filter(el=>el.customData?.manabiField==='hun').every(el=>el.opacity===0)).toBe(true);
  expect(JSON.stringify(original)).toBe(before);
 });
 it('detaches textbook provenance and old reading after native spelling edits',()=>{
  const sourced={...value,source:{materialId:'10',tokenId:'id_0_word',quote:'学习'}};
  const card=wordCardSkeleton(sourced,'a',{x:0,y:0},palette);
  const field=card.find(el=>el.customData?.manabiField==='text');field.text='复';field.originalText='复';
  const edited=readCard(card[0],card);
  expect(edited.text).toBe('复习');expect(edited.reading).toBe('');expect(edited.source).toEqual({kind:'manual'});
  const rebuilt=wordCardSkeleton(edited,'b',{x:0,y:0},palette);
  expect(rebuilt.some(el=>el.customData?.manabiField==='reading')).toBe(false);
 });
 it('wraps long expressions without placing a whole reading over each token',()=>{
  const text='一边学习一边复习',reading='いちべんがくしゅういちべんふくしゅう';
  const layout=teachingWordLayout({...value,text,reading,language:'Japanese'},{maxWidth:360});
  expect(layout.width).toBeLessThanOrEqual(360);
  expect(layout.parts.filter(p=>p.role==='text').map(p=>p.text).join('')).toBe(text);
  expect(layout.parts.filter(p=>p.role==='reading').map(p=>p.text).join('')).toBe(reading);
 });
 it('keeps a four-character word together on a narrow display and balances longer phrases',()=>{
  const rows=layout=>Object.values(Object.groupBy(layout.parts.filter(p=>p.role==='text'),p=>p.y)).map(row=>row.map(p=>p.text).join(''));
  const short=teachingWordLayout({...value,text:'换位思考',reading:'huàn wèi sī kǎo',meaning:'상대방의 입장에서 생각하다'},{fontSize:35,maxWidth:280});
  expect(rows(short)).toEqual(['换位思考']);
  expect(short.width).toBeLessThanOrEqual(280);
  const phrase={...value,text:'换个角度想一想',reading:'huàn gè jiǎo dù xiǎng yī xiǎng'};
  const layout=teachingWordLayout(phrase);
  expect(rows(layout)).toHaveLength(2);
  expect(rows(layout).every(row=>[...row].length>=3)).toBe(true);
  expect(rows(layout).join('')).toBe(phrase.text);
  const narrow=teachingWordLayout(phrase,{maxWidth:310});
  expect(rows(narrow)).toHaveLength(3);
  expect(rows(narrow).every(row=>[...row].length>=2)).toBe(true);
  expect(layout.parts.filter(p=>p.role==='reading').map(p=>p.text)).toEqual(phrase.reading.split(' '));
  expect(rows(teachingWordLayout({...phrase,showReading:false,showHun:false,showMeaning:false}))).toEqual(rows(layout));
 });
});
