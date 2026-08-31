import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';
import { buildStudyReviewRefs, normalizeResp, RESP_MAX } from '../studyExerciseBridge';
import { errorTags, isWeaknessEvent } from '../errorTags';
import { promoteWeakFirst, WEAK_PROMOTE_CAP } from '../weaknessProfile';

/**
 * 계약: v2-A R2 — 오답 응답(resp) · 표기 축(glyph) · 편성 편향 (오너 "A R2 ㄱㄱ").
 *
 * 설계 §0 ③은 `buildExerciseResult`가 응답을 들고 있다고 했는데 **그 함수는 없다**.
 * 실측한 진짜 경로는 `settle(ok, pickedValue, result)` → `recordSettle` 인데,
 * pickedValue(=응답)가 recordSettle로 넘어가지 않고 **버려지고 있었다**. R2는 그 한 칸을
 * 잇는 일이다 — 설계의 취지는 맞았고 이름만 틀렸다.
 *
 * 지키는 것은 요구다: ⑴ 응답은 오답일 때만·상한 안에서 ⑵ glyph는 근거가 확실할 때만
 * ⑶ 편성은 만들지도 버리지도 않고 상한 안에서 순서만.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

const typingItem = {
  type: 'vocab-typing',
  effect: { kind: 'vocab' },
  word: { id: 'w1', word_text: '約束', meaning: '약속' },
};

describe('A R2 ① 오답 응답(resp)', () => {
  it('오답일 때만 남는다 — 정답 응답은 진단 정보가 0이다', () => {
    const wrong = buildStudyReviewRefs({ correct: false, item: typingItem, lang: 'Japanese', response: '約束す' });
    expect(wrong[0].detail.resp).toBe('約束す');

    const right = buildStudyReviewRefs({ correct: true, item: typingItem, lang: 'Japanese', response: '約束' });
    expect(right[0].detail, '정답에 resp를 실으면 detail만 불린다').not.toHaveProperty('resp');
  });

  it('응답이 없거나 문자열이 아니면 키 자체가 없다', () => {
    for (const response of [null, undefined, '   ', 42, { pick: 'a' }]) {
      const refs = buildStudyReviewRefs({ correct: false, item: typingItem, lang: 'Japanese', response });
      expect(refs[0].detail, `response=${JSON.stringify(response)}`).not.toHaveProperty('resp');
    }
  });

  it(`상한 ${RESP_MAX}자 — 진단에 필요한 건 글자 어긋남이지 장문이 아니다`, () => {
    expect(normalizeResp('가'.repeat(200))).toHaveLength(RESP_MAX);
    expect(normalizeResp('  약속  ')).toBe('약속');
  });

  it('기존 detail 계약을 건드리지 않는다 — source·mode·qtype 무변경', () => {
    const [ref] = buildStudyReviewRefs({ correct: false, item: typingItem, lang: 'Japanese', response: 'x' });
    expect(ref.detail.mode).toBe('study');
    expect(ref.detail.qtype).toBeTruthy();
    expect(ref.type).toBe('vocab');
  });

  it('응답이 채점 지점에서 기록 지점까지 실제로 흐른다', () => {
    // 이 한 칸이 끊겨 있던 것이 R2의 실제 결함이다 — 순수 함수만 맞고 배선이 없으면
    // 필드는 영원히 안 찬다.
    const page = read('src/views/StudySessionPage.jsx');
    expect(page, 'settle의 pickedValue가 recordSettle로 넘어가야 한다')
      .toContain('recordSettle(ok, item, result, pickedValue)');
    const bridge = read('src/lib/studyExerciseBridge.js');
    expect(sliceBetween(bridge, 'export async function recordStudyReviewCompleted', 'const reviewRefs'))
      .toContain('response');
  });
});

describe('A R2 ② 표기 축(glyph)', () => {
  // 기본 픽스처는 **놓친 글자가 실제로 있는** 모양이어야 한다. resp가 정답보다 길기만
  // 하면 ins가 0이라 어떤 가드를 빼도 태그가 안 나 검사가 공허해진다(돌연변이로 실측).
  const ev = (over) => ({
    source: 'vocab', item_key: '一緒', correct: false,
    detail: { qtype: 'typing', resp: '一' }, ...over,
  });

  it('놓친 글자만 센다 — 잉여로 친 글자는 표기 약점의 근거가 얇다', () => {
    // resp '一' vs 정답 '一緒' → 緒를 놓쳤다.
    const tags = errorTags(ev({ item_key: '一緒', detail: { qtype: 'typing', resp: '一' } }));
    expect(tags).toContain('glyph:緒');
    // 반대 방향(정답보다 더 쓴 글자)은 태그가 되지 않는다.
    const extra = errorTags(ev({ item_key: '一', detail: { qtype: 'typing', resp: '一緒' } }));
    expect(extra.some((t) => t.startsWith('glyph:'))).toBe(false);
  });

  it('근거가 확실할 때만 — 정답·비어휘·보기형·resp 부재는 축이 빠진다', () => {
    const noGlyph = (e) => errorTags(e).every((t) => !t.startsWith('glyph:'));
    expect(noGlyph(ev({ correct: true })), '정답').toBe(true);
    expect(noGlyph(ev({ source: 'grammar' })), '문법은 item_key가 슬러그라 정답이 아니다').toBe(true);
    expect(noGlyph(ev({ detail: { qtype: 'choice', resp: '보기1' } })), '고르기 응답은 보기 문자열').toBe(true);
    expect(noGlyph(ev({ detail: { qtype: 'typing' } })), 'resp 없음(소급 안전)').toBe(true);
  });

  it('소급 안전 — R2 이전 이벤트는 이 축만 조용히 빠진다', () => {
    // P1「저장 말고 유도」: 옛 이벤트에 resp가 없을 뿐, 나머지 축은 그대로 난다.
    const old = ev({ detail: { qtype: 'typing' } });
    expect(isWeaknessEvent(old)).toBe(true);
    expect(errorTags(old)).toContain('retrieval:typing');
  });

  it('한 이벤트가 표기 축을 무한히 늘리지 않는다', () => {
    const many = errorTags(ev({ item_key: '一二三四五六七', detail: { qtype: 'typing', resp: '一' } }));
    expect(many.filter((t) => t.startsWith('glyph:')).length).toBeLessThanOrEqual(3);
  });
});

describe('A R2 ③ 편성 편향', () => {
  const items = [1, 2, 3, 4, 5, 6].map((n) => ({ meta: { slug: `ch${n}` } }));
  const slugOf = (g) => g?.meta?.slug || null;

  it('만들지도 버리지도 않는다 — 순서만 바뀐다', () => {
    const out = promoteWeakFirst(items, new Set(['ch4', 'ch5']), { slugOf });
    expect(out).toHaveLength(items.length);
    expect(new Set(out.map(slugOf))).toEqual(new Set(items.map(slugOf)));
    expect(out.map(slugOf).slice(0, 2)).toEqual(['ch4', 'ch5']);
  });

  it(`상한 ${WEAK_PROMOTE_CAP} — 전량 앞으로 몰면 세션이 약점 특강이 된다`, () => {
    // 약점이 상한보다 **많고 약하지 않은 후보가 섞여** 있어야 상한이 드러난다.
    // 전부 약점이면 상한이 있으나 없으나 순서가 같아 검사가 공허하다(돌연변이로 실측).
    const weak = new Set(['ch2', 'ch4', 'ch5', 'ch6']); // 4개 > 상한 3
    const out = promoteWeakFirst(items, weak, { slugOf }).map(slugOf);
    // 앞 3개만 승격되고, 상한을 넘은 ch6는 제자리(비약점 사이)에 남는다.
    expect(out).toEqual(['ch2', 'ch4', 'ch5', 'ch1', 'ch3', 'ch6']);
    expect(out.slice(0, WEAK_PROMOTE_CAP).every((s) => weak.has(s))).toBe(true);
  });

  it('약점이 없으면 순서가 그대로다 — 신규·게스트 무영향', () => {
    expect(promoteWeakFirst(items, new Set(), { slugOf }).map(slugOf)).toEqual(items.map(slugOf));
    expect(promoteWeakFirst(items, null, { slugOf }).map(slugOf)).toEqual(items.map(slugOf));
  });

  it('호출자의 배열을 되돌려주지 않는다 — 조립부의 공유 버킷이다', () => {
    for (const weak of [new Set(), new Set(['ch2'])]) {
      expect(promoteWeakFirst(items, weak, { slugOf })).not.toBe(items);
    }
  });

  it('조립부가 정렬 결과를 실제로 소비한다', () => {
    // 정렬해 놓고 원본을 넘기면 이 라운드는 아무 일도 하지 않은 것이 된다.
    const src = read('src/lib/studyMaterials.js');
    expect(src).toContain('const grammarDueOrdered = promoteWeakFirst(grammarDue');
    expect(src).toContain('grammarDue: grammarDueOrdered');
    expect(src, '문단 재료도 같은 순서를 봐야 한다').toContain('grammarDueOrdered.slice(0, 2)');
  });
});
