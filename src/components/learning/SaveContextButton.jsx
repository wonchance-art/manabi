'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/AuthContext';
import './learning.css';

export async function saveContext(payload) {
  const response = await fetch('/api/learning/vocabulary', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || '저장하지 못했어요.'), result);
  return result;
}

export default function SaveContextButton({ word, source, label = '복습에 담기', onSaved, preparePayload }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pending,setPending] = useState(false), [message,setMessage] = useState(''), [error,setError] = useState(''), [conflict,setConflict] = useState(null);
  const busy = useRef(false);
  const pendingPayload = useRef(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function save(confirm) {
    if (busy.current) return;
    const accountId = user.id;
    busy.current=true;setPending(true);setError('');setMessage('');
    try {
      // Confirm exactly the snapshot shown to the learner, without another generation.
      const payload = confirm && conflict?.payload ? conflict.payload
        : preparePayload ? await preparePayload() : {word, source};
      if (!live.current) return;
      pendingPayload.current = payload;
      const result = await saveContext({...payload,...(confirm ? {confirmId:confirm.id,confirmMeaning:confirm.meaning} : {})});
      for (const key of ['vocab','vocab-words','pdf-saved-vocab','vocabulary-contexts','book-review']) queryClient.invalidateQueries({queryKey:[key,accountId]});
      if (!live.current) return;
      setConflict(null);setMessage(result.contextAdded ? '출처와 함께 담았어요. 기존 복습 일정은 유지됩니다.' : '이미 담아둔 문맥이에요.');
      onSaved?.(result);
    } catch(cause) {
      if (!live.current || cause.name === 'AbortError') return;
      if(cause.code === 'meaning_conflict' && cause.existing) setConflict({...cause, payload: pendingPayload.current});
      else setError(cause.message);
    } finally {busy.current=false;if (live.current) setPending(false);}
  }
  if (!user) return <p className="learning-links__muted">로그인하면 출처와 함께 복습에 담을 수 있어요.</p>;
  return <div className="learning-context-save">
    <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={()=>save()}>{pending?'저장 중…':label}</button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {conflict && <div className="learning-context-confirm" role="group" aria-label="뜻 확인">
      <p>기존 뜻: <strong>{conflict.existing.meaning || '(없음)'}</strong></p>
      <p>이번 뜻: <strong>{conflict.incomingMeaning}</strong></p>
      <p>같은 뜻인 경우에만 기존 카드에 문맥을 추가해 주세요.</p>
      <button type="button" className="btn btn--primary btn--sm" disabled={pending} onClick={()=>save(conflict.existing)}>같은 뜻이에요 · 문맥 추가</button>
      <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={()=>setConflict(null)}>취소</button>
    </div>}
  </div>;
}
