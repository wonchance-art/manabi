'use client';
import {useEffect,useState} from 'react';
import {listCloudBoards} from '../../lib/teachingBoardCloudClient';

export default function BoardCloudPanel({mode,active,rootId,day,store,onBackup,onBeforeAction,onOpen}){
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[attempt,setAttempt]=useState(0),[truncated,setTruncated]=useState(false);
 useEffect(()=>{
  if(!active||mode!=='history')return;let alive=true;setError('');setRows(null);
  listCloudBoards(rootId).then(value=>{if(alive){setRows(value.boards||[]);setTruncated(!!value.truncated);}}).catch(error=>{if(alive)setError(error.message);});return()=>{alive=false;};
 },[mode,active,rootId,attempt]);
 const act=async fn=>{if(busy)return;setBusy(true);setError('');try{onBeforeAction();await store.flush?.();await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(mode==='status')return <div className="board-cloud-panel"><p role="status"><strong>{store.label}</strong></p>{store.updatedAt&&<p>마지막 계정 저장 · {new Date(store.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</p>}<p>{store.localSaved?'이 기기에도 필기를 보관하고 있어요.':'기기 저장 상태를 확인해 주세요.'}</p><div className="board-cloud-actions"><button disabled={busy||store.conflict} onClick={()=>act(()=>store.sync())}>지금 저장</button><button onClick={onBackup}>백업 내려받기</button><button disabled={busy} onClick={()=>act(()=>store.reload())}>{store.conflict?'내 초안 보관 후 최신 판 열기':'최신 판 확인'}</button></div>{error&&error!==store.error&&<p role="alert">{error}</p>}</div>;
 return <div className="board-cloud-panel"><label>날짜 찾기<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 2026-09"/></label>{error?<p role="alert">{error} <button onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></p>:rows===null?<p role="status">지난 설명판을 불러오고 있어요…</p>:<><ul className="board-cloud-history">{rows.filter(r=>r.day.includes(query.trim())).map(row=><li key={row.id}><button disabled={busy||row.day===day} aria-current={row.day===day?'date':undefined} onClick={()=>act(()=>onOpen(row.day))}><span><b>{row.day}{row.day===day?' · 현재 수업':''}</b><small>{row.pages}개 판</small></span><span aria-hidden="true">↗</span></button></li>)}</ul>{!rows.length&&<p>계정에 저장한 설명판이 아직 없어요.</p>}{!!rows.length&&!rows.some(r=>r.day.includes(query.trim()))&&<p>해당 날짜의 설명판이 없어요.</p>}{truncated&&<p>최근 100개 수업을 표시합니다.</p>}</>}</div>;
}
