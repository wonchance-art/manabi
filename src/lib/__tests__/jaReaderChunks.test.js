// 일본어 누르는 덩어리 계약(JA-UNITS-001, 오너 확정 C2 2026-11-05 KST).
// 실제 kuromoji 분석 결과(tokenizeJaLine)를 그대로 넣어, 덩어리 경계 · 저장 키 · 문형 연결을 고정한다.
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { tokenizeJaLine } from '../server/tokenizeJa.js';
import { buildReaderChunks, chunkCardToken, chunkPatternEntry, JA_CHUNK_PATTERNS } from '../jaReaderChunks.js';
import { groupTokensToUnits } from '../jaWordUnits.js';
import { groupTokensToUnits as listenGroup } from '../listenSubtitles.js';
import { loadPatternIndex } from '../patternIndex.js';
import { patternSlug } from '../sentencePattern.js';
import { buildVocabRow } from '../vocabIO.js';

const LINES = ['このテストは難しいかもしれません。', '毎朝ご飯を食べています。', '昨日は学校に行きませんでした。', '今日は本を読まなければならない。', '図書館はとても静かでした。', '家で本を読んでいました。'];
let seq, dict, chunks;
const idsOf = (li) => seq.filter((id) => id.startsWith(`id_${li}_`));
// 줄 하나를 「누르는 칸」 열로 — 덩어리는 [표면], 나머지는 토큰 그대로.
const tapRow = (li) => {
  const out = [];
  for (const id of idsOf(li)) {
    const c = chunks.get(id);
    if (!c) out.push(dict[id].text);
    else if (c.ids[0] === id) out.push(`[${c.surface}${c.kind === 'pattern' ? '*' : ''}]`);
  }
  return out.join(' ');
};

beforeAll(async () => {
  seq = []; dict = {};
  for (const [li, line] of LINES.entries()) {
    (await tokenizeJaLine(line)).forEach((t, i) => { const id = `id_${li}_${i}`; seq.push(id); dict[id] = t; });
  }
  chunks = buildReaderChunks(seq, dict);
}, 60000);

describe('덩어리 경계', () => {
  it('しれません · 食べています · 行きませんでした가 각각 한 번에 눌린다', () => {
    expect(tapRow(0)).toBe('この テスト は 難しい [かもしれません*] 。');
    expect(tapRow(1)).toBe('毎朝 ご飯 を [食べています] 。');
    expect(tapRow(2)).toBe('昨日 は 学校 に [行きませんでした] 。');
    expect(tapRow(5)).toBe('家 で 本 を [読んでいました] 。');
  });
  it('굳은 문형은 앞 활용과 떼어 문형 덩어리로 — 앞 말이 한 조각이면 그대로 한 칸', () => {
    expect(tapRow(3)).toBe('今日 は 本 を 読ま [なければならない*] 。');
  });
  it('명사 뒤 です는 떼어 둔다(静か | でした) — 분석이 な형용사 어간을 명사로만 남기는 동안', () => {
    expect(tapRow(4)).toBe('図書館 は とても 静か [でした] 。');
  });
  it('줄을 넘어 묶지 않고, 덩어리의 조각은 모두 같은 덩어리를 가리킨다', () => {
    for (const c of new Set(chunks.values())) {
      const lines = new Set(c.ids.map((id) => id.split('_')[1]));
      expect(lines.size).toBe(1);
      for (const id of c.ids) expect(chunks.get(id)).toBe(c);
    }
  });
  it('분석 결과(processed_json)를 바꾸지 않는다', () => {
    const before = JSON.stringify(dict);
    buildReaderChunks(seq, dict);
    expect(JSON.stringify(dict)).toBe(before);
  });
});

describe('저장 키 — 단어 덩어리는 지금 첫 조각을 눌러 저장하던 것과 같은 행', () => {
  it('食べています → 食べる · 行きませんでした → 行く · 読んでいました → 読む', () => {
    for (const [li, base] of [[1, '食べる'], [2, '行く'], [5, '読む']]) {
      const head = idsOf(li).find((id) => chunks.get(id)?.kind === 'word');
      const { token, id } = chunkCardToken(dict, chunks.get(head));
      expect(id).toBe(head);
      expect(token.base_form).toBe(base);
      const row = buildVocabRow({ userId: 'u', surface: token.text, base: token.base_form, language: 'Japanese' });
      const before = buildVocabRow({ userId: 'u', surface: dict[head].text, base: dict[head].base_form, language: 'Japanese' });
      expect(row.word_text).toBe(before.word_text);
      expect(row.base_form).toBe(before.base_form);
    }
  });
  it('문형 덩어리는 단어 품사 · 뜻을 싣지 않는다(카드가 단어장 등급 대신 문법 담기를 보인다)', () => {
    const c = chunks.get(idsOf(0).find((id) => chunks.get(id)?.kind === 'pattern'));
    const { token } = chunkCardToken(dict, c);
    expect(token.base_form).toBe('かもしれない');
    expect(token.pos).toBe('');
    expect(token.meaning).toBe('');
  });
});

describe('문형 연결 — 정본 문형 사전(bunkei)과 문법 복습 열쇠', () => {
  it('표의 문형은 모두 사전에 있고, 굳은 문형은 담기 열쇠(bk:)를 만든다', async () => {
    const index = await loadPatternIndex('Japanese', { allKernels: true });
    for (const p of JA_CHUNK_PATTERNS) {
      const entry = chunkPatternEntry(index, p.ref);
      expect(entry, `${p.ref.level} ${p.ref.pattern}`).toBeTruthy();
      if (p.kind === 'set') expect(patternSlug(entry)).toBe(`bk:${p.ref.level}:${p.ref.pattern}`);
    }
  });
  it('덩어리가 가리키는 문형', () => {
    const refOf = (li, kind) => chunks.get(idsOf(li).find((id) => chunks.get(id)?.kind === kind))?.ref?.pattern;
    expect(refOf(0, 'pattern')).toBe('〜かもしれない');
    expect(refOf(3, 'pattern')).toBe('〜なければならない・〜なきゃ');
    expect(refOf(1, 'word')).toBe('〜て います');
    expect(refOf(2, 'word')).toBe('〜ませんでした');
  });
});

describe('묶음 정본은 하나 — 듣기 자막과 공용', () => {
  it('listenSubtitles가 내보내는 groupTokensToUnits는 jaWordUnits의 것이다', () => {
    expect(listenGroup).toBe(groupTokensToUnits);
  });
  it('뷰어는 덩어리 규칙을 따로 만들지 않고 정본을 부른다', () => {
    const src = fs.readFileSync(new URL('../jaReaderChunks.js', import.meta.url), 'utf8');
    expect(src).toMatch(/import \{ groupTokensToUnits \} from '\.\/jaWordUnits\.js'/);
    const viewer = fs.readFileSync(new URL('../../views/ViewerPage.jsx', import.meta.url), 'utf8');
    expect(viewer).toContain('buildReaderChunks(');
    expect(viewer).not.toMatch(/function groupTokensToUnits/);
  });
  it('문형 덩어리는 단어 등급(키 1~4 포함)을 막고 문법 담기(savePattern)를 쓴다', () => {
    const viewer = fs.readFileSync(new URL('../../views/ViewerPage.jsx', import.meta.url), 'utf8');
    expect(viewer).toContain("const noWordSave = koreanPieceSelected || jaPatternSelected;");
    expect(viewer).toContain('if (noWordSave) return;');
    expect(viewer).toMatch(/onClick=\{\(\) => savePattern\(chunkEntry\)\}/);
    expect(viewer.match(/!noWordSave/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
