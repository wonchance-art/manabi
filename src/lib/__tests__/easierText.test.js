import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildEasierPrompt, easierCacheKey, grammarCacheKey } from '../grammarDetail.js';
import { sliceBetween } from './helpers/sliceBetween.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
/** 주석 제거 후 대조 — 헤더 주석의 예시 문구가 계약에 잡히지 않게(cronRegistration 선례). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// [더 쉽게] (#1077-3, 오너 승인 2026-08-26) — 지정 문장을 같은 언어의 쉬운 말로.
// 서버 변경 0·스키마 변경 0이 이 기능의 정체성이다(조사표에서 외부 선례 전량 배제,
// 자사 grammarDetail 틀 채택의 근거였다).

describe('easierCacheKey — viewer_tx·viewer_gr과 같은 캐시 관례', () => {
  it('viewer_ez 접두 + 200자 슬라이스', () => {
    const long = '很'.repeat(300);
    const key = easierCacheKey('Chinese', long);
    expect(key.startsWith('viewer_ez:Chinese:')).toBe(true);
    expect(key.length).toBe('viewer_ez:Chinese:'.length + 200);
  });

  it('문법 캐시 키와 같은 꼴 — 접두만 다르다(관례 이탈 방지)', () => {
    const text = '他的汉语水平提高得很快。';
    expect(easierCacheKey('Chinese', text).replace(/^viewer_ez:/, ''))
      .toBe(grammarCacheKey('Chinese', text).replace(/^viewer_gr:/, ''));
  });
});

describe('buildEasierPrompt — 번역이 아니라 같은 언어 안의 바꿔 말하기', () => {
  const p = buildEasierPrompt('他的汉语水平提高得很快。', '중국어');

  it('원문·언어명을 싣고, 같은 언어임을 두 번 명시한다', () => {
    expect(p).toContain('他的汉语水平提高得很快。');
    expect(p).toContain('같은 중국어');
    expect(p).toContain('한국어 번역이 아니라');
  });

  it('형식 헤더 — 쉬운 문장·바꾼 말(없으면 생략)', () => {
    expect(p).toContain('**쉬운 문장**');
    expect(p).toContain('**바꾼 말**');
    expect(p).toContain('생략');
  });

  it('의미 보존·정보 추가 금지 규칙', () => {
    expect(p).toContain('의미 보존');
    expect(p).toContain('원문에 없는 정보 추가 금지');
  });
});

describe('useEasierText — 정본 부품 재사용 배선', () => {
  const hook = codeOf(read('src/lib/useEasierText.js'));

  it('서버 신설 없음 — 기존 callGemini(/api/gemini)와 GEMINI_TIER 재사용', () => {
    expect(hook).toContain('callGemini(');
    expect(hook).toContain('GEMINI_TIER');
    expect(hook).not.toContain("fetch(");
    expect(hook).not.toContain('/api/easier');
  });

  it('캐시를 네트워크보다 먼저 본다 — 두 번째 열람은 무료·즉시', () => {
    expect(hook.indexOf('localStorage.getItem')).toBeGreaterThan(-1);
    expect(hook.indexOf('localStorage.getItem')).toBeLessThan(hook.indexOf('callGemini('));
  });

  it('실패는 버튼으로 되돌린다 — 빈 패널을 남기지 않는다', () => {
    expect(hook).toMatch(/catch[\s\S]{0,200}?setOpen\(false\)/);
  });
});

describe('뷰어 배선 — [자세히]와 같은 자리·같은 결', () => {
  const page = read('src/views/ViewerPage.jsx');

  it('좌측 패널에 [더 쉽게] 토글이 있고 지정 문장으로 실행한다', () => {
    expect(page).toContain('🔤 더 쉽게');
    expect(page).toContain('easier.run(leftPanelText)');
  });

  it('문장이 바뀌면 문법 해설과 함께 리셋된다 — 다른 문장의 결과가 남지 않게', () => {
    expect(page).toMatch(/grammar\.reset\(\);[\s\S]{0,120}?easier\.reset\(\);/);
  });

  it('쉬운 문장은 원어라 본문과 같은 :lang() 폰트 규칙을 태운다', () => {
    // 앵커 소실 시 throw(sliceBetween) — raw slice(indexOf()는 공허 통과(v2-L 메타 계약 금지)
    const block = sliceBetween(page, 'easier.loading').slice(0, 400);
    expect(block).toContain('lang={contentLangTag}');
    expect(block).toContain('formatDetail(easier.result)');
  });
});
