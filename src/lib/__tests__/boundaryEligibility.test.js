// 뷰어 v2 AD-R3 PR① — 묶기·나누기 조건 판정(설계서 §6.1·§4.4·§12.2·§11.2). 화면 문구는 PR③에서 vt() 3벌로 붙이고,
// 이 함수는 이유 코드만 돌려준다(쓸 수 없는 옵션은 숨기지 않고 꺼진 채 이유 — AD-R2 규칙).
import {describe, expect, it} from 'vitest';
import {BOUNDARY_LIMITS, boundaryMergeEligibility, boundarySplitEligibility} from '../boundaryEdits';

const owner = {owner: true};
function material(language, lines, edits) {
  const sequence = [], dictionary = {};
  lines.forEach((tokens, line) => {
    tokens.forEach((token, i) => { const id = token.failed ? `failed_${line}_t` : `id_${line}_${i}_t`; sequence.push(id); dictionary[id] = token; });
    if (line < lines.length - 1) { sequence.push(`br_${line}_t`); dictionary[`br_${line}_t`] = {text: '\n', pos: '개행'}; }
  });
  return {sequence, dictionary, metadata: {language, ...(edits ? {viewerBoundaries: {version: 1, edits}} : {})}};
}
const zh = (text, extra = {}) => ({text, base_form: text, furigana: '', pos: '명사', ...extra});
const zhJson = material('Chinese', [[zh('运动员'), zh('的'), zh('身体'), zh('素质'), zh('。', {pos: '기호'})], [zh('他'), zh('道', {sep_link: undefined}), zh('了'), zh('歉', {sep_link: '道歉'})]]);
// 시퀀스: 0 运动员 · 1 的 · 2 身体 · 3 素质 · 4 。 · 5 br · 6 他 · 7 道 · 8 了 · 9 歉

describe('묶기 조건', () => {
  it('같은 줄 이웃 토큰 2~8개, 소유자, 중·일·영이면 된다', () => {
    const r = boundaryMergeEligibility(zhJson, 2, 3, owner);
    expect(r).toMatchObject({ok: true, reason: null, selection: {line: 0, start: 4, end: 8}});
  });

  it.each([
    ['줄바꿈을 넘음', 3, 6, 'cross_line'],
    ['문장부호 포함', 3, 4, 'punctuation'],
    ['토큰 1개', 2, 2, 'too_few'],
    ['이합사 조각(sep_link) 포함', 8, 9, 'separable'],
  ])('%s → 불가', (_, a, b, reason) => {
    expect(boundaryMergeEligibility(zhJson, a, b, owner)).toMatchObject({ok: false, reason});
  });

  it('이합사 통짜(base_form ≠ text)는 중국어에서만 막는다 — 일본어 활용형은 기본형이 달라도 된다', () => {
    const zhSep = material('Chinese', [[zh('吵过', {base_form: '吵架'}), zh('架', {base_form: '吵架'})]]);
    expect(boundaryMergeEligibility(zhSep, 0, 1, owner)).toMatchObject({ok: false, reason: 'separable'});
    const ja = material('Japanese', [[{text: '申し', base_form: '申す', pos: '동사'}, {text: '込ん', base_form: '込む', pos: '동사'}]]);
    expect(boundaryMergeEligibility(ja, 0, 1, owner)).toMatchObject({ok: true});
  });

  it('분석 실패 줄은 묶지 않는다', () => {
    const failed = material('Chinese', [[zh('好'), {text: '坏掉的行', pos: '미분석', failed: true}]]);
    expect(boundaryMergeEligibility(failed, 0, 1, owner)).toMatchObject({ok: false, reason: 'failed'});
  });

  it('토큰 8개 · 글자 12(중·일) · 40(영) 상한', () => {
    expect(BOUNDARY_LIMITS).toMatchObject({maxTokens: 8, maxChars: {Chinese: 12, Japanese: 12, English: 40}, maxEdits: 200});
    const nine = material('Chinese', [Array.from({length: 9}, () => zh('好'))]);
    expect(boundaryMergeEligibility(nine, 0, 8, owner)).toMatchObject({ok: false, reason: 'too_many'});
    expect(boundaryMergeEligibility(nine, 0, 7, owner)).toMatchObject({ok: true});
    const long = material('Chinese', [[zh('一二三四五六七'), zh('八九十一二三')]]);
    expect(boundaryMergeEligibility(long, 0, 1, owner)).toMatchObject({ok: false, reason: 'too_long'});
    const en = material('English', [[{text: 'pick', base_form: 'pick', pos: null}, {text: 'up', base_form: 'up', pos: null}]]);
    expect(boundaryMergeEligibility(en, 0, 1, owner)).toMatchObject({ok: true});
  });

  it.each([
    ['한국어', {language: 'Korean', owner: true}, 'korean'],
    ['프랑스어(승인 밖)', {language: 'French', owner: true}, 'unsupported_language'],
    ['비소유자', {owner: false}, 'not_owner'],
    ['팀 수업 사본', {owner: true, classCopy: true}, 'class_copy'],
    ['작성기 구간 자료', {owner: true, passage: true}, 'passage'],
    ['수업 모드', {owner: true, classMode: true}, 'class_mode'],
  ])('%s → 불가', (_, ctx, reason) => {
    expect(boundaryMergeEligibility(zhJson, 2, 3, ctx)).toMatchObject({ok: false, reason});
  });

  it('자료 metadata가 한국어면 ctx 언어가 없어도 막는다', () => {
    const ko = material('Korean', [[{text: '도서관에서'}, {text: '공부해요'}]]);
    expect(boundaryMergeEligibility(ko, 0, 1, owner)).toMatchObject({ok: false, reason: 'korean'});
    expect(boundarySplitEligibility(ko, 'id_0_0_t', owner)).toMatchObject({ok: false, reason: 'korean'});
  });

  it('자료당 기록 200개 상한 — 기존 기록과 겹치는 편집(되돌리기 포함)은 막지 않는다', () => {
    const edits = Array.from({length: 200}, (_, i) => ({id: `b_${i}`, line: 9 + i, start: 0, end: 2, text: 'xx', cuts: [], base: [], status: 'applied'}));
    const full = material('Chinese', [[zh('运动员'), zh('的'), zh('身体'), zh('素质')]], edits);
    expect(boundaryMergeEligibility(full, 2, 3, owner)).toMatchObject({ok: false, reason: 'edit_limit'});
    const overlapping = material('Chinese', [[zh('运动员'), zh('的'), zh('身体素质')]], [...edits.slice(1), {id: 'b_x', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], base: [], status: 'applied'}]);
    expect(boundarySplitEligibility(overlapping, 'id_0_2_t', owner)).toMatchObject({ok: true});
  });
});

describe('나누기 조건', () => {
  it('2글자 이상 토큰이면 된다(서로게이트 쌍은 한 글자)', () => {
    expect(boundarySplitEligibility(zhJson, 'id_0_2_t', owner)).toMatchObject({ok: true, selection: {line: 0, start: 4, end: 6}});
    expect(boundarySplitEligibility(zhJson, 'id_0_1_t', owner)).toMatchObject({ok: false, reason: 'too_short'});
    const astral = material('Chinese', [[zh('𠮷')]]);
    expect(boundarySplitEligibility(astral, 'id_0_0_t', owner)).toMatchObject({ok: false, reason: 'too_short'});
  });

  it('영어는 공백이 든(묶은) 토큰만 나눈다', () => {
    const en = material('English', [[{text: 'picked up', base_form: 'pick up'}, {text: 'books', base_form: 'book'}]]);
    expect(boundarySplitEligibility(en, 'id_0_0_t', owner)).toMatchObject({ok: true});
    expect(boundarySplitEligibility(en, 'id_0_1_t', owner)).toMatchObject({ok: false, reason: 'single_word'});
  });

  it('문장부호 · 개행 · 이합사 · 없는 토큰 · 비소유자는 불가', () => {
    const punct = material('Chinese', [[zh('……', {pos: '기호'})]]);
    expect(boundarySplitEligibility(punct, 'id_0_0_t', owner)).toMatchObject({ok: false, reason: 'punctuation'});
    expect(boundarySplitEligibility(zhJson, 'br_0_t', owner)).toMatchObject({ok: false, reason: 'invalid_range'});
    const sep = material('Chinese', [[zh('吵过', {base_form: '吵架'})]]);
    expect(boundarySplitEligibility(sep, 'id_0_0_t', owner)).toMatchObject({ok: false, reason: 'separable'});
    expect(boundarySplitEligibility(zhJson, 'nope', owner)).toMatchObject({ok: false, reason: 'invalid_range'});
    expect(boundarySplitEligibility(zhJson, 'id_0_2_t', {})).toMatchObject({ok: false, reason: 'not_owner'});
  });
});
