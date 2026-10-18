'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { STUDY_UNAVAILABLE_COPY as COPY } from '../lib/studyUnavailable';

/**
 * 학습 기록 저장소를 읽지 못했을 때의 /study(STUDY-UNAVAILABLE-001). 다시 시도 = 같은 주소의 서버 조립을 다시 부른다(router.refresh).
 * 단어장으로 = 기기에 남은 단어장 · 보류함을 볼 수 있는 곳.
 */
export default function StudyUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>{COPY.title}</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px' }}>{COPY.body}</p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary btn--md" disabled={pending}
          onClick={() => startTransition(() => router.refresh())}>{COPY.retry}</button>
        <Link href="/vocab" className="btn btn--ghost btn--md">{COPY.vocab}</Link>
      </div>
    </div>
  );
}
