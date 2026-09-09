'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { readingSourceTarget, UUID } from '../../lib/learningSources';

export default function ReadingSourceFocus({ materialId, ready, json, onTarget }) {
  const {user,loading}=useAuth();
  const userId=user?.id;
  const params=useSearchParams(),search=params.toString();
  const [message,setMessage]=useState(''),[retry,setRetry]=useState(0),[failed,setFailed]=useState(false);
  const completed=useRef(null);
  useEffect(()=>{
    const source=new URLSearchParams(search),contextId=source.get('sourceContext');
    const scope=`${userId || 'guest'}:${materialId}:${search}:${retry}`;
    if(completed.current===scope || !ready || (contextId && loading)) return;
    onTarget(null);setMessage('');setFailed(false);
    if(!source.has('sourceContext')&&!source.has('sourceToken')&&!source.has('sourceText')) return;
    const request=new AbortController();
    let interacted=false;
    const stop=()=>{interacted=true;completed.current=scope;};
    window.addEventListener('pointerdown',stop,{capture:true,once:true});
    window.addEventListener('keydown',stop,{capture:true,once:true});
    async function focus() {
      let context={locator:{tokenId:source.get('sourceToken'),surface:source.get('sourceText')}};
      if(source.has('sourceContext')) {
        if(!UUID.test(contextId || '')) {setMessage('저장한 문맥 주소를 확인해 주세요.');return;}
        if(!userId) {setMessage('저장한 문맥은 로그인 후 확인할 수 있어요.');return;}
        const response=await fetch(`/api/learning/vocabulary?contextId=${encodeURIComponent(contextId)}&materialId=${encodeURIComponent(materialId)}`,{cache:'no-store',signal:request.signal});
        const result=await response.json();
        if(!response.ok) throw new Error(response.status===404?'이 문맥의 원문을 더 이상 열 수 없어요.':'저장한 문맥을 불러오지 못했어요.');
        context=result.context;
      }
      if(request.signal.aborted || interacted) return;
      completed.current=scope;
      const tokenId=readingSourceTarget(json,context);
      const target=tokenId?[...document.querySelectorAll('[data-source-token]')].find(el=>el.dataset.sourceToken===tokenId):null;
      if(!target) {setMessage('예문의 위치가 바뀌었거나 같은 표현이 여러 곳에 있어요. 저장한 문맥과 함께 확인해 주세요.');return;}
      onTarget(tokenId);
      target.scrollIntoView({block:'center'});
    }
    focus().catch(error=>{if(!request.signal.aborted&&!interacted){setMessage(error.message);setFailed(true);}});
    return ()=>{request.abort();window.removeEventListener('pointerdown',stop,true);window.removeEventListener('keydown',stop,true);};
  },[materialId,ready,json,onTarget,search,userId,loading,retry]);
  return message?<p className="learning-links" role="status">{message}{failed&&<button className="btn btn--ghost btn--sm" onClick={()=>setRetry(n=>n+1)}>다시 시도</button>}</p>:null;
}
