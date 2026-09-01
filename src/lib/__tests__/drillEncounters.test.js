import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DRILL_ENCOUNTER_LANGS, DRILL_REF_LANGS, drillEncounterTokens, drillEncounterRefs,
  recordDrillEncounters,
} from '../drillSrs.js';
import { loadVocabEncounters, loadVocabEncounterContexts } from '../../components/world/vocabEncounters.js';
import { loadRefVocabLookup } from '../refVocabLookup.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 드릴 → 단어 만남 (부채 ① R1, #1077 5490883012 → 실측 정정 5494648246).
 *
 * ── 부채의 정체는 「연결이 끊긴 것」이 아니라 「붙일 고리가 없는 것」이었다
 *
 * 드릴은 이미 SRS에 연결돼 있다 — 다만 **문법** 쪽이다(`review_events` source:'grammar'
 * + `grammar_review`). `user_vocabulary`(단어 FSRS)에는 아무것도 가지 않았고, 그 이유는
 * 배선이 끊겨서가 아니라 **드릴 항목이 문자열뿐이고 단어 참조가 없어서**였다.
 *
 * ── 그래서 (b) 「채점 때 맞추기」로 갔는데, 실측이 그 권장을 반으로 갈랐다
 *
 * 드릴 2,148개 전수(2026-09-01):
 *   목표어 문장을 든 드릴은 **21%**(454)뿐이다 — 나머지는 `prompt`가 한국어 메타언어다.
 *   공백 분할 + 정본 대조: **fr 229/230 · en 59/61** (오탐 0) / **ja 36/92 · zh 0/71**.
 *   최장일치 스캔으로 CJK 수율을 올리면 95~100%가 되지만 **뽑히는 게 틀린다**
 *   (`我有时间`→我·有时·间 / `おにぎりを`→り). 그 오답들은 **정본에 실재하는 단어**라
 *   소비 시점 유령 차단을 통과해 오늘 학습에 출제된다 — 없는 것보다 나쁘다.
 * ⇒ 공백 언어만 기계로 잇는다(R1).
 *
 * ── R2가 그 결론의 절반을 뒤집었다 (2026-09-01)
 *
 * 「ja·zh는 기계 추출 불가」는 **문장 전체를 분석기에 넘겼을 때**의 실측이었다. 경계를
 * 다른 데서 얻으면 성립한다: zh는 v2-T 후처리가 들어온 뒤 71문장 전수가 맞고(我·有·时间),
 * ja는 배열 드릴이라 **사람이 문절마다 띄어 둔 것**을 그대로 쓰면 조각 매치가 안 생긴다.
 * 그래서 저작이 아니라 **생성 시점 파생**(`data/drillRefs.json`)으로 갔다 — 드릴 133개·
 * 표기 402개. 생성기·감사·전수 실측 = `drillRefsBuild.test.js`.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/** 테스트용 메모리 스토리지 — 실제 localStorage를 건드리지 않는다. */
const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
/** 정본 조회기 대역 — main 표기를 그대로 돌려준다. */
const fakeLookup = (words) => ({
  findWord: (t) => (words.has(t) ? { level: 'A1', word: { ko: '뜻' }, main: words.get(t) } : null),
});

describe('① 조각 추출 — 순수, 그리고 문장이 있는 드릴만', () => {
  it('sentence가 있으면 공백·구두점으로 가른다', () => {
    expect(drillEncounterTokens({ sentence: 'She drinks tea every day.' }))
      .toEqual(['She', 'drinks', 'tea', 'every', 'day']);
  });

  it('choice·fill은 조각이 없다 — prompt는 한국어 메타언어다', () => {
    // 실물 그대로의 모양: 물음은 한국어, 답은 조각(`束`)이라 대조할 목표어 문장이 없다.
    expect(drillEncounterTokens({ type: 'fill', prompt: "'약속'의 일본어 한자어: 約___", answer: '束' })).toEqual([]);
    expect(drillEncounterTokens({ type: 'choice', prompt: '알맞은 것은?', choices: ['a', 'b'], answer: 'a' })).toEqual([]);
    expect(drillEncounterTokens(null)).toEqual([]);
    expect(drillEncounterTokens({ sentence: 42 })).toEqual([]);
  });

  it('한 조각짜리 dictation도 조각을 낸다 — fr 발음 드릴이 163개다', () => {
    expect(drillEncounterTokens({ type: 'dictation', sentence: 'été' })).toEqual(['été']);
  });
});

describe('② 대상 언어 — 공백으로 갈리는 언어만', () => {
  it('네 언어 전부 — 다만 ja·zh는 얻는 길이 다르다', () => {
    expect([...DRILL_ENCOUNTER_LANGS].sort()).toEqual(['en', 'fr', 'ja', 'zh']);
    expect([...DRILL_REF_LANGS].sort()).toEqual(['ja', 'zh']);
    // refs 언어는 만남 언어의 부분집합이어야 한다 — 아니면 조용히 죽은 갈래가 생긴다.
    for (const code of DRILL_REF_LANGS) expect(DRILL_ENCOUNTER_LANGS.has(code)).toBe(true);
  });

  it('ja·zh는 조각을 절대 쓰지 않는다 — refs에 없는 드릴은 아무것도 기록하지 않는다', async () => {
    const storage = memStorage();
    // 조회기가 그 조각을 **안다고 해도** 상관없다: ja·zh 경로는 조회기를 아예 부르지 않는다.
    // 오분리가 정본을 통과해 출제되던 자리가 여기다(`おにぎりを`→り).
    const lookup = fakeLookup(new Map([['あには', '兄'], ['我喝茶。', '我'], ['あには かいしゃいんです。', '兄']]));
    const ja = { id: 'ja-refs에-없는-드릴', sentence: 'あには かいしゃいんです。' };
    const zh = { id: 'zh-refs에-없는-드릴', sentence: '我喝茶。' };
    expect(await recordDrillEncounters('Japanese', ja, { storage, lookup })).toEqual([]);
    expect(await recordDrillEncounters('Chinese', zh, { storage, lookup })).toEqual([]);
    expect(loadVocabEncounters('ja', storage).size).toBe(0);
    expect(loadVocabEncounters('zh', storage).size).toBe(0);
  });

  it('ja·zh는 생성된 refs를 그대로 얹는다 — 실행 시점 분석 없이', async () => {
    const storage = memStorage();
    const drill = { id: 'ja-n506-d5', sentence: 'バスで 会社に 行きます。' };
    const refs = drillEncounterRefs(drill);
    expect(refs.length).toBeGreaterThan(0);
    // 조회기를 주지 **않는다** — 이 경로가 조회기 없이 성립해야 클라이언트가 가벼워진다.
    expect(await recordDrillEncounters('Japanese', drill, { storage })).toEqual(refs);
    expect([...loadVocabEncounters('ja', storage)].sort()).toEqual([...refs].sort());
  });

  it('실측 근거가 코드 옆에 남아 있다 — 다음 세션이 취향으로 되돌리지 않게', () => {
    const src = read('src/lib/drillSrs.js');
    for (const mark of ['有时', '229/230', 'drillRefsBuild']) {
      expect(src, `실측 근거 「${mark}」가 사라졌다`).toContain(mark);
    }
  });
});

describe('③ 기록 — 정본 표기만, 등급 없이', () => {
  it('정본에 있는 조각만 남는다 — 유령 표기를 쓰기 시점에 막는다', async () => {
    const storage = memStorage();
    const lookup = fakeLookup(new Map([['tea', 'tea'], ['day', 'day']]));
    const met = await recordDrillEncounters('English', { sentence: 'She drinks tea every day.' }, { storage, lookup });
    expect(met).toEqual(['tea', 'day']);          // drinks·every·She는 정본에 없다 → 버린다
    expect([...loadVocabEncounters('en', storage)].sort()).toEqual(['day', 'tea']);
  });

  it('저장 표기는 조각이 아니라 정본 main이다 — 뷰어와 같은 계약', async () => {
    const storage = memStorage();
    // fr 굴절: 문장에는 활용형, 정본에는 표제어. 저장되는 건 표제어여야 한다(§4.8).
    const lookup = fakeLookup(new Map([['parle', 'parler']]));
    expect(await recordDrillEncounters('French', { sentence: 'Il parle vite.' }, { storage, lookup })).toEqual(['parler']);
    expect([...loadVocabEncounters('fr', storage)]).toEqual(['parler']);
  });

  it('문맥은 드릴 문장이고 출처는 drill이다 — cloze 재료가 된다', async () => {
    const storage = memStorage();
    const lookup = fakeLookup(new Map([['tea', 'tea']]));
    await recordDrillEncounters('English', { sentence: 'She drinks tea every day.' }, { storage, lookup });
    expect(loadVocabEncounterContexts('en', storage).tea)
      .toEqual({ t: 'She drinks tea every day.', s: 'drill' });
  });

  it('정답·오답과 무관하다 — 틀려도 그 말을 만난 것은 사실이다', async () => {
    // 시그니처에 correct가 아예 없다. 「맞혀야 만남」이 되면 오답 학습자가 순환에서 빠진다.
    expect(recordDrillEncounters.length).toBe(2); // (lang, drill) + 기본값 옵션
    const body = sliceBetween(read('src/lib/drillSrs.js'), 'export async function recordDrillEncounters', '\n}');
    expect(body, '만남 기록이 정오답을 본다').not.toMatch(/\bcorrect\b/);
  });

  it('FSRS 등급을 주지 않는다 — 문장 정답을 단어 인출로 세지 않는다', () => {
    const body = sliceBetween(read('src/lib/drillSrs.js'), 'export async function recordDrillEncounters', '\n}');
    for (const f of ['user_vocabulary', 'calculateFSRS', 'persistVocabGrade', 'upsertRated']) {
      expect(body, `만남 기록이 ${f}를 건드린다 — 단어 일정을 흔들면 안 된다`).not.toContain(f);
    }
  });

  it('실패는 조용하다 — 부가 기록이 채점을 막지 않는다', async () => {
    const boom = { findWord: () => { throw new Error('boom'); } };
    await expect(recordDrillEncounters('English', { sentence: 'tea' }, { storage: memStorage(), lookup: boom }))
      .resolves.toEqual([]);
  });
});

describe('④ 배선 — 채점 경로와 서버 동기화', () => {
  it('단일 기록 경로가 만남도 부른다 — 그리고 반환 프로미스에 얹지 않는다', () => {
    const body = sliceBetween(read('src/lib/drillSrs.js'), 'export function recordChapterDrillResult', '\n}\n');
    expect(body, '채점 경로가 만남을 기록하지 않는다').toContain('recordDrillEncounters(lang, drill)');
    expect(body, '만남 기록이 채점 반환값에 얹혔다 — 실패하면 문항이 되살아난다')
      .not.toMatch(/(return|await)\s+recordDrillEncounters/);
  });

  it('드릴 화면이 만남을 서버로 올린다 — 없으면 드릴만 푸는 학습자가 기기에 갇힌다', () => {
    // /study는 서버 정본(user_vocab_encounters)을 읽는다. 뷰어·어휘 페이지에만 sync가
    // 있으면 그 둘을 안 여는 학습자의 순환이 끊긴다 — 새 부품이 아니라 누락된 호출 지점이다.
    const src = read('src/components/ChapterDrills.jsx');
    expect(src).toContain('syncVocabEncounters(supabase, user.id, encounterCode)');
  });
});

describe('⑤ 실물 수율 — 계약이 공허하지 않다', () => {
  it('fr·en 실제 드릴에서 정본 표기가 나온다(실측 하한 고정)', async () => {
    const cases = [
      ['french', 'fr', 200],
      ['english', 'en', 50],
    ];
    for (const [name, code, floor] of cases) {
      const mod = await import(`../../content/${name}/index.js`);
      const lookup = await loadRefVocabLookup(code);
      let hitDrills = 0;
      for (const c of mod.ALL_CHAPTERS || []) {
        for (const d of (c.drills || [])) {
          const toks = drillEncounterTokens(d);
          if (toks.length > 0 && toks.some((t) => lookup?.findWord(t))) hitDrills++;
        }
      }
      // 실측 2026-09-01: fr 229 · en 59. 하한을 넉넉히 두되 **0이면 실패**해야 한다 —
      // 정본이나 콘텐츠가 바뀌어 수확이 말라붙으면 여기서 먼저 걸린다.
      expect(hitDrills, `${code} 드릴 수확이 ${floor} 밑으로 떨어졌다: ${hitDrills}`).toBeGreaterThanOrEqual(floor);
    }
  }, 30000);
});
