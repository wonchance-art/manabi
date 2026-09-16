'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useInfiniteQuery,useQueryClient} from '@tanstack/react-query';
import {listCloudBoards} from '../../lib/teachingBoardCloudClient';
import {boardHistoryGroups,boardHistoryPeriod,boardHistoryRange} from '../../lib/teachingBoardHistory';
import BoardReusePanel from './BoardReusePanel';

// This component stays mounted when its menu closes. Only metadata is cached;
// the much larger source document lives in the mounted preview, never Query.
export default function BoardHistoryBrowser({owner,active,rootId,day,store,pages,onCopy,onPick,onOpen,busy,actionError}) {
  const client=useQueryClient(),list=useRef(null),position=useRef(0),focusDay=useRef(null);
  const [period,setPeriod]=useState('all'),[range,setRange]=useState({from:'',to:''}),[draft,setDraft]=useState({from:'',to:''});
  const [validation,setValidation]=useState(''),[sourceDay,setSourceDay]=useState(null),[denied,setDenied]=useState(false);
  const queryKey=['teaching-board-history',owner,String(rootId),range.from,range.to];
  const query=useInfiniteQuery({queryKey,enabled:active&&!!owner&&!denied,initialPageParam:null,retry:false,
    staleTime:Infinity,gcTime:5*60*1000,refetchOnWindowFocus:false,
    queryFn:({pageParam,signal})=>listCloudBoards(rootId,{...range,cursor:pageParam,signal}),
    getNextPageParam:page=>page.nextCursor??undefined});
  const {error}=query;
  useEffect(()=>{
    if(![401,403].includes(error?.status))return;
    setDenied(true);setSourceDay(null);
    client.removeQueries({queryKey:['teaching-board-history',owner,String(rootId)]});
  },[error,client,owner,rootId]);
  useEffect(()=>()=>{client.removeQueries({queryKey:['teaching-board-history',owner,String(rootId)]});},[client,owner,rootId]);
  useEffect(()=>{
    if(!active)setSourceDay(null);
    return ()=>{client.cancelQueries({queryKey:['teaching-board-history',owner,String(rootId),range.from,range.to],exact:true});};
  },[active,owner,rootId,range.from,range.to,client]);
  useLayoutEffect(()=>{
    if(!active||sourceDay)return;
    if(list.current)list.current.scrollTop=position.current;
    const frame=requestAnimationFrame(()=>{list.current?.querySelector(`[data-source-day="${focusDay.current}"]`)?.focus({preventScroll:true});});
    return()=>cancelAnimationFrame(frame);
  },[active,sourceDay]);
  const apply=next=>{position.current=0;focusDay.current=null;setRange(next);if(list.current)list.current.scrollTop=0;setValidation('');};
  const refresh=()=>{if(['month','previous'].includes(period)){const next=boardHistoryPeriod(period);if(next.from!==range.from||next.to!==range.to){apply(next);return;}}query.refetch();};
  const changePeriod=value=>{setPeriod(value);setValidation('');if(value!=='custom')apply(boardHistoryPeriod(value));};
  const applyCustom=event=>{event.preventDefault();try{if(!draft.from||!draft.to)throw Error('시작일과 종료일을 모두 선택해 주세요.');apply(boardHistoryRange(draft.from,draft.to));}catch(e){setValidation(e.message);}};
  const rows=query.data?.pages.flatMap(page=>page.boards)||[],groups=boardHistoryGroups(rows);
  if(denied)return <p role="alert">이 수업의 선생님만 지난 설명판을 열 수 있어요. 수업 권한을 확인해 주세요.</p>;
  return <div className="board-history-browser">
    <div className="board-history-list" hidden={!!sourceDay}>
      <p className="board-menu-caption">현재 수업 · {day}</p>
      <div className="board-history-filter"><label>기간<select aria-label="설명판 기간" value={period} onChange={e=>changePeriod(e.target.value)}><option value="all">전체 기간</option><option value="month">이번 달</option><option value="previous">지난달</option><option value="custom">기간 지정</option></select></label><button disabled={query.isFetching} onClick={refresh}>새로고침</button></div>
      {period==='custom'&&<form className="board-history-dates" onSubmit={applyCustom} noValidate>
        <label>시작일<input type="date" min="1900-01-01" max="2200-12-31" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label>
        <label>종료일<input type="date" min="1900-01-01" max="2200-12-31" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label><button type="submit">적용</button>
        {validation&&<p role="alert">{validation}</p>}
      </form>}
      <div className="board-history-scroll" ref={list} onScroll={e=>{if(active&&!sourceDay)position.current=e.currentTarget.scrollTop;}}>
        {query.isPending&&<p role="status">지난 설명판을 불러오고 있어요…</p>}
        {error&&!query.isFetchNextPageError&&<p role="alert">{rows.length?'목록을 새로고침하지 못했어요. ':''}{error.message} <button disabled={query.isFetching} onClick={()=>query.refetch()}>다시 불러오기</button></p>}
        {groups.map(group=><section key={group.month} className="board-history-month" aria-label={group.month}><h3>{Number(group.month.slice(0,4))}년 {Number(group.month.slice(5))}월</h3><ul className="board-cloud-history">{group.rows.map(row=><li key={row.id}><div className="board-cloud-history-row"><button data-source-day={row.day} aria-label={`${row.day} 설명판 살펴보기`} disabled={busy||row.day===day} aria-current={row.day===day?'date':undefined} onClick={()=>{position.current=list.current?.scrollTop||0;focusDay.current=row.day;setSourceDay(row.day);}}><span><b>{Number(row.day.slice(5,7))}.{Number(row.day.slice(8))} {new Date(`${row.day}T12:00:00+09:00`).toLocaleDateString('ko-KR',{weekday:'long',timeZone:'Asia/Seoul'})}</b><small>{row.day===day?'현재 수업':`${row.pages}쪽`}</small></span><span aria-hidden="true">›</span></button></div></li>)}</ul></section>)}
        {!query.isPending&&!error&&!rows.length&&<p>{range.from?'이 기간에 저장한 설명판이 없어요.':'계정에 저장한 설명판이 아직 없어요.'}</p>}
        {query.isFetchNextPageError&&<p role="alert">이전 수업을 더 불러오지 못했어요. 지금 목록은 그대로예요.</p>}
        {query.hasNextPage&&<button className="board-history-more" disabled={query.isFetching} onClick={()=>query.fetchNextPage()}>{query.isFetchingNextPage?'불러오는 중…':query.isFetchNextPageError?'이전 수업 다시 불러오기':'이전 수업 더 보기'}</button>}
      </div>
      <p className="board-history-count" role="status">{rows.length?`${rows.length}개 수업${!query.hasNextPage?' · 마지막 수업까지 확인했어요.':''}`:''}</p>
    </div>
    {sourceDay&&active&&<BoardReusePanel key={sourceDay} rootId={rootId} sourceDay={sourceDay} day={day} pages={pages} blocked={store.conflict} onCopy={onCopy} onPick={onPick} onBack={()=>setSourceDay(null)} onOpen={()=>onOpen(sourceDay)} opening={busy} actionError={actionError} onDenied={()=>{setDenied(true);setSourceDay(null);client.removeQueries({queryKey:['teaching-board-history',owner,String(rootId)]});}}/>}
  </div>;
}
