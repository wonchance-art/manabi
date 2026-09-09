'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {useInfiniteQuery,useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import {langNameKo} from '@/lib/constants';
import {pinnedMaterialIds} from '@/lib/offlineCache';
import {fetchLibraryPage,LIBRARY_LANGUAGES,libraryFilters,libraryNarrowed,libraryKey,libraryError,libraryComposerHref,removeFromCollection} from '@/lib/personalLibrary';
import {libraryResume} from '@/lib/libraryActivity';
import {safeLibraryReturn} from '@/lib/libraryReturn';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import LibraryRow,{LibraryCover} from './LibraryRow';
import LibraryCollections,{LibraryDialog,useCollections} from './LibraryCollections';
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
  <p className="shelf-muted">완료는 직접 남긴 글의 읽기 기록입니다. 파일 끝에 도착한 것과는 별개예요.</p><button className="manabi-button" type="submit">적용</button>
 </form></LibraryDialog>;
}
export default function LibraryShelf({user}){
 const params=useSearchParams(),router=useRouter(),cache=useQueryClient();
 const filters=libraryFilters(params),narrowed=libraryNarrowed(filters);
 const [search,setSearch]=useState(filters.query),[dialog,setDialog]=useState(null),[menu,setMenu]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const collections=useCollections(user.id);
 const currentCollection=collections.data?.find(c=>c.id===filters.collection);
 const returnTo=safeLibraryReturn(`/materials?${params}`);
 const pinned=useQuery({queryKey:['library-pinned',user.id],enabled:filters.pinned,queryFn:pinnedMaterialIds,staleTime:0});
 const keyFilters={...filters};delete keyFilters.shown;
 const list=useInfiniteQuery({queryKey:['personal-library',user.id,keyFilters,pinned.data],enabled:!filters.pinned||pinned.isSuccess,initialPageParam:0,
  queryFn:({pageParam})=>fetchLibraryPage(supabase,filters,pageParam,{pinned:pinned.data}),
  getNextPageParam:(last,pages)=>{const length=pages.reduce((n,p)=>n+p.items.length,0);return length<last.total?length:undefined;},staleTime:0});
 const items=list.data?.pages.flatMap(p=>p.items)||[],total=list.data?.pages[0]?.total||0;
 useEffect(()=>setSearch(filters.query),[filters.query]);
 useEffect(()=>{if(items.length<filters.shown&&list.hasNextPage&&!list.isFetching&&!list.isError)list.fetchNextPage();},[filters.shown,items.length,list.hasNextPage,list.isFetching,list.isError,list.fetchNextPage]);
 function change(patch){const next=new URLSearchParams(params.toString());if(!Object.hasOwn(patch,'shown'))next.delete('shown');next.delete('restoreY');for(const [k,v]of Object.entries(patch)){if(v)next.set(k,String(v));else next.delete(k);}router.replace(`/materials${next.size?`?${next}`:''}`,{scroll:false});}
 async function removeMembership(){if(!menu||!filters.collection)return;setBusy(true);setError('');try{await removeFromCollection(supabase,user.id,filters.collection,menu);await cache.invalidateQueries({queryKey:['personal-library',user.id]});setMenu(null);}catch{setError('모음집에서 빼지 못했어요. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function removeSavedReference(){
  if(!menu||menu.owned)return;setBusy(true);setError('');
  try{
   const membership=await supabase.from('library_collection_items').delete().eq('owner_id',user.id).eq('target_kind',menu.target_kind).eq('target_id',menu.target_id);if(membership.error)throw membership.error;
   if(menu.target_kind==='material'){const bookmark=await supabase.from('library_bookmarks').delete().eq('owner_id',user.id).eq('material_id',menu.target_id);if(bookmark.error)throw bookmark.error;}
   await cache.invalidateQueries({queryKey:['personal-library',user.id]});await cache.invalidateQueries({queryKey:['library-bookmark',user.id]});setMenu(null);
  }catch{setError('보관 참조를 모두 해제하지 못했어요. 원문은 그대로입니다. 다시 시도해 주세요.');}finally{setBusy(false);}
 }
 return <div className="shelf-layout"><header className="shelf-header"><h1>내 서재<span>.</span></h1><form role="search" onSubmit={e=>{e.preventDefault();change({q:search.trim()});}}><label className="shelf-sr" htmlFor="library-search">제목·파일명 검색</label><input id="library-search" type="search" maxLength={120} value={search} placeholder="제목이나 파일명으로 찾기" onChange={e=>{setSearch(e.target.value);if(!e.target.value)change({q:''});}}/><button type="submit" aria-label="검색">↗</button></form><Link className="manabi-button" href={libraryComposerHref(returnTo,filters.collection)}>새 자료 <span aria-hidden="true">＋</span></Link></header>
  {!narrowed&&!search&&<RecentReads user={user}/>}
  <section className="shelf-list-section" aria-labelledby="shelf-list-title"><div className="shelf-section-heading"><h2 id="shelf-list-title">{filters.query?'찾은 자료':currentCollection?.name||'모아 둔 자료'}</h2><div className="shelf-list-tools"><label className="shelf-sr" htmlFor="library-sort">정렬</label><select id="library-sort" value={filters.sort} onChange={e=>change({sort:e.target.value})}><option value="newest">최근 저장순</option><option value="opened">최근 열어본 순</option><option value="title">제목순</option>{filters.sort==='level'&&<option value="level">급수순</option>}</select><button onClick={()=>setDialog('filters')} aria-label="자료 필터">필터{filters.language||filters.kind||filters.state||filters.level||filters.pinned?' ·':''}</button></div></div>
   <nav className="shelf-collections" aria-label="모음집"><button aria-pressed={!filters.collection} onClick={()=>change({collection:''})}>전체</button>{collections.data?.slice(0,3).map(c=><button key={c.id} aria-pressed={filters.collection===c.id} onClick={()=>change({collection:c.id})}>{c.name}</button>)}{currentCollection&&!collections.data?.slice(0,3).includes(currentCollection)&&<button aria-pressed="true" onClick={()=>setDialog('collections')}>{currentCollection.name}</button>}<button className="shelf-manage" onClick={()=>setDialog('collections')}>{collections.data?.length?'모음집 관리':'모음집 만들기'} <span aria-hidden="true">＋</span></button></nav>
   <QueryFailure query={collections} label="모음집"/>
   {filters.collection&&collections.isSuccess&&!currentCollection&&<p className="shelf-query-error" role="status">이 모음집을 찾을 수 없어요. <button onClick={()=>change({collection:''})}>전체 자료 보기</button></p>}
   {narrowed&&<div className="shelf-result-summary"><p role="status">{filters.query&&`‘${filters.query}’ · `}{list.isSuccess?`${total}개 자료`:'조건 확인 중…'}</p><button onClick={()=>{setSearch('');router.replace('/materials',{scroll:false});}}>조건 지우기</button></div>}
   {!!list.data?.pages[0]?.unavailable&&<p className="shelf-query-error" role="status">원문을 열 수 없는 보관 참조가 {list.data.pages[0].unavailable}개 있어요. 원문 삭제나 공개 범위 변경 때문일 수 있습니다. 개인 표현·복습 기록은 그대로 남습니다.</p>}
   {list.isPending&&<div className="shelf-loading" role="status">자료를 불러오고 있어요…<i/><i/><i/></div>}
   <QueryFailure query={pinned} label="이 기기의 보관 자료"/>
   {list.isError&&<QueryFailure query={list} label="자료 목록"/>}
   {!!items.length&&<ul className="shelf-rows">{items.map(row=><LibraryRow key={libraryKey(row)} row={row} ownerId={user.id} onMenu={value=>{setMenu(value);setError('');}}/>)}</ul>}
   {list.isSuccess&&!items.length&&<div className="shelf-empty"><span className="shelf-empty-mark" aria-hidden="true">m.</span><h3>{narrowed?'이 조건의 자료가 없어요.':'아직 비어 있는 나만의 책장.'}</h3><p>{narrowed?'조건을 줄이거나 이곳에 새 자료를 담아 보세요.':'읽고 싶은 글, 파일, 링크를 한곳에 모아 두세요.'}</p><Link className="manabi-button" href={libraryComposerHref(returnTo,filters.collection)}>{narrowed?'새 자료':'첫 자료 만들기'} ＋</Link>{!narrowed&&<Link className="manabi-link" href="/discover">읽을거리 둘러보기 ↗</Link>}</div>}
   {list.hasNextPage&&<button className="shelf-load-more" disabled={list.isFetchingNextPage} onClick={()=>{change({shown:items.length+20});list.fetchNextPage();}}>{list.isFetchingNextPage?'불러오는 중…':`더 보기 · ${total-items.length}개 남음`} ↓</button>}
   {!!items.length&&!list.hasNextPage&&<p className="shelf-list-end">{total}개 자료를 모아 두었어요.</p>}
  </section>
  <footer className="shelf-footer"><Link href="/study/library">지난 학습 문단 ↗</Link><Link href="/vocab">담은 표현 ↗</Link><Link href="/materials?tools=1&view=owned">고급 보관 도구 ↗</Link><Link href="/discover?view=reading">공개 읽을거리 ↗</Link></footer>
  {dialog==='filters'&&<FilterDialog filters={filters} onApply={change} onClose={()=>setDialog(null)}/>}
  {dialog==='collections'&&<LibraryCollections ownerId={user.id} onClose={()=>setDialog(null)} onSelect={id=>change({collection:id})}/>}
  {dialog?.target&&<LibraryCollections ownerId={user.id} target={dialog.target} onClose={()=>setDialog(null)}/>}
  {menu&&<LibraryDialog title="자료 더보기" onClose={()=>!busy&&setMenu(null)}><p className="shelf-dialog-intro">{menu.title}</p><div className="shelf-action-list">{menu.editable&&<Link href={`/materials/${menu.material_id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>글과 첨부 수정 ↗</Link>}<button onClick={()=>{setDialog({target:menu});setMenu(null);}}>모음집에 담기</button>{filters.collection&&<button disabled={busy} onClick={removeMembership}>이 모음집에서 빼기</button>}{!menu.owned&&<button disabled={busy} onClick={removeSavedReference}>서재 보관 해제</button>}{menu.owned&&<Link href={`/materials?tools=1&view=owned&q=${encodeURIComponent(menu.title)}`}>보관 도구 열기 ↗</Link>}</div>{!menu.owned&&<p className="shelf-muted">보관을 해제하면 내 모음집의 참조도 정리됩니다. 공개 원문과 개인 표현·복습 기록은 남습니다.</p>}{filters.collection&&<p className="shelf-muted">이 모음집에서만 빼려면 ‘이 모음집에서 빼기’를 선택하세요.</p>}{error&&<p role="alert">{error}</p>}</LibraryDialog>}
 </div>;
}
