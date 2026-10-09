'use client';
// 문장 탭 선처리 — 카드가 열린 채 같은 줄에 0.3초 머물면 start() 1회(뷰어 v2 AE-R2 정본 §4 「시작」).
// lineKey가 null이면(시트 닫힘·수업 모드·게스트·무id 리스트 단어) 타이머를 취소한다. 같은 줄의 다른 단어는
// 키가 같아 다시 세지 않는다. 시간 규칙은 createDwellTrigger(순수, 가짜 타이머 계약)에 있다.
import { useEffect, useRef } from 'react';
import { createDwellTrigger } from './sentenceTranslation.js';

export function useSentencePrefetch({ lineKey, start }) {
  const startRef = useRef(start);
  startRef.current = start;
  const trigger = useRef(null);
  if (!trigger.current) trigger.current = createDwellTrigger({ onFire: () => { startRef.current?.(); } });
  useEffect(() => { trigger.current.update(lineKey); }, [lineKey]);
  useEffect(() => {
    const t = trigger.current;
    return () => t.dispose();
  }, []);
}
