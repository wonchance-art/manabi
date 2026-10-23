import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 배움(/home) 일본어 칸의 글꼴(FIELD-AUDIT 2026-10-23 KST — 운영 실측). 오늘 문단 · 표현 · 복습 단어는 세리프 KR(--font-serif-kr)을 쓰는데,
// 같은 클래스가 lang="ja" 일본어 문장도 그려 한자가 한국 자형이었고 한자가 흩어진 세리프 KR 조각 17개(743KB)를 받아 LCP가 2.7~4.0초였다.
// 후보 비교(390 · 같은 빌드에 CSS만 바꿈, Fast 4G · CPU ×4, 3회): 현행 글꼴 32파일 1072KB · LCP 2.2초 /
// Noto Sans JP 28파일 657KB · LCP = FCP(0.6초) / Noto Serif JP 700 29파일 684KB · LCP 1.1~1.9초(새 선언 · 렌더 차단 CSS 추가) /
// 시스템 명조 21파일 · 기기마다 다른 모양(Android · Linux는 고딕으로 떨어짐). → 이미 받는 Noto Sans JP.
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const css = read('src/components/learn/learn.css');
const JA_RULE = ".learn-paragraph__sentence:lang(ja),.learn-paragraph__words:lang(ja),.learn-review__word:lang(ja){font-family:var(--font-noto-jp,'Noto Sans JP'),var(--font-noto-kr,'Noto Sans KR'),sans-serif}";

describe('배움 일본어 칸 글꼴', () => {
  it('일본어(lang=ja) 문장 · 표현 · 복습 단어는 Noto Sans JP로 그린다 — 전역 :lang(ja)와 같은 순서, 폴백 이름 포함', () => {
    expect(css).toContain(JA_RULE);
    const global = read('src/index.css');
    expect(global).toMatch(/:lang\(ja\) \{\n {2}font-family: var\(--font-noto-jp, 'Noto Sans JP'\), var\(--font-noto-kr, 'Noto Sans KR'\), sans-serif;/);
  });
  it('일본어 규칙은 기본 세리프 규칙보다 뒤에 있고 굵기 · 크기는 기본 규칙 그대로다(font-family만 바꾼다)', () => {
    for (const base of ['.learn-paragraph__sentence{font:700 19px/1.65 var(--font-serif-kr),serif;', '.learn-paragraph__words{font:700 20px/1.4 var(--font-serif-kr),serif;', '.learn-review__word{font:700 24.8px/1.3 var(--font-serif-kr),serif;']) {
      expect(css.indexOf(base), base).toBeGreaterThan(-1);
      expect(css.indexOf(base), base).toBeLessThan(css.indexOf(JA_RULE));
    }
    expect(JA_RULE).not.toMatch(/font:|font-size|font-weight/);
  });
  it('세 칸은 일본어일 때 lang="ja"를 단다(규칙이 걸리는 조건)', () => {
    const tile = read('src/components/learn/ParagraphTile.jsx');
    expect(tile).toContain('<span className="learn-paragraph__sentence" lang={code}>');
    expect(tile).toContain('<span className="learn-paragraph__words" lang={code}>');
    expect(read('src/components/learn/LearnTiles.jsx')).toContain('<span className="learn-review__word" lang={encounterLookupLang(wordScopeLanguage(word)) || undefined}>');
    expect(read('src/lib/refVocabLookup.js')).toContain("{ Japanese: 'ja',");
  });
});
