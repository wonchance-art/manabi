// 뷰어 v2 AD-R3 PR① — 단어 경계 편집(한 단어로 묶기 · 나누기) 순수 함수 계약.
// 정본: docs/manabi-viewer-v2-ad-r3.md §3.1~3.5(기록 형식·불변식·연산·서버 적용·재분석), §8.1(새 계약), §2.2(왕복 표본).
// 「왕복 동일」(정본 §10): 묶기 → 원래 칼선으로 나누기, 나누기 → 다시 묶기, 재절단 → 원래 칼선이면
// 토큰 배열이 **원래 객체 그대로**(toBe)이고 기록이 0이다. 한국어는 어절 칼선 오너 결정(A/B) 전이라 거부한다.
import {readFileSync, writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {
  applyBoundaryEdits, assignBoundaryPieceIds, boundaryLineEntries, boundarySelection, boundarySpans,
  boundaryTokenRange, compactBoundaryText, composeBoundaryPiece, editBoundaries, readBoundaryEdits, replaceBoundaryLine,
} from '../boundaryEdits';
import {inspectAnalysisCoverage} from '../analysisCoverage';
import {tokenizeZhLine} from '../server/tokenizeZh';
import {tokenizeJaLine} from '../server/tokenizeJa';
import {tokenizeEnLine} from '../server/tokenizeEn';
import {loadRefVocabIndex} from '../refVocabIndex';

const entriesOf = (tokens, line = 0, stamp = 't') => tokens.map((token, i) => ({id: `id_${line}_${i}_${stamp}`, token}));
const zhTok = (text, furigana, extra = {}) => ({text, base_form: text, furigana, pos: '명사', meaning: `${text}-뜻`, ...extra});
const texts = entries => entries.map(e => e.token.text).join('|');
const startsOf = entries => { let at = 0; return entries.map(e => { const p = at; at += compactBoundaryText(e.token.text).length; return p; }); };
const lenOf = e => compactBoundaryText(e.token.text).length;
const ZH = {language: 'Chinese'}, JA = {language: 'Japanese'}, EN = {language: 'English'};

// 같은 참조 · 같은 순서 · 기록 0 — 「원상태」의 정의(설계서 §2.2).
function expectIdentical(after, before) {
  expect(after.length).toBe(before.length);
  after.forEach((entry, k) => expect(entry).toBe(before[k]));
}

describe('좌표 — 공백을 뺀 줄 글자 위치(UTF-16)', () => {
  it('토큰 구간은 공백을 지운 누적 길이다(영어 묶음 토큰 pick up = 6글자)', () => {
    const spans = boundarySpans(entriesOf([{text: 'I'}, {text: 'pick up'}, {text: 'it'}]));
    expect(spans.map(s => [s.start, s.end])).toEqual([[0, 1], [1, 7], [7, 9]]);
  });

  it('processed_json 시퀀스 범위(포함 끝)를 줄 좌표로 바꾸고, 줄을 넘으면 거부한다', () => {
    const json = {sequence: ['id_0_0_t', 'id_0_1_t', 'id_0_2_t', 'br_0_t', 'id_1_0_t'], dictionary: {
      id_0_0_t: zhTok('运动员', 'yùn dòng yuán'), id_0_1_t: zhTok('身体', 'shēn tǐ'), id_0_2_t: zhTok('素质', 'sù zhì'),
      br_0_t: {text: '\n', pos: '개행'}, id_1_0_t: zhTok('好', 'hǎo')}};
    expect(boundaryLineEntries(json, 0).map(e => e.id)).toEqual(['id_0_0_t', 'id_0_1_t', 'id_0_2_t']);
    expect(boundarySelection(json, 1, 2)).toMatchObject({ok: true, line: 0, start: 3, end: 7, ids: ['id_0_1_t', 'id_0_2_t']});
    expect(boundarySelection(json, 2, 4)).toMatchObject({ok: false, reason: 'cross_line'});
    expect(boundarySelection(json, 2, 9)).toMatchObject({ok: false, reason: 'invalid_range'});
    expect(boundaryTokenRange(json, 'id_0_2_t')).toMatchObject({ok: true, line: 0, start: 5, end: 7});
    expect(boundaryTokenRange(json, 'br_0_t')).toMatchObject({ok: false});
  });
});

describe('editBoundaries — 연산(§3.2)', () => {
  const line = () => entriesOf([zhTok('运动员', 'yùn dòng yuán'), zhTok('的', 'de'), zhTok('身体', 'shēn tǐ'), zhTok('素质', 'sù zhì'), zhTok('非常', 'fēi cháng'), zhTok('好', 'hǎo'), {text: '。', base_form: '。', furigana: '', pos: '기호'}]);

  it('묶기: 구간이 한 조각이 되고, 기록은 원래 토큰을 id째 base로 보관한다. 구간 밖 토큰은 같은 객체다', () => {
    const before = line();
    const result = editBoundaries(before, [], {line: 0, start: 4, end: 8, cuts: []}, {...ZH, id: 'b_1'});
    expect(result).toMatchObject({ok: true, changed: true, restored: false});
    expect(texts(result.tokens)).toBe('运动员|的|身体素质|非常|好|。');
    [0, 1].forEach(k => expect(result.tokens[k]).toBe(before[k]));
    [3, 4, 5].forEach(k => expect(result.tokens[k]).toBe(before[k + 1]));
    expect(result.edits).toEqual([result.record]);
    expect(result.record).toMatchObject({id: 'b_1', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], status: 'applied'});
    expect(result.record.base[0]).toBe(before[2]);
    expect(result.record.base[1]).toBe(before[3]);
    expect(result.pieces).toEqual([{index: 2, start: 4, end: 8, text: '身体素质'}]);
    // 새 조각은 서버가 뜻·품사를 채운다(§3.4). 병음은 구성 토큰을 이어 붙인 잠정값, 표식 boundary:'user'.
    expect(result.tokens[2]).toMatchObject({id: null, needsAnalysis: true, token: {text: '身体素质', base_form: '身体素质', furigana: 'shēn tǐ sù zhì', pos: null, boundary: 'user'}});
  });

  it('묶기 → 원래 칼선으로 나누기 = 원래 객체 그대로, 기록 0 (서버 호출 0)', () => {
    const before = line();
    const merged = editBoundaries(before, [], {line: 0, start: 4, end: 8, cuts: []}, ZH);
    const back = editBoundaries(merged.tokens, merged.edits, {line: 0, start: 4, end: 8, cuts: [6]}, ZH);
    expect(back).toMatchObject({ok: true, changed: true, restored: true, record: null, pieces: []});
    expectIdentical(back.tokens, before);
    expect(back.edits).toEqual([]);
  });

  it('나누기 → 다시 묶기 = 원래 객체 그대로, 기록 0', () => {
    const before = line();
    const split = editBoundaries(before, [], {line: 0, start: 0, end: 3, cuts: [1, 2]}, ZH);
    expect(texts(split.tokens)).toBe('运|动|员|的|身体|素质|非常|好|。');
    expect(split.tokens.slice(0, 3).map(e => e.token.furigana)).toEqual(['yùn', 'dòng', 'yuán']);
    const back = editBoundaries(split.tokens, split.edits, {line: 0, start: 0, end: 3, cuts: []}, ZH);
    expect(back.restored).toBe(true);
    expectIdentical(back.tokens, before);
    expect(back.edits).toEqual([]);
  });

  it('재절단: 请|把手|机关|机|。 → 把|手机|关机 → 원래 칼선 한 번에 되돌리기 = 원래 객체', () => {
    const before = entriesOf([zhTok('请', 'qǐng'), zhTok('把手', 'bǎ shǒu'), zhTok('机关', 'jī guān'), zhTok('机', 'jī'), {text: '。', pos: '기호', furigana: ''}]);
    let st = {tokens: before, edits: []};
    const step = req => { const r = editBoundaries(st.tokens, st.edits, {line: 0, ...req}, ZH); expect(r.ok).toBe(true); st = r; return r; };
    step({start: 1, end: 3, cuts: [2]});   // 把手 → 把|手
    step({start: 3, end: 5, cuts: [4]});   // 机关 → 机|关
    step({start: 2, end: 4, cuts: []});    // 手+机 → 手机
    step({start: 4, end: 6, cuts: []});    // 关+机 → 关机
    expect(texts(st.tokens)).toBe('请|把|手机|关机|。');
    expect(st.edits).toHaveLength(1);
    expect(st.edits[0]).toMatchObject({start: 1, end: 6, text: '把手机关机', cuts: [2, 4]});
    expect(st.edits[0].base.map(e => e.id)).toEqual([before[1].id, before[2].id, before[3].id]);
    expect(st.tokens.find(e => e.token.text === '手机').token.furigana).toBe('shǒu jī');
    const back = step({start: 1, end: 6, cuts: [3, 5]});
    expect(back.restored).toBe(true);
    expectIdentical(back.tokens, before);
    expect(back.edits).toEqual([]);
  });

  it('겹치는 기록은 하나로 합치고 base는 분석기 원래 토큰만 담는다(불변식 1·2)', () => {
    const before = line();
    const a = editBoundaries(before, [], {line: 0, start: 4, end: 8, cuts: []}, {...ZH, id: 'b_a'});
    const b = editBoundaries(a.tokens, a.edits, {line: 0, start: 3, end: 8, cuts: []}, {...ZH, id: 'b_b'});
    expect(texts(b.tokens)).toBe('运动员|的身体素质|非常|好|。');
    expect(b.edits).toHaveLength(1);
    expect(b.edits[0]).toMatchObject({id: 'b_b', start: 3, end: 8, cuts: []});
    expect(b.edits[0].base).toEqual([before[1], before[2], before[3]]);
    b.edits[0].base.forEach((entry, k) => expect(entry).toBe(before[k + 1]));
    // 다른 줄 기록은 건드리지 않는다
    const other = {id: 'b_other', line: 3, start: 0, end: 2, text: 'xx', cuts: [], base: [], status: 'applied'};
    const c = editBoundaries(before, [other], {line: 0, start: 4, end: 8, cuts: []}, ZH);
    expect(c.edits[0]).toBe(other);
    expect(c.edits).toHaveLength(2);
  });

  it('요청이 현재 칼선과 같으면 무변경(같은 참조)', () => {
    const before = line();
    const r = editBoundaries(before, [], {line: 0, start: 4, end: 6, cuts: []}, ZH);
    expect(r).toMatchObject({ok: true, changed: false});
    expect(r.tokens).toBe(before);
  });

  it('구간 양 끝은 토큰 경계여야 하고, 칼선은 구간 안 오름차순이어야 한다(불변식 3)', () => {
    const before = line();
    expect(editBoundaries(before, [], {line: 0, start: 5, end: 8, cuts: []}, ZH)).toMatchObject({ok: false, reason: 'not_token_boundary'});
    expect(editBoundaries(before, [], {line: 0, start: 4, end: 99, cuts: []}, ZH)).toMatchObject({ok: false, reason: 'invalid_range'});
    expect(editBoundaries(before, [], {line: 0, start: 4, end: 8, cuts: [8]}, ZH)).toMatchObject({ok: false, reason: 'invalid_cuts'});
    expect(editBoundaries(before, [], {line: 0, start: 4, end: 8, cuts: [7, 5]}, ZH)).toMatchObject({ok: false, reason: 'invalid_cuts'});
    expect(editBoundaries(before, [], {line: 0, start: 4, end: 8, cuts: [5.5]}, ZH)).toMatchObject({ok: false, reason: 'invalid_cuts'});
    // 서로게이트 쌍 안쪽 칼선 금지
    const astral = entriesOf([zhTok('𠮷野', 'jí yě')]);
    expect(editBoundaries(astral, [], {line: 0, start: 0, end: 3, cuts: [1]}, ZH)).toMatchObject({ok: false, reason: 'invalid_cuts'});
    expect(editBoundaries(astral, [], {line: 0, start: 0, end: 3, cuts: [2]}, ZH)).toMatchObject({ok: true});
  });

  it('공백 토큰을 넘어서는 묶지 않는다. 끝에 붙은 공백 토큰은 구간 밖에 남는다', () => {
    const before = entriesOf([zhTok('我', 'wǒ'), {text: ' ', pos: '기호', furigana: ''}, zhTok('是', 'shì'), zhTok('学生', 'xué sheng')]);
    expect(editBoundaries(before, [], {line: 0, start: 0, end: 2, cuts: []}, ZH)).toMatchObject({ok: false, reason: 'whitespace_inside'});
    const r = editBoundaries(before, [], {line: 0, start: 1, end: 4, cuts: []}, ZH);
    expect(texts(r.tokens)).toBe('我| |是学生');
    expect(r.tokens[1]).toBe(before[1]);
  });

  it('기록이 지금 토큰과 어긋나면(다른 창 · 오래된 기록) 추측하지 않고 거부한다', () => {
    const before = line();
    const stale = {id: 'b_s', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], base: [before[2], before[3]], status: 'applied'};
    // 지금 토큰은 아직 身体|素质(칼선 6) — 기록의 cuts []와 다르다
    expect(editBoundaries(before, [stale], {line: 0, start: 8, end: 10, cuts: []}, ZH)).toMatchObject({ok: false, reason: 'stale_edits'});
  });

  it('한국어는 어절 칼선 오너 결정(A/B) 전이라 명시적으로 거부하고 아무것도 바꾸지 않는다', () => {
    const before = entriesOf([{text: '도서관에서', base_form: '도서관', pos: '명사'}, {text: '공부해요', pos: '동사'}]);
    const edits = [];
    for (const req of [{start: 0, end: 9, cuts: []}, {start: 0, end: 5, cuts: [3]}]) {
      const r = editBoundaries(before, edits, {line: 0, ...req}, {language: 'Korean'});
      expect(r).toMatchObject({ok: false, reason: 'korean', changed: false, record: null});
      expect(r.tokens).toBe(before);
      expect(r.edits).toBe(edits);
    }
    expect(editBoundaries(before, [], {line: 0, start: 0, end: 9, cuts: []}, {})).toMatchObject({ok: false, reason: 'unsupported_language'});
    expect(editBoundaries(before, [], {line: 0, start: 0, end: 9, cuts: []}, {language: 'French'})).toMatchObject({ok: false, reason: 'unsupported_language'});
  });
});

describe('언어별 조각 필드 — 잠정값(§3.4 표). 뜻·품사는 서버 분석 경로가 채운다', () => {
  it('일본어 묶기: base_form = 앞 표면 + 마지막 기본형, 읽기 = 구성 읽기 연결', () => {
    const before = entriesOf([
      {text: '申し', base_form: '申す', furigana: 'もうし', pos: '동사'},
      {text: '込ん', base_form: '込む', furigana: 'こん', pos: '동사'},
      {text: 'だ', base_form: 'だ', furigana: null, pos: '조동사'},
    ]);
    const r = editBoundaries(before, [], {line: 0, start: 0, end: 4, cuts: []}, JA);
    expect(r.tokens[0].token).toMatchObject({text: '申し込ん', base_form: '申し込む', furigana: 'もうしこん', boundary: 'user'});
    const back = editBoundaries(r.tokens, r.edits, {line: 0, start: 0, end: 4, cuts: [2]}, JA);
    expectIdentical(back.tokens, before);
  });

  it('일본어 나누기: 조각 기본형은 표면, 읽기는 비워 서버(사전)에 맡긴다', () => {
    const before = entriesOf([{text: '映画館', base_form: '映画館', furigana: 'えいがかん', pos: '명사'}, {text: 'へ', base_form: 'へ', furigana: null, pos: '조사'}]);
    const r = editBoundaries(before, [], {line: 0, start: 0, end: 3, cuts: [2]}, JA);
    expect(r.tokens.slice(0, 2).map(e => e.token)).toMatchObject([{text: '映画', base_form: '映画', furigana: null}, {text: '館', base_form: '館', furigana: null}]);
    expectIdentical(editBoundaries(r.tokens, r.edits, {line: 0, start: 0, end: 3, cuts: []}, JA).tokens, before);
  });

  it('영어 구동사: 원문 공백을 살린 pick up, 기본형 = 첫 lemma + 나머지 소문자, 좌표는 공백을 뺀다', () => {
    const lineText = 'She picked up the book.';
    const before = entriesOf(tokenizeEnLine(lineText));
    const at = startsOf(before), k = before.findIndex(e => e.token.text === 'picked');
    const r = editBoundaries(before, [], {line: 0, start: at[k], end: at[k + 1] + 2, cuts: []}, {...EN, lineText});
    expect(r.tokens[k].token).toMatchObject({text: 'picked up', base_form: 'pick up', boundary: 'user'});
    expect(r.record).toMatchObject({text: 'pickedup', start: 3, end: 11});
    // 원문 없이도 영어는 공백 하나로 잇는다
    expect(editBoundaries(before, [], {line: 0, start: 3, end: 11, cuts: []}, EN).tokens[k].token.text).toBe('picked up');
    const back = editBoundaries(r.tokens, r.edits, {line: 0, start: 3, end: 11, cuts: [9]}, {...EN, lineText});
    expectIdentical(back.tokens, before);
    expect(back.edits).toEqual([]);
  });

  it('중국어 병음: 나누기는 글자 수대로 나누고(splitZhToken 규칙), 묶기는 이어 붙인다', () => {
    const parts = [{token: zhTok('机关', 'jī guān'), from: 1, to: 2}, {token: zhTok('机', 'jī'), from: 0, to: 1}];
    expect(composeBoundaryPiece({language: 'Chinese', text: '关机', parts})).toMatchObject({text: '关机', base_form: '关机', furigana: 'guān jī', pos: null, boundary: 'user'});
    // 글자-음절 수가 어긋난 토큰의 일부는 병음을 추측하지 않는다
    expect(composeBoundaryPiece({language: 'Chinese', text: 'A', parts: [{token: zhTok('A股', 'gǔ'), from: 0, to: 1}]}).furigana).toBe('');
    expect(composeBoundaryPiece({language: 'Chinese', text: '股', parts: [{token: zhTok('A股', 'gǔ'), from: 1, to: 2}]}).furigana).toBe('');
  });
});

describe('applyBoundaryEdits — 분석기 토큰 위에 기록 다시 적용(§3.4·§3.5, 서버·재분석 공용)', () => {
  const fresh = () => entriesOf([zhTok('运动员', 'yùn dòng yuán'), zhTok('的', 'de'), zhTok('身体', 'shēn tǐ'), zhTok('素质', 'sù zhì'), zhTok('非常', 'fēi cháng'), zhTok('好', 'hǎo')], 0, 'new');

  it('기록이 없으면 입력 배열을 그대로 돌려준다(기록 0 = 동작 동일)', () => {
    const tokens = fresh();
    const r = applyBoundaryEdits(tokens, [], ZH);
    expect(r.tokens).toBe(tokens);
    expect(r.results).toEqual([]);
  });

  it('묶기 기록을 적용하고 새 base(분석기 토큰)를 돌려준다. 조각에 boundary 표식', () => {
    const tokens = fresh();
    const r = applyBoundaryEdits(tokens, [{id: 'b_1', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], base: []}], ZH);
    expect(texts(r.tokens)).toBe('运动员|的|身体素质|非常|好');
    expect(r.tokens[2].token).toMatchObject({text: '身体素质', furigana: 'shēn tǐ sù zhì', boundary: 'user'});
    expect(r.tokens[0]).toBe(tokens[0]);
    expect(r.results).toEqual([{id: 'b_1', status: 'applied', start: 4, end: 8, cuts: [], base: [tokens[2], tokens[3]]}]);
    const rule = applyBoundaryEdits(tokens, [{id: 'r', line: 0, start: 4, end: 8, text: '身体素质', cuts: []}], {...ZH, marker: 'user_rule'});
    expect(rule.tokens[2].token.boundary).toBe('user_rule');
  });

  it('구간 글자가 다르면 줄에서 한 번만 나올 때 옮기고, 아니면 pending으로 남긴다(조용히 버리지 않음)', () => {
    const tokens = fresh();
    const moved = applyBoundaryEdits(tokens, [{id: 'b_m', line: 0, start: 0, end: 4, text: '身体素质', cuts: []}], ZH);
    expect(moved.results[0]).toMatchObject({status: 'applied', start: 4, end: 8, moved: true});
    const missing = applyBoundaryEdits(tokens, [{id: 'b_x', line: 0, start: 4, end: 8, text: '身体条件', cuts: []}], ZH);
    expect(missing.tokens).toBe(tokens);
    expect(missing.results[0]).toMatchObject({id: 'b_x', status: 'pending', reason: 'text_mismatch'});
    const edge = applyBoundaryEdits(tokens, [{id: 'b_e', line: 0, start: 5, end: 8, text: '体素质', cuts: []}], ZH);
    expect(edge.results[0]).toMatchObject({status: 'pending', reason: 'edge_mismatch'});
    const twice = entriesOf([zhTok('身体', 'shēn tǐ'), zhTok('好', 'hǎo'), zhTok('身体', 'shēn tǐ')]);
    expect(applyBoundaryEdits(twice, [{id: 'b_t', line: 0, start: 1, end: 3, text: '身体', cuts: [2]}], ZH).results[0]).toMatchObject({status: 'pending', reason: 'text_mismatch'});
  });

  it('분석기가 이미 같은 칼선을 내면 바꾸지 않고 redundant로 알린다. 겹치는 기록은 뒤의 것이 pending', () => {
    const tokens = fresh();
    const same = applyBoundaryEdits(tokens, [{id: 'b_r', line: 0, start: 4, end: 8, text: '身体素质', cuts: [6]}], ZH);
    expect(same.tokens).toBe(tokens);
    expect(same.results[0]).toMatchObject({status: 'applied', redundant: true});
    const overlap = applyBoundaryEdits(tokens, [
      {id: 'b_1', line: 0, start: 4, end: 8, text: '身体素质', cuts: []},
      {id: 'b_2', line: 0, start: 3, end: 6, text: '的身体', cuts: []},
    ], ZH);
    expect(overlap.results.map(r => [r.id, r.status, r.reason])).toEqual([['b_1', 'applied', undefined], ['b_2', 'pending', 'overlap']]);
  });

  it('editBoundaries가 만든 기록을 분석기 토큰에 다시 적용하면 같은 경계가 나온다(재분석 뒤 유지)', () => {
    const before = fresh();
    let st = {tokens: before, edits: []};
    for (const req of [{start: 4, end: 8, cuts: []}, {start: 0, end: 3, cuts: [2]}]) st = editBoundaries(st.tokens, st.edits, {line: 0, ...req}, ZH);
    const again = applyBoundaryEdits(fresh(), st.edits, ZH);
    expect(texts(again.tokens)).toBe(texts(st.tokens));
    expect(again.results.every(r => r.status === 'applied')).toBe(true);
  });

  it('한국어는 무변경 + 모든 기록 pending(reason korean)', () => {
    const tokens = entriesOf([{text: '도서관에서'}]);
    const r = applyBoundaryEdits(tokens, [{id: 'k', line: 0, start: 0, end: 5, text: '도서관에서', cuts: [3]}], {language: 'Korean'});
    expect(r.tokens).toBe(tokens);
    expect(r.results).toEqual([{id: 'k', status: 'pending', reason: 'korean', base: []}]);
  });
});

describe('processed_json 반영 — 줄 좌표 검사 통과 · 원상태면 바이트 단위로 같다', () => {
  const rawText = '运动员的身体素质非常好。\n今天天气很好。';
  const build = () => {
    const sequence = [], dictionary = {};
    rawText.split('\n').forEach((lineText, line, all) => {
      tokenizeZhLine(lineText).forEach((token, i) => { const id = `id_${line}_${i}_1728`; sequence.push(id); dictionary[id] = token; });
      if (line < all.length - 1) { sequence.push(`br_${line}_1728`); dictionary[`br_${line}_1728`] = {text: '\n', pos: '개행'}; }
    });
    return {sequence, dictionary, metadata: {language: 'Chinese'}};
  };

  it('묶기 → 저장 형태 → 나누기 → 원래 processed_json과 깊이 같다', () => {
    const json = build(), snapshot = JSON.parse(JSON.stringify(json));
    const sel = boundarySelection(json, 2, 3);
    expect(sel).toMatchObject({ok: true, line: 0});
    expect(sel.ids.map(id => json.dictionary[id].text)).toEqual(['身体', '素质']);
    const merged = editBoundaries(sel.entries, readBoundaryEdits(json), {line: 0, start: sel.start, end: sel.end, cuts: []}, {...ZH, id: 'b_7f3a9c21'});
    const withIds = assignBoundaryPieceIds(merged.tokens, 0, 'rev-0a1b2c3d4e');
    expect(withIds[2].id).toBe('id_0_e2_rev0a1b2');
    const next = replaceBoundaryLine(json, 0, withIds, merged.edits);
    expect(inspectAnalysisCoverage(rawText, next)).toMatchObject({validStructure: true, missingIndices: []});
    expect(next.sequence.filter(id => id.startsWith('id_1_'))).toEqual(json.sequence.filter(id => id.startsWith('id_1_')));
    expect(readBoundaryEdits(next)).toHaveLength(1);
    // 저장 왕복(JSON) 뒤에도 원래 칼선으로 나누면 원래 id·뜻·병음이 돌아온다
    const stored = JSON.parse(JSON.stringify(next));
    const line0 = boundaryLineEntries(stored, 0);
    const piece = boundaryTokenRange(stored, 'id_0_e2_rev0a1b2');
    const split = editBoundaries(line0, readBoundaryEdits(stored), {line: 0, start: piece.start, end: piece.end, cuts: [piece.start + 2]}, ZH);
    expect(split.restored).toBe(true);
    expect(replaceBoundaryLine(stored, 0, split.tokens, split.edits)).toEqual(snapshot);
    expect(json).toEqual(snapshot); // 입력 불변
  });

  it('id 없는 조각이 남아 있으면 반영하지 않는다(서버 조각 확정 전 저장 금지)', () => {
    const json = build(), sel = boundarySelection(json, 2, 3);
    const merged = editBoundaries(sel.entries, [], {line: 0, start: sel.start, end: sel.end, cuts: []}, ZH);
    expect(replaceBoundaryLine(json, 0, merged.tokens, merged.edits)).toBeNull();
  });
});

describe('실제 자료 토큰 표본 — 좌표 보존 · 왕복 실패 0', () => {
  // 설계서 §2.1·§7.1 예문 + 이합사(道了歉 sep_link)·공백·숫자 섞인 줄. 분할 결과는 지금 tokenizeZhLine 그대로다.
  const ZH_LINES = [
    '运动员的身体素质非常好。', '请把手机关机。', '我在北京大学读书。', '王先生肚子疼。', '他对音乐很感兴趣。',
    '我想给妈妈打电话。', '不客气。', '我们去踢足球吧。', '那时候我还小。', '你明天有空儿吗？',
    '他昨天买了三本书。', '我第一次来中国。', '你先进去吧。', '他向老师道了歉。', '这件事情很复杂。',
    '我每天早上喝咖啡。', '图书馆在学校东边。', '他们昨天吵过架。', '今天天气很好， 我们 去公园吧！', '2026年我和朋友一起看了3部电影。',
  ];

  // 한 줄에서: 이웃 둘 묶기 → 원래 칼선 / 다자 토큰 글자마다 나누기 → 묶기. 매번 원래 객체·기록 0·글자 보존.
  function roundTrips(entries, options) {
    const stat = {merge: 0, split: 0, failures: []};
    const compact = entries.map(e => compactBoundaryText(e.token.text)).join('');
    const at = startsOf(entries);
    const check = (kind, after, label) => {
      const same = after.edits.length === 0 && after.tokens.length === entries.length && after.tokens.every((e, k) => e === entries[k]);
      if (!same) stat.failures.push(`${kind}:${label}:${texts(after.tokens)}`);
    };
    for (let i = 0; i + 1 < entries.length; i++) {
      if (!lenOf(entries[i]) || !lenOf(entries[i + 1])) continue; // 공백 토큰은 묶지 않는다
      const a = at[i], m = at[i + 1], b = m + lenOf(entries[i + 1]);
      const merged = editBoundaries(entries, [], {line: 0, start: a, end: b, cuts: []}, options);
      if (!merged.ok || merged.tokens.map(e => compactBoundaryText(e.token.text)).join('') !== compact) { stat.failures.push(`merge-ok:${i}`); continue; }
      check('merge', editBoundaries(merged.tokens, merged.edits, {line: 0, start: a, end: b, cuts: [m]}, options), i);
      stat.merge++;
    }
    entries.forEach((entry, i) => {
      const chars = [...compactBoundaryText(entry.token.text)];
      if (chars.length < 2) return;
      const cuts = []; let p = at[i];
      for (const ch of chars.slice(0, -1)) { p += ch.length; cuts.push(p); }
      const split = editBoundaries(entries, [], {line: 0, start: at[i], end: at[i] + lenOf(entry), cuts}, options);
      if (!split.ok || split.tokens.map(e => compactBoundaryText(e.token.text)).join('') !== compact) { stat.failures.push(`split-ok:${i}`); return; }
      check('split', editBoundaries(split.tokens, split.edits, {line: 0, start: at[i], end: at[i] + lenOf(entry), cuts: []}, options), i);
      stat.split++;
    });
    return stat;
  }

  it('중국어 고정 20문장: 좌표가 공백 뺀 원문과 일치하고, 왕복 실패 0', () => {
    let merge = 0, split = 0;
    for (const lineText of ZH_LINES) {
      const entries = entriesOf(tokenizeZhLine(lineText));
      expect(entries.map(e => compactBoundaryText(e.token.text)).join('')).toBe(compactBoundaryText(lineText));
      expect(boundarySpans(entries).at(-1).end).toBe(compactBoundaryText(lineText).length);
      const stat = roundTrips(entries, {...ZH, lineText});
      expect(stat.failures, lineText).toEqual([]);
      merge += stat.merge; split += stat.split;
    }
    expect(merge).toBeGreaterThan(80);
    expect(split).toBeGreaterThan(40);
  });

  it('중국어 refVocab 예문 전수: 묶기 왕복 · 나누기 왕복 실패 0(설계서 §2.2 재현)', async () => {
    const index = await loadRefVocabIndex('Chinese');
    const sentences = [...new Set([...index.values()].map(e => e.word.ex?.zh).filter(Boolean))];
    expect(sentences.length).toBeGreaterThan(6000);
    const total = {merge: 0, split: 0, failures: []};
    for (const s of sentences) {
      const stat = roundTrips(entriesOf(tokenizeZhLine(s)), {...ZH, lineText: s});
      total.merge += stat.merge; total.split += stat.split;
      if (stat.failures.length) total.failures.push([s, stat.failures.slice(0, 3)]);
    }
    if (process.env.BOUNDARY_ROUNDTRIP_REPORT) writeFileSync(`${process.env.BOUNDARY_ROUNDTRIP_REPORT}.zh.json`, JSON.stringify({sentences: sentences.length, merge: total.merge, split: total.split, failures: total.failures.length}));
    expect(total.failures.slice(0, 5)).toEqual([]);
    expect(total.merge).toBeGreaterThan(30000);
    expect(total.split).toBeGreaterThan(15000);
  });

  it('일본어 어휘 예문 표본(결정적 1/10): 좌표 보존 · 왕복 실패 0', async () => {
    const mod = await import('../../content/japanese/index.js');
    const rows = [];
    for (const m of mod.JA_LEVEL_META || []) for (const th of mod.getVocab(m.key)?.themes || []) for (const w of th.words || []) if (w.ex?.ja) rows.push(String(w.ex.ja));
    const sample = [...new Set(rows)].filter((_, i) => i % 10 === 0);
    expect(sample.length).toBeGreaterThan(500);
    let merge = 0, split = 0; const failures = [];
    for (const s of sample) {
      const entries = entriesOf(await tokenizeJaLine(s));
      expect(entries.map(e => compactBoundaryText(e.token.text)).join('')).toBe(compactBoundaryText(s));
      const stat = roundTrips(entries, {...JA, lineText: s});
      merge += stat.merge; split += stat.split;
      if (stat.failures.length) failures.push([s, stat.failures.slice(0, 3)]);
    }
    if (process.env.BOUNDARY_ROUNDTRIP_REPORT) writeFileSync(`${process.env.BOUNDARY_ROUNDTRIP_REPORT}.ja.json`, JSON.stringify({sentences: sample.length, merge, split, failures: failures.length}));
    expect(failures.slice(0, 5)).toEqual([]);
    expect(merge).toBeGreaterThan(3000);
    expect(split).toBeGreaterThan(1000);
  });
});

describe('공용 모듈 계약 — 브라우저·서버가 같이 쓴다(§3.4)', () => {
  it('서버 전용 모듈·Node 내장·DB 클라이언트를 import하지 않는다', () => {
    const source = readFileSync(new URL('../boundaryEdits.js', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map(m => m[1]);
    expect(imports).toEqual(['./analysisCoverage']);
    expect(source).not.toMatch(/supabase|fetch\(|localStorage|Date\.now|Math\.random/);
  });
});
