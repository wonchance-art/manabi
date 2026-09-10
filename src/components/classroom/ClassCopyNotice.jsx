'use client';
import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {requestClassCopy} from '../../lib/classCopyClient';
import './classroom-reader.css';

export default function ClassCopyNotice({material,user,returnTo}){
  const match=/^\/class\/([a-z0-9][a-z0-9-]{0,15})(?:\?|$)/.exec(returnTo||'');
  const team=match?.[1],sourceId=material?.processed_json?.metadata?.source_ref;
  const query=useQuery({queryKey:['class-copy-status',user?.id,team,sourceId],queryFn:()=>requestClassCopy(team,sourceId,'inspect'),enabled:!!user&&!!team&&!!sourceId,staleTime:60000,retry:false});
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const client=useQueryClient(),trigger=useRef(null),dialog=useRef(null);
  if(!user||!team||!sourceId)return null;
  const state=query.data;
  const close=()=>{setOpen(false);trigger.current?.focus();};
  async function update(){
    setBusy(true);setError('');
    try{await requestClassCopy(team,sourceId,'update',{copyRevision:state.copyRevision,sourceRevision:state.sourceRevision});await client.invalidateQueries({queryKey:['material',String(material.id)]});await query.refetch();close();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="class-copy-notice">
    {query.isLoading?<span role="status">수업의 새 내용을 확인하고 있어요…</span>:query.error?<span>새 내용을 확인하지 못했어요. <button onClick={()=>query.refetch()}>다시 확인</button></span>
      :state?.copyId&&String(state.copyId)!==String(material.id)?<span>별도로 보관한 사본입니다. 이 자료는 자동으로 변경하지 않습니다.</span>
      :['update','blocked'].includes(state?.state)?<><span>수업의 현재 내용과 차이가 있어요.</span><button ref={trigger} onClick={()=>{setOpen(true);requestAnimationFrame(()=>dialog.current?.focus());}}>변경 내용 보기</button></>:null}
    {open&&<div className="class-copy-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)close();}}><section ref={dialog} className="class-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="class-copy-title" tabIndex={-1} onKeyDown={e=>{
      if(e.key==='Escape'&&!busy){e.stopPropagation();close();}
      if(e.key==='Tab'){const nodes=[...e.currentTarget.querySelectorAll('button:not(:disabled),[href],input')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===e.currentTarget)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    }}><h2 id="class-copy-title">수업의 새 내용</h2><p>{state.summary?.added?`표현 ${state.summary.added}개 추가 · `:''}{state.summary?.preserved?`내 교정 ${state.summary.preserved}곳 유지`:'내 학습 기록은 유지됩니다.'}</p>
      {state.summary?.meanings?.length>0&&<section className="class-copy-meanings" aria-label="달라진 뜻"><b>뜻 수정 {state.summary.meanings.length}개</b><ul>{state.summary.meanings.slice(0,20).map((change,i)=><li key={i}><strong>{change.text}</strong><span>{change.before||'뜻 없음'} → {change.after||'뜻 없음'}</span>{change.personal&&<small>내가 고친 뜻 유지</small>}</li>)}</ul>{state.summary.meanings.length>20&&<small>앞의 20개를 표시합니다.</small>}</section>}
      {state.reason&&<p>{state.reason}</p>}<details><summary>선생님의 현재 내용 보기</summary><pre>{state.preview}</pre></details>
      {error&&<p role="alert">{error}</p>}<footer>{state.state==='update'&&<button disabled={busy} onClick={update}>{busy?'반영 중…':'변경 내용 반영'}</button>}<button disabled={busy} onClick={close}>지금 자료로 계속 읽기</button></footer>
    </section></div>}
  </div>;
}
