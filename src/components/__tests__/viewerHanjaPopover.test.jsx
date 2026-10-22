import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ViewerHanjaPopover from '../viewer/ViewerHanjaPopover';
import { loadRefVocabIndex } from '../../lib/refVocabIndex';
import { VIEWER_MESSAGES, translateViewerText } from '../../lib/viewerMessages';

/**
 * 계약: 한자 창(팝오버) 렌더 — 뷰어 v2 AE-R4 PR ②(정본 VIEWER-V2-ROUNDS-001 §9 합격 「단위」 ·
 * 설계서 docs/manabi-viewer-v2-ae-r4.md §3·§5·§6·§7.2). 무엇을 고를지는 PR ① 순수 함수 계약(viewerHanjaPanel.test.js)이
 * 지키고, 여기서는 그것이 창에 그대로 놓이는지(색 연결 · 병음 자리 · 역할 미상 · 빈 덩어리 · 표지)를 본다.
 */

const ROOT = process.cwd();
const readData = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/data', f), 'utf8'));
const tables = { koTable: readData('hanjaKo.json'), hunTable: readData('hanjaHun.json'), tradTable: readData('hanjaTrad.json'), panel: readData('hanjaPanel.json') };
const css = fs.readFileSync(path.join(ROOT, 'src/components/viewer/reader-controls.css'), 'utf8');

let refIndex;
beforeAll(async () => { refIndex = await loadRefVocabIndex('Chinese'); }, 30000);

function render({ ch, word, reading = null, key = '0:0', locale = 'ko', tones = false, savedRows = [], material = null }) {
  return renderToStaticMarkup(createElement(ViewerHanjaPopover, {
    inspect: { ch, key, reading }, word, tables, savedRows, material, refIndex, showToneColors: tones, uiLocale: locale,
    vt: (text, values) => translateViewerText(locale, text, values), onClose: () => {},
  }));
}
// vitest 기본 환경(node)에는 DOMParser가 없다 — 정적 마크업 문자열을 class 기준으로 자른다.
const sliceClass = (html, cls) => {
  const at = html.indexOf(`class="${cls}`);
  if (at < 0) return null;
  const start = html.lastIndexOf('<', at);
  const tagEnd = html.indexOf(' ', start);
  const tag = html.slice(start + 1, tagEnd);
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
  re.lastIndex = start;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[2]) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
};
const text = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

describe('창 틀 — 비모달 dialog, 머리가 이름', () => {
  it('role=dialog · aria-modal=false · aria-labelledby = 머리 id, ✕ 44px 버튼', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1' });
    expect(html).toMatch(/^<div class="hanja-pop" role="dialog" aria-modal="false" aria-labelledby="([^"]+)" tabindex="-1"/);
    const id = html.match(/aria-labelledby="([^"]+)"/)[1];
    expect(html).toContain(`class="hanja-pop__head" id="${id}"`);
    expect(html).toContain('class="hanja-pop__close" aria-label="닫기"');
  });
  it('「AI」 표시 · 글자 카드 구획(이야기·메타·자형 칩·다시 만나기) 0', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān' });
    expect(text(html)).not.toMatch(/\bAI\b/);
    for (const gone of ['char-inspect', '다시 만나기', '획', '부수']) expect(html).not.toContain(gone);
  });
});

describe('머리 · 구성 — 단어장 흐름(오너 확정 2026-10-22 KST 「앞 안 2」: 머리 한 줄 · 오른쪽 작은 正 · 조각 글자 칸 · 색은 조각 표지에만)', () => {
  it('观(壮观) → 「观 guān 볼 관 … 正 觀」(화살표 · 훈음 색칠 없음), [見 볼 견 · 뜻] [雚 황새 관 · 소리 ›]', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1' });
    const head = sliceClass(html, 'hanja-pop__head');
    expect(text(head)).toBe('观guān볼 관正觀');
    expect(head).not.toMatch(/is-meaning|is-sound|→/);
    expect(head).toContain('class="hanja-pop__hun" lang="ko">볼 관</span>');
    expect(head).toContain('<span class="hanja-pop__zheng"><span aria-hidden="true">正</span><span class="hanja-pop__ch--zheng" lang="zh-Hant-TW">觀</span></span>');
    const parts = sliceClass(html, 'hanja-pop__parts');
    expect(parts).toContain('class="hanja-pop__piece is-meaning" data-piece="見" aria-label="見 볼 견, 뜻 조각"');
    expect(parts).toContain('class="hanja-pop__piece is-sound" data-piece="雚" aria-label="雚 황새 관, 소리 조각"');
    expect(text(sliceClass(parts, 'hanja-pop__piece is-meaning'))).toBe('見볼 견뜻');
    expect(text(sliceClass(parts, 'hanja-pop__piece is-sound'))).toBe('雚황새 관소리 ›');
    expect(parts).not.toMatch(/<strong>|hanja-pop__plus/); // 훈음은 통째로 굵게 · 조각 사이 + 없음
    expect(html).not.toMatch(/hanja-pop__arrow|hanja-pop__mine/);
  });
  it('색 토큰: 조각 표지만 뜻 = --primary-light · 소리 = --reader-sound, 조각 바탕 = 글자 칸 토큰, 누른 글자 = --hanja-pop-hit', () => {
    const rule = (sel) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';
    expect(rule('.hanja-pop__piece.is-meaning i')).toContain('color:var(--primary-light)');
    expect(rule('.hanja-pop__piece.is-sound i')).toContain('color:var(--reader-sound)');
    expect(rule('.hanja-pop__piece')).toContain('background:var(--hanja-pop-tile)');
    expect(rule('.hanja-pop__tile em')).toContain('color:var(--hanja-pop-hit)');
    expect(rule('.hanja-pop__tile')).not.toContain('background');
    expect(css).not.toMatch(/\.hanja-pop__(arrow|mine|to)\b/);
  });
  it('역할 미상(术 — 術 3성분) → 머리·조각 색 클래스 0, 「역할 미상」, 원 훈은 title·접근 이름(보정 라벨은 전체)', () => {
    const html = render({ ch: '术', word: '技术', reading: 'shù', key: '0:1' });
    const head = sliceClass(html, 'hanja-pop__head');
    expect(text(head)).toBe('术shù재주 술正術');
    expect(head).not.toMatch(/is-meaning|is-sound/);
    const parts = sliceClass(html, 'hanja-pop__parts is-unknown');
    expect(parts).not.toMatch(/is-meaning|is-sound|<button/);
    expect(text(parts)).toContain('역할 미상');
    expect(parts).toContain('조금 걸을 척'); // 彳 — PIECE_LABELS 보정 라벨은 전체
    expect(parts).toContain('title="삽주뿌리 출"><span aria-hidden="true">출</span><span class="hanja-pop__sr">삽주뿌리 출</span>'); // 术 — 음만, 원 훈은 title·접근 이름
  });
  it('구성 자료 없음 · 4성분 이상(乐 → 樂) → 구성 덩어리 빈 자리(높이 유지)', () => {
    const html = render({ ch: '乐', word: '音乐', reading: 'yuè', key: '0:1' });
    expect(html).toContain('<div class="hanja-pop__parts is-empty" aria-hidden="true"></div>');
  });
  it('간체 = 正(工) → 正 표시 없음', () => {
    const html = render({ ch: '工', word: '工作', reading: 'gōng', key: '0:0' });
    expect(sliceClass(html, 'hanja-pop__head')).not.toContain('hanja-pop__zheng');
  });
  it('중국어 화면: 조각 표지 形旁 · 声旁(번역 행), 한국어 화면: 뜻 · 소리', () => {
    for (const [locale, sense, sound] of [['zh-CN', '形旁', '声旁'], ['zh-TW', '形旁', '聲旁'], ['ko', '뜻', '소리']]) {
      const parts = sliceClass(render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', locale }), 'hanja-pop__parts');
      expect(parts).toContain(`<i>${sense}</i>`);
      expect(parts).toContain(`<i>${sound}<span aria-hidden="true"> ›</span></i>`);
    }
  });
});

describe('병음 — 머리 · 타일에만(구성 조각 0), 성조 색 설정을 따른다', () => {
  const saved = [{ word_text: '参观', language: 'Chinese', meaning: '참관하다, 견학하다' }];
  it('머리 병음 + 타일 병음 줄, 조각에는 병음 없음', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', savedRows: saved });
    expect(sliceClass(html, 'hanja-pop__head')).toContain('class="hanja-pop__py" lang="zh-Latn-pinyin">guān</span>');
    expect(sliceClass(html, 'hanja-pop__parts')).not.toMatch(/pinyin|hanja-pop__py/);
    expect(html.match(/class="hanja-pop__tpy/g)?.length).toBe(3);
  });
  it('성조 색 끔 → pinyin-tone 클래스 0, 켬 → 머리·타일 음절마다', () => {
    const off = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', savedRows: saved });
    expect(off).not.toContain('pinyin-tone--');
    const on = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', savedRows: saved, tones: true });
    expect(sliceClass(on, 'hanja-pop__head')).toContain('hanja-pop__py pinyin-tone--1');
    expect(sliceClass(on, 'hanja-pop__words')).toContain('<span class="pinyin-tone--1">cān</span><em class="pinyin-tone--1">guān</em>');
    expect(sliceClass(on, 'hanja-pop__words')).toContain('hanja-pop__tpy has-tones');
  });
  it('토큰 병음이 없으면 머리 병음은 비운다(사전 대표 읽기로 메우지 않는다 — 다음자 위험)', () => {
    const html = render({ ch: '观', word: '壮观', reading: null, key: '0:1' });
    expect(sliceClass(html, 'hanja-pop__head')).not.toContain('hanja-pop__py');
  });
});

describe('같은 한자어 칸 — 3개 이하 · 내 단어 먼저(표지 없음 — 오너 「[복습] 안뜨도록」) · 중국어 · 병음 · 한자어 순 · 누른 글자·음절만 칠', () => {
  it('壮观의 观 → 参观(내 단어) 먼저, 한국 한자어 줄 「참관」에서 관만, 병음 guān만, 중국어 观만', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', savedRows: [{ word_text: '参观', language: 'Chinese', meaning: '참관하다' }] });
    const words = sliceClass(html, 'hanja-pop__words');
    const tiles = words.split('class="hanja-pop__tile').slice(1);
    expect(tiles.length).toBe(3);
    expect(tiles[0]).toMatch(/^ is-mine"><span class="hanja-pop__tzh"/);
    expect(text(tiles[0].replace(/^[^>]*>/, '')).replace(/<div $/, '')).toBe('参观cānguān참관');
    expect(tiles[0]).toContain('<em>guān</em>');
    expect(tiles[0]).toContain('<em>观</em>');
    expect(tiles[0]).toContain('<em>관</em>');
    expect(text(words)).not.toContain('壮观');
  });
  it('판정 실패 칸은 짧은 뜻(흐림 — is-dim · is-short) — 商店의 店: 药店 「약국」, 乐 yuè 칸에 快乐(lè) 없음', () => {
    const yue = sliceClass(render({ ch: '乐', word: '音乐', reading: 'yuè', key: '0:1' }), 'hanja-pop__words');
    expect(text(yue)).not.toContain('快乐');
    // 설계서 §12.4 목업은 音乐의 乐(音乐会 · 乐曲 · 乐队 흐림)이었으나, HSK 2026 보강(ZH-LEVEL-2026-001 ④)으로
    // 乐器 악기가 들어와 세 칸이 판정 성공으로 찼다 — 흐린 칸은 같은 모양(2칸 성공 + 1칸 흐림)인 商店의 店으로 본다.
    expect(text(yue)).toBe('音乐会yīnyuèhuì음악회乐器yuèqì악기乐曲yuèqǔ악곡');
    const html = render({ ch: '店', word: '商店', reading: 'diàn', key: '0:1' });
    const words = sliceClass(html, 'hanja-pop__words');
    expect(text(words)).toBe('书店shūdiàn서점店铺diànpù점포药店yàodiàn약국');
    expect(words.split('class="hanja-pop__tile').slice(1).filter((t) => t.startsWith(' is-dim'))).toHaveLength(1);
    const dim = words.split('class="hanja-pop__tile').slice(1).filter((t) => t.startsWith(' is-dim'));
    for (const t of dim) expect(t).toContain('class="hanja-pop__tko is-short"');
  });
  it('후보 0 → 덩어리 빈 자리(높이 유지)', () => {
    const html = render({ ch: '弩', word: '连弩', reading: 'nǔ', key: '0:1' });
    expect(html).toContain('<div class="hanja-pop__words is-empty" aria-hidden="true"></div>');
  });
});

describe('문구 — viewerMessages ko · zh-CN · zh-TW', () => {
  it('창의 vt 문구가 모두 번역 행에 있다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/viewer/ViewerHanjaPopover.jsx'), 'utf8');
    const keys = [...src.matchAll(/\bvt\(\s*'([^']+)'/g)].map((m) => m[1]);
    for (const [, a, b] of src.matchAll(/vt\(role === 'meaning' \? '([^']+)' : '([^']+)'\)/g)) keys.push(a, b);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    for (const k of keys) for (const locale of ['ko', 'zh-CN', 'zh-TW']) expect(Object.hasOwn(VIEWER_MESSAGES[locale], k), `${locale}: ${k}`).toBe(true);
  });
});
