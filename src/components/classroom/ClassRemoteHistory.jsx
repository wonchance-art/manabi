'use client';
import {useEffect,useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {readUnlock} from '../../lib/classClient';
import ClassStudyHistory from './ClassStudyHistory';
export default function ClassRemoteHistory({team,user,...props}){
 const [search,setSearch]=useState(''),[term,setTerm]=useState(''),[extras,setExtras]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setTerm(search),250);return()=>clearTimeout(timer);},[search]);
 const query=useInfiniteQuery({queryKey:['class-history',team,user?.id,term,extras],initialPageParam:0,retry:false,queryFn:async({pageParam,signal})=>{
  const token=readUnlock(team)?.token;if(!token)throw new Error('수업 페이지에서 암호를 다시 입력해 주세요.');
  const response=await fetch(`/api/class/${encodeURIComponent(team)}/history?${new URLSearchParams({q:term,extras:String(extras),offset:String(pageParam)})}`,{signal,headers:{'x-class-token':token},cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'수업 기록을 불러오지 못했어요.');return result;
 },getNextPageParam:last=>last.next??undefined});
 return <>{query.isLoading&&<p role="status">수업 기록을 불러오는 중…</p>}{query.error&&<p role="alert">{query.error.message} <button onClick={()=>query.refetch()}>다시 불러오기</button></p>}
 <ClassStudyHistory {...props} showEmpty={!query.isLoading&&!query.error} notes={query.data?.pages.flatMap(p=>p.notes)||[]} coverage={query.data?.pages[0]?.coverage||[]} remote={{search,setSearch,extras,setExtras}}/>
 {query.hasNextPage&&<button className="classroom-button classroom-button--quiet" disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>{query.isFetchingNextPage?'불러오는 중…':'이전 수업 더 보기'}</button>}</>;
}
