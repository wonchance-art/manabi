import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JAPANESE_VOCAB_REF } from '../japaneseVocabRegistry';
import { loadRefVocabLookup } from '../refVocabLookup.js';
import { sliceBetween } from './helpers/sliceBetween';

// 🈁 ja 표제어 읽기 매칭 (#1077 라운드 10 §남긴 것 — 표기 차이 204건). 실제 정본 payload 기준 실측 핀:
// 표면 키가 없는 토큰을 읽기(yomi)로 2차 조회한다. 규칙 셋 — 〜표기 제외 · 가나↔한자만 · 최저 급수
// 우선(동급 무개입). 만남 기록·상태 점(뷰어)이 소비하고, 표면 우선·main=word.ja는 불변이다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const byReading = (reading, surface) => JAPANESE_VOCAB_REF.findWordByReading(reading, surface);

describe('findWordByReading — 실측', () => {
  it('가나 표면 → 한자 표제어: せんせい는 표면 키가 없고, 읽기로 先生(N5)를 만난다(専制 N2보다 낮은 급수)', () => {
    expect(JAPANESE_VOCAB_REF.findWord('せんせい')).toBeNull();
    const hit = byReading('せんせい', 'せんせい');
    expect(hit?.word.ja).toBe('先生');
    expect(hit?.level).toBe('N5');
    expect(byReading('がくせい', 'がくせい')?.word.ja).toBe('学生');
  });

  it('한자 표면 → 가나 표제어: 有難う는 표면 키가 없고, 읽기로 ありがとう를 만난다', () => {
    expect(JAPANESE_VOCAB_REF.findWord('有難う')).toBeNull();
    expect(byReading('ありがとう', '有難う')?.word.ja).toBe('ありがとう');
  });

  it('한자↔한자는 다른 말 — 先制(せんせい)는 先生을 만나지 않는다', () => {
    expect(JAPANESE_VOCAB_REF.findWord('先制')).toBeNull();
    expect(byReading('せんせい', '先制')).toBeNull();
  });

  it('동급 동음이의는 무개입 — はし(橋·箸 둘 다 N5) → null; 급수가 다르면 최저 급수 — きょう → 今日(N5, 強 N1 탈락)', () => {
    expect(byReading('はし', 'はし')).toBeNull();
    expect(byReading('きょう', 'きょう')?.word.ja).toBe('今日');
  });

  it('〜표기 표제어는 표제어가 아니다 — ふん(〜分) → null', () => {
    expect(byReading('ふん', 'ふん')).toBeNull();
  });

  it('가타카나는 히라가나로 접어 비교 — ぱん → パン', () => {
    expect(byReading('ぱん', 'ぱん')?.word.ja).toBe('パン');
    expect(byReading('パン', 'パン')?.word.ja).toBe('パン');
  });

  it('빈 입력·미지 읽기 → null', () => {
    expect(byReading('', '')).toBeNull();
    expect(byReading(undefined, undefined)).toBeNull();
    expect(byReading('ぬるぽがっ', 'ぬるぽがっ')).toBeNull();
  });
});

describe('loadRefVocabLookup(ja) — 표면 우선, 미스 때만 읽기', () => {
  it('reading 없으면 기존 동작 그대로(위임 불변); reading이 있어도 표면 히트가 먼저; 미스면 읽기', async () => {
    const lookup = await loadRefVocabLookup('ja');
    expect(lookup.findWord('せんせい')).toBeNull();
    expect(lookup.findWord('せんせい', 'せんせい')?.main).toBe('先生');
    expect(lookup.findWord('先生', 'せんせい')?.main).toBe('先生');
    expect(lookup.findWord('専制', 'せんせい')?.main).toBe('専制'); // 표면 히트가 읽기보다 먼저
    expect(lookup.findWord('先制', 'せんせい')).toBeNull();
  });

  it('표면 우선은 관측 가능하다 — くすり(N4 가나 표제어)는 읽기 우선이면 薬(N5)로 바뀌지만 표면 히트가 이긴다', async () => {
    // 실측: 가나 표제어 50건이 이 경우(わたす→渡す·じゅぎょう→授業·くすり→薬 …) — 순서를 뒤집으면 기록되는
    // 저작 표기가 달라져 기록 → 재대조 왕복이 깨진다.
    const lookup = await loadRefVocabLookup('ja');
    expect(JAPANESE_VOCAB_REF.findWordByReading('くすり', 'くすり')?.word.ja).toBe('薬');
    expect(lookup.findWord('くすり', 'くすり')?.main).toBe('くすり');
  });
});

describe('뷰어 배선 — 만남 기록과 점 대조가 같은 열쇠', () => {
  const viewer = read('src/views/ViewerPage.jsx');

  it('후리가나(가나 표면은 표면 자체)를 2차 조회에 넘기고, 표기 차이 히트의 main을 토큰 text로 기억한다', () => {
    const effect = sliceBetween(viewer, 'const lookup = await loadRefVocabLookup(code);', 'recordVocabEncounters(code, met');
    expect(effect).toContain("const reading = code === 'ja' ? (t.furigana || (KANA_ONLY.test(t.text) ? t.text : null)) : null;");
    expect(effect).toContain('const hit = lookup.findWord(t.base_form) || lookup.findWord(t.text, reading);');
    expect(effect).toContain('if (hit.main !== t.text && hit.main !== t.base_form) mainByText.set(t.text, hit.main);');
    expect(effect).toContain('if (alive) setMetMainByText(mainByText);');
    expect(viewer).toContain('const KANA_ONLY = /^[\\u3040-\\u30ffー]+$/;');
  });

  it('점 대조 두 곳(단어 목록·상태 하이라이트)이 기억한 main으로도 만남을 본다', () => {
    const sites = viewer.match(/metWordSet\.has\(normalizeRefWordKey\(metCode, metMainByText\.get\((t|token)\.text\)\)\)/g) || [];
    expect(sites.length).toBe(2);
  });
});
