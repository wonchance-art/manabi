'use client';

import { useEffect, useState } from 'react';

/** 구판 출처 링크로 들어왔을 때 바뀐 내용을 조용히 알려 준다. 열람으로 복습을 채점하지 않는다. */
export default function ChapterSourceNotice({ revision }) {
  const [changed, setChanged] = useState(false);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const update = () => {
      const requested = new URLSearchParams(window.location.search).get('sourceRevision');
      setChanged(!!requested && requested !== revision);
      const anchor = window.location.hash.slice(1);
      setMissing(anchor.startsWith('tb-') && !document.getElementById(anchor));
    };
    update();
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, [revision]);
  if (!changed && !missing) return null;
  return <p role="status" className="card" style={{ padding: '12px 16px', lineHeight: 1.7 }}>
    {missing ? '예문의 위치가 바뀌었어요. 이 단원에서 최신 설명을 확인해 주세요.'
      : '복습을 시작한 뒤 교재 내용이 수정됐어요. 지금은 최신 내용을 보고 있습니다.'}
  </p>;
}
