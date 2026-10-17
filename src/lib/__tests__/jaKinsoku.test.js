import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { KINSOKU_LANGUAGES, hasKinsoku, zhClosingCells, zhKinsokuMarks, zhKinsokuStyle } from '../zhGrid';

// 일본어 줄머리 금칙(JA-KINSOKU — 목업 viewer-lang-4 §4, 오너 「권장대로」 2026-10-17 KST · W3C JLREQ §3.1.7 행두 금칙).
// 토큰마다 flex 항목이라 브라우저 line-break가 토큰 사이에 닿지 않는다 — 중국어 ZH-GRID-001의 zhKinsokuMarks를
// 일본어 닫는 부호 집합으로 넓혀 같은 표시(--zh-hold/--zh-pull)로 앞 토큰과 묶는다. 새 구현은 두지 않는다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const preview = read('src/components/viewer/ViewerPreview.jsx');
const css = read('src/components/viewer/reader-controls.css');
const ci = read('.github/workflows/ci.yml');

describe('일본어 닫는 부호 집합 — 중국어 집합 + 일본어 행두 금칙 문자', () => {
  it('句読点 · 닫는 괄호 · 느낌표/물음표는 일본어에서도 한 칸', () => {
    for (const t of ['。', '、', '」', '』', '）', '！', '？', '…', '．', '，']) expect(zhClosingCells(t, 'Japanese'), t).toBe(1);
    expect(zhClosingCells('。」', 'Japanese')).toBe(2);
    expect(zhClosingCells('!?', 'Japanese')).toBe(1);
  });
  it('일본어에만 더하는 것: 장음 · 중점 · 반복 부호 · 작은 가나 · 물결표 · 반각 가나 부호', () => {
    for (const t of ['ー', '・', 'ゝ', '々', 'っ', 'ャ', 'ㇰ', '〜', '～', '｡', '､', '｣']) {
      expect(zhClosingCells(t, 'Japanese'), t).toBe(1);
      expect(zhClosingCells(t), `${t} — 중국어 집합은 그대로`).toBe(0);
    }
  });
  it('여는 부호 · 낱말 · 부호를 품은 낱말은 닫는 부호가 아니다', () => {
    for (const t of ['「', '『', '（', '友達', 'ない', 'コーヒー', 'ない。', '2024', '']) expect(zhClosingCells(t, 'Japanese'), t).toBe(0);
  });
  it('중국어 기본값은 바뀌지 않는다(language 생략 = Chinese)', () => {
    for (const t of ['。', '，', '！」', '……', ',']) expect(zhClosingCells(t)).toBe(zhClosingCells(t, 'Chinese'));
  });
});

describe('목업 문장 — 「ない。」가 함께 내려간다', () => {
  const tokens = {
    a: { text: '友達' }, b: { text: 'が' }, c: { text: '来' }, d: { text: 'ます' }, e: { text: '。' },
    f: { text: '彼' }, g: { text: 'は' }, h: { text: '来' }, i: { text: 'ない' }, j: { text: '。' },
    k: { text: '「' }, l: { text: 'すご' }, m: { text: 'ー' }, n: { text: 'い' }, o: { text: '！' }, p: { text: '」' },
    br: { text: '\n', pos: '개행' }, q: { text: '、' }, r: { text: 'パン' },
  };
  const ids = Object.keys(tokens);
  const marks = zhKinsokuMarks(ids, (id) => tokens[id], 'Japanese');

  it('앞 토큰 hold · 부호 묶음 첫 토큰 pull — 같은 값이라 배치는 그대로', () => {
    expect(Object.fromEntries(marks)).toEqual({
      d: { hold: 1 }, e: { pull: 1 }, i: { hold: 1 }, j: { pull: 1 },
      l: { hold: 1 }, m: { pull: 1 }, n: { hold: 2 }, o: { pull: 2 },
    });
    expect(zhKinsokuStyle(marks.get('i'))).toEqual({ '--zh-hold': 1 });
    expect(zhKinsokuStyle(marks.get('j'))).toEqual({ '--zh-pull': 1 });
  });
  it('개행 뒤 첫 부호는 붙을 앞 토큰이 없다 · 여는 부호(「)는 묶지 않는다', () => {
    expect(marks.has('q')).toBe(false);
    expect(marks.has('k')).toBe(false);
  });
  it('같은 토큰을 중국어로 읽으면 장음(ー)은 묶지 않는다 — 언어별 집합만 다르다', () => {
    const zh = zhKinsokuMarks(ids, (id) => tokens[id]);
    expect(zh.has('m')).toBe(false);
    expect(zh.get('i')).toEqual({ hold: 1 });
  });
});

describe('배선 — 본문 · Aa 미리보기가 같은 함수 · 같은 CSS 변수', () => {
  it('금칙 언어는 중국어 · 일본어 둘(한국어 · 영어 · 프랑스어 무변경)', () => {
    expect(KINSOKU_LANGUAGES).toEqual(['Chinese', 'Japanese']);
    for (const l of ['Korean', 'English', 'French', undefined]) expect(hasKinsoku(l)).toBe(false);
  });
  it('본문과 미리보기 모두 hasKinsoku로 켜고 언어를 넘긴다(중국어 격자 · ZhText는 중국어 그대로)', () => {
    expect(viewer).toContain('const zhMarks = hasKinsoku(materialLang) ? zhKinsokuMarks(json.sequence, id => json.dictionary[id], materialLang) : null;');
    expect(viewer).toContain('const zhStyle = zhKinsokuStyle(zhMarks?.get(tokenId));');
    expect(viewer).toContain("const zhGrid = materialLang === 'Chinese';");
    expect(preview).toContain('const marks=hasKinsoku(language)?zhKinsokuMarks(shown.map((_,i)=>i),i=>shown[i],language):null;');
    expect(preview).toContain('style={zhKinsokuStyle(marks?.get(i))||undefined}');
  });
  it('일본어 CSS: 부호 하나 = 1em + 낱말 간격(flex gap = --char-gap), hold와 pull이 상쇄', () => {
    expect(css).toContain('.viewer-layout[data-language="Japanese"] :is(.reader-area,.reader-settings__preview) {--ja-pitch:calc(1em + var(--char-gap,0px));}');
    expect(css).toContain('.viewer-layout[data-language="Japanese"] :is(.reader-area,.reader-settings__preview) .word-token {margin-left:calc(0px - (var(--zh-pull,0) * var(--ja-pitch)));margin-right:calc(var(--zh-hold,0) * var(--ja-pitch));}');
    // 일본어 낱말 간격은 flex gap이 맡는다 — 중국어처럼 0으로 두지 않는다.
    expect(viewer).toContain("gap: `max(${lineGap}px, var(--hl-row-gap-min, 0px)) ${zhGrid ? 0 : charGap}rem`, '--char-gap': `${charGap}rem`,");
  });
  it('실렌더 계약(e2e)이 필수 CI 목록에 있다', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'e2e/viewer-ja-kinsoku.e2e.mjs'))).toBe(true);
    expect(ci).toMatch(/e2e\/viewer-zh-grid\.e2e\.mjs e2e\/viewer-ja-kinsoku\.e2e\.mjs/);
  });
});
