'use client';

import Link from 'next/link';
import { useViewerLanguage } from '../lib/useViewerLanguage';
import { t } from '../lib/viewerMessages';

// 「준비 중」 학습 언어(지금은 한국어)가 주 언어인 계정에 일본어 화면 대신 보이는 안내(ONB-001 D-L4).
// 문구는 내 언어(viewer_language:v1)로 보인다. 판정은 viewerLanguage.isPreparingLearningLanguage 하나다.
export const KOREAN_READING_HREF = '/materials/add?language=Korean';

/** 화면 전체 자리(/study · 서재 · 작문). */
export function PreparingLanguagePage() {
  const { uiLocale } = useViewerLanguage();
  return (
    <div className="page-container preparing-language" style={{ maxWidth: 560, paddingTop: 40 }} lang={uiLocale}>
      <p className="preparing-language__chip"><span>{t(uiLocale, '한국어')}</span> · <span>{t(uiLocale, '준비 중')}</span></p>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '10px 0 8px' }}>{t(uiLocale, '한국어 과정은 준비 중이에요')}</h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
        {t(uiLocale, '한국어 과정은 아직 준비 중이에요. 지금은 읽기 화면에서 한국어 글을 먼저 읽을 수 있고, 화면과 해설은 내 언어로 볼 수 있어요.')}
      </p>
      <div className="manabi-row">
        <Link className="manabi-button" href={KOREAN_READING_HREF}>{t(uiLocale, '한국어 글 읽으러 가기')} <span aria-hidden="true">→</span></Link>
        <Link className="manabi-link" href="/profile">{t(uiLocale, '내 정보에서 배울 언어 바꾸기')}</Link>
      </div>
    </div>
  );
}

/** 한 줄 자리(배움 홈). */
export function PreparingLanguageLine() {
  const { uiLocale } = useViewerLanguage();
  return (
    <p className="preparing-language__line" lang={uiLocale}>
      <span className="preparing-language__chip"><span>{t(uiLocale, '한국어')}</span> · <span>{t(uiLocale, '준비 중')}</span></span>
      {' '}<Link href={KOREAN_READING_HREF}>{t(uiLocale, '읽기 화면에서 한국어 글을 먼저 읽을 수 있어요')} <span aria-hidden="true">→</span></Link>
    </p>
  );
}
