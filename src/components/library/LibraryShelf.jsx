'use client';
import Link from 'next/link';
import {useEffect,useState,useRef} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {useInfiniteQuery,useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import {langNameKo} from '@/lib/constants';
import {pinnedMaterialIds} from '@/lib/offlineCache';
import {fetchLibraryPage,LIBRARY_LANGUAGES,libraryFilters,libraryNarrowed,libraryKey,libraryError,libraryComposerHref} from '@/lib/personalLibrary';
import {libraryResume} from '@/lib/libraryActivity';
import {safeLibraryReturn} from '@/lib/libraryReturn';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import LibraryRow,{LibraryCover} from './LibraryRow';
import LibraryCollections,{LibraryDialog,useCollections} from './LibraryCollections';
import {operationTarget,currentLibraryTarget,selectedRange,folderPaths,prepareOperation,continueOperation,libraryRpc,invalidateLibrary,libraryOperationError,pendingOperationKey,parsePendingOperation,operationCounts} from '@/lib/libraryOperations';
import './library.css';

function QueryFailure({query,label}){return query.isError?<div className="shelf-query-error" role="alert"><p>{label} · {libraryError(query.error)}</p><button onClick={()=>query.refetch()}>다시 불러오기</button></div>:null;}
function RecentReads({user}){
 const [more,setMore]=useState(false),[rows,setRows]=useState([]);
 const recent=useQuery({queryKey:['library-recent',user.id],staleTime:0,queryFn:()=>fetchLibraryPage(supabase,{},0,{recent:true})});
 useEffect(()=>{
  const items=[...(recent.data?.items||[])];
  const ordered=items.sort((a,b)=>Date.parse(b.opened_at)-Date.parse(a.opened_at)).slice(0,3);
  let storage;try{storage=window.localStorage;}catch{/* No exact local location. */}
  setRows(ordered.map(row=>({...row,resume:libraryResume(row,user.id,storage)})));
 },[recent.data,user.id]);
 if(!rows.length)return <>{recent.isPending&&<p className="shelf-muted" role="status">읽던 곳을 확인하고 있어요…</p>}<QueryFailure query={recent} label="읽던 곳"/></>;
 return <section className={`shelf-recent${more?' is-expanded':''}`} aria-labelledby="shelf-recent-title"><div className="shelf-section-heading"><h2 id="shelf-recent-title">읽던 곳에서</h2>{rows.length>1&&<button className="shelf-recent-toggle" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'접기':'다른 읽던 자료'}</button>}</div><div className="shelf-recent-grid">{rows.map((row,index)=><LibraryReaderLink key={libraryKey(row)} href={row.resume.href} className={`shelf-recent-card${index?' shelf-recent-extra':''}`}><LibraryCover row={row}/><div><small>{row.language?langNameKo(row.language):'읽던 자료'}</small><h3>{row.title}</h3><p>{row.resume.label} <span aria-hidden="true">↗</span></p></div></LibraryReaderLink>)}</div><QueryFailure query={recent} label="읽던 곳"/></section>;
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
export default function LibraryShelf({user}){
 const params=useSearchParams(),router=useRouter(),cache=useQueryClient();
 const filters=libraryFilters(params),narrowed=libraryNarrowed(filters),trash=filters.scope==='trash';
 const [search,setSearch]=useState(filters.query),[dialog,setDialog]=useState(null),[menu,setMenu]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [selecting,setSelecting]=useState(false),[selected,setSelected]=useState([]),[result,setResult]=useState(null),[pending,setPending]=useState(null),[folder,setFolder]=useState(''),[rename,setRename]=useState('');
 const anchor=useRef(null),attempt=useRef(null),listRef=useRef(null);
 const collections=useCollections(user.id),folders=folderPaths(collections.data||[]);
 const currentCollection=folders.find(c=>c.id===filters.collection),returnTo=safeLibraryReturn(`/materials?${params}`);
 const pinned=useQuery({queryKey:['library-pinned',user.id],enabled:filters.pinned,queryFn:pinnedMaterialIds,staleTime:0});
 const keyFilters={...filters};delete keyFilters.shown;
 const list=useInfiniteQuery({queryKey:['personal-library',user.id,keyFilters,pinned.data],enabled:!filters.pinned||pinned.isSuccess,initialPageParam:0,
 queryFn:({pageParam})=>fetchLibraryPage(supabase,filters,pageParam,{pinned:pinned.data}),getNextPageParam:(last,pages)=>{const length=pages.reduce((n,p)=>n+p.items.length,0);return length<last.total?length:undefined;},staleTime:0});
 const {hasNextPage,isFetching,isError,fetchNextPage}=list;
 const items=list.data?.pages.flatMap(p=>p.items)||[],total=list.data?.pages[0]?.total||0;
 const selectedKeys=new Set(selected.map(libraryKey)),counts=operationCounts(result);
 const selectionScope=JSON.stringify({...keyFilters,sort:null,pinnedIds:pinned.data||[],owner:user.id});
 useEffect(()=>{setSelected([]);setSelecting(false);anchor.current=null;},[selectionScope]);
 useEffect(()=>{try{setPending(parsePendingOperation(localStorage.getItem(pendingOperationKey(user.id))));}catch{/* No persistence available. */}},[user.id]);
 useEffect(()=>setSearch(filters.query),[filters.query]);
 useEffect(()=>{if(items.length<filters.shown&&hasNextPage&&!isFetching&&!isError)fetchNextPage();},[filters.shown,items.length,hasNextPage,isFetching,isError,fetchNextPage]);
 function change(patch){const next=new URLSearchParams(params.toString());if(!Object.hasOwn(patch,'shown'))next.delete('shown');next.delete('restoreY');for(const [k,v]of Object.entries(patch)){if(v)next.set(k,String(v));else next.delete(k);}router.replace(`/materials${next.size?`?${next}`:''}`,{scroll:false});}
 function remember(id,undo=false){const request=id?{id,undo}:null;setPending(request);try{if(request)localStorage.setItem(pendingOperationKey(user.id),JSON.stringify(request));else localStorage.removeItem(pendingOperationKey(user.id));}catch{/* Result can still be recovered in this tab. */}}
 async function finish(value){setResult(value);await invalidateLibrary(cache,user.id);setSelected([]);setDialog(null);setMenu(null);if(!value.items.some(x=>x.status==='pending'))remember(null);requestAnimationFrame(()=>listRef.current?.focus({preventScroll:true}));}
 async function apply(action,rows=selected,options={}){
  if(busy||!rows.length||pending)return;setBusy(true);setError('');
  const payload=JSON.stringify({action,rows,options});
  if(attempt.current?.payload!==payload)attempt.current={payload,id:crypto.randomUUID()};
  const id=attempt.current.id;remember(id);
  try{await prepareOperation(supabase,id,action,rows,options);await finish(await continueOperation(supabase,id,{onProgress:setResult}));attempt.current=null;}catch(e){setError(libraryOperationError(e));setDialog(null);setMenu(null);}finally{setBusy(false);}
 }
 async function resume(id,undo=false){if(busy)return;setBusy(true);setError('');remember(id,undo);try{const known=await libraryRpc(supabase,'library_operation_status',{p_id:id});if(!known){remember(null);setError('저장된 작업이 없습니다. 다시 선택해 주세요.');return;}await finish(await continueOperation(supabase,id,{undo,onProgress:setResult}));}catch(e){setError(libraryOperationError(e));}finally{setBusy(false);}}
 function toggle(row,checked,shift){setSelected(previous=>selectedRange(items,previous,libraryKey(row),anchor.current,checked,shift));anchor.current=libraryKey(row);}
 async function selectAll(){setBusy(true);setError('');try{const keys=await libraryRpc(supabase,'library_selection',{p_filters:{...filters,pinnedIds:(pinned.data||[]).map(String)}});setSelected(keys);setSelecting(true);}catch(e){setError(libraryOperationError(e));}finally{setBusy(false);}}
 const subject=menu?[menu]:selected;
 const close=()=>{if(!busy){setDialog(null);setMenu(null);}};
 const navigation=<><button aria-current={!filters.collection&&filters.scope==='all'?'page':undefined} onClick={()=>change({collection:'',scope:''})}>전체</button><button aria-current={filters.scope==='favorites'?'page':undefined} onClick={()=>change({collection:'',scope:'favorites'})}>즐겨찾기</button><button aria-current={filters.scope==='unfiled'?'page':undefined} onClick={()=>change({collection:'',scope:'unfiled'})}>미분류</button><div className="shelf-folder-heading"><span>폴더</span><button aria-label="폴더 관리" onClick={()=>setDialog('collections')}>＋</button></div>{folders.map(f=><button key={f.id} className="shelf-folder-link" aria-current={filters.collection===f.id?'page':undefined} title={f.path} onClick={()=>change({collection:f.id,scope:''})}>{f.path}</button>)}<button className="shelf-trash-link" aria-current={trash?'page':undefined} onClick={()=>change({collection:'',scope:'trash'})}>휴지통</button></>;
 return <div className="shelf-layout shelf-managed"><header className="shelf-header"><h1>내 서재</h1><form role="search" onSubmit={e=>{e.preventDefault();change({q:search.trim()});}}><label className="shelf-sr" htmlFor="library-search">제목·파일명 검색</label><input id="library-search" type="search" maxLength={120} value={search} placeholder="검색" onChange={e=>{setSearch(e.target.value);if(!e.target.value)change({q:''});}}/><button type="submit" aria-label="검색">↗</button></form><Link className="manabi-button" href={libraryComposerHref(returnTo,filters.collection)}>자료 추가</Link></header>
 <div className="shelf-workspace"><nav className="shelf-folder-nav" aria-label="서재 위치">{navigation}</nav><div className="shelf-content">
 {!narrowed&&!search&&<RecentReads user={user}/>}
 <section className="shelf-list-section" aria-labelledby="shelf-list-title"><div className="shelf-section-heading"><h2 id="shelf-list-title">{currentCollection?.path||({trash:'휴지통',favorites:'즐겨찾기',unfiled:'미분류'})[filters.scope]||'전체'} <span className="shelf-count">{list.isSuccess?total:''}</span></h2><div className="shelf-list-tools"><label className="shelf-sr" htmlFor="library-sort">정렬</label><select id="library-sort" value={filters.sort} onChange={e=>change({sort:e.target.value})}><option value="newest">최근 저장순</option><option value="opened">최근 열어본 순</option><option value="title">제목순</option>{filters.sort==='level'&&<option value="level">급수순</option>}</select><button onClick={()=>setDialog('filters')} aria-label="자료 필터">필터</button><button aria-pressed={selecting} disabled={busy} onClick={()=>{setSelecting(!selecting);setSelected([]);}}>{selecting?'취소':'선택'}</button></div></div>
 <QueryFailure query={collections} label="폴더"/><QueryFailure query={pinned} label="기기 보관"/><QueryFailure query={list} label="자료 목록"/>
 {filters.collection&&collections.isSuccess&&!currentCollection&&<p role="status">폴더가 없습니다. <button onClick={()=>change({collection:''})}>전체</button></p>}
 {(filters.query||filters.language||filters.kind||filters.state)&&<div className="shelf-result-summary"><span>{filters.query||filters.language||filters.kind||filters.state}</span><button onClick={()=>change({q:'',lang:'',kind:'',state:'',view:'',unread:''})}>조건 지우기</button></div>}
 {selecting&&<div className="shelf-selection-heading"><label><input type="checkbox" aria-label="현재 표시된 자료 선택" checked={items.length>0&&items.every(r=>selectedKeys.has(libraryKey(r)))} disabled={busy} onChange={e=>setSelected(e.target.checked?[...new Map([...selected,...items.map(operationTarget)].map(r=>[libraryKey(r),r])).values()]:selected.filter(r=>!items.some(x=>libraryKey(r)===libraryKey(x))))}/>현재 목록</label><span>{selected.length}개 선택</span>{total>items.length&&<button disabled={busy} onClick={selectAll}>검색 결과 {total}개 선택</button>}</div>}
 {list.isPending&&<p role="status" className="shelf-muted">불러오는 중…</p>}
 <div ref={listRef} tabIndex={-1} className="shelf-list-focus" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();setSelecting(true);setSelected(items.map(operationTarget));}}}>
 {!!items.length&&<ul className="shelf-rows">{items.map(row=><LibraryRow key={libraryKey(row)} row={row} ownerId={user.id} selecting={selecting} selected={selectedKeys.has(libraryKey(row))} disabled={busy} onSelect={toggle} onMenu={value=>{setMenu(value);setError('');}}/>)}</ul>}
 {list.isSuccess&&!items.length&&<div className="shelf-empty"><h3>{trash?'휴지통이 비어 있어요.':'자료가 없어요.'}</h3>{!trash&&<Link className="manabi-button" href={libraryComposerHref(returnTo,filters.collection)}>자료 추가</Link>}</div>}
 </div>
 {list.hasNextPage&&<button className="shelf-load-more" disabled={list.isFetchingNextPage} onClick={()=>{change({shown:items.length+20});list.fetchNextPage();}}>{list.isFetchingNextPage?'불러오는 중…':'더 보기'}</button>}
 </section>
 {selecting&&selected.length>0&&<div className="shelf-selection-bar" aria-label="선택한 자료 작업"><strong>{selected.length}개</strong>{trash?<button disabled={busy||!!pending} onClick={()=>apply('restore')}>복원</button>:<><button disabled={busy||!!pending} onClick={()=>{setMenu(null);setFolder('');setDialog('add');}}>폴더에 추가</button>{filters.collection&&<button disabled={busy||!!pending} onClick={()=>{setMenu(null);setFolder('');setDialog('move');}}>이동</button>}<button disabled={busy||!!pending} onClick={()=>apply('favorite',selected,{value:filters.scope!=='favorites'})}>{filters.scope==='favorites'?'즐겨찾기 해제':'즐겨찾기'}</button><button disabled={busy||!!pending} onClick={()=>{setMenu(null);setDialog('trash');}}>휴지통</button></>}<button disabled={busy} aria-label="선택 해제" onClick={()=>{setSelected([]);setSelecting(false);}}>×</button></div>}
 {error&&<p className="shelf-notice" role="alert">{error}</p>}
 {pending&&!busy&&<div className="shelf-notice" role="status">저장 결과 확인 필요 <button onClick={()=>resume(pending.id,pending.undo)}>다시 확인</button></div>}
 {result&&<div className="shelf-notice" role="status"><span>{counts.undone?`${counts.undone}개 취소됨`:`${counts.success||0}개 완료`}{Object.entries(counts).filter(([k])=>!['success','undone'].includes(k)).reduce((n,[,v])=>n+v,0)>0&&' · 일부 자료는 다시 확인해 주세요.'}</span>{(counts.conflict||counts.unavailable)>0&&<button disabled={busy||!!pending} onClick={async()=>{setBusy(true);try{const failed=result.items.filter(x=>['conflict','unavailable'].includes(x.status));setSelected(await Promise.all(failed.map(x=>currentLibraryTarget(supabase,x))));setSelecting(true);setResult(null);}catch(e){setError(libraryOperationError(e));}finally{setBusy(false);}}}>실패 항목 다시 선택</button>}{counts.success>0&&<button disabled={busy||!!pending} onClick={()=>resume(result.id,true)}>실행 취소</button>}<button aria-label="결과 닫기" disabled={busy} onClick={()=>setResult(null)}>×</button></div>}
 <footer className="shelf-footer"><Link href="/study/library">지난 학습</Link><Link href="/vocab">담은 표현</Link><Link href="/materials?tools=1&view=owned">고급 도구</Link></footer>
 </div></div>
 {dialog==='filters'&&<FilterDialog filters={filters} onApply={change} onClose={close}/>}
 {dialog==='collections'&&<LibraryCollections ownerId={user.id} onClose={close} initialParent={filters.collection} onSelect={id=>change({collection:id,scope:''})}/>}
 {menu&&!dialog&&<LibraryDialog title={menu.title} onClose={close}><div className="shelf-action-list">{menu.state==='trashed'?<button disabled={busy||!!pending||menu.unavailable} onClick={()=>apply('restore',[menu])}>복원</button>:<>
 {!menu.unavailable&&<><button disabled={!!pending} onClick={()=>{setRename(menu.display_title||menu.title);setDialog('rename');}}>이름 변경</button><button disabled={busy||!!pending} onClick={()=>apply('favorite',[menu],{value:!menu.favorite})}>{menu.favorite?'즐겨찾기 해제':'즐겨찾기'}</button><button disabled={!!pending} onClick={()=>{setFolder('');setDialog('add');}}>폴더에 추가</button>{filters.collection&&<><button disabled={!!pending} onClick={()=>{setFolder('');setDialog('move');}}>이동</button><button disabled={busy||!!pending} onClick={()=>apply('remove',[menu],{source:filters.collection})}>이 폴더에서 빼기</button></>}{menu.editable&&<Link href={`/materials/${menu.material_id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>원본 편집</Link>}</>}
 <button disabled={!!pending} onClick={()=>setDialog('trash')}>휴지통으로 이동</button></>}</div></LibraryDialog>}
 {['add','move'].includes(dialog)&&<LibraryDialog title={dialog==='move'?'이동':'폴더에 추가'} onClose={close}><form className="shelf-filter-form" onSubmit={e=>{e.preventDefault();apply(dialog,subject,{folder,source:filters.collection});}}><select aria-label="대상 폴더" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">폴더 선택</option>{folders.filter(f=>dialog!=='move'||f.id!==filters.collection).map(f=><option key={f.id} value={f.id}>{f.path}</option>)}</select>{!folders.length&&<button type="button" onClick={()=>setDialog('collections')}>폴더 만들기</button>}<button className="manabi-button" disabled={!folder||busy}>{dialog==='move'?'이동':'추가'}</button></form></LibraryDialog>}
 {dialog==='rename'&&<LibraryDialog title="이름 변경" onClose={close}><form className="shelf-filter-form" onSubmit={e=>{e.preventDefault();apply('rename',subject,{title:rename});}}><input aria-label="내 서재 표시 이름" maxLength={200} value={rename} onChange={e=>setRename(e.target.value)}/><button type="button" disabled={busy} onClick={()=>apply('rename',subject,{title:''})}>원래 이름 사용</button><button className="manabi-button" disabled={busy||!rename.trim()}>저장</button></form></LibraryDialog>}
 {dialog==='trash'&&<LibraryDialog title="휴지통으로 이동" onClose={close}><p>선택한 {subject.length}개 자료를 옮깁니다. 학습 기록은 남습니다.</p><div className="shelf-dialog-actions"><button disabled={busy} onClick={close}>취소</button><button className="manabi-button" disabled={busy} onClick={()=>apply('trash',subject)}>이동</button></div></LibraryDialog>}
 </div>;
}
