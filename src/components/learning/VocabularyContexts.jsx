'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/AuthContext';
import './learning.css';

export default function VocabularyContexts({ vocabularyId }) {
  const {user}=useAuth();
  const [removing,setRemoving]=useState(null),[removeError,setRemoveError]=useState('');
  const {data,error,refetch}=useQuery({queryKey:['vocabulary-contexts',user?.id,vocabularyId],enabled:!!user&&!!vocabularyId,
    queryFn:async()=>{const response=await fetch(`/api/learning/vocabulary?id=${encodeURIComponent(vocabularyId)}`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);return result.contexts;}});
  async function remove(id) {
    setRemoving(id);setRemoveError('');
    try {
      const response=await fetch('/api/learning/vocabulary',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || '문맥을 지우지 못했어요.');
      await refetch();
    } catch(cause) {setRemoveError(cause.message);} finally {setRemoving(null);}
  }
  if(error)return <p className="learning-links__muted">추가 문맥을 불러오지 못했어요. <button type="button" className="btn btn--ghost btn--sm" onClick={()=>refetch()}>다시 시도</button></p>;
  if(!data?.length)return null;
  return <details className="learning-links"><summary>이 표현을 만난 문맥 {data.length}개</summary><ul>
    {data.map(context=><li key={context.id}>
      <p className="learning-source-quote">{context.quote}</p>{context.translation&&<p>{context.translation}</p>}
      <Link href={context.href} target="_blank" rel="noopener noreferrer" prefetch={false}>{context.kind==='textbook'?'교재 예문':context.kind==='pdf'?`PDF${context.locator?.page?` ${context.locator.page}쪽`:''}`:'자료 속 문장'} 열기 ↗</Link>
      <button type="button" className="btn btn--ghost btn--sm" disabled={!!removing} onClick={()=>remove(context.id)}>{removing===context.id?'지우는 중…':'이 문맥만 지우기'}</button>
    </li>)}
  </ul><p className="learning-links__muted">문맥을 지워도 단어 카드와 복습 일정은 유지돼요.</p>{removeError&&<p role="alert">{removeError}</p>}</details>;
}
