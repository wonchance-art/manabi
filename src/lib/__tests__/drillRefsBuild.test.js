/**
 * 드릴 만남 refs 생성기 겸 신선도 계약 — ja·zh (부채 ① R2, #1077).
 *
 * ── 왜 여기(테스트)에 사는가
 *
 * 생성기는 **런타임 분석기**(`tokenizeZhLine` = jieba WASM + v2-T 후처리)를 문다.
 * `scripts/build-*.mjs` 선례(build-zh-hsk)는 전부 외부 원천 파일을 CLI 인자로 받는
 * **순수 변환기**라 이 문제를 겪지 않았다 — 우리만 사내 모듈 체인을 문다. node로 돌리려면
 * 그 체인의 확장자 없는 import 7건과 JSON import 5건을 production 파일에서 고쳐야 하는데,
 * 스크립트 하나 편하자고 서버 핫패스를 건드리는 건 배포 위험만 사는 거래다(실측: Next 15,
 * 저장소 전체 JSON import 18건). vitest는 그 체인을 이미 해석하고, 우리 머지 게이트가
 * **바로 vitest**다(`npm test` green = 하드리밋). 그래서 생성과 검사를 한 파일에 둔다.
 *
 * 재생성:  UPDATE_DRILL_REFS=1 npx vitest run src/lib/__tests__/drillRefsBuild.test.js
 * 평시:    콘텐츠·분석기가 바뀌어 산출물이 낡으면 이 테스트가 CI에서 빨개진다.
 *
 * ── 왜 언어마다 방법이 다른가 (전량 실측 2026-09-01)
 *
 * **zh — 분석기 그대로.** 71문장 전수 추적 결과 분할·정본 대조가 전부 맞았다
 * (`我有时间` → 我·有·时间 — v2-T 후처리가 我·有时·间을 이미 고쳐 뒀다). 4.5 refs/문장.
 *
 * **ja — 분석기를 쓸 수 없다.** 드릴 문장 92개 중 89개가 **가나 전용**이고(초급 장이
 * 한자 앞에 가나를 가르치니 당연하다), 가나 전용은 kuromoji의 최악 조건이다. 실측:
 *   あには → あ|に|は     (兄 = あに가 사라지고 간투사 「あ」가 남는다)
 *   まいあさ → まい/まく + あ/ある + さ   (毎朝이 「씨뿌리다」+「있다」가 된다)
 *   えきの → え|きの      /  でんしゃ → でん|しゃ/す
 * 이 조각들이 정본에 부딪히면 **학습자가 만난 적 없는 말이 사전과 FSRS 대기열에 박힌다** —
 * R1이 「유령 표기를 쓰기 시점에 막는다」로 세운 계약을 정확히 어기는 것이다.
 *
 * 대신 **문장이 이미 들고 있는 신호**를 쓴다: ja 드릴 문장은 배열 문제라서 사람이 문절마다
 * 띄어 뒀다(`えきの ちかくに ぎんこうが あります`). 그 경계 안에서 앞에서부터 정본을 맞추고,
 * 꼬리는 닫힌 조사 집합으로만 뗀다. 문절 = 내용어 + 기능어라는 일본어의 기본 구조 그대로이고,
 * 새로 발명한 게 아니라 교재의 분かち書き가 이미 인코딩해 둔 것을 읽는 것이다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeZhLine } from '../server/tokenizeZh';
import { loadRefVocabLookup } from '../refVocabLookup';

const OUTPUT = path.join(fileURLToPath(new URL('../data/', import.meta.url)), 'drillRefs.json');

/**
 * 문절 꼬리로 뗄 수 있는 것 — **격조사와 계사뿐**이다. 빈 문자열(문절 통째)도 후보.
 *
 * 동사 어미(ます·ましょう·ません)를 빼 둔 것이 이 목록의 핵심이다. 그걸 떼면 **어간**이
 * 남는데, 어간이 정본의 **다른 표제어**와 부딪친다 — 실측 `行きます` → `行き`(ゆき,
 * '가는 길' N3 명사)는 문장의 뜻(行く)과 아예 다른 말이다. `いらっしゃいます` → `いらっしゃい`도 같다.
 * から·まで·より도 뺐다: 조사이긴 하나 어휘를 이룬다(`それから` → `それ`).
 * 그래서 이 목록은 「떼도 남는 게 온전한 명사구 머리인 것」만 담는다. 수율보다 정확도 —
 * 놓친 말은 수율만 잃지만, 틀린 말은 학습자의 사전을 오염시킨다.
 */
const JA_TAILS = ['', 'は', 'が', 'を', 'に', 'へ', 'と', 'の', 'も', 'です', 'ですか', 'には', 'では', 'とは', 'にも', 'とも', 'へは'];

/**
 * 감사 제외 — 파생 규칙은 옳게 돌았지만 **그 문장에서 그 낱말이 아닌** 것들(2026-09-01
 * 92문장 전수 수동 감사). 전부 문형을 가르치는 N2·N1 문장에서 나왔고, 원인은 하나다:
 * 형식명사·활용형이 정본의 다른 표제어와 **철자가 같다**(동형이의). 규칙으로는 못 가른다.
 *   ところが(그런데) ≠ ところ(장소) · 〜うちに(사이에) ≠ うち(집)
 *   〜てしまった(완료) ≠ しまった(아차) · 〜にもまして(더욱) ≠ まして(하물며)
 * 콘텐츠가 바뀌어 이 문절이 사라지면 아래 계약이 「쓰이지 않는 제외」로 잡는다.
 */
const JA_AUDIT_DROP = [
  ['ところが', 'ところ'],
  ['ところです', 'ところ'],
  ['うちに', 'うち'],
  ['しまった', 'しまった'],
  ['まして', 'まして'],
];

/** 문장 → 사람이 띄어 둔 문절. 구두점은 경계로만 쓰고 버린다. */
export function jaChunks(sentence) {
  return String(sentence || '').replace(/[。、？！]/g, ' ').split(/\s+/).filter(Boolean);
}

/** 문절 하나 → 정본 표기 또는 null. 머리가 **가장 긴** 해석이 이긴다(꼬리를 짧게 뗀다). */
export function jaChunkRef(chunk, lookup) {
  let best = null;
  for (const tail of JA_TAILS) {
    if (tail && !chunk.endsWith(tail)) continue;
    const head = tail ? chunk.slice(0, -tail.length) : chunk;
    if (!head || (best && head.length <= best.head.length)) continue;
    const hit = lookup.findWord(head);
    if (hit?.main) best = { head, main: hit.main };
  }
  if (!best) return null;
  if (JA_AUDIT_DROP.some(([c, m]) => c === chunk && m === best.main)) return null;
  return best.main;
}

async function deriveJa(lookup) {
  const { ALL_CHAPTERS } = await import('../../content/japanese/index.js');
  const out = {};
  for (const chapter of ALL_CHAPTERS || []) {
    for (const drill of chapter.drills || []) {
      if (!drill?.id || typeof drill.sentence !== 'string' || !drill.sentence) continue;
      const refs = [];
      for (const chunk of jaChunks(drill.sentence)) {
        const main = jaChunkRef(chunk, lookup);
        if (main && !refs.includes(main)) refs.push(main);
      }
      if (refs.length > 0) out[drill.id] = refs;
    }
  }
  return out;
}

async function deriveZh(lookup) {
  const { ALL_CHAPTERS } = await import('../../content/chinese/index.js');
  const out = {};
  for (const chapter of ALL_CHAPTERS || []) {
    for (const drill of chapter.drills || []) {
      if (!drill?.id || typeof drill.sentence !== 'string' || !drill.sentence) continue;
      const refs = [];
      for (const t of (await tokenizeZhLine(drill.sentence)) || []) {
        if (!t || t.pos === '기호') continue;
        // 뷰어와 같은 대조 순서 — 기본형 우선, 없으면 표면형. 정본에 없으면 버린다.
        const hit = lookup.findWord(t.base_form || '') || lookup.findWord(t.text || '');
        if (hit?.main && !refs.includes(hit.main)) refs.push(hit.main);
      }
      if (refs.length > 0) out[drill.id] = refs;
    }
  }
  return out;
}

export async function buildDrillRefs() {
  const [jaLookup, zhLookup] = await Promise.all([loadRefVocabLookup('ja'), loadRefVocabLookup('zh')]);
  if (!jaLookup?.findWord || !zhLookup?.findWord) throw new Error('정본 조회기를 못 얻었다');
  const merged = { ...(await deriveJa(jaLookup)), ...(await deriveZh(zhLookup)) };
  // 키 정렬 — 콘텐츠 순서가 바뀌어도 산출물이 흔들리지 않게(결정성).
  return Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
}

describe('드릴 refs 생성 — ja·zh (부채 ① R2)', () => {
  it('산출물이 콘텐츠·분석기와 맞는다 (낡으면 여기서 잡힌다)', async () => {
    const built = `${JSON.stringify(await buildDrillRefs(), null, 2)}\n`;
    if (process.env.UPDATE_DRILL_REFS) {
      writeFileSync(OUTPUT, built, 'utf8');
      return;
    }
    expect(built).toBe(readFileSync(OUTPUT, 'utf8'));
  }, 300000);

  it('산출물에 구두점이 섞이지 않는다 — 기호 필터가 지금은 관측되지 않는다', async () => {
    // 변이 실측: zh 파생에서 `pos === '기호'` 필터를 빼도 산출물이 **한 바이트도 안 변한다**.
    // 이유는 필터가 죽어서가 아니라 정본에 기호 표제어가 없어서다(코퍼스 기호 3종 。？，
    // 전부 findWord → null). 즉 중복 여부가 **정본의 내용**에 달려 있다 — 그래서 필터는
    // 두고, 우리가 실제로 원하는 성질을 여기서 못 박는다. 정본에 기호가 들어오는 날
    // 필터가 일을 시작하고, 혹시 그 앞을 새면 이 계약이 잡는다.
    const refs = await buildDrillRefs();
    for (const [id, list] of Object.entries(refs)) {
      for (const main of list) {
        expect(main, `${id}`).toBeTruthy();
        expect(/^[\s。、，？！,.?!;:'"()\[\]{}]+$/u.test(main), `구두점이 표기로 들어갔다: ${id} ${main}`).toBe(false);
      }
      expect(new Set(list).size, `${id}에 중복 표기`).toBe(list.length);
    }
  }, 300000);

  it('감사 제외는 전부 실재하는 문절이다 — 콘텐츠가 바뀌면 죽은 제외를 지운다', async () => {
    const { ALL_CHAPTERS } = await import('../../content/japanese/index.js');
    const chunks = new Set();
    for (const chapter of ALL_CHAPTERS || []) {
      for (const drill of chapter.drills || []) {
        if (typeof drill?.sentence !== 'string') continue;
        for (const c of jaChunks(drill.sentence)) chunks.add(c);
      }
    }
    for (const [chunk] of JA_AUDIT_DROP) expect(chunks.has(chunk), `죽은 감사 제외: ${chunk}`).toBe(true);
  }, 120000);

  it('ja 파생은 문절을 벗어나지 않는다 — 조각 매치가 유령을 만드는 자리다', async () => {
    const lookup = await loadRefVocabLookup('ja');
    // kuromoji가 えきの를 え|きの로 쪼갠 그 자리. 우리 규칙은 문절 머리에서만 맞춘다.
    expect(jaChunkRef('えきの', lookup)).toBe(null);      // えき는 정본에 없다 — 놓치되 틀리지 않는다
    expect(jaChunkRef('あには', lookup)).toBe('あに');     // kuromoji는 여기서 「あ」를 냈다
    expect(jaChunkRef('ぎんこうが', lookup)).toBe('ぎんこう'); // kuromoji는 「こう」를 냈다
    expect(jaChunkRef('まいあさ', lookup)).toBe(null);     // kuromoji는 「まく」(씨뿌리다)를 냈다
  }, 120000);

  it('동사 어미는 떼지 않는다 — 어간이 다른 표제어와 부딪친다', async () => {
    const lookup = await loadRefVocabLookup('ja');
    // 行きます의 뜻은 行く다. ます를 떼면 行き(ゆき '가는 길' N3 명사)가 잡힌다 — 다른 말이다.
    expect(jaChunkRef('行きます', lookup)).toBe(null);
    expect(jaChunkRef('いらっしゃいます', lookup)).toBe(null);
    // 계사·격조사는 뗀다 — 남는 게 온전한 명사구 머리다.
    expect(jaChunkRef('すきです', lookup)).toBe('すき');
    expect(jaChunkRef('かばんは', lookup)).toBe('かばん');
  }, 120000);
});
