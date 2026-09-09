'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/AuthContext';
import './learning.css';

export default function MaterialChapterLinks({ lang, slug, kind, materialId }) {
  const {user}=useAuth();
  const [open,setOpen]=useState(false),[selected,setSelected]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
  const params=new URLSearchParams({lang,...(slug?{slug}:{kind,id:String(materialId)})});
  const {data,isLoading,error:loadError,refetch}=useQuery({queryKey:['material-chapter-links',user?.id,lang,slug,kind,materialId],enabled:!!user&&open,
    queryFn:async()=>{const response=await fetch(`/api/learning/material-links?${params}`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}});
  async function change(method,payload){if(pending)return;setPending(true);setError('');try{
    const response=await fetch('/api/learning/material-links',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw new Error(result.error);setSelected('');await refetch();
  }catch(cause){setError(cause.message);}finally{setPending(false);}}
  function connect(){if(slug){const found=data.candidates.find(c=>`${c.kind}:${c.id}`===selected);if(found)change('POST',{lang,slug,kind:found.kind,materialId:found.id});}
    else if(selected)change('POST',{lang,slug:selected,kind,materialId});}
  return <details className="learning-links" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{slug?'자료와 함께 복습하기':'연결한 교재 단원'}</summary>
    <p className="learning-links__muted">연결 목록은 나에게만 보입니다. 자료의 공개 범위는 바뀌지 않습니다.</p>
    {!user?<p>로그인하면 자료와 교재를 연결할 수 있어요.</p>:<>
      {isLoading&&<p role="status">불러오는 중…</p>}
      {(error||loadError)&&<p role="alert">{error||loadError.message}</p>}
      {loadError&&<button type="button" className="btn btn--ghost btn--sm" onClick={()=>refetch()}>다시 시도</button>}
      {data&&<>
        <ul>{data.links.map(link=><li key={link.id} className="learning-links__row"><Link href={link.href}>{link.title||'제목 없는 자료'}</Link>
          <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={()=>change('DELETE',{id:link.id})} aria-label={`${link.title} 연결 해제`}>연결 해제</button></li>)}</ul>
        {!data.links.length&&<p>아직 연결한 {slug?'자료가':'단원이'} 없어요.</p>}
        <label>{slug?'내 자료 선택':'교재 단원 선택'}<select aria-label={slug?'내 자료 선택':'교재 단원 선택'} value={selected} onChange={e=>setSelected(e.target.value)} disabled={pending}>
          <option value="">선택해 주세요</option>
          {slug?data.candidates.map(c=><option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>{c.kind==='pdf'?'PDF · ':''}{c.title||'제목 없는 자료'}</option>)
            :data.catalog.map(level=><optgroup key={level.level} label={level.level}>{level.chapters.map(c=><option key={c.slug} value={c.slug}>{c.title}</option>)}</optgroup>)}
        </select></label>
        <button type="button" className="btn btn--primary btn--sm" disabled={!selected||pending} onClick={connect}>{pending?'저장 중…':'연결하기'}</button>
      </>}
    </>}
  </details>;
}
