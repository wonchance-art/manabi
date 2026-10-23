import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 배움(/home) 일본어 · 중국어 칸의 글꼴(FIELD-AUDIT 2026-10-23 KST — 운영 실측). 오늘 문단 · 표현 · 복습 단어는 세리프 KR(--font-serif-kr)을 쓰는데,
// 같은 클래스가 lang="ja" · lang="zh" 문장도 그려 한자가 한국 자형이었고 한자가 흩어진 세리프 KR 조각(일본어 견본 17개 · 743KB)을 받아 LCP가 2.7~4.0초였다.
// 일본어 후보 비교(390 · 같은 빌드에 CSS만 바꿈, Fast 4G · CPU ×4, 3회): 현행 32파일 1072KB · LCP 2.2초 /
// Noto Sans JP 28파일 657KB · LCP = FCP(0.6초) / Noto Serif JP 700 29파일 684KB · LCP 1.1~1.9초(새 선언 · 렌더 차단 CSS 추가) /
// 시스템 명조 21파일 · 기기마다 다른 모양(Android · Linux는 고딕으로 떨어짐). → 이미 받는 Noto Sans JP. 중국어는 ZhSlot이 이미 받는 Noto Sans SC.
// 글꼴을 바꾸려면(예: 명조 유지 결정 → Noto Serif JP) 아래 FAMILY 한 곳과 learn.css 규칙 한 줄을 고친다 — 「전역 :lang와 같은 순서」 단언만 그 결정과 묶인다.
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const css = read('src/components/learn/learn.css');
const CLASSES = ['.learn-paragraph__sentence', '.learn-paragraph__words', '.learn-review__word'];
const FAMILY = Object.freeze({
  ja: "var(--font-noto-jp,'Noto Sans JP'),var(--font-noto-kr,'Noto Sans KR'),sans-serif",
  zh: "var(--font-noto-sc, 'Noto Sans SC'),sans-serif",
});
const rule = (lang) => `${CLASSES.map((c) => `${c}:lang(${lang})`).join(',')}{font-family:${FAMILY[lang]}}`;
const squash = (s) => s.replace(/\s+/g, '');

describe('배움 일본어 · 중국어 칸 글꼴', () => {
  for (const lang of ['ja', 'zh']) {
    it(`${lang}: 문장 · 표현 · 복습 단어는 언어 글꼴로 그린다(규칙 한 줄 · font-family만 · 기본 세리프 규칙보다 뒤)`, () => {
      expect(css).toContain(rule(lang));
      expect(css.split(rule(lang))).toHaveLength(2);
      for (const base of ['.learn-paragraph__sentence{font:700 19px/1.65 var(--font-serif-kr),serif;', '.learn-paragraph__words{font:700 20px/1.4 var(--font-serif-kr),serif;', '.learn-review__word{font:700 24.8px/1.3 var(--font-serif-kr),serif;']) {
        expect(css.indexOf(base), base).toBeGreaterThan(-1);
        expect(css.indexOf(base), base).toBeLessThan(css.indexOf(rule(lang)));
      }
    });
  }
  it('일본어 채택은 전역 :lang(ja)와 같은 글꼴 · 같은 순서다(명조 유지로 바꾸면 이 단언만 그 결정에 맞춘다)', () => {
    expect(squash(read('src/index.css'))).toContain(squash(`:lang(ja) {font-family: ${FAMILY.ja};}`));
  });
  it('중국어는 전역 :lang(zh)의 첫 글꼴(SC)만 쓰고 Noto Sans KR을 뒤에 두지 않는다 — SC 스타일시트를 기다리는 동안 KR 한자 조각을 받지 않게', () => {
    expect(squash(read('src/index.css'))).toContain(squash(":lang(zh) {font-family: var(--font-noto-sc, 'Noto Sans SC'),"));
    expect(FAMILY.zh).not.toContain('--font-noto-kr');
    expect(FAMILY.zh).not.toContain('serif-kr');
  });
  it('세 칸은 언어 코드로 lang을 달고, 중국어일 때 ZhSlot이 간체 스타일시트를 건다(규칙이 걸리는 조건 · 글꼴이 오는 길)', () => {
    const tile = read('src/components/learn/ParagraphTile.jsx');
    expect(tile).toContain('<ZhSlot lang={code}><span className="learn-paragraph__sentence" lang={code}>');
    expect(tile).toContain('<ZhSlot lang={code}><span className="learn-paragraph__words" lang={code}>');
    expect(read('src/components/learn/LearnTiles.jsx')).toContain('<ZhSlot lang={encounterLookupLang(wordScopeLanguage(word))}><span className="learn-review__word" lang={encounterLookupLang(wordScopeLanguage(word)) || undefined}>');
    expect(read('src/lib/refVocabLookup.js')).toContain("{ Japanese: 'ja', French: 'fr', Chinese: 'zh', English: 'en' }");
  });
});
