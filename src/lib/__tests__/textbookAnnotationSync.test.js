import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {sliceBetween} from './helpers/sliceBetween.js';
import {makeTextbookAnchor} from '../textbookAnnotations';
import {createTextbookSaveRunner,groupTextbookNotes,shouldRetryTextbookSave,textbookAnnotationScope,textbookConflictDraft,textbookOperationId,textbookSaveRequest} from '../textbookAnnotationSync';

/**
 * 계약: 교재 설명 저장·대기·재시도 규칙을 수업 화면과 팀 페이지가 공유한다(VIEWER-BOUNDARY PR-1).
 * 기기에 남은 저장 대기분은 scope·operation id가 같아야 다른 화면에서 복구된다.
 */
const read=f=>readFileSync(f,'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const ctx={scope:textbookAnnotationScope('u1','42'),materialId:'42',team:'class'};
const request=(body='도서관',operation='11111111-1111-4111-8111-111111111111')=>({operation,annotation:{id:'22222222-2222-4222-8222-222222222222',revision:1,anchor:{exact:'图书馆'},body,archived:false}});
function fakeOutbox({send}={}) {
 const store=new Map(),log=[];
 return {store,log,deps:{now:()=>1,
  put:async row=>{log.push(['put',row.id]);store.set(row.id,row);},
  send:send||(async(id,team,req)=>{log.push(['send',id,team,req.operation]);return {annotation:req.annotation};}),
  remove:async id=>{log.push(['remove',id]);store.delete(id);},
  list:async scope=>{log.push(['list',scope]);return [...store.values()].filter(r=>r.scope===scope);},
 }};
}
function callbacks() {
 const seen=[];
 return {seen,cb:{start:()=>seen.push('start'),pending:r=>seen.push(['pending',r.operation]),saved:async next=>seen.push(['saved',next]),failed:e=>seen.push(['failed',e.message,!!e.conflict]),settled:()=>seen.push('settled')}};
}

describe('기존 기기 대기분과 같은 키', () => {
 it('scope·operation id 형식이 이전 TextbookAnnotations와 같다', () => {
  expect(textbookAnnotationScope('u1',42)).toBe(JSON.stringify(['textbook-annotation','u1','42']));
  // 로그인 전(user 없음) scope도 이전 JSON.stringify 결과와 같다(null).
  expect(textbookAnnotationScope(undefined,'42')).toBe('["textbook-annotation",null,"42"]');
  expect(textbookOperationId('abc')).toBe('textbook:abc');
 });
});

describe('저장 순서와 중복 방지', () => {
 it('성공: 기기 보관 → 서버 저장 → 보관 삭제 → 남은 대기 조회, 남은 대기가 없으면 null', async () => {
  const o=fakeOutbox(),runner=createTextbookSaveRunner(o.deps),{seen,cb}=callbacks(),req=request();
  expect(await runner.run(req,ctx,cb)).toBe('saved');
  expect(o.log.map(l=>l[0])).toEqual(['put','send','remove','list']);
  expect(o.log[0][1]).toBe(`textbook:${req.operation}`);
  expect(o.log[1]).toEqual(['send','42','class',req.operation]);
  expect(seen).toEqual(['start',['pending',req.operation],['saved',null],'settled']);
  expect(o.store.size).toBe(0);
 });

 it('저장 중에는 같은 요청을 다시 받지 않는다 — 서버 전송 1회', async () => {
  const gate=deferred(),send=vi.fn(()=>gate.promise),o=fakeOutbox({send}),runner=createTextbookSaveRunner(o.deps);
  const first=runner.run(request(),ctx,{});await Promise.resolve();await Promise.resolve();
  expect(runner.locked).toBe(true);
  expect(await runner.run(request(),ctx,{})).toBe('locked');
  gate.resolve({});expect(await first).toBe('saved');
  expect(send).toHaveBeenCalledTimes(1);expect(runner.locked).toBe(false);
 });

 it('네트워크 실패: 기기 보관은 남고, 재시도는 같은 operation으로 한 번 더 보낸다', async () => {
  let fail=true;const sent=[];
  const o=fakeOutbox({send:async(id,team,req)=>{sent.push(req.operation);if(fail)throw new Error('offline');return {};}});
  const runner=createTextbookSaveRunner(o.deps),{seen,cb}=callbacks(),req=request();
  expect(await runner.run(req,ctx,cb)).toBe('failed');
  expect(seen).toContainEqual(['failed','offline',false]);
  expect([...o.store.keys()]).toEqual([`textbook:${req.operation}`]);
  expect(shouldRetryTextbookSave(req,runner.locked)).toBe(true);
  fail=false;
  expect(await runner.run(req,ctx,{})).toBe('saved');
  expect(sent).toEqual([req.operation,req.operation]);
  expect(o.store.size).toBe(0);
 });

 it('409 충돌: 실패로 알리고 자동 재전송 대상에서 빠진다(덮어쓰기 0)', async () => {
  const send=vi.fn(async()=>{throw Object.assign(new Error('다른 수정이 있어요.'),{status:409,conflict:true});});
  const o=fakeOutbox({send}),runner=createTextbookSaveRunner(o.deps),{seen,cb}=callbacks(),req=request();
  expect(await runner.run(req,ctx,cb)).toBe('failed');
  expect(seen).toContainEqual(['failed','다른 수정이 있어요.',true]);
  expect(shouldRetryTextbookSave({...req,conflict:true},runner.locked)).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
  expect(o.store.has(`textbook:${req.operation}`)).toBe(true);
 });

 it('과 전환·언마운트(bump) 뒤 늦은 성공 응답은 화면 상태를 바꾸지 않는다', async () => {
  const gate=deferred(),o=fakeOutbox({send:()=>gate.promise}),runner=createTextbookSaveRunner(o.deps),{seen,cb}=callbacks();
  const run=runner.run(request(),ctx,cb);await Promise.resolve();await Promise.resolve();
  runner.bump();gate.resolve({});
  expect(await run).toBe('stale');
  expect(seen.filter(s=>s!=='start'&&s[0]!=='pending')).toEqual([]);
  expect(runner.locked).toBe(false);
 });

 it('bump 뒤 늦은 실패 응답도 메시지를 남기지 않는다', async () => {
  const gate=deferred(),o=fakeOutbox({send:()=>gate.promise}),runner=createTextbookSaveRunner(o.deps),{seen,cb}=callbacks();
  const run=runner.run(request(),ctx,cb);await Promise.resolve();await Promise.resolve();
  runner.bump();gate.reject(new Error('late'));
  expect(await run).toBe('stale');
  expect(seen.some(s=>s[0]==='failed'||s==='settled')).toBe(false);
 });

 it('기기 보관 직후 bump되면 서버로 보내지 않는다', async () => {
  const gate=deferred(),send=vi.fn(async()=>({})),o=fakeOutbox({send});
  o.deps.put=()=>gate.promise;
  const runner=createTextbookSaveRunner(o.deps),run=runner.run(request(),ctx,{});
  runner.bump();gate.resolve();
  expect(await run).toBe('stale');expect(send).not.toHaveBeenCalled();
 });

 it('대기가 없거나 진행 중이면 재전송하지 않는다', () => {
  expect(shouldRetryTextbookSave(null,false)).toBe(false);
  expect(shouldRetryTextbookSave(request(),true)).toBe(false);
 });
});

describe('요청·충돌 해소 값', () => {
 it('저장 요청은 서버가 받는 필드만 담는다', () => {
  const ids=['op','new-op','new-id'];const make=()=>ids.shift();
  const row={id:'a',revision:3,anchor:{exact:'x'},body:'본문',archived:false,material_id:9,created_at:'t',created_by:'u'};
  expect(textbookSaveRequest(row,{archived:true},make)).toEqual({operation:'op',annotation:{id:'a',revision:3,anchor:{exact:'x'},body:'본문',archived:true}});
  expect(textbookSaveRequest({anchor:{exact:'y'},body:'새'},{},make)).toEqual({operation:'new-op',annotation:{id:'new-id',revision:0,anchor:{exact:'y'},body:'새',archived:false}});
 });

 it('충돌 후 다시 편집: 입력 본문은 그대로, revision만 최신 서버 값', () => {
  const pending={operation:'o',annotation:{id:'a',revision:1,anchor:{exact:'x'},body:'내 입력',archived:false},conflict:true};
  expect(textbookConflictDraft({annotations:[{id:'a',revision:4,body:'다른 사람'}]},pending)).toEqual({id:'a',revision:4,anchor:{exact:'x'},body:'내 입력',archived:false});
  expect(textbookConflictDraft({annotations:[]},pending).revision).toBe(0);
  expect(textbookConflictDraft(undefined,pending)).toBe(null);
 });
});

describe('팀 페이지 목록 분류', () => {
 const json={sequence:['a','b','c','d','e'],dictionary:{a:{text:'我'},b:{text:'去'},c:{text:'图书馆'},d:{text:'看'},e:{text:'书'}}};
 const at=(id,first,last,extra={})=>({id,anchor:makeTextbookAnchor(json,first,last),body:id,archived:false,...extra});
 it('원문 순서로 놓고, 위치를 잃은 설명과 보관한 설명을 따로 둔다', () => {
  const lost={id:'lost',anchor:{type:'TextQuoteSelector',exact:'没有',prefix:'',suffix:'',start:0,end:2},body:'lost',archived:false};
  const {placed,unplaced,archived}=groupTextbookNotes(json,[at('book','e','e'),at('lib','c','c'),lost,at('old','a','b',{archived:true}),{...lost,id:'lost-old',archived:true}]);
  expect(placed.map(p=>p.row.id)).toEqual(['lib','book']);
  expect(unplaced.map(p=>p.row.id)).toEqual(['lost']);
  expect(archived.map(p=>[p.row.id,!!p.location])).toEqual([['old',true],['lost-old',false]]);
 });
 it('본문을 읽지 못하면 조용히 다른 위치에 붙이지 않고 전부 위치 확인 대상으로 둔다', () => {
  const {placed,unplaced}=groupTextbookNotes(null,[at('lib','c','c')]);
  expect(placed).toEqual([]);expect(unplaced.map(p=>p.row.id)).toEqual(['lib']);
 });
});

describe('배선 계약(동작 보증은 e2e)', () => {
 const viewerNotes=read('src/components/classroom/TextbookAnnotations.jsx');
 const hook=read('src/lib/useTextbookAnnotations.js');
 const panel=read('src/components/classroom/ClassTextbookNotes.jsx');
 const page=read('src/views/ClassTeamPage.jsx');
 it('수업 화면은 공용 훅만 쓴다 — 저장·대기 로직 복제 0', () => {
  expect(viewerNotes).toContain('useTextbookAnnotations(');
  for(const dup of ['putClassOperation','listClassOperations','deleteClassOperation','requestTextbookAnnotations'])expect(viewerNotes).not.toContain(dup);
  expect(panel).toContain('useTextbookAnnotations(');
  for(const dup of ['putClassOperation','listClassOperations','deleteClassOperation','requestTextbookAnnotations'])expect(panel).not.toContain(dup);
 });
 it('받아 둔 사본(local)은 서버 조회를 켜지 않는다', () => {
  expect(hook).toContain('enabled:enabled&&!local');
  expect(hook).toContain("local?{annotations:localAnnotations||[],canEdit:false}");
 });
 it('팀 페이지 패널: 네트워크는 교재 설명 API와 과 본문 조회뿐, 새 위치 지정 0, 편집은 서버 canEdit', () => {
  expect(panel).not.toMatch(/(^|[^\w.])fetch\(/); // 전역 fetch 0(react-query refetch는 같은 조회의 재시도)
  expect(panel).not.toContain('supabase');
  expect(panel).not.toContain('unlock');
  expect(panel).not.toContain('makeTextbookAnchor');
  expect(panel).not.toContain('설명 추가');
  expect(panel).toContain('fetchChapterText(chapter.id)');
  for(const label of ['>수정</button>','>보관</button>','>다시 표시</button>']){
   const at=panel.indexOf(label);expect(at).toBeGreaterThan(0);
   expect(panel.lastIndexOf('canEdit&&',at)).toBeGreaterThan(panel.lastIndexOf('</article>',at));
  }
 });
 it('팀 페이지 패널은 펼친 뒤에만 조회 컴포넌트를 mount한다', () => {
  const shell=sliceBetween(panel,'export default function ClassTextbookNotes(','\nfunction NoteHistory(');
  expect(shell).not.toContain('useTextbookAnnotations(');
  expect(shell).not.toContain('useQuery(');
  expect(shell.indexOf('{open&&<>')).toBeGreaterThan(0);
  expect(shell.indexOf('<ChapterNotes')).toBeGreaterThan(shell.indexOf('{open&&<>'));
 });
 it('교사 오너 뷰에만 1곳 mount — 학생·잠김 화면에는 없다(PR-1 범위)', () => {
  const owner=sliceBetween(page,'function OwnerView(','\nfunction NotesList(');
  expect(owner.match(/<ClassTextbookNotes /g)).toHaveLength(1);
  expect(page.match(/<ClassTextbookNotes /g)).toHaveLength(1);
  expect(sliceBetween(page,'function LockedView(','\n}\n')).not.toContain('ClassTextbookNotes');
 });
});
