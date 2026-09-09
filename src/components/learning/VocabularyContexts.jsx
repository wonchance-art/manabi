'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/AuthContext';
import { splitSentenceAroundWord } from '../../lib/constants';
import { reviewSourceContexts } from '../../lib/learningSources';
import './learning.css';

export default function VocabularyContexts({ vocabularyId, readOnly = false, word = null }) {
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
  const {primary,others}=word?reviewSourceContexts(word,data || []):{primary:null,others:data || []};
  return <>
    {primary&&<section className="review-card__context" aria-label="저장한 문맥">
      {primary.quote&&<p className="review-card__source">{(()=>{
        const {parts,term}=splitSentenceAroundWord(primary.quote,primary.locator?.surface || word.word_text,word.base_form);
        return parts.map((part,i)=><span key={i}>{part}{i<parts.length-1&&<mark className="review-card__highlight">{term}</mark>}</span>);
      })()}</p>}
      {primary.href&&<p className="review-room-source-link"><Link href={primary.href} target="_blank" rel="noopener noreferrer" prefetch={false}>{primary.legacy?'원문 열기 ↗':'이 문장 열기 ↗'}</Link><small>새 탭에서 확인한 뒤 이 카드로 돌아오세요.</small></p>}
    </section>}
    {error&&<p className="learning-links__muted">추가 문맥을 불러오지 못했어요. <button type="button" className="btn btn--ghost btn--sm" onClick={()=>refetch()}>다시 시도</button></p>}
    {others.length>0&&<details className="learning-links"><summary>{word?'다른 문맥':'이 표현을 만난 문맥'} {others.length}개</summary><ul>
    {others.map(context=><li key={context.id}>
      <p className="learning-source-quote">{context.quote}</p>{context.translation&&<p>{context.translation}</p>}
      <Link href={context.href} target="_blank" rel="noopener noreferrer" prefetch={false}>{context.kind==='textbook'?'교재 예문':context.kind==='pdf'?`PDF${context.locator?.page?` ${context.locator.page}쪽`:''}`:'자료 속 문장'} 열기 ↗</Link>
      {!readOnly && <button type="button" className="btn btn--ghost btn--sm" disabled={!!removing} onClick={()=>remove(context.id)}>{removing===context.id?'지우는 중…':'이 문맥만 지우기'}</button>}
    </li>)}
  </ul><p className="learning-links__muted">{readOnly ? '원문은 새 탭에서 열려요. 이 탭으로 돌아오면 복습을 이어갈 수 있어요.' : '문맥을 지워도 단어 카드와 복습 일정은 유지돼요.'}</p>{removeError&&<p role="alert">{removeError}</p>}</details>}
  </>;
}
