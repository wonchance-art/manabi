import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {makeTextbookAnchor} from '../textbookAnnotations';

/**
 * 팀 페이지 교재 설명 패널의 표시 계약(VIEWER-BOUNDARY PR-1). 조회·저장 자체는
 * textbookAnnotationSync.test.js가, 실제 클릭 흐름은 e2e가 맡는다. 여기서는
 * 서버 응답 상태별로 사용자가 보는 결과(버튼 유무·대기 복구·빈/오류)를 확인한다.
 */
const m=vi.hoisted(()=>({notes:null,text:null}));
vi.mock('../useTextbookAnnotations',()=>({useTextbookAnnotations:()=>m.notes}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>m.text}));
vi.mock('../classTeamQueries',()=>({fetchChapterText:async()=>null,chapterLabel:t=>t}));
vi.mock('next/link',()=>({default:({href,children})=>createElement('a',{href},children)}));
const {default:ClassTextbookNotes,ChapterNotes}=await import('../../components/classroom/ClassTextbookNotes.jsx');

const json={sequence:['a','b','c'],dictionary:{a:{text:'我去'},b:{text:'图书馆'},c:{text:'看书'}}};
const row=(id,first,extra={})=>({id,revision:1,anchor:makeTextbookAnchor(json,first),body:`${id} 설명`,archived:false,...extra});
const lost={id:'lost',revision:1,anchor:{type:'TextQuoteSelector',exact:'没有',prefix:'',suffix:'',start:0,end:2},body:'lost 설명',archived:false};
const user={id:'teacher'},chapter={id:12,title:'제2과 图书馆'};
const render=()=>renderToStaticMarkup(createElement(ChapterNotes,{user,teamKey:'fixture-class',chapter}));
const notes=(patch={})=>({query:{isLoading:false,error:null,refetch:()=>{}},data:{canEdit:true},rows:[],canEdit:true,history:[],pending:null,busy:false,message:'',save:()=>{},retry:()=>{},resolveConflict:()=>{},...patch});
beforeEach(()=>{m.text={isLoading:false,error:null,data:json,refetch:()=>{}};m.notes=notes();});

describe('교사 팀 페이지 교재 설명', () => {
 it('접힌 상태에서는 조회 컴포넌트를 그리지 않는다', () => {
  const html=renderToStaticMarkup(createElement(ClassTextbookNotes,{user,teamKey:'fixture-class',chapters:[chapter]}));
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('과 선택');
 });

 it('원문 순서로 보이고, 교사에게만 수정·보관·이력, 새 설명은 수업 화면 안내', () => {
  const rows=[row('book','c'),row('lib','b'),lost,row('old','a',{archived:true})];
  m.notes=notes({rows,data:{canEdit:true},history:[{annotation_id:'lib',snapshot:{revision:1,body:'처음 설명'},created_at:'2026-10-07T03:00:00Z'}]});
  const html=render();
  expect(html.indexOf('lib 설명')).toBeLessThan(html.indexOf('book 설명'));
  expect(html.match(/>수정<\/button>/g)).toHaveLength(2);
  expect(html.match(/>보관<\/button>/g)).toHaveLength(2);
  expect(html).toContain('처음 설명');
  expect(html).toContain('보관한 설명 1개');
  expect(html).toContain('다시 표시');
  expect(html).toContain('원문 위치 확인이 필요한 설명 1개');
  expect(html).toContain('새 설명은 수업 화면에서 원문을 선택해 추가해요.');
  expect(html).toContain('href="/viewer/12?class=fixture-class&amp;day=');
  expect(html).not.toContain('설명 추가');
 });

 it('서버가 canEdit=false면 편집·보관·복원·이력 버튼이 없다', () => {
  m.notes=notes({rows:[row('lib','b'),row('old','a',{archived:true})],data:{canEdit:false},canEdit:false});
  const html=render();
  expect(html).toContain('lib 설명');
  for(const label of ['>수정<','>보관<','다시 표시','수정 이력','보관한 설명'])expect(html).not.toContain(label);
  expect(html).toContain('이 교재의 설명은 읽기만 할 수 있어요.');
 });

 it('빈 과', () => {
  expect(render()).toContain('이 과에는 아직 교재 설명이 없어요.');
 });

 it('조회 실패에도 이 기기의 저장 대기분과 재시도는 보인다', () => {
  const pending={operation:'o',annotation:{id:'lib',revision:1,anchor:row('lib','b').anchor,body:'오프라인 입력',archived:false}};
  m.notes=notes({query:{isLoading:false,error:new Error('x'),refetch:()=>{}},data:undefined,canEdit:undefined,pending});
  const html=render();
  expect(html).toContain('교재 설명을 불러오지 못했어요.');
  expect(html).toContain('다시 확인');
  expect(html).toContain('이 기기에 보관됨 · 서버 저장 확인 대기');
  expect(html).toContain('오프라인 입력');
  expect(html).toContain('저장 재시도');
  expect(html).not.toContain('이 과에는 아직 교재 설명이 없어요.');
 });

 it('충돌이면 재시도 대신 최신 확인 후 다시 편집만 제공한다', () => {
  const pending={operation:'o',conflict:true,annotation:{id:'lib',revision:1,anchor:row('lib','b').anchor,body:'겹친 입력',archived:false}};
  m.notes=notes({rows:[row('lib','b')],pending});
  const html=render();
  expect(html).toContain('다른 수정과 겹쳤어요. 입력은 보관돼 있습니다.');
  expect(html).toContain('최신 내용 확인하고 다시 편집');
  expect(html).not.toContain('저장 재시도');
  // 대기 중에는 다른 편집을 시작할 수 없다(덮어쓰기 방지).
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>수정<\/button>/);
 });
});
