/**
 * JLPT 단어 페이지 예문 단어 나눔 표 생성기 겸 신선도 계약(오너 확정 2026-10-19 KST · 문서 「일본어 판에서 달라지는 점」).
 *
 * ── 왜 생성 JSON인가
 * 예문 단어 나눔은 형태소 분석(kuromoji — 앱 분석기와 같은 tokenizeJaLine)으로 원형까지 저장해야 한다(して → する).
 * 정적 페이지 조립 안에서 kuromoji를 처음 실으면 사전 읽기가 깨졌다(next dev 실측: Maximum call stack · ConnectionCosts buffer overflow).
 * 그래서 jaYomiIndex.json · drillRefs.json 선례대로 시험에서 만들고 신선도를 CI가 지킨다 — 페이지 조립은 표만 읽는다.
 *
 * 재생성:  UPDATE_JA_EXAMPLE_WORDS=1 npx vitest run src/lib/__tests__/jaExampleWordsBuild.test.js
 *
 * ── 표 형식
 * { v: { [jaExampleKey(예문)]: '2,_1,_1,2,_1,_1,2:する,…' } } — encodeJaPieces(조각 글자 수 · _ 누르지 않음 · :원형).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JAPANESE_VOCAB_REF } from '../japaneseVocabRegistry';
import { decodeJaPieces, encodeJaPieces, jaExampleKey, jaExampleWords, jaWordPieces } from '../jaExampleWords';

const OUTPUT = path.join(fileURLToPath(new URL('../data/', import.meta.url)), 'jaExampleWords.json');

function exampleTexts() {
  const texts = new Set();
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    for (const theme of JAPANESE_VOCAB_REF.getVocab(level)?.themes || []) {
      for (const w of theme.words || []) if (w.ex?.ja) texts.add(w.ex.ja);
    }
  }
  return [...texts].sort();
}

async function buildTable() {
  const { tokenizeJaLine } = await import('../server/tokenizeJa');
  const v = {};
  const owner = {};
  for (const text of exampleTexts()) {
    const pieces = jaWordPieces(await tokenizeJaLine(text));
    if (pieces.map((p) => p.text).join('') !== text) continue; // 분석기가 글자를 건너뛴 예문 — 나누지 않는다
    const key = jaExampleKey(text);
    if (owner[key] && owner[key] !== text) throw new Error(`열쇠 충돌: ${owner[key]} / ${text}`);
    owner[key] = text;
    v[key] = encodeJaPieces(pieces);
  }
  const sorted = Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]));
  return `${JSON.stringify({ _source: 'JLPT 단어 예문(src/content/japanese/vocab)을 tokenizeJaLine(kuromoji + 독음 수리 층)으로 나눈 단어 조각 — '
    + 'src/lib/__tests__/jaExampleWordsBuild.test.js가 만든다(UPDATE_JA_EXAMPLE_WORDS=1).', v: sorted })}\n`;
}

describe('JLPT 예문 단어 나눔 표 — 생성 · 신선도', () => {
  it('표가 지금 예문 · 지금 분석기와 같다(바뀌면 UPDATE_JA_EXAMPLE_WORDS=1로 다시 만든다)', async () => {
    const next = await buildTable();
    if (process.env.UPDATE_JA_EXAMPLE_WORDS) writeFileSync(OUTPUT, next);
    expect(readFileSync(OUTPUT, 'utf8')).toBe(next);
  }, 120_000);

  it('모든 예문이 표에 있고, 표를 풀면 예문 글자 수와 맞는다', () => {
    const table = JSON.parse(readFileSync(OUTPUT, 'utf8')).v;
    const texts = exampleTexts();
    const missing = texts.filter((t) => !decodeJaPieces(table[jaExampleKey(t)], t));
    expect(texts.length).toBeGreaterThan(6000);
    expect(missing.length / texts.length).toBeLessThan(0.01);
  });
});

describe('단어 묶기 — 시안 ⑱ 예문 그대로', () => {
  const tok = (list) => list.map(([text, base_form, pos]) => ({ text, base_form, pos }));
  it('활용어 뒤 조동사 · て는 앞 단어에, 조사 · 띄어쓰기는 따로, 원형을 싣는다(して → する · います → いる)', () => {
    const pieces = jaWordPieces(tok([['旅行', '旅行', '명사'], ['の', 'の', '조사'], [' ', ' ', '기호'], ['準備', '準備', '명사'], ['を', 'を', '조사'], [' ', ' ', '기호'],
      ['し', 'する', '동사'], ['て', 'て', '조사'], [' ', ' ', '기호'], ['い', 'いる', '동사'], ['ます', 'ます', '조동사'], ['。', '。', '기호']]));
    expect(pieces).toEqual([{ text: '旅行', lemma: '旅行' }, { text: 'の', lemma: '' }, { text: ' ', lemma: '' }, { text: '準備', lemma: '準備' },
      { text: 'を', lemma: '' }, { text: ' ', lemma: '' }, { text: 'して', lemma: 'する' }, { text: ' ', lemma: '' }, { text: 'います', lemma: 'いる' }, { text: '。', lemma: '' }]);
    const code = encodeJaPieces(pieces);
    expect(code).toBe('2,_1,_1,2,_1,_1,2:する,_1,3:いる,_1');
    expect(decodeJaPieces(code, '旅行の 準備を して います。')).toEqual(pieces);
    expect(decodeJaPieces(code, '旅行の 準備を して いる。')).toBeNull(); // 예문이 바뀌면 표를 쓰지 않는다
  });
  it('명사 뒤 です는 따로(누르지 않음) — 天気 하나만 누른다', () => {
    expect(jaWordPieces(tok([['天気', '天気', '명사'], ['です', 'です', '조동사'], ['ね', 'ね', '조사']])))
      .toEqual([{ text: '天気', lemma: '天気' }, { text: 'です', lemma: '' }, { text: 'ね', lemma: '' }]);
  });
  it('카드 단어 · 후리가나가 조각 경계를 넘으면 합친다', () => {
    const pieces = [{ text: '映画', lemma: '映画' }, { text: '館', lemma: '館' }, { text: 'へ', lemma: '' }];
    expect(jaExampleWords('映画館へ', '映画館', pieces)).toEqual({ seg: [3, 1], lem: [1, 0] });
    expect(jaExampleWords('映画館へ', '', pieces, [[0, 3, 'えいがかん']])).toEqual({ seg: [3, 1], lem: [1, 0] });
    expect(jaExampleWords('映画館', '映画館', pieces.slice(0, 2))).toBeNull(); // 한 조각뿐이면 나누지 않는다
    expect(jaExampleWords('映画館', '', [{ text: '映画', lemma: '映画' }])).toBeNull(); // 이어 붙여 원문이 안 되면 null
  });
});
