/**
 * 한국어기초사전(krdict) 뜻 단위 조회·검증 순수 모듈 — 1단계 기반(오너 채택 2026-10-07 KST).
 *
 * - 정본 행은 `krdict_senses`(docs/sql/krdict-senses.sql)에 있고, 이 모듈은 그 행을 받아
 *   후보 목록·렌더·저장 envelope 검증만 한다. 네트워크·supabase를 import하지 않는다.
 * - senseKey = `krdict:<항목ID>:<뜻ID>`. 항목 ID(target_code)와 뜻 ID(Sense id)는 판본을
 *   넘어 유지된다(2019→2026 항목 ID 99.95% 유지). 표제어·동형어 번호는 판본마다 바뀔 수
 *   있어(동형어 번호 변경 166건) 표시에만 쓴다. 뜻 ID는 표시 순서(위치)가 아니다
 *   (열다 = 1,2,3,4,7,5,6).
 * - 사전 행은 판본 단위로 불변이다((release_id, entry_id, sense_no)가 기본 키, UPDATE 권한
 *   없음). 그래서 senseKey+판본이 같으면 문구도 같다. envelope는 그 문구를 다시 만들어
 *   저장 문자열과 정확히 같을 때만 통과한다. 클라이언트가 임의 문자열에 krdict 꼬리표를
 *   붙이거나 다른 판본의 문구를 내밀 수 없다.
 * - 1단계는 기록만 한다. 기존 카드의 뜻·일정·평가를 이 모듈이 만들거나 바꾸는 경로는 없다.
 *   zh-TW 파생(사람 감수 필요)과 동형어 카드 분리는 2단계다.
 */

export const KRDICT_SOURCE = Object.freeze({
  label: '국립국어원 한국어기초사전',
  url: 'https://krdict.korean.go.kr',
  license: 'CC BY-SA 2.0 KR',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/kr/',
});

// 출처 표시 문구(설계 §3.6 후보). 카피 최종 검수는 UI 배선 라운드에서 한다.
export const KRDICT_ATTRIBUTION = Object.freeze({
  ko: '뜻: 국립국어원 한국어기초사전 · CC BY-SA 2.0 KR',
  'zh-CN': '释义：韩国国立国语院《韩国语基础词典》· CC BY-SA 2.0 KR',
});

/** 1단계에서 사전 문구로 렌더할 수 있는 설명 언어. zh-TW는 파생·감수 전이라 없다. */
export const KRDICT_LOCALES = Object.freeze(['ko', 'zh-CN']);

// 선행 0·앞뒤 공백·다른 사전 접두어를 정규화해 받아주지 않는다(같은 뜻에 키가 둘이 되면 안 된다).
export const SENSE_KEY_PATTERN = /^krdict:([1-9][0-9]{0,8}):([1-9][0-9]{0,3})$/;
export const RELEASE_PATTERN = /^krdict-([0-9]{4})([0-9]{2})([0-9]{2})$/;

const MAX_ENTRY_ID = 999_999_999;
const MAX_SENSE_NO = 9_999;
const positiveInt = (value, max) => Number.isSafeInteger(value) && value > 0 && value <= max;

export function formatSenseKey(entryId, senseNo) {
  if (!positiveInt(entryId, MAX_ENTRY_ID) || !positiveInt(senseNo, MAX_SENSE_NO)) throw new TypeError('invalid_sense_key_part');
  return `krdict:${entryId}:${senseNo}`;
}

/** 엄격 파싱. 형식이 어긋나면 null(고쳐서 받아주지 않는다). */
export function parseSenseKey(key) {
  if (typeof key !== 'string') return null;
  const match = SENSE_KEY_PATTERN.exec(key);
  if (!match) return null;
  return Object.freeze({ dict: 'krdict', entryId: Number(match[1]), senseNo: Number(match[2]) });
}

/** `krdict-YYYYMMDD`이면서 실제 달력 날짜인지(2026-02-31 같은 것은 거부). */
export function isKrdictRelease(id) {
  if (typeof id !== 'string') return false;
  const match = RELEASE_PATTERN.exec(id);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function krdictEntryUrl(entryId) {
  if (!positiveInt(entryId, MAX_ENTRY_ID)) throw new TypeError('invalid_entry_id');
  return `${KRDICT_SOURCE.url}/kor/dicSearch/SearchView?ParaWordNo=${entryId}`;
}

/** 표제어 조회 키: NFC, 공백·하이픈 제거(접사 `-가`, 구 `가격 인상`도 같은 규칙). 임포트와 조회가 함께 쓴다. */
export function normalizeLookupForm(text) {
  if (typeof text !== 'string') return '';
  return text.normalize('NFC').replace(/[\s-]+/gu, '');
}

/**
 * 분석기(src/lib/server/koreanAnalysis.js POS) → krdict 품사.
 * 빈 배열 = 사전 조회 안 함(폴백). 분석기 라벨이 늘면 계약 테스트가 이 표를 강제한다.
 * 고유명사는 krdict가 일부(도쿄·부산 등)만 '명사'로 싣는다. 후보가 있어도 맞는 뜻이
 * 없을 수 있으므로(프랑스의 수도 파리 ≠ 곤충 파리) 2단계 선택에서 반드시 확인한다.
 */
export const ANALYZER_POS_TO_KRDICT = Object.freeze({
  명사: Object.freeze(['명사', '의존 명사']),
  고유명사: Object.freeze(['명사']),
  대명사: Object.freeze(['대명사']),
  수사: Object.freeze(['수사']),
  동사: Object.freeze(['동사']),
  형용사: Object.freeze(['형용사']),
  부사: Object.freeze(['부사']),
  연체사: Object.freeze(['관형사']),
  접속사: Object.freeze(['부사']),
  감탄사: Object.freeze(['감탄사']),
  조사: Object.freeze(['조사']),
  조동사: Object.freeze(['보조 동사', '보조 형용사']),
  접두사: Object.freeze(['접사']),
  접미: Object.freeze(['접사']),
  어소: Object.freeze([]),
  기호: Object.freeze([]),
  외국어: Object.freeze([]),
  기타: Object.freeze([]),
});

/** 알 수 없는 분석기 라벨은 null — 추측해서 넓히지 않는다. */
export function krdictPosFor(analyzerPos) {
  return Object.hasOwn(ANALYZER_POS_TO_KRDICT, analyzerPos) ? ANALYZER_POS_TO_KRDICT[analyzerPos] : null;
}

const nonEmpty = value => typeof value === 'string' && value !== '';
const optionalText = value => (nonEmpty(value) ? value : null);

/** DB 행(snake_case) → 뜻 객체. 형식이 어긋난 행은 조용히 고치지 않고 거부한다. */
export function senseFromRow(row) {
  const entryId = Number(row?.entry_id), senseNo = Number(row?.sense_no);
  const senseKey = formatSenseKey(entryId, senseNo);
  if (row.sense_key !== undefined && row.sense_key !== senseKey) throw new TypeError('sense_key_mismatch');
  if (!isKrdictRelease(row.release_id)) throw new TypeError('invalid_sense_row:release_id');
  for (const field of ['headword', 'lookup_form', 'pos', 'lexical_unit', 'definition_ko']) {
    if (!nonEmpty(row[field])) throw new TypeError(`invalid_sense_row:${field}`);
  }
  if (row.lookup_form !== normalizeLookupForm(row.headword)) throw new TypeError('invalid_sense_row:lookup_form');
  const noEquivalent = row.zh_cn_no_equivalent === true;
  if (noEquivalent && row.zh_cn_equivalent != null) throw new TypeError('invalid_sense_row:zh_cn_no_equivalent');
  return Object.freeze({
    senseKey, entryId, senseNo,
    releaseId: row.release_id,
    headword: row.headword,
    lookupForm: row.lookup_form,
    homographNo: Number(row.homograph_no ?? 0),
    pos: row.pos,
    lexicalUnit: row.lexical_unit,
    vocabLevel: optionalText(row.vocab_level),
    displayOrder: Number(row.display_order),
    definitionKo: row.definition_ko,
    zhCnEquivalent: optionalText(row.zh_cn_equivalent),
    zhCnDefinition: optionalText(row.zh_cn_definition),
    zhCnNoEquivalent: noEquivalent,
  });
}

/**
 * 한 판본의 행만 색인한다. 판본이 섞이면 같은 senseKey가 두 문구를 가질 수 있어 거부한다.
 * 후보 순서: 동형어 번호 → 항목 ID → 사전 표시 순서(뜻 ID 순이 아니다).
 */
export function buildSenseIndex(rows) {
  const byKey = new Map(), byLookup = new Map();
  let release = null;
  for (const row of rows) {
    const sense = senseFromRow(row);
    if (release === null) release = sense.releaseId;
    else if (sense.releaseId !== release) throw new TypeError('mixed_release');
    if (byKey.has(sense.senseKey)) throw new TypeError(`duplicate_sense_key:${sense.senseKey}`);
    byKey.set(sense.senseKey, sense);
    if (!byLookup.has(sense.lookupForm)) byLookup.set(sense.lookupForm, []);
    byLookup.get(sense.lookupForm).push(sense);
  }
  const order = (a, b) => a.homographNo - b.homographNo || a.entryId - b.entryId || a.displayOrder - b.displayOrder;
  for (const list of byLookup.values()) list.sort(order);
  return Object.freeze({ release, byKey, byLookup });
}

/**
 * 표제어(+분석기 품사) → 후보 뜻 목록.
 * pos를 생략하면 품사 필터 없이 같은 표제어의 모든 뜻을 돌려준다. 알 수 없는 품사·조회 안 하는
 * 품사(기호 등)는 빈 목록이다. 후보가 1개여도 '정답'이 아니다 — 선택(또는 null)은 2단계가 정한다.
 */
export function candidateSenses(index, { lemma, pos } = {}) {
  const lookupForm = normalizeLookupForm(lemma);
  if (!lookupForm) return [];
  const all = index.byLookup.get(lookupForm) || [];
  if (pos == null) return all.slice();
  const allowed = krdictPosFor(pos);
  if (!allowed || allowed.length === 0) return [];
  return all.filter(sense => allowed.includes(sense.pos));
}

/** 카드 정답 문자열. 없으면 null(사전 문구로 렌더하지 않음 → 폴백 대상). */
export function renderSenseMeaning(sense, locale) {
  if (!sense) return null;
  if (locale === 'ko') return sense.definitionKo;
  if (locale === 'zh-CN') return sense.zhCnNoEquivalent ? sense.zhCnDefinition : sense.zhCnEquivalent;
  return null;
}

/**
 * 저장 envelope 검증. 서버는 envelope.senseKey와 현재 활성 판본으로 행을 조회해 sense로
 * 넘기고, 활성 판본 id를 release로 넘긴다. 통과하면 카드에 기록할 출처(senseKey·판본)만
 * 돌려준다. 입력을 변경하지 않으며 뜻·일정·평가 필드를 만들거나 고치지 않는다.
 */
export function verifyKrdictMeaningEnvelope(envelope, { sense, release } = {}) {
  const reject = reason => Object.freeze({ ok: false, reason });
  if (!envelope || typeof envelope !== 'object' || envelope.meaningSource !== 'krdict') return reject('not_krdict');
  if (!parseSenseKey(envelope.senseKey)) return reject('invalid_sense_key');
  if (!isKrdictRelease(envelope.release) || envelope.release !== release) return reject('release_mismatch');
  if (!sense) return reject('unknown_sense');
  if (sense.senseKey !== envelope.senseKey) return reject('sense_mismatch');
  // 행의 판본이 envelope 판본과 같아야 문구가 그 판본의 문구라는 뜻이 된다.
  if (sense.releaseId !== envelope.release) return reject('release_mismatch');
  if (typeof envelope.lemma !== 'string' || normalizeLookupForm(envelope.lemma) !== sense.lookupForm) return reject('lemma_mismatch');
  if (!KRDICT_LOCALES.includes(envelope.locale)) return reject('unsupported_locale');
  const expected = renderSenseMeaning(sense, envelope.locale);
  if (expected == null) return reject('no_dictionary_text');
  // 정확 일치만. trim·NFC 정규화로 '비슷한' 문자열을 받아주면 위조 문구가 통과한다.
  if (envelope.lexicalMeaning !== expected) return reject('meaning_mismatch');
  return Object.freeze({ ok: true, meaning: expected, provenance: Object.freeze({ senseKey: sense.senseKey, release: sense.releaseId }) });
}
