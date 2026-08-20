import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: ① 폭맞춤 확대 + ④ 글자 탐색(오너 승인 2026-08-19 "ㅇㅋ 가자 권장한 대로").
// ①은 측정 JS 없는 CSS 수식(100cqi ÷ 분모)이 핵심 — 1em 격자 계약(pinyinRuby.test.js)
// 이 성립해야만 수식이 참이므로, 카드 쪽 격자 복제 규칙이 본문과 어긋나면 안 된다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const css = read('src/index.css');
const viewer = read('src/views/ViewerPage.jsx');

describe('① 폭맞춤 확대 계약', () => {
  it('크기 수식 — cqi 컨테이너 + clamp(최소 1.5rem·캡 8rem), 미지원 엔진 폴백 줄 선행', () => {
    expect(css).toMatch(/\.word-fit-wrap \{ container-type: inline-size; width: 100%; \}/);
    expect(css).toMatch(/\.word-fit \{\s*font-size: 1\.5rem;\s*font-size: clamp\(1\.5rem, calc\(100cqi \/ var\(--fit-n, 1\)\), 8rem\);/);
  });

  it('격자 복제 — 본문 병음 격자 계약과 동일 규칙(.word-fit 스코프)', () => {
    // 핵심 3종: 1em 셀 · 병음 단일 크기 0.26em · 절대배치(rt-an — WebKit rt 계약 공유)
    expect(css).toMatch(/\.word-fit ruby\[data-pinyin\] \{ display: inline-flex; justify-content: center; width: 1em; \}/);
    expect(css).toMatch(/\.word-fit ruby\[data-pinyin\] > \.rt-an \{ font-size: 0\.26em;/);
    expect(css).toMatch(/\.word-fit ruby\[data-pinyin\] > \.rt-an, \.word-fit ruby\[data-yomi\] > \.rt-an \{\s*position: absolute;/s);
    // bottom 상수는 카드 line-height(1.9)와 유도식 동조 — 분모가 어긋나면 간격이 틀어진다
    expect(css).toMatch(/\.word-fit \.surface \{ line-height: 1\.9; display: block; \}/);
    expect(css).toMatch(/\.word-fit ruby\[data-pinyin\] > \.rt-an, \.word-fit ruby\[data-yomi\] > \.rt-an \{[^}]*bottom: calc\(100% - \(0\.5 \/ 1\.9\) \* 100%\);/s);
  });

  it('뷰어 배선 — CJK만 폭맞춤(fitWord.js), 분모는 fitDivisor, 라틴 자료는 기존 크기 유지', () => {
    expect(viewer).toContain("import { fitDivisor, isFitLang } from '../lib/fitWord'");
    expect(viewer).toContain('if (!isFitLang(materialLang))');
    expect(viewer).toContain("'--fit-n': fitDivisor(selectedToken.text, selectedToken.furigana, materialLang)");
  });
});

describe('④ 글자 탐색 계약', () => {
  it('한자만 탭 대상 — word-fit__char 스팬 + 재탭 닫기 토글', () => {
    expect(viewer).toContain("import { charDetail, isInspectableChar, wordsWithChar } from '../lib/charInspect'");
    expect(viewer).toMatch(/isInspectableChar\(ch\) \? \(/);
    expect(viewer).toContain("className={`word-fit__char${inspectChar?.key === key ? ' word-fit__char--active' : ''}`}");
    expect(viewer).toMatch(/setInspectChar\(prev => \(prev\?\.key === key \? null : \{ ch, key, reading \}\)\)/);
  });

  it('테이블은 탐색이 열리면 토글·언어와 무관하게 지연 로드된다(음 테이블은 신자체 수록 — 실측)', () => {
    expect(viewer).toMatch(/\(showHanjaKo && materialLang === 'Chinese'\) \|\| inspectChar !== null/);
    expect(viewer).toMatch(/\[showHanjaKo, materialLang, hanjaKoTable, inspectChar\]/);
  });

  it('글자 패널 — 훈음·병음·日 자형 + 이 글자가 든 내 단어(칩 탭 = 그 단어 카드로)', () => {
    expect(viewer).toContain("charDetail(inspectChar.ch, { koTable: hanjaKoTable, hunTable: hanjaHunTable, jaTable: hanjaJaTable })");
    expect(viewer).toContain('wordsWithChar(inspectChar.ch');
    expect(viewer).toContain('char-inspect__words-label');
    // 칩은 카드 교체 경로(handleListWordClick) 재사용 — 새 상태 없음
    expect(viewer).toMatch(/char-inspect__word"[\s\S]{0,200}onClick=\{\(\) => handleListWordClick\(/);
  });

  it('단어 전환·카드 닫기에서 탐색 상태가 리셋된다(이전 글자 패널이 새 단어에 붙는 혼선 차단)', () => {
    for (const fn of ['handleTokenClick', 'handleListWordClick', 'closeWordCard']) {
      const body = viewer.match(new RegExp(`const ${fn} = \\([^)]*\\) => \\{[\\s\\S]*?\\n  \\};`))?.[0];
      expect(body, fn).toBeTruthy();
      expect(body, `${fn}에 setInspectChar(null) 누락`).toContain('setInspectChar(null)');
    }
  });
});
