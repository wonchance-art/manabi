'use client';
import Link from 'next/link';
import {useEffect,useState,useRef} from 'react';
import {useSearchParams} from 'next/navigation';
import {useInfiniteQuery,useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import {langNameKo} from '@/lib/constants';
import {encounterLookupLang} from '@/lib/refVocabLookup';
import {pinnedMaterialIds} from '@/lib/offlineCache';
import {LIBRARY_LANGUAGES,libraryFilters,libraryNarrowed,libraryKey,libraryError,libraryComposerHref} from '@/lib/personalLibrary';
import {libraryResume} from '@/lib/libraryActivity';
import {safeLibraryReturn} from '@/lib/libraryReturn';
import {keepPreviousForUser} from '@/lib/keepPreviousForUser';
import {useCommittedReplace} from '@/lib/useCommittedReplace';
import {libraryConversationsQuery,libraryListQuery,libraryRecentQuery} from '@/lib/libraryShelfQueries';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import LibraryRow,{LibraryCover} from './LibraryRow';
import ConversationShelf from './ConversationShelf';
import LibraryCollections,{LibraryDialog,useCollections} from './LibraryCollections';
import {operationTarget,currentLibraryTarget,selectedRange,folderPaths,prepareOperation,continueOperation,libraryRpc,invalidateLibrary,libraryOperationError,pendingOperationKey,parsePendingOperation,operationCounts} from '@/lib/libraryOperations';
import {LibraryShelfBodySkeleton,RecentReadsSkeleton,ShelfRowsSkeleton} from './LibrarySkeleton';
import {useShelfEmptyHint} from './useShelfEmptyHint';
import './library.css';

function QueryFailure({query,label}){return query.isError?<div className="shelf-query-error" role="alert"><p>{label} · {libraryError(query.error)}</p><button onClick={()=>query.refetch()}>다시 시도</button></div>:null;}
// 서재 쿼리는 30초 캐시한다 — 쓰기 지점이 모두 무효화한다(browserQueryTrim.test.js가 지킨다).
// 읽던 곳·목록: 열람 기록(useLibraryActivity)·읽은 위치(useScrollRestore)·서재 작업과 자료 추가·공개 범위(invalidateLibrary).
// 받아두기 목록(library-pinned): 자료실의 받아두기 토글이 무효화한다.
// 읽던 곳이 없던 계정(이 기기에서 지난번 0개)은 받는 동안 골격을 세우지 않는다 — 규칙 · 예외는 useShelfEmptyHint 한 곳.
/** 서재 몸 첫 그림을 기다리는 상한 — 받기가 끝나지도 실패하지도 않으면(멈춘 연결) 이때 칸별 골격으로 넘긴다. */
const SHELF_REVEAL_CAP_MS=8000;
export function RecentReads({user,ssr=false}){
 const [more,setMore]=useState(false),[rows,setRows]=useState([]);
 const recent=useQuery(libraryRecentQuery(supabase,user.id));
 const emptyBefore=useShelfEmptyHint('recent',user.id,ssr,recent,recent.data?.items?.length||0);
 useEffect(()=>{
  const items=[...(recent.data?.items||[])];
  const ordered=items.sort((a,b)=>Date.parse(b.opened_at)-Date.parse(a.opened_at)).slice(0,3);
  let storage;try{storage=window.localStorage;}catch{/* No exact local location. */}
  setRows(ordered.map(row=>({...row,resume:libraryResume(row,user.id,storage)})));
 },[recent.data,user.id]);
 // 받는 중 · 받은 직후 줄을 고르는 한 프레임은 골격(LOADING-SKELETON-001) — 비었다가 카드가 들어오며 아래가 밀리지 않게.
 if(!rows.length)return <>{((recent.isPending&&!emptyBefore)||(recent.data?.items?.length>0))&&<RecentReadsSkeleton/>}<QueryFailure query={recent} label="읽던 곳"/></>;
 return <section className={`shelf-recent${more?' is-expanded':''}`} aria-labelledby="shelf-recent-title"><div className="shelf-section-heading"><h2 id="shelf-recent-title">읽던 곳에서</h2>{rows.length>1&&<button className="shelf-recent-toggle" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'접기':'다른 읽던 자료'}</button>}</div><div className="shelf-recent-grid">{rows.map((row,index)=><LibraryReaderLink key={libraryKey(row)} href={row.resume.href} className={`shelf-recent-card${index?' shelf-recent-extra':''}`}><LibraryCover row={row}/><div><small>{row.language?langNameKo(row.language):'읽던 자료'}</small><h3 lang={encounterLookupLang(row.language)||undefined}>{row.title}</h3><p>{row.resume.label} <span aria-hidden="true">↗</span></p></div></LibraryReaderLink>)}</div><QueryFailure query={recent} label="읽던 곳"/></section>;
}
function FilterDialog({filters,onApply,onClose}){
 const [draft,setDraft]=useState(filters);
 return <LibraryDialog title="자료 찾기" onClose={onClose}><form className="shelf-filter-form" onSubmit={e=>{e.preventDefault();onApply({lang:draft.language,kind:draft.kind,state:draft.state,level:draft.level,pinned:draft.pinned?'1':'',view:'',unread:''});onClose();}}>
  <label>언어<select aria-label="언어" value={draft.language} onChange={e=>setDraft({...draft,language:e.target.value})}><option value="">모든 언어</option>{LIBRARY_LANGUAGES.map(l=><option key={l} value={l}>{langNameKo(l)}</option>)}<option value="unknown">언어 미지정</option></select></label>
  <label>자료<select aria-label="자료 종류" value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}><option value="">모든 자료</option>{[['text','글이 있는 자료'],['note','작성한 기록'],['book','책'],['pdf','PDF 첨부·원본'],['epub','EPUB 첨부'],['link','링크가 있는 자료']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label>읽기 상태<select aria-label="읽기 상태" value={draft.state} onChange={e=>setDraft({...draft,state:e.target.value})}><option value="">모든 상태</option><option value="opened">열어본 자료</option><option value="unread">읽기 미완료</option><option value="completed">읽기 완료</option></select></label>
  {(draft.level||draft.pinned)&&<div className="shelf-legacy-filter"><p>이전 주소의 조건을 유지하고 있어요.{draft.level&&` · ${draft.level}`}{draft.pinned&&' · 이 기기에 받아둔 자료'}</p><button type="button" onClick={()=>setDraft({...draft,level:'',pinned:false})}>이 조건 해제</button></div>}
  <button className="manabi-button" type="submit">적용</button>
 </form></LibraryDialog>;
}
export default function LibraryShelf({user,ssr=false}){
 // 검색어만 바꾸는 이동은 반영을 확인한다 — 같은 경로 router.replace가 가끔 commit되지 않는다(useCommittedReplace).
 const params=useSearchParams(),replace=useCommittedReplace(),cache=useQueryClient();
 const filters=libraryFilters(params),narrowed=libraryNarrowed(filters),trash=filters.scope==='trash';
 const [search,setSearch]=useState(filters.query),[dialog,setDialog]=useState(null),[menu,setMenu]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [selecting,setSelecting]=useState(false),[selected,setSelected]=useState([]),[result,setResult]=useState(null),[pending,setPending]=useState(null),[folder,setFolder]=useState(''),[rename,setRename]=useState('');
 const anchor=useRef(null),attempt=useRef(null),listRef=useRef(null);
 const collections=useCollections(user.id),folders=folderPaths(collections.data||[]);
 const currentCollection=folders.find(c=>c.id===filters.collection),returnTo=safeLibraryReturn(`/materials?${params}`);
 const pinned=useQuery({queryKey:['library-pinned',user.id],enabled:filters.pinned,queryFn:()=>pinnedMaterialIds(user.id),staleTime:30000});
 const listQuery=libraryListQuery(supabase,user.id,filters,pinned.data),keyFilters=listQuery.queryKey[2];
 // 조건을 바꾸는 동안 이전 목록을 흐리게 남긴다(LIST-KEEP — 비었다가 다시 차며 높이가 튀던 것). 같은 계정일 때만.
 const list=useInfiniteQuery({...listQuery,enabled:!filters.pinned||pinned.isSuccess,placeholderData:keepPreviousForUser(user.id)});
 const {hasNextPage,isFetching,isError,fetchNextPage,isPlaceholderData:stale}=list;
 const items=list.data?.pages.flatMap(p=>p.items)||[],total=list.data?.pages[0]?.total||0;
 // 대화(v2-Z): 목록에 그대로 두되 「대화」 표시를 달고, 전체 보기 위에 따로 모은다. 실패해도 서재는 그대로 — 묶음만 숨는다.
 const conversations=useQuery(libraryConversationsQuery(supabase,user.id));
 const conversationIds=new Set((conversations.data||[]).map(c=>c.id));
 // 서버 미리 받기를 놓친 첫 그림(ssr 아님)은 읽던 곳 · 대화 · 목록 첫 쪽이 정해진 뒤 세 칸을 한 번에 그린다(REVIEW-SHELF-CLS-001 —
 // 목업 A안 scratchpad/mockups/cls-vocab-materials.md). 칸마다 골격이 따로 풀리면 읽던 곳 골격(157px)이 사라지거나 대화 골격(189px)이
 // 안내 한 줄(112px)로 줄며 아래 목록을 끌어올렸다(390 합성 계정 CLS 0.14–0.15). 읽던 곳은 RecentReads와 같은 쿼리(같은 키 — 요청 하나).
 // 한 칸의 첫 실패도 정해진 것이다(다시 시도는 그 칸이 맡는다). 한 번 드러나면 다시 골격으로 돌아가지 않고, 상한이 지나면 기다리지 않는다.
 // 미리 받은 서재(ssr)는 처음부터 드러나 있다(무변화). 좁힌 목록 · 검색은 읽던 곳 · 대화가 없어 지금처럼 목록 골격만.
 const shelfBody=!narrowed&&!search;
 const recent=useQuery({...libraryRecentQuery(supabase,user.id),enabled:shelfBody});
 const settling=query=>query.isPending&&query.failureCount===0;
 const bodyLoading=shelfBody&&(settling(recent)||settling(conversations)||settling(list));
 const [bodyRevealed,setBodyRevealed]=useState(ssr);
 useEffect(()=>{if(!bodyLoading)setBodyRevealed(true);},[bodyLoading]);
 useEffect(()=>{const timer=setTimeout(()=>setBodyRevealed(true),SHELF_REVEAL_CAP_MS);return()=>clearTimeout(timer);},[]);
 const bodyWaiting=!bodyRevealed&&bodyLoading;
 const selectedKeys=new Set(selected.map(libraryKey)),counts=operationCounts(result);
 // 정리 결과 알림 — 영역(.sr-only)은 늘 두고 내용만 넣는다(내용과 함께 생기는 role=status는 화면 낭독기가 놓칠 수 있다). 보이는 줄은 한 번만 읽히게 숨기고, 다시 시도 · 되돌리기가 이 영역을 가리킨다(A11Y-SWEEP-001).
 const pendingLine=pending&&!busy?'정리 결과를 아직 확인하지 못했어요.':'';
 const resultLine=result?`${busy?'정리 중…':counts.undone?`${counts.undone}개 취소됨`:`${counts.success||0}개 완료`}${Object.entries(counts).filter(([k])=>!['success','undone','pending'].includes(k)).reduce((n,[,v])=>n+v,0)>0?' · 일부 자료는 다시 확인해 주세요.':''}`:'';
 const selectionScope=JSON.stringify({...keyFilters,sort:null,pinnedIds:pinned.data||[],owner:user.id});
 useEffect(()=>{setSelected([]);setSelecting(false);anchor.current=null;},[selectionScope]);
 useEffect(()=>{try{setPending(parsePendingOperation(localStorage.getItem(pendingOperationKey(user.id))));}catch{/* No persistence available. */}},[user.id]);
 useEffect(()=>setSearch(filters.query),[filters.query]);
 useEffect(()=>{if(!stale&&items.length<filters.shown&&hasNextPage&&!isFetching&&!isError)fetchNextPage();},[stale,filters.shown,items.length,hasNextPage,isFetching,isError,fetchNextPage]);
 function change(patch){const next=new URLSearchParams(params.toString());if(!Object.hasOwn(patch,'shown'))next.delete('shown');next.delete('restoreY');for(const [k,v]of Object.entries(patch)){if(v)next.set(k,String(v));else next.delete(k);}replace(`/materials${next.size?`?${next}`:''}`,{scroll:false});}
 function remember(id,undo=false){const request=id?{id,undo}:null;setPending(request);try{if(request)localStorage.setItem(pendingOperationKey(user.id),JSON.stringify(request));else localStorage.removeItem(pendingOperationKey(user.id));}catch{/* Result can still be recovered in this tab. */}}
 async function finish(value){setResult(value);await invalidateLibrary(cache,user.id);setSelected([]);setDialog(null);setMenu(null);if(!value.items.some(x=>x.status==='pending'))remember(null);requestAnimationFrame(()=>listRef.current?.focus({preventScroll:true}));}
 async function apply(action,rows=selected,options={}){
  if(busy||!rows.length||pending)return;setBusy(true);setError('');
  const payload=JSON.stringify({action,rows,options});
  if(attempt.current?.payload!==payload)attempt.current={payload,id:crypto.randomUUID()};
  const id=attempt.current.id;remember(id);
  try{await prepareOperation(supabase,id,action,rows,options);await finish(await continueOperation(supabase,id,{onProgress:setResult}));attempt.current=null;}catch(e){setError(libraryOperationError(e));setDialog(null);setMenu(null);}finally{setBusy(false);}
 }
 async function resume(id,undo=false){if(busy)return;setBusy(true);setError('');remember(id,undo);try{const known=await libraryRpc(supabase,'library_operation_status',{p_id:id});if(!known){remember(null);setError('저장된 작업이 없어요. 다시 선택해 주세요.');return;}await finish(await continueOperation(supabase,id,{undo,onProgress:setResult}));}catch(e){setError(libraryOperationError(e));}finally{setBusy(false);}}
 function toggle(row,checked,shift){setSelected(previous=>selectedRange(items,previous,libraryKey(row),anchor.current,checked,shift));anchor.current=libraryKey(row);}
 async function selectAll(){setBusy(true);setError('');try{const keys=await libraryRpc(supabase,'library_selection',{p_filters:{...filters,pinnedIds:(pinned.data||[]).map(String)}});setSelected(keys);setSelecting(true);}catch(e){setError(libraryOperationError(e));}finally{setBusy(false);}}
 const subject=menu?[menu]:selected;
 const close=()=>{if(!busy){setDialog(null);setMenu(null);}};
 const navigation=<><button aria-current={!filters.collection&&filters.scope==='all'?'page':undefined} onClick={()=>change({collection:'',scope:''})}>전체</button><button aria-current={filters.scope==='favorites'?'page':undefined} onClick={()=>change({collection:'',scope:'favorites'})}>즐겨찾기</button><button aria-current={filters.scope==='unfiled'?'page':undefined} onClick={()=>change({collection:'',scope:'unfiled'})}>미분류</button><div className="shelf-folder-heading"><span>폴더</span><button aria-label="폴더 관리" onClick={()=>setDialog('collections')}>＋</button></div>{folders.map(f=><button key={f.id} className="shelf-folder-link" aria-current={filters.collection===f.id?'page':undefined} title={f.path} onClick={()=>change({collection:f.id,scope:''})}>{f.path}</button>)}<button className="shelf-trash-link" aria-current={trash?'page':undefined} onClick={()=>change({collection:'',scope:'trash'})}>휴지통</button></>;
 return <div className="shelf-layout shelf-managed"><header className="shelf-header"><h1>내 서재</h1><form role="search" onSubmit={e=>{e.preventDefault();change({q:search.trim()});}}><label className="shelf-sr" htmlFor="library-search">제목·파일명 검색</label><input id="library-search" type="search" maxLength={120} value={search} placeholder="검색" onChange={e=>{setSearch(e.target.value);if(!e.target.value)change({q:''});}}/><button type="submit" aria-label="검색">↗</button></form><Link className="manabi-button" href={libraryComposerHref(returnTo,filters.collection)}>자료 추가</Link></header>
 <div className="shelf-workspace"><nav className="shelf-folder-nav" aria-label="서재 위치">{navigation}</nav><div className="shelf-content">
 {bodyWaiting?<LibraryShelfBodySkeleton/>:<>
 {shelfBody&&<RecentReads user={user} ssr={ssr}/>}
 {shelfBody&&<ConversationShelf query={conversations} ownerId={user.id} ssr={ssr}/>}
 <section className="shelf-list-section" aria-labelledby="shelf-list-title"><div className="shelf-section-heading"><h2 id="shelf-list-title">{currentCollection?.path||({trash:'휴지통',favorites:'즐겨찾기',unfiled:'미분류'})[filters.scope]||'전체'} <span className="shelf-count">{list.isSuccess&&!stale?total:''}</span></h2><div className="shelf-list-tools"><label className="shelf-sr" htmlFor="library-sort">정렬</label><select id="library-sort" value={filters.sort} onChange={e=>change({sort:e.target.value})}><option value="newest">최근 저장순</option><option value="opened">최근 열어본 순</option><option value="title">제목순</option>{filters.sort==='level'&&<option value="level">급수순</option>}</select><button onClick={()=>setDialog('filters')} aria-label="자료 필터">필터</button><button aria-pressed={selecting} disabled={busy} onClick={()=>{setSelecting(!selecting);setSelected([]);}}>{selecting?'취소':'선택'}</button></div></div>
 <QueryFailure query={collections} label="폴더"/><QueryFailure query={pinned} label="기기 보관"/><QueryFailure query={list} label="자료 목록"/>
 {filters.collection&&collections.isSuccess&&!currentCollection&&<p role="status">폴더가 없어요. <button onClick={()=>change({collection:''})}>전체</button></p>}
 {(filters.query||filters.language||filters.kind||filters.state)&&<div className="shelf-result-summary"><span>{filters.query||filters.language||filters.kind||filters.state}</span><button onClick={()=>change({q:'',lang:'',kind:'',state:'',view:'',unread:''})}>조건 지우기</button></div>}
 {selecting&&<div className="shelf-selection-heading"><label><input type="checkbox" aria-label="현재 표시된 자료 선택" checked={items.length>0&&items.every(r=>selectedKeys.has(libraryKey(r)))} disabled={busy} onChange={e=>setSelected(e.target.checked?[...new Map([...selected,...items.map(operationTarget)].map(r=>[libraryKey(r),r])).values()]:selected.filter(r=>!items.some(x=>libraryKey(r)===libraryKey(x))))}/>현재 목록</label><span>{selected.length}개 선택</span>{total>items.length&&<button disabled={busy} onClick={selectAll}>검색 결과 {total}개 선택</button>}</div>}
 {(list.isPending||(stale&&!items.length))&&<ShelfRowsSkeleton/>}
 <div ref={listRef} tabIndex={-1} className="shelf-list-focus" aria-busy={stale||undefined} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();setSelecting(true);setSelected(items.map(operationTarget));}}}>
 {!!items.length&&<ul className="shelf-rows">{items.map(row=><LibraryRow key={libraryKey(row)} row={row.target_kind==='material'&&conversationIds.has(String(row.material_id))?{...row,conversation:true}:row} ownerId={user.id} selecting={selecting} selected={selectedKeys.has(libraryKey(row))} disabled={busy||stale} onSelect={toggle} onMenu={value=>{setMenu(value);setError('');}}/>)}</ul>}
 {list.isSuccess&&!stale&&!items.length&&<div className="shelf-empty"><h3>{trash?'휴지통이 비어 있어요.':'아직 자료가 없어요.'}</h3>{!trash&&<Link className="manabi-button" href={libraryComposerHref(returnTo,filters.collection)}>자료 추가</Link>}</div>}
 </div>
 {list.hasNextPage&&!stale&&<button className="shelf-load-more" disabled={list.isFetchingNextPage} onClick={()=>{change({shown:items.length+20});list.fetchNextPage();}}>{list.isFetchingNextPage?'불러오는 중…':'더 보기'}</button>}
 </section></>}
 {selecting&&selected.length>0&&<div className="shelf-selection-bar" aria-label="선택한 자료 작업"><strong>{selected.length}개</strong>{trash?<button disabled={busy||!!pending} onClick={()=>apply('restore')}>복원</button>:<><button disabled={busy||!!pending} onClick={()=>{setMenu(null);setFolder('');setDialog('add');}}>폴더에 추가</button>{filters.collection&&<button disabled={busy||!!pending} onClick={()=>{setMenu(null);setFolder('');setDialog('move');}}>이동</button>}<button disabled={busy||!!pending} onClick={()=>apply('favorite',selected,{value:filters.scope!=='favorites'})}>{filters.scope==='favorites'?'즐겨찾기 해제':'즐겨찾기'}</button><button disabled={busy||!!pending} onClick={()=>{setMenu(null);setDialog('trash');}}>휴지통</button></>}<button disabled={busy} aria-label="선택 해제" onClick={()=>{setSelected([]);setSelecting(false);}}>×</button></div>}
 {error&&<p className="shelf-notice" role="alert">{error}</p>}
 <span className="sr-only" role="status" id="shelf-organize-notice">{[pendingLine,resultLine].filter(Boolean).join(' ')}</span>
 {pendingLine&&<div className="shelf-notice"><span aria-hidden="true">{pendingLine} </span><button aria-describedby="shelf-organize-notice" onClick={()=>resume(pending.id,pending.undo)}>다시 시도</button></div>}
 {result&&<div className="shelf-notice"><span aria-hidden="true">{resultLine}</span>{(counts.conflict||counts.unavailable)>0&&<button aria-describedby="shelf-organize-notice" disabled={busy||!!pending} onClick={async()=>{setBusy(true);try{const failed=result.items.filter(x=>['conflict','unavailable'].includes(x.status));setSelected(await Promise.all(failed.map(x=>currentLibraryTarget(supabase,x))));setSelecting(true);setResult(null);}catch(e){setError(libraryOperationError(e));}finally{setBusy(false);}}}>실패 항목 다시 선택</button>}{counts.success>0&&<button aria-describedby="shelf-organize-notice" disabled={busy||!!pending} onClick={()=>resume(result.id,true)}>되돌리기</button>}<button aria-label="결과 닫기" disabled={busy} onClick={()=>setResult(null)}>×</button></div>}
 {/* 바닥 링크도 몸이 드러난 뒤 — 몸 골격 아래 섰다가 실제 칸 높이로 밀리지 않게(REVIEW-SHELF-CLS-001). */}
 {!bodyWaiting&&<>{!list.isPending&&<footer className="shelf-footer"><Link href="/study/library">지난 이야기</Link><Link href="/vocab">복습</Link><Link href="/materials?tools=1&view=owned">자료 상세 보기</Link></footer>}</>}
 </div></div>
 {dialog==='filters'&&<FilterDialog filters={filters} onApply={change} onClose={close}/>}
 {dialog==='collections'&&<LibraryCollections ownerId={user.id} onClose={close} initialParent={filters.collection} onSelect={id=>change({collection:id,scope:''})}/>}
 {menu&&!dialog&&<LibraryDialog title={menu.title} onClose={close}><div className="shelf-action-list">{menu.state==='trashed'?<button disabled={busy||!!pending||menu.unavailable} onClick={()=>apply('restore',[menu])}>복원</button>:<>
 {!menu.unavailable&&<><button disabled={!!pending} onClick={()=>{setRename(menu.display_title||menu.title);setDialog('rename');}}>이름 변경</button><button disabled={busy||!!pending} onClick={()=>apply('favorite',[menu],{value:!menu.favorite})}>{menu.favorite?'즐겨찾기 해제':'즐겨찾기'}</button><button disabled={!!pending} onClick={()=>{setFolder('');setDialog('add');}}>폴더에 추가</button>{filters.collection&&<><button disabled={!!pending} onClick={()=>{setFolder('');setDialog('move');}}>이동</button><button disabled={busy||!!pending} onClick={()=>apply('remove',[menu],{source:filters.collection})}>이 폴더에서 빼기</button></>}{menu.editable&&<Link href={`/materials/${menu.material_id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>원본 편집</Link>}</>}
 <button disabled={!!pending} onClick={()=>setDialog('trash')}>휴지통으로</button></>}</div></LibraryDialog>}
 {['add','move'].includes(dialog)&&<LibraryDialog title={dialog==='move'?'이동':'폴더에 추가'} onClose={close}><form className="shelf-filter-form" onSubmit={e=>{e.preventDefault();apply(dialog,subject,{folder,source:filters.collection});}}><select aria-label="대상 폴더" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">폴더 선택</option>{folders.filter(f=>dialog!=='move'||f.id!==filters.collection).map(f=><option key={f.id} value={f.id}>{f.path}</option>)}</select>{!folders.length&&<button type="button" onClick={()=>setDialog('collections')}>폴더 만들기</button>}<button className="manabi-button" disabled={!folder||busy}>{dialog==='move'?'이동':'추가'}</button></form></LibraryDialog>}
 {dialog==='rename'&&<LibraryDialog title="이름 변경" onClose={close}><form className="shelf-filter-form" onSubmit={e=>{e.preventDefault();apply('rename',subject,{title:rename});}}><input aria-label="내 서재 표시 이름" maxLength={200} value={rename} onChange={e=>setRename(e.target.value)}/><button type="button" disabled={busy} onClick={()=>apply('rename',subject,{title:''})}>원래 이름 사용</button><button className="manabi-button" disabled={busy||!rename.trim()}>저장</button></form></LibraryDialog>}
 {dialog==='trash'&&<LibraryDialog title={menu?`"${menu.display_title||menu.title}" 자료를 휴지통으로 옮길까요?`:`선택한 ${subject.length}개 자료를 휴지통으로 옮길까요?`} onClose={close}><p>학습 기록은 남아 있어요.</p><div className="shelf-dialog-actions"><button disabled={busy} onClick={close}>취소</button><button className="manabi-button" disabled={busy} onClick={()=>apply('trash',subject)}>휴지통으로</button></div></LibraryDialog>}
 </div>;
}
