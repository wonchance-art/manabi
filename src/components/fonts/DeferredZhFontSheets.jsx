'use client';
import { useEffect } from 'react';
import { preload } from 'react-dom';
import { SC_STYLESHEET_HREF, TC_STYLESHEET_HREF } from './ScFontLink';
import { onIdle } from '@/lib/viewerHanjaPanel';
// 변수 · 크기 보정 대체 글꼴(next/font 범위가 주던 것과 같은 값) — 웹폰트 시트가 붙기 전에도 스택이 같다.
import './zhFontVars.css';

// 중국어(간체 · 번체) 글꼴을 첫 그림 뒤에 거는 세그먼트용(VIEWER-FONT-SPLIT-001 2단계, 2026-11-07 KST).
//
// 왜: 뷰어 레이아웃이 ScFontScope · TcFontScope(next/font)를 늘 실어, 일본어 · 영어 · 한국어 자료에서도 SC · TC @font-face CSS
// (gz 약 196KB)를 첫 그림 전에 받았다(운영 실측 — 1.6Mbps에서 약 1초, FCP · LCP를 그만큼 밀었다).
// 중국어 자료의 본문은 서버가 그린다(ZH-SSR-001, 2026-11-08 KST — 손님 · 기본 설정에서만). 그 첫 그림의 한자 · 병음은 아래 zhFontVars.css의
// 크기 보정 대체 글꼴로 서고, 이 시트가 붙어 웹폰트 조각이 오면 글꼴만 바뀐다 — 칸 폭은 글꼴과 무관하게 정해져(병음 칸 식 · 한자 1em 격자)
// 본문이 다시 흐르지 않는다. 正 줄 · 한자 창 · 번체/간체 칩 · 예문 · zh UI/해설 언어는 하이드레이션 뒤에 그린다(zh UI는 안내 스크립트가 감춘다).
// 그래서 두 시트를 렌더 차단 없이 붙인다 — 미리 받기 · 붙이는 때는 쪽이 아는 본문 언어로 고른다(아래 known). 글자 조각(woff2)은 지금처럼
// 그 글자가 처음 나올 때 받는다(next/font 때와 같은 font-display: swap).
// 변수 --font-noto-sc · --font-noto-tc와 크기 보정 대체 글꼴은 zhFontVars.css가 next/font와 같은 값으로 준다(e2e viewer-language-settings —
// zh UI 뷰어가 「웹폰트, … Fallback」 스택 전체를 받는다). 웹폰트 이름은 독립 시트의 family 그대로다.
export const DEFERRED_ZH_SHEETS = Object.freeze([SC_STYLESHEET_HREF, TC_STYLESHEET_HREF].filter(Boolean));
const MARK = 'data-manabi-zh-font';
const FIRST_INPUT = ['pointerdown', 'keydown'];

/** 시트를 문서에 붙인다 — 같은 href의 스타일시트가 이미 있으면(React precedence 링크 포함) 그대로 둔다. 붙인 수를 돌려준다. */
export function attachZhFontSheets(doc = document, hrefs = DEFERRED_ZH_SHEETS) {
  let added = 0;
  for (const href of hrefs) {
    const exists = [...doc.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.getAttribute('href') === href);
    if (exists) continue;
    const link = doc.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    link.setAttribute(MARK, '');
    doc.head.appendChild(link);
    added += 1;
  }
  return added;
}

/**
 * 서버가 아는 본문 언어에 따라 미리 받기 · 붙이는 때를 고른다(VIEWER-MOBILE-PERF-001, 2026-11-09 KST).
 * 예전에는 뷰어 레이아웃(셸)이 두 시트(br 약 68KB)를 모든 뷰어에서 미리 받았다 — 일본어 · 영어 손님 뷰어에서도 렌더 차단 CSS · 문서와
 * 대역을 나눠 써서 1.6Mbps 교대 A/B LCP−TTFB가 JA 2.39 → 1.90s · EN 2.33 → 2.00s로 줄었다(둘 다 뺀 판). 셸은 자료 언어를 모르므로
 * 쪽(본문 경계)이 정한다:
 *   - known 'zh'    = 서버가 중국어 본문을 그렸다. 경계 공개($RR)가 간체 시트를 기다리므로 간체만 경계 첫 조각에서 미리 받는다(우선순위 보통 —
 *                     미리 받기를 아예 빼면 시트를 공개 직전에 찾아 LCP가 2.47 → 3.77s로 나빠졌고, 경계 조각 위치면 2.29s로 셸과 같다).
 *                     번체는 낱말 카드 正 줄 · 한자 창(누른 뒤)만 쓰므로 한가할 때(또는 첫 입력 때) 붙인다.
 *   - known 'other' = 서버가 중국어가 아닌 본문을 그렸다. 미리 받지 않고 둘 다 한가할 때(또는 첫 입력 때) 붙인다 — 설명 · 화면 언어가 한국어가 아니면
 *                     (첫 그림 전 판정이 'locale'로 본문을 감춤) 지금처럼 바로 붙인다.
 *   - known null    = 모름(로그인 · 서버 본문 없음). 지금 그대로 — 둘 다 낮은 우선순위로 미리 받고 붙자마자 붙인다. 브라우저가 그리는
 *                     중국어 본문은 시트가 없으면 한자가 'Noto Sans KR' 조각까지 내려가 약 600KB를 받는다(ZH-SSR-SC-001).
 */
export default function DeferredZhFontSheets({ known = null }) {
  if (known === 'zh') { if (SC_STYLESHEET_HREF) preload(SC_STYLESHEET_HREF, { as: 'style' }); }
  else if (known !== 'other') for (const href of DEFERRED_ZH_SHEETS) preload(href, { as: 'style', fetchPriority: 'low' });
  useEffect(() => {
    if (known === null || document.documentElement.getAttribute('data-viewer-hold') === 'locale') { attachZhFontSheets(); return undefined; }
    // 한가할 때, 또는 첫 입력(누름 · 키) 때 — 먼저 오는 쪽. 일본어 자료의 한자 창(낱말 → 글자를 눌러 여는 char-inspect)은 간체 · 번체 꼴을
    // Noto Sans SC로 그린다(운영 실측 /viewer/105 话 · 题, /viewer/108 张 · 體) — 낱말을 누르는 순간 시트를 받기 시작해 글자를 누를 때는 와 있게.
    let done = false;
    const attach = () => {
      if (done) return;
      done = true;
      cancelIdle();
      for (const type of FIRST_INPUT) window.removeEventListener(type, attach, true);
      attachZhFontSheets();
    };
    const cancelIdle = onIdle(attach, { timeout: 4000 });
    for (const type of FIRST_INPUT) window.addEventListener(type, attach, { capture: true, passive: true });
    return () => { done = true; cancelIdle(); for (const type of FIRST_INPUT) window.removeEventListener(type, attach, true); };
  }, [known]);
  return null;
}
