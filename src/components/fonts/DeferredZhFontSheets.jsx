'use client';
import { useEffect } from 'react';
import { preload } from 'react-dom';
import { SC_STYLESHEET_HREF, TC_STYLESHEET_HREF } from './ScFontLink';
// 변수 · 크기 보정 대체 글꼴(next/font 범위가 주던 것과 같은 값) — 웹폰트 시트가 붙기 전에도 스택이 같다.
import './zhFontVars.css';

// 중국어(간체 · 번체) 글꼴을 첫 그림 뒤에 거는 세그먼트용(VIEWER-FONT-SPLIT-001 2단계, 2026-11-07 KST).
//
// 왜: 뷰어 레이아웃이 ScFontScope · TcFontScope(next/font)를 늘 실어, 일본어 · 영어 · 한국어 자료에서도 SC · TC @font-face CSS
// (gz 약 196KB)를 첫 그림 전에 받았다(운영 실측 — 1.6Mbps에서 약 1초, FCP · LCP를 그만큼 밀었다).
// 뷰어에서 중국어 글자가 첫 서버 그림에 나오는 일은 없다: 중국어 자료는 서버 본문에서 빠지고(viewerSsrRow), 正 줄 · 한자 창 ·
// 번체/간체 칩 · 예문 · zh UI/해설 언어는 하이드레이션 뒤에 그린다(서버 본문은 손님 · 기본 설정에서만 — zh UI는 안내 스크립트가 감춘다).
// 그래서 두 시트를 렌더 차단 없이 미리 받아 두고(preload · 낮은 우선순위) 하이드레이션 직후에 붙인다. 중국어를 그리는 때에는
// 이미 붙어 있고, 글자 조각(woff2)은 지금처럼 그 글자가 처음 나올 때 받는다(next/font 때와 같은 font-display: swap).
// 변수 --font-noto-sc · --font-noto-tc와 크기 보정 대체 글꼴은 zhFontVars.css가 next/font와 같은 값으로 준다(e2e viewer-language-settings —
// zh UI 뷰어가 「웹폰트, … Fallback」 스택 전체를 받는다). 웹폰트 이름은 독립 시트의 family 그대로다.
export const DEFERRED_ZH_SHEETS = Object.freeze([SC_STYLESHEET_HREF, TC_STYLESHEET_HREF].filter(Boolean));
const MARK = 'data-manabi-zh-font';

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

export default function DeferredZhFontSheets() {
  // 서버 그림에서 head로 올라가는 미리 받기 — 렌더를 막지 않고, 주요 CSS · JS 뒤로 미룬다.
  for (const href of DEFERRED_ZH_SHEETS) preload(href, { as: 'style', fetchPriority: 'low' });
  useEffect(() => { attachZhFontSheets(); }, []);
  return null;
}
