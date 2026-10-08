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

describe('머리 · 구성 — 색 연결(정본 §9 합격: 머리 훈·음 색 = 조각 색, 역할 미상이면 색 없음)', () => {
  it('观(壮观) → 「观 guān → 觀 볼 관」, 볼 = 뜻 색 · 관 = 소리 색, [見 볼 견 · 뜻] + [雚 황새 관 · 소리]', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1' });
    const head = sliceClass(html, 'hanja-pop__head');
    expect(text(head)).toBe('观guān→觀볼 관');
    expect(head).toContain('<span class="is-meaning">볼</span>');
    expect(head).toContain('<span class="is-sound">관</span>');
    expect(head).toContain('lang="zh-Hant-TW">觀</span>');
    const parts = sliceClass(html, 'hanja-pop__parts');
    expect(parts).toContain('class="hanja-pop__piece is-meaning" data-piece="見" aria-label="見 볼 견, 뜻 조각"');
    expect(parts).toContain('class="hanja-pop__piece is-sound" data-piece="雚" aria-label="雚 황새 관, 소리 조각"');
    expect(text(sliceClass(parts, 'hanja-pop__piece is-meaning'))).toBe('見볼 견뜻');
    expect(text(sliceClass(parts, 'hanja-pop__piece is-sound'))).toBe('雚황새 관소리');
    expect(sliceClass(parts, 'hanja-pop__piece is-meaning')).toContain('<strong>볼</strong>'); // 뜻 조각은 훈을 진하게
    expect(sliceClass(parts, 'hanja-pop__piece is-sound')).toContain('<strong>관</strong>'); // 소리 조각은 음을 진하게
  });
  it('같은 토큰: 머리 훈 = 뜻 조각 = --primary-light, 머리 음 = 소리 조각 = --reader-sound', () => {
    const rule = (sel) => css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';
    expect(rule('.hanja-pop .hanja-pop__hun .is-meaning')).toContain('color:var(--primary-light)');
    expect(rule('.hanja-pop__piece.is-meaning')).toContain('color:var(--primary-light)');
    expect(rule('.hanja-pop__piece.is-meaning i')).toContain('background:var(--primary-light)');
    expect(rule('.hanja-pop .hanja-pop__hun .is-sound')).toContain('color:var(--reader-sound)');
    expect(rule('.hanja-pop__piece.is-sound')).toContain('var(--reader-sound)');
    expect(rule('.hanja-pop__piece.is-sound strong')).toContain('color:var(--reader-sound)');
  });
  it('역할 미상(术 — 術 3성분) → 머리·조각 색 클래스 0, 「역할 미상」, 원 훈은 title·접근 이름(보정 라벨은 전체)', () => {
    const html = render({ ch: '术', word: '技术', reading: 'shù', key: '0:1' });
    const head = sliceClass(html, 'hanja-pop__head');
    expect(text(head)).toBe('术shù→術재주 술');
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
  it('간체 = 正(工) → 화살표 없이 한 글자', () => {
    const html = render({ ch: '工', word: '工作', reading: 'gōng', key: '0:0' });
    expect(sliceClass(html, 'hanja-pop__head')).not.toContain('hanja-pop__to');
  });
  it('중국어 화면: 조각 표지 形旁 · 声旁(번역 행), 한국어 화면: 뜻 · 소리', () => {
    for (const [locale, sense, sound] of [['zh-CN', '形旁', '声旁'], ['zh-TW', '形旁', '聲旁'], ['ko', '뜻', '소리']]) {
      const parts = sliceClass(render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', locale }), 'hanja-pop__parts');
      expect(parts).toContain(`<i>${sense}</i>`);
      expect(parts).toContain(`<i>${sound}</i>`);
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

describe('같은 한자어 타일 — 3개 이하 · 내 단어 먼저(꼬리표) · 누른 글자·음절만 칠', () => {
  it('壮观의 观 → 参观(내 단어) 먼저, 한국 한자어 줄 「참관」에서 관만, 병음 guān만, 중국어 观만', () => {
    const html = render({ ch: '观', word: '壮观', reading: 'guān', key: '0:1', savedRows: [{ word_text: '参观', language: 'Chinese', meaning: '참관하다' }] });
    const words = sliceClass(html, 'hanja-pop__words');
    const tiles = words.split('class="hanja-pop__tile').slice(1);
    expect(tiles.length).toBe(3);
    expect(tiles[0]).toMatch(/^ is-mine"><i class="hanja-pop__mine">내 단어<\/i>/);
    expect(text(tiles[0].replace(/^[^>]*>/, '')).replace(/<div $/, '')).toBe('내 단어cānguān参观참관');
    expect(tiles[0]).toContain('<em>guān</em>');
    expect(tiles[0]).toContain('<em>观</em>');
    expect(tiles[0]).toContain('<em>관</em>');
    expect(tiles.slice(1).every((t) => !t.includes('hanja-pop__mine'))).toBe(true);
    expect(text(words)).not.toContain('壮观');
  });
  it('판정 실패 칸은 짧은 뜻(흐림 — is-dim · is-short), 乐 yuè 칸에 快乐(lè) 없음', () => {
    const html = render({ ch: '乐', word: '音乐', reading: 'yuè', key: '0:1' });
    const words = sliceClass(html, 'hanja-pop__words');
    expect(text(words)).not.toContain('快乐');
    expect(text(words)).toBe('yīnyuèhuì音乐会음악회yuèqǔ乐曲악곡yuèduì乐队악단'); // 설계서 §12.4 목업 그대로
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
