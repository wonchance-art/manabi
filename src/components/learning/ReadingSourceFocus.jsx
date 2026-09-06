'use client';
import { useEffect, useState } from 'react';

export default function ReadingSourceFocus({ materialId, ready, onTarget }) {
  const [message,setMessage]=useState('');
  useEffect(()=>{
    onTarget(null);
    if(!ready)return;
    setMessage('');
    const params=new URLSearchParams(window.location.search),id=params.get('sourceToken'),text=params.get('sourceText');
    if(!id&&!text)return;
    const nodes=[...document.querySelectorAll('[data-source-token]')];
    // 재분석 후 토큰 ID가 다른 문장에 재사용되었을 수 있어 표면형도 확인한다.
    let matches=id?nodes.filter(el=>el.dataset.sourceToken===id&&(!text||el.dataset.sourceText===text)):[];
    if(matches.length!==1&&text)matches=nodes.filter(el=>el.dataset.sourceText===text);
    if(matches.length!==1){setMessage('예문의 위치가 바뀌었거나 같은 표현이 여러 곳에 있어요. 저장한 문맥과 함께 확인해 주세요.');return;}
    const target=matches[0];
    // React owns the token class. Direct classList changes disappear when saved-word
    // queries resolve and React updates that same node's className.
    onTarget(target.dataset.sourceToken);
    target.scrollIntoView({block:'center'});
    return ()=>onTarget(null);
  },[materialId,ready,onTarget]);
  return message?<p className="learning-links" role="status">{message}</p>:null;
}
