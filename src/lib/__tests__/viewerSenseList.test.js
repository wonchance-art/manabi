import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSenseList, sameSense, senseKey, senseListCount } from '../viewerSenseList';
import { buildMeaningOptions } from '../tokenEditOptions';
import { referenceMatchesContext } from '../viewerReliability';

/**
 * 계약: 단어창 사전 뜻 목록(VIEWER-V2-ROUNDS-001 §2.1 B안 · AE-R1 설계서 §3.2·§7.3).
 * - 품사별 번호 목록(번호는 묶음을 넘어 이어 센다). 재료 = morpheme_dictionary.meanings + refVocab.
 * - 같은 뜻은 정규화 집합 비교로 합친다(괄호 보충·순서 무시, 부분 겹침은 다른 뜻).
 * - 이 문장 뜻(토큰 뜻)과 같은 줄 하나만 current(「문맥상」). 사전 뜻으로 바꿔치기 0.
 * - 예문(refVocab ex)은 그 뜻 줄 아래. 사전 뜻끼리는 buildMeaningOptions와 같은 집합.
 * - 「AI」 표 판정은 없다(오너 결정 2026-10-07 23:45 KST — 「AI」 표 폐기).
 */
const 壮观Ref = { zh: '壮观', pinyin: 'zhuàngguān', ko: '장관이다, 웅장하다', pos: '형용사',
  ex: { zh: '瀑布的景色非常壮观。', pinyin: 'Pù bù de jǐng sè fēi cháng zhuàng guān.', ko: '폭포의 경치가 매우 웅장해요.' } };
const 壮观Dict = { pos: '형용사·명사', reading: 'zhuàng guān', meanings: [
  { meaning: '(경관이) 웅장하다, 장관이다', priority: 1, pos: '형용사' },
  { meaning: '장관, 웅장한 경관', priority: 2, pos: '명사' },
] };
const 壮观Token = { text: '壮观', furigana: 'zhuàng guān', meaning: '웅장하다, 장관이다', pos: '형용사' };
const flat = (groups) => groups.flatMap((g) => g.items);

describe('정규화 — 집합이 같아야 같은 뜻', () => {
  it('순서·괄호 보충·전각 괄호·구분자·공백·NFC를 무시한다', () => {
    expect(sameSense('장관이다, 웅장하다', '웅장하다, 장관이다')).toBe(true);
    expect(sameSense('(경관이) 웅장하다, 장관이다', '장관이다，웅장하다')).toBe(true);
    expect(sameSense('（경관이）웅장하다；장관이다', '웅장하다/장관이다')).toBe(true);
    expect(sameSense('Stadium', ' stadium ')).toBe(true);
    expect(sameSense('한', '한')).toBe(true); // NFD 한 → NFC
  });
  it('부분 겹침·빈 뜻은 같지 않다(오합 방지)', () => {
    expect(sameSense('웅장하다', '웅장하다, 장관이다')).toBe(false);
    expect(sameSense('장관', '장관이다')).toBe(false);
    expect(sameSense('', '')).toBe(false);
    expect(sameSense('(보충만)', '(보충만)')).toBe(false);
    expect(senseKey('b, a, a')).toEqual(['a', 'b']);
  });
  it('현행 결함 재현: referenceMatchesContext는 순서만 다른 같은 뜻을 다른 뜻으로 본다 — 목록은 합친다', () => {
    expect(referenceMatchesContext(壮观Token, 壮观Ref)).toBe(false); // 기존 계약(완전 일치) 그대로
    const items = flat(buildSenseList({ refWord: 壮观Ref, token: 壮观Token, language: 'Chinese' }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ meaning: '장관이다, 웅장하다', current: true, source: 'ref' });
  });
});

describe('합치기 · 칠하기 · 예문 배치 (壮观, 설계서 §12.1 목업)', () => {
  const groups = buildSenseList({ dictEntry: 壮观Dict, refWord: 壮观Ref, token: 壮观Token, language: 'Chinese' });
  it('품사 묶음 형용사 ① / 명사 ② — refVocab은 같은 뜻 줄에 합쳐 줄이 늘지 않는다', () => {
    expect(groups.map((g) => g.pos)).toEqual(['형용사', '명사']);
    expect(senseListCount(groups)).toBe(2);
    expect(flat(groups).map((i) => [i.n, i.meaning, i.source])).toEqual([
      [1, '(경관이) 웅장하다, 장관이다', 'dict+ref'],
      [2, '장관, 웅장한 경관', 'dict'],
    ]);
  });
  it('이 문장 뜻과 같은 줄 하나만 current, 표시 뜻은 사전 문구 그대로(토큰 뜻으로 덮지 않는다)', () => {
    expect(flat(groups).map((i) => i.current)).toEqual([true, false]);
    expect(壮观Token.meaning).toBe('웅장하다, 장관이다'); // 입력 불변
  });
  it('예문은 합친 뜻 줄 아래에만', () => {
    expect(flat(groups)[0].example).toBe(壮观Ref.ex);
    expect('example' in flat(groups)[1]).toBe(false);
  });
  it('「AI」 판정 필드·함수가 없다', async () => {
    const mod = await import('../viewerSenseList');
    expect(Object.keys(mod).filter((k) => /ai|mark/i.test(k))).toEqual([]);
    for (const item of flat(groups)) expect(Object.keys(item).sort()).toEqual(
      ['current', 'meaning', 'n', 'pos', 'source', ...('example' in item ? ['example'] : [])].sort());
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/viewerSenseList.js'), 'utf8');
    expect(src).not.toMatch(/meaning_source|ai_context/);
  });
});

describe('번호 · 묶음 규칙', () => {
  it('번호는 품사 묶음을 넘어 이어 세고, 묶음 순서는 처음 나온 순서', () => {
    const dictEntry = { pos: '동사·명사', meanings: [
      { meaning: '공부하다', pos: '동사' }, { meaning: '학습', pos: '명사' }, { meaning: '배우다', pos: '동사' }] };
    const groups = buildSenseList({ dictEntry, token: { meaning: '배우다' }, language: 'Chinese' });
    expect(groups.map((g) => [g.pos, g.items.map((i) => [i.n, i.meaning, i.current])])).toEqual([
      ['동사', [[1, '공부하다', false], [2, '배우다', true]]],
      ['명사', [[3, '학습', false]]],
    ]);
  });
  it('뜻별 pos가 없으면 행 pos의 첫 후보로 묶는다(일본어는 뜻별 pos 없음 → 행 pos)', () => {
    const ja = buildSenseList({ dictEntry: { pos: '명사', meanings: [{ meaning: '날씨' }, { meaning: '좋은 날씨' }] },
      token: { meaning: '날씨' }, language: 'Japanese' });
    expect(ja).toEqual([{ pos: '명사', items: [
      { n: 1, meaning: '날씨', pos: '명사', source: 'dict', current: true },
      { n: 2, meaning: '좋은 날씨', pos: '명사', source: 'dict', current: false }] }]);
    const multi = buildSenseList({ dictEntry: { pos: '동사·명사', meanings: [{ meaning: '연구하다' }] }, language: 'Chinese' });
    expect(multi[0].pos).toBe('동사');
    const none = buildSenseList({ dictEntry: { meanings: [{ meaning: 'run' }] }, language: 'English' });
    expect(none[0].pos).toBeNull();
  });
  it('사전 뜻 ≤3 + refVocab 1 — 다른 뜻이면 refVocab 품사 묶음 끝에 한 줄', () => {
    const dictEntry = { pos: '동사', meanings: [
      { meaning: '열다', pos: '동사' }, { meaning: '켜다', pos: '동사' }, { meaning: '운전하다', pos: '동사' }] };
    const refWord = { zh: '开', pinyin: 'kāi', ko: '개최하다', pos: '동사', ex: { zh: '开会。', pinyin: 'kāi huì', ko: '회의를 열다.' } };
    const groups = buildSenseList({ dictEntry, refWord, token: { furigana: 'kāi', meaning: '켜다' }, language: 'Chinese' });
    const items = flat(groups);
    expect(items).toHaveLength(4);
    expect(items[3]).toMatchObject({ n: 4, meaning: '개최하다', source: 'ref', example: refWord.ex, current: false });
    expect(items.filter((i) => i.current).map((i) => i.meaning)).toEqual(['켜다']);
  });
});

describe('경계 사례', () => {
  it('빈 meanings · refVocab 없음 → 빈 목록(뜻 줄만 남는다)', () => {
    expect(buildSenseList({ dictEntry: { meanings: [] }, token: { meaning: '뜻' }, language: 'Chinese' })).toEqual([]);
    expect(buildSenseList({ dictEntry: null, refWord: null, token: { meaning: '뜻' }, language: 'Chinese' })).toEqual([]);
    expect(buildSenseList({})).toEqual([]);
  });
  it('빈 뜻·공백 뜻·문자열 항목은 버리고, 트림한 완전 일치 중복만 지운다', () => {
    const groups = buildSenseList({ dictEntry: { pos: '명사', meanings: [
      { meaning: '  ' }, '옛 문자열 항목', { meaning: ' 경기장 ' }, { meaning: '경기장' }, { meaning: '스타디움, 경기장' }] }, language: 'Chinese' });
    expect(flat(groups).map((i) => i.meaning)).toEqual(['경기장', '스타디움, 경기장']);
  });
  it('refVocab만 있을 때(사전 행 없음 — 비로그인·미적재) refVocab 한 줄 + 예문', () => {
    const refWord = { zh: '体育场', pinyin: 'tǐyùchǎng', ko: '경기장, 스타디움', pos: '명사', ex: { zh: '比赛在体育场举行。', pinyin: '', ko: '경기는 경기장에서 열려요.' } };
    const groups = buildSenseList({ refWord, token: { furigana: 'tǐ yù chǎng', meaning: '스타디움, 경기장' }, language: 'Chinese' });
    expect(groups).toEqual([{ pos: '명사', items: [{ n: 1, meaning: '경기장, 스타디움', pos: '명사', source: 'ref', example: refWord.ex, current: true }] }]);
  });
  it('품사 불일치 — 같은 뜻이면 사전 줄의 품사를 지키고 refVocab 예문만 붙인다', () => {
    const groups = buildSenseList({ dictEntry: { pos: '명사', meanings: [{ meaning: '장관, 경관', pos: '명사' }] },
      refWord: { ko: '경관, 장관', pos: '형용사', ex: { zh: '很壮观', ko: '장관이다' } }, token: { meaning: '경관, 장관' }, language: 'Chinese' });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ pos: '명사', items: [{ meaning: '장관, 경관', source: 'dict+ref', current: true }] });
  });
  it('병음이 다른 refVocab 뜻은 합치지도 칠하지도 않는다(referenceMatchesContext 계약과 같은 쪽)', () => {
    const dictEntry = { pos: '형용사', reading: 'cháng', meanings: [{ meaning: '길다', pos: '형용사' }] };
    const refWord = { zh: '长', pinyin: 'zhǎng', ko: '길다', pos: '동사', ex: { zh: '长大', ko: '자라다' } };
    const groups = buildSenseList({ dictEntry, refWord, token: { furigana: 'cháng', meaning: '길다' }, language: 'Chinese' });
    const items = flat(groups);
    expect(items.map((i) => [i.meaning, i.source, i.current])).toEqual([['길다', 'dict', true], ['길다', 'ref', false]]);
    expect(items[0].example).toBeUndefined();
  });
  it('표제어 읽기(기본형이면 사전 reading)를 넘기면 그것과 비교한다', () => {
    const refWord = { zh: '道歉', pinyin: 'dàoqiàn', ko: '사과하다', pos: '동사' };
    const token = { text: '道', furigana: 'dào', meaning: '사과하다', sep_link: '道歉' };
    expect(flat(buildSenseList({ refWord, token, language: 'Chinese' }))[0].current).toBe(false);
    expect(flat(buildSenseList({ refWord, token, language: 'Chinese', reading: 'dào qiàn' }))[0].current).toBe(true);
  });
  it('토큰 뜻이 목록에 없으면 칠한 줄 0 — 사전 첫 뜻으로 바꿔 칠하지 않는다', () => {
    const groups = buildSenseList({ dictEntry: 壮观Dict, token: { meaning: '대단하다' }, language: 'Chinese' });
    expect(flat(groups).some((i) => i.current)).toBe(false);
  });
  it('완전 일치 줄이 있으면 정규화 일치 줄보다 먼저 칠한다(칠한 줄은 최대 1)', () => {
    const groups = buildSenseList({ dictEntry: { meanings: [{ meaning: 'b, a' }, { meaning: 'a, b' }] }, token: { meaning: 'a, b' }, language: 'English' });
    expect(flat(groups).map((i) => i.current)).toEqual([false, true]);
  });
  it('한국어 자료는 목록 없음(morpheme_dictionary 미지원)', () => {
    expect(buildSenseList({ dictEntry: 壮观Dict, refWord: 壮观Ref, token: 壮观Token, language: 'Korean' })).toEqual([]);
  });
  it('입력을 바꾸지 않는다', () => {
    const before = JSON.stringify([壮观Dict, 壮观Ref, 壮观Token]);
    buildSenseList({ dictEntry: 壮观Dict, refWord: 壮观Ref, token: 壮观Token, language: 'Chinese' });
    expect(JSON.stringify([壮观Dict, 壮观Ref, 壮观Token])).toBe(before);
  });
});

describe('교정 후보(buildMeaningOptions)와 같은 집합 — 목록 줄을 누른 교정이 후보와 어긋나지 않는다', () => {
  const cases = [
    [壮观Dict, 壮观Token],
    [{ pos: '명사', meanings: [{ meaning: ' 경기장 ' }, { meaning: '경기장' }, { meaning: '' }, { meaning: '스타디움', pos: '명사' }] }, { meaning: '토큰만의 뜻' }],
    [{ meanings: [] }, { meaning: '뜻' }],
    [{ pos: '동사·명사', meanings: [{ meaning: '연구하다', pos: '동사' }, { meaning: '연구', pos: '명사' }] }, { meaning: '연구' }],
  ];
  it.each(cases.map((c, i) => [i, ...c]))('case %i', (_i, dictEntry, token) => {
    const fromList = flat(buildSenseList({ dictEntry, refWord: 壮观Ref, token, language: 'Chinese' }))
      .filter((i) => i.source !== 'ref').map((i) => i.meaning);
    const options = buildMeaningOptions(dictEntry, token).map((o) => o.meaning);
    const dictOnly = options.filter((m) => (dictEntry.meanings || []).some((d) => String(d?.meaning || '').trim() === m));
    expect(fromList).toEqual(dictOnly);
    // 뜻별 pos도 후보와 같다(후보에 pos가 있으면 목록 줄 pos도 그것)
    for (const o of buildMeaningOptions(dictEntry, token).filter((x) => x.pos)) {
      expect(flat(buildSenseList({ dictEntry, token, language: 'Chinese' })).find((i) => i.meaning === o.meaning)?.pos).toBe(o.pos);
    }
  });
});
