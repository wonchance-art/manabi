// 한국어기초사전(krdict) 1단계 계약 — 임포트 규칙·senseKey·후보·저장 envelope 검증.
// 출처 표시: fixture는 국립국어원 「한국어기초사전」(https://krdict.korean.go.kr) 2026-06-19 XML 발췌이며
// CC BY-SA 2.0 KR(https://creativecommons.org/licenses/by-sa/2.0/kr/)을 따른다. 변경 내역은
// fixtures/krdict-20260619-excerpt.xml 머리 주석에 있다. 사례 번호(N05·H03·H04·D08·D09·N06·W01)는
// 한국어 단어 뜻 66개 사례(#1342 교차 검수)와 krdict 설계 문서 §4를 따른다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildKrdictRows, buildReleaseRow, parseKrdictJsonl, parseKrdictXml, releaseFromCreationDate, rowsDigest, writeKrdictRelease,
} from '../../../scripts/lib/krdictImport.mjs';
import { parseArgs, planImport } from '../../../scripts/import-krdict.mjs';
import {
  ANALYZER_POS_TO_KRDICT, KRDICT_ATTRIBUTION, KRDICT_LOCALES, KRDICT_SOURCE, buildSenseIndex, candidateSenses, formatSenseKey,
  isKrdictRelease, krdictEntryUrl, parseSenseKey, renderSenseMeaning, verifyKrdictMeaningEnvelope,
} from '../krdictSenses.js';

const FIXTURE_DIR = new URL('./fixtures/', import.meta.url);
const xml = fs.readFileSync(new URL('krdict-20260619-excerpt.xml', FIXTURE_DIR), 'utf8');
const RELEASE = 'krdict-20260619';
const importFixture = () => {
  const parsed = parseKrdictXml(xml);
  return buildKrdictRows(parsed.entries, { release: releaseFromCreationDate(parsed.creationDate) });
};
const { rows, report } = importFixture();
const index = buildSenseIndex(rows);
const sense = key => index.byKey.get(key);
const envelope = (key, locale, overrides = {}) => ({
  meaningSource: 'krdict', senseKey: key, release: RELEASE, locale, lemma: sense(key).headword,
  lexicalMeaning: renderSenseMeaning(sense(key), locale), ...overrides,
});
const verify = (env, { key = env.senseKey, release = RELEASE } = {}) => verifyKrdictMeaningEnvelope(env, { sense: index.byKey.get(key), release });
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
};

describe('senseKey·판본 형식', () => {
  it('항목ID:뜻ID만 정체성으로 쓰고, 정규화로 다른 키를 받아주지 않는다', () => {
    expect(formatSenseKey(71307, 1)).toBe('krdict:71307:1');
    expect(parseSenseKey('krdict:71307:1')).toEqual({ dict: 'krdict', entryId: 71307, senseNo: 1 });
    for (const bad of ['krdict:071307:1', ' krdict:71307:1', 'krdict:71307:1 ', 'krdict:71307:0', 'stdict:71307:1',
      'krdict:71307', 'krdict:파리:1', 'krdict:71307:1:2', 71307, null]) expect(parseSenseKey(bad)).toBeNull();
    expect(() => formatSenseKey(0, 1)).toThrow('invalid_sense_key_part');
    expect(() => formatSenseKey(71307, 1.5)).toThrow('invalid_sense_key_part');
  });

  it('판본은 실제 달력 날짜인 krdict-YYYYMMDD만 받는다', () => {
    expect(isKrdictRelease(RELEASE)).toBe(true);
    for (const bad of ['krdict-20260231', 'krdict-2026-06-19', 'stdict-20260619', 'krdict-20260619 ', undefined]) expect(isKrdictRelease(bad)).toBe(false);
    expect(releaseFromCreationDate('2026/06/19 12:38:52')).toBe(RELEASE);
    expect(() => releaseFromCreationDate('2026/02/30 00:00:00')).toThrow('krdict_bad_creation_date');
  });
});

describe('사례: 후보와 정본 문구', () => {
  it('N05 파리(명사) → 곤충 뜻 하나, v2 실패 문구는 사전 문구가 아니다', () => {
    const list = candidateSenses(index, { lemma: '파리', pos: '명사' });
    expect(list.map(s => s.senseKey)).toEqual(['krdict:71307:1']);
    expect(list[0].definitionKo).toBe('주로 여름철에 음식물과 더러운 물질에 몰려들며 콜레라 등의 전염병을 옮기는, 날아다니는 작은 곤충.');
    expect(renderSenseMeaning(list[0], 'zh-CN')).toBe('苍蝇');
    // 현행 v2가 저장하던 표준국어대사전 계열 문구에 krdict 꼬리표를 붙여도 통과하지 못한다.
    expect(verify(envelope('krdict:71307:1', 'ko', { lexicalMeaning: '파리목에 속하는 곤충을 통틀어 이르는 말.' }))).toEqual({ ok: false, reason: 'meaning_mismatch' });
  });

  it('N06 고유명사 파리(도시)도 후보는 곤충 하나뿐이다 — 후보 존재는 정답이 아니다(2단계 선택이 null을 낼 수 있어야 함)', () => {
    const list = candidateSenses(index, { lemma: '파리', pos: '고유명사' });
    expect(list.map(s => s.senseKey)).toEqual(['krdict:71307:1']);
    expect(list[0].definitionKo).not.toMatch(/도시|수도|프랑스/);
  });

  it('열다 H03·H04 → 같은 senseKey·같은 문자열(v2는 두 문장에 다른 문자열을 저장해 거짓 충돌)', () => {
    const v2 = { H03: '닫혀 있던 것을 트거나 넓히다.', H04: '닫히거나 막힌 것을 다시 넓히거나 펼치다.' };
    expect(v2.H03).not.toBe(v2.H04);
    const chosen = { H03: 'krdict:66574:1', H04: 'krdict:66574:1' };
    const h03 = renderSenseMeaning(sense(chosen.H03), 'ko'), h04 = renderSenseMeaning(sense(chosen.H04), 'ko');
    expect(h03).toBe('닫히거나 잠긴 것을 트거나 벗기다.');
    expect(h04).toBe(h03);
    expect(renderSenseMeaning(sense(chosen.H04), 'zh-CN')).toBe('开');
    // 다시 임포트해도(같은 입력) 같은 행·같은 해시·같은 문자열.
    const again = importFixture();
    expect(rowsDigest(again.rows)).toBe(rowsDigest(rows));
    expect(renderSenseMeaning(buildSenseIndex(again.rows).byKey.get('krdict:66574:1'), 'ko')).toBe(h03);
  });

  it('열다의 뜻 ID는 위치가 아니다(표시 순서 1,2,3,4,7,5,6)', () => {
    const list = candidateSenses(index, { lemma: '열다', pos: '동사' });
    expect(list.map(s => s.senseNo)).toEqual([1, 2, 3, 4, 7, 5, 6]);
    expect(list[4].senseKey).toBe('krdict:66574:7');
    expect(list[4].definitionKo).toBe('어떤 일의 가장 중요한 계기나 조건을 새롭게 마련하다.');
  });

  it('걷다/걸다 동형어: 항목 ID로 갈리고 품사로 걸러진다(D08·D09)', () => {
    const walk = candidateSenses(index, { lemma: '걷다', pos: '동사' });
    expect(walk).toHaveLength(11);
    expect([...new Set(walk.map(s => s.entryId))]).toEqual([25357, 29667, 15920, 15933]);
    expect(walk.map(s => s.homographNo)).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
    expect(sense('krdict:29667:1').definitionKo).toBe('바닥에서 발을 번갈아 떼어 옮기면서 움직여 위치를 옮기다.');
    expect(renderSenseMeaning(sense('krdict:29667:1'), 'zh-CN')).toBe('走，行走，步行');

    const hang = candidateSenses(index, { lemma: '걸다', pos: '동사' });
    expect(hang).toHaveLength(16);
    expect(new Set(hang.map(s => s.entryId))).toEqual(new Set([65528]));
    expect(sense('krdict:65528:1').definitionKo).toBe('어떤 물체를 떨어지지 않도록 어디에 매달다.');
    expect(renderSenseMeaning(sense('krdict:65528:1'), 'zh-CN')).toBe('挂');
    expect(candidateSenses(index, { lemma: '걸다', pos: '형용사' }).map(s => s.entryId)).toEqual([25461, 25461, 25461, 25461, 25461]);
    expect(candidateSenses(index, { lemma: '걸다' })).toHaveLength(21);

    const walkKeys = new Set(walk.map(s => s.senseKey));
    expect(hang.some(s => walkKeys.has(s.senseKey))).toBe(false);
    // 활용 어간 안내(걸-, 걸어-)는 뜻 후보가 아니다.
    expect(candidateSenses(index, { lemma: '걸-' })).toEqual([]);
    expect(candidateSenses(index, { lemma: '걸어-' })).toEqual([]);
    // W01: 걸다의 뜻을 걷다 기본형으로 저장하려 하면 거부.
    expect(verify(envelope('krdict:65528:1', 'ko', { lemma: '걷다' }))).toEqual({ ok: false, reason: 'lemma_mismatch' });
  });

  it('조회 안 하는 품사·모르는 품사는 빈 후보(넓혀서 추측하지 않는다)', () => {
    expect(candidateSenses(index, { lemma: '파리', pos: '기호' })).toEqual([]);
    expect(candidateSenses(index, { lemma: '파리', pos: 'NNG' })).toEqual([]);
    expect(candidateSenses(index, { lemma: '', pos: '명사' })).toEqual([]);
  });

  it('분석기 품사 라벨 전부가 대응표에 있다(라벨이 늘면 여기서 깨진다)', () => {
    const source = fs.readFileSync(new URL('../server/koreanAnalysis.js', import.meta.url), 'utf8');
    const labels = JSON.parse(/const POS = (\[[^\]]+\]);/.exec(source)[1].replace(/'/g, '"'));
    expect(Object.keys(ANALYZER_POS_TO_KRDICT).sort()).toEqual([...labels].sort());
  });
});

describe('임포트 규칙', () => {
  it('관용구·속담은 제외한다 — 부모 항목 ID를 공유해 넣으면 senseKey가 충돌한다', () => {
    expect(report.counts.entriesExcluded.idiomOrProverb).toBe(5);
    expect(rows.some(r => ['관용구', '속담'].includes(r.lexical_unit))).toBe(false);
    expect(rows.some(r => r.definition_ko === '남에게 쉽사리 죽음을 당할 목숨.')).toBe(false); // 관용구 '파리 목숨'
    expect(rows.filter(r => r.entry_id === 71307)).toHaveLength(1);
    // 규칙을 빼면(관용구를 일반 구로 취급) 파리 71307:1이 두 번 생긴다.
    const parsed = parseKrdictXml(xml);
    const relabeled = parsed.entries.map(e => (['관용구', '속담'].includes(e.lexicalUnit) ? { ...e, lexicalUnit: '구', pos: '품사 없음' } : e));
    expect(() => buildKrdictRows(relabeled, { release: RELEASE })).toThrow('krdict_duplicate_sense_key:krdict:71307:1');
  });

  it('어간 안내·상호 참조는 빼고, 본문에 화살표가 있는 정상 뜻은 남긴다', () => {
    expect(report.counts.sensesExcluded).toEqual({ idiomOrProverb: 6, conjugationGuide: 3, crossReference: 2 });
    expect(rows.some(r => r.headword === '간막이' || r.headword === '라떼')).toBe(false); // → 칸막이, → 라테
    expect(rows.some(r => r.definition_ko.startsWith('→') || /^\([^)]*\)\s*→/.test(r.definition_ko))).toBe(false);
  });

  it('인코딩 결함만 복원한다: 앞뒤 공백, 이중 이스케이프, XML 속성 탭 정규화 — 내용은 고치지 않는다', () => {
    expect(rows.find(r => r.entry_id === 15381 && r.sense_no === 1).definition_ko).toBe('검은 편이다.'); // 원문 '검은 편이다. '
    expect(rows.find(r => r.entry_id === 24397).zh_cn_definition).toBe('韩文字母"ㄴ"的名称。'); // 원문 &amp;quot;
    expect(rows.find(r => r.entry_id === 23462 && r.sense_no === 1).zh_cn_equivalent).toBe('放置 ，搁置'); // 원문 속성값 안 탭
    expect(report.normalization).toMatchObject({ trimmed: 1, doubleEscapedEntities: 1, nfcChanged: 0 });
  });

  it('중국어는 간체 대역만: 대역 없음(无对应词汇)이면 중국어 뜻풀이, 대역이 아예 없으면 렌더하지 않는다', () => {
    const contraction = sense('krdict:64369:1'); // 걔
    expect(contraction.zhCnNoEquivalent).toBe(true);
    expect(contraction.zhCnEquivalent).toBeNull();
    expect(renderSenseMeaning(contraction, 'zh-CN')).toBe(contraction.zhCnDefinition);
    const noZh = sense('krdict:41106:1'); // 내재되다 — 실측 유일
    expect(renderSenseMeaning(noZh, 'ko')).toBe('사물이나 현상의 내부에 존재하다.');
    expect(renderSenseMeaning(noZh, 'zh-CN')).toBeNull();
    expect(verify(envelope('krdict:41106:1', 'ko', { locale: 'zh-CN', lexicalMeaning: '内在' }))).toEqual({ ok: false, reason: 'no_dictionary_text' });
    expect(rows.every(r => !('zh_tw_equivalent' in r))).toBe(true);
    expect(renderSenseMeaning(sense('krdict:71307:1'), 'zh-TW')).toBeNull();
  });

  it('XML 파서는 깨진 입력을 조용히 넘기지 않는다(합성 입력)', () => {
    const wrap = body => `<?xml version="1.0"?><LexicalResource><GlobalInformation><feat att="creationDate" val="2026/06/19 12:00:00" /></GlobalInformation><Lexicon>${body}</Lexicon></LexicalResource>`;
    const entry = (def, extra = '') => `<LexicalEntry att="id" val="1"><feat att="lexicalUnit" val="단어" /><feat att="partOfSpeech" val="명사" /><Lemma><feat att="writtenForm" val="가" /></Lemma>${extra}<Sense att="id" val="1"><feat att="definition" val="${def}" /></Sense></LexicalEntry>`;
    const stats = { controlCharsRemoved: 0, unescapedLtInAttribute: 0 };
    const parsed = parseKrdictXml(wrap(entry('뜻\u0008풀이 a<b', '<feat att="semanticCategory" val="자연 > 지형" />')), stats);
    expect(parsed.entries[0].senses[0].definition).toBe('뜻풀이 a<b');
    expect(stats).toEqual({ controlCharsRemoved: 1, unescapedLtInAttribute: 1 });
    expect(() => parseKrdictXml(wrap(entry('a & b')))).toThrow('krdict_xml_bare_ampersand');
    expect(() => parseKrdictXml(wrap(entry('&nbsp;')))).toThrow('krdict_xml_unknown_entity');
    expect(() => parseKrdictXml(wrap(entry('뜻').replace('</Sense>', '</Lemma>')))).toThrow('krdict_xml_mismatched_end');
    expect(() => parseKrdictXml(wrap(entry('뜻')) + '텍스트')).toThrow('krdict_xml_unexpected_text');
    const unknownUnit = parseKrdictXml(wrap(entry('뜻').replace('val="단어"', 'val="새 단위"'))).entries;
    expect(() => buildKrdictRows(unknownUnit, { release: RELEASE })).toThrow('krdict_unknown_lexical_unit');
    const unknownLevel = parseKrdictXml(wrap(entry('뜻', '<feat att="vocabularyLevel" val="최상급" />'))).entries;
    expect(() => buildKrdictRows(unknownLevel, { release: RELEASE })).toThrow('krdict_unknown_level');
  });

  it('JSONL 사본은 줄바꿈(\\n)으로만 나눈다 — 값 안의 U+2028에서 레코드를 자르지 않는다', () => {
    const line = JSON.stringify({ id: '71307', word: '파리', hom: 0, unit: '단어', pos: '명사', level: '중급', senses: [{ no: 1,
      def: '주로 여름철에 음식물과 더러운 물질에 몰려들며 콜레라 등의 전염병을 옮기는, 날아다니는 작은 곤충.',
      eq: { 중국어: { lemma: '苍蝇', def: '一种会飞的昆虫。一般在夏天出现并聚集在食物和脏东西上，可传播霍乱等疾病。' }, 러시아어: { lemma: 'муха', def: 'а б' } } }] });
    expect(line).toContain(' ');
    const entries = parseKrdictJsonl(`${line}\n`);
    expect(entries).toHaveLength(1);
    const fromJsonl = buildKrdictRows(entries, { release: RELEASE }).rows;
    expect(fromJsonl).toEqual(rows.filter(r => r.entry_id === 71307));
  });
});

describe('저장 envelope 검증', () => {
  it('정본 문구와 정확히 같을 때만 통과하고, 카드에 남길 출처만 돌려준다', () => {
    for (const locale of KRDICT_LOCALES) {
      const result = verify(envelope('krdict:29667:1', locale));
      expect(result).toEqual({ ok: true, meaning: renderSenseMeaning(sense('krdict:29667:1'), locale), provenance: { senseKey: 'krdict:29667:1', release: RELEASE } });
    }
  });

  it('위조 envelope는 거부한다', () => {
    const ok = envelope('krdict:71307:1', 'ko');
    const cases = [
      [{ ...ok, lexicalMeaning: `${ok.lexicalMeaning} ` }, 'meaning_mismatch'],
      [{ ...ok, lexicalMeaning: ok.lexicalMeaning.normalize('NFD') }, 'meaning_mismatch'],
      [{ ...ok, lexicalMeaning: '날개가 있고 날아다니는 작은 곤충.' }, 'meaning_mismatch'],
      [{ ...ok, locale: 'zh-CN' }, 'meaning_mismatch'], // ko 문구를 zh-CN 정답으로
      [{ ...ok, meaningSource: 'ai' }, 'not_krdict'],
      [{ ...ok, meaningSource: undefined }, 'not_krdict'],
      [{ ...ok, senseKey: 'krdict:071307:1' }, 'invalid_sense_key'],
      [{ ...ok, senseKey: 'krdict:65528:1' }, 'sense_mismatch'], // 서버가 넘긴 행과 다른 키
      [{ ...ok, locale: 'zh-TW' }, 'unsupported_locale'],
      [{ ...ok, lemma: '파리채' }, 'lemma_mismatch'],
    ];
    for (const [env, reason] of cases) expect(verifyKrdictMeaningEnvelope(env, { sense: sense('krdict:71307:1'), release: RELEASE })).toEqual({ ok: false, reason });
    expect(verifyKrdictMeaningEnvelope(ok, { sense: undefined, release: RELEASE })).toEqual({ ok: false, reason: 'unknown_sense' });
    expect(verifyKrdictMeaningEnvelope(null, { sense: sense('krdict:71307:1'), release: RELEASE })).toEqual({ ok: false, reason: 'not_krdict' });
  });

  it('판본이 다르면 거부한다(활성 판본·행 판본·envelope 판본이 모두 같아야 한다)', () => {
    const ok = envelope('krdict:66574:1', 'ko');
    expect(verify({ ...ok, release: 'krdict-20251219' })).toEqual({ ok: false, reason: 'release_mismatch' });
    expect(verify(ok, { release: 'krdict-20261219' })).toEqual({ ok: false, reason: 'release_mismatch' });
    expect(verify({ ...ok, release: 'krdict-20260231' }, { release: 'krdict-20260231' })).toEqual({ ok: false, reason: 'release_mismatch' });
    // 다음 판본이 활성인데 서버가 옛 판본 행을 넘긴 경우(같은 senseKey·같은 문구여도 거부).
    const next = 'krdict-20261219';
    const oldRow = sense('krdict:66574:1');
    expect(verifyKrdictMeaningEnvelope({ ...ok, release: next }, { sense: oldRow, release: next })).toEqual({ ok: false, reason: 'release_mismatch' });
  });

  it('여러 판본 행을 한 색인에 섞지 않는다(같은 senseKey가 두 문구를 갖게 됨)', () => {
    const later = rows.map(r => ({ ...r, release_id: 'krdict-20261219' }));
    expect(() => buildSenseIndex([...rows, ...later])).toThrow('mixed_release');
  });
});

describe('기존 카드 무변경 원칙', () => {
  it('검증은 입력(envelope·사전 행·기존 카드)을 바꾸지 않고, 결과에 뜻·일정·평가 필드를 만들지 않는다', () => {
    const card = deepFreeze({ id: 'c1', word_text: '파리', meaning: '내가 고친 뜻', interval: 30, ease_factor: 2.6, next_review_at: '2026-10-10' });
    const env = deepFreeze(envelope('krdict:71307:1', 'ko'));
    const before = JSON.stringify({ card, env });
    const result = verifyKrdictMeaningEnvelope(env, { sense: sense('krdict:71307:1'), release: RELEASE });
    expect(JSON.stringify({ card, env })).toBe(before);
    expect(Object.keys(result).sort()).toEqual(['meaning', 'ok', 'provenance']);
    expect(Object.keys(result.provenance).sort()).toEqual(['release', 'senseKey']);
  });

  it('적재는 사전 표에만 쓰고, 같은 계획 재실행은 이어 채우며, 다른 산출 해시면 아무것도 쓰지 않고 멈춘다', async () => {
    const releaseRow = buildReleaseRow({ release: RELEASE, sourceKind: 'official', inputFormat: 'xml', rows,
      files: [{ name: '1_5000_20260619.xml', sha256: 'a'.repeat(64), bytes: 1 }] });
    const db = fakeClient();
    expect(await writeKrdictRelease(db.client, { releaseRow, rows }, { batchSize: 7 })).toEqual({ release: RELEASE, resumed: false, count: rows.length });
    expect(await writeKrdictRelease(db.client, { releaseRow, rows }, { batchSize: 7 })).toEqual({ release: RELEASE, resumed: true, count: rows.length });
    expect(new Set(db.touched)).toEqual(new Set(['krdict_releases', 'krdict_senses']));
    expect(db.tables.krdict_senses).toHaveLength(rows.length);

    const conflict = fakeClient({ existingRelease: { ...releaseRow, output_sha256: 'b'.repeat(64) } });
    await expect(writeKrdictRelease(conflict.client, { releaseRow, rows })).rejects.toThrow('krdict_release_conflict');
    expect(conflict.tables.krdict_senses).toHaveLength(0);
    await expect(writeKrdictRelease(db.client, { releaseRow, rows: rows.slice(1) })).rejects.toThrow('krdict_write_plan_mismatch');
  });

  it('이 모듈은 순수하다: import·네트워크·DB 호출이 없다', () => {
    const source = fs.readFileSync(new URL('../krdictSenses.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bfetch\(|\brequire\(|\.from\(['"]/);
  });
});

describe('출처 표시', () => {
  it('ko·zh-CN 문구가 출처와 라이선스를 담고, zh-TW는 1단계에 없다', () => {
    expect(KRDICT_SOURCE).toEqual({ label: '국립국어원 한국어기초사전', url: 'https://krdict.korean.go.kr', license: 'CC BY-SA 2.0 KR', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/kr/' });
    expect(KRDICT_ATTRIBUTION.ko).toBe('뜻: 국립국어원 한국어기초사전 · CC BY-SA 2.0 KR');
    expect(KRDICT_ATTRIBUTION['zh-CN']).toBe('释义：韩国国立国语院《韩国语基础词典》· CC BY-SA 2.0 KR');
    expect(Object.keys(KRDICT_ATTRIBUTION)).toEqual([...KRDICT_LOCALES]);
    expect(krdictEntryUrl(29667)).toBe('https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=29667');
  });
});

describe('임포트 CLI', () => {
  it('기본은 dry-run, 쓰기는 명시 플래그 + 공식본(또는 Preview용 허용) 뿐이다', () => {
    expect(parseArgs(['--xml', 'dir'])).toMatchObject({ write: false, source: 'unofficial-copy' });
    expect(() => parseArgs(['--xml', 'dir', '--write'])).toThrow('공식본이 아닌 입력은 적재하지 않습니다');
    expect(parseArgs(['--xml', 'dir', '--write', '--source', 'official'])).toMatchObject({ write: true });
    expect(() => parseArgs(['--jsonl', 'f.jsonl'])).toThrow('--release');
    expect(() => parseArgs(['--xml', 'a', '--jsonl', 'b'])).toThrow();
    expect(() => buildReleaseRow({ release: RELEASE, sourceKind: 'official', inputFormat: 'jsonl', files: [], rows })).toThrow('krdict_official_requires_xml');
  });

  it('같은 입력이면 보고서가 바이트 단위로 같고, 입력 SHA-256·판본·산출 해시를 담는다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krdict-'));
    try {
      fs.copyFileSync(new URL('krdict-20260619-excerpt.xml', FIXTURE_DIR), path.join(dir, '001.xml'));
      const first = JSON.stringify(planImport({ xml: dir, source: 'unofficial-copy' }).report);
      const second = JSON.stringify(planImport({ xml: dir, source: 'unofficial-copy' }).report);
      expect(second).toBe(first);
      const report = JSON.parse(first);
      expect(report.release).toBe(RELEASE);
      expect(report.input.files).toEqual([{ name: '001.xml', sha256: expect.stringMatching(/^[0-9a-f]{64}$/), bytes: Buffer.byteLength(xml) }]);
      expect(report.output_sha256).toBe(rowsDigest(rows));
      expect(report.counts.rows).toBe(rows.length);
      // 생성일이 다른 파일이 섞이면 판본을 정하지 않고 멈춘다.
      fs.writeFileSync(path.join(dir, '002.xml'), xml.replace('2026/06/19 12:38:52', '2026/06/20 00:00:01'));
      expect(() => planImport({ xml: dir, source: 'unofficial-copy' })).toThrow('생성일이 다릅니다');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** supabase-js 호환 최소 가짜 클라이언트 — 표 이름과 행만 기록한다. */
function fakeClient({ existingRelease = null } = {}) {
  const tables = { krdict_releases: existingRelease ? [existingRelease] : [], krdict_senses: [] };
  const touched = [];
  const keyOf = { krdict_releases: r => r.id, krdict_senses: r => `${r.release_id}|${r.entry_id}|${r.sense_no}` };
  const client = {
    from(table) {
      touched.push(table);
      const filters = [];
      const matching = () => tables[table].filter(row => filters.every(([column, value]) => row[column] === value));
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([column, value]); return query; },
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        insert: async row => { tables[table].push(row); return { error: null }; },
        upsert: async (batch, { ignoreDuplicates }) => {
          if (!ignoreDuplicates) throw new Error('update path not allowed');
          const seen = new Set(tables[table].map(keyOf[table]));
          for (const row of batch) if (!seen.has(keyOf[table](row))) { tables[table].push(row); seen.add(keyOf[table](row)); }
          return { error: null };
        },
        then: (resolve, reject) => Promise.resolve({ count: matching().length, error: null }).then(resolve, reject),
      };
      return query;
    },
  };
  return { client, tables, touched };
}
