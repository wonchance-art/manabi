// 가벼운 학습 snapshot(SNAPSHOT-LIGHT-001 — 마이그레이션 20261025150000_vocabulary_snapshot_light, 로그인 감사 F2 · F8).
// public.fsrs_vocabulary_snapshot_light(p_actor, p_language, p_summary)는 fsrs_vocabulary_snapshot과 같은 판정의 부분 집합을 줄여 보낸다:
//   ⑴ 언어 하나의 행만(p_language) ⑵ 요약 칸 배열(p_summary — 칸 이름을 행마다 되풀이하지 않는다) ⑶ 기본값이 아닌 registry 칸만.
// expandLightSnapshot은 그 응답을 snapshot과 **같은 모양**으로 되돌린다 — 이 뒤는 지금 그대로(validateVocabularyLearningSnapshot ·
// projectVocabularyLearningRows · countReviewScope · selectLegacyReviewRows). 판정을 여기서 새로 하지 않는다: 빠진 registry 칸은
// snapshot이 그 행에 내는 값(등록 안 됨 · 아는 단어 아님 · 제외 아님)이고, 요약 행의 user_id는 함수가 거른 그 계정이다.
// compactVocabularySnapshot은 반대 방향의 기준 구현이다(합성 백엔드 · 계약 테스트 — 운영 경로는 쓰지 않는다).
// 계약: vocabularySnapshotLight.test.js(왕복 · 원문 판정 조각 동일) · supabase/tests/vocabulary-snapshot-light.mjs(SQL light = compact(SQL snapshot)).
import { VOCABULARY_LEARNING_SUMMARY_FIELDS } from './vocabularyLearningRead.js';

export const LIGHT_SNAPSHOT_VERSION = 1;
/** 요약 행 배열의 칸 순서 — 요약 조회(fields=summary)와 같은 칸에서 user_id만 뺀다(함수가 그 계정 행만 거른다). */
export const LIGHT_SUMMARY_COLUMNS = Object.freeze(VOCABULARY_LEARNING_SUMMARY_FIELDS.filter(key => key !== 'user_id'));
const REGISTRY_KEYS = ['cardId', 'userId', 'enrolled', 'card', 'known', 'excluded', 'eligible', 'nextQuestionAt', 'firstQuestionAt'];

const fail = () => { throw Object.assign(new Error('fsrs_snapshot_unavailable'), { code: 'fsrs_snapshot_unavailable', status: 503 }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((value, i) => value === b[i]);

/** snapshot이 이 행에 내는 기본 registry 칸 — 등록 안 됨 · 아는 단어 아님 · 제외 아님(fsrs_vocabulary_snapshot의 그 jsonb_build_object). */
export function defaultRegistryEntry(cardId, userId) {
  return { cardId, userId, enrolled: false, card: null, known: false, excluded: false, eligible: true, nextQuestionAt: null, firstQuestionAt: null };
}

const isDefaultEntry = (entry, userId) => object(entry) && Object.keys(entry).length === REGISTRY_KEYS.length
  && REGISTRY_KEYS.every(key => Object.hasOwn(entry, key)) && entry.userId === userId && entry.enrolled === false && entry.card === null
  && entry.known === false && entry.excluded === false && entry.eligible === true && entry.nextQuestionAt === null && entry.firstQuestionAt === null;

/**
 * light 응답 → snapshot 모양(rows · registry 길이 같음 · 같은 순서). 모양이 어긋나면 snapshot을 못 읽은 것과 같은 오류(fsrs_snapshot_unavailable).
 * full 모양 행 객체는 그대로 넘긴다(복사하지 않는다 — snapshot 읽기와 같은 객체 동일성).
 */
export function expandLightSnapshot(light, userId, { language = null, summary = false } = {}) {
  const head = light?.light;
  if (!object(light) || !object(head) || head.version !== LIGHT_SNAPSHOT_VERSION || head.registry !== 'sparse'
      || head.summary !== summary || (head.language ?? null) !== (language ?? null)
      || !Array.isArray(light.rows) || !Array.isArray(light.registry) || light.actorId !== userId) fail();
  if (summary ? !sameList(head.columns, LIGHT_SUMMARY_COLUMNS) : head.columns != null) fail();
  const rows = summary ? light.rows.map(values => {
    if (!Array.isArray(values) || values.length !== LIGHT_SUMMARY_COLUMNS.length) fail();
    const row = { user_id: userId };
    LIGHT_SUMMARY_COLUMNS.forEach((key, i) => { row[key] = values[i]; });
    return row;
  }) : light.rows;
  const given = new Map();
  for (const entry of light.registry) {
    if (!object(entry) || typeof entry.cardId !== 'string' || given.has(entry.cardId) || isDefaultEntry(entry, userId)) fail();
    given.set(entry.cardId, entry);
  }
  const registry = rows.map(row => {
    const id = row?.id;
    if (typeof id !== 'string') fail();
    const entry = given.get(id);
    given.delete(id);
    return entry || defaultRegistryEntry(id, userId);
  });
  if (given.size) fail(); // 행이 없는 registry 칸
  const { light: _head, ...envelope } = light;
  return { ...envelope, rows, registry };
}

/** 기준 구현: snapshot(RPC 원문 모양) → 같은 인자의 light 응답. 합성 백엔드 · 계약 테스트용(운영 경로는 SQL 함수). */
export function compactVocabularySnapshot(snapshot, { language = null, summary = false } = {}) {
  const userId = snapshot?.actorId;
  // 완전한 snapshot만 줄인다(SQL 함수는 같은 x 행에서 rows · registry를 함께 만든다 — 칸이 빠진 snapshot은 만들 수 없다).
  if (!Array.isArray(snapshot?.rows) || !Array.isArray(snapshot.registry) || snapshot.rows.length !== snapshot.registry.length) fail();
  const byId = new Map(snapshot.registry.map(entry => [entry?.cardId, entry]));
  const rows = snapshot.rows.filter(row => language === null || row?.language === language);
  const registry = rows.map(row => byId.get(row?.id) || fail()).filter(entry => !isDefaultEntry(entry, userId));
  const { rows: _rows, registry: _registry, ...envelope } = snapshot;
  return { ...envelope,
    light: { version: LIGHT_SNAPSHOT_VERSION, language, summary, registry: 'sparse', columns: summary ? [...LIGHT_SUMMARY_COLUMNS] : null },
    rows: summary ? rows.map(row => LIGHT_SUMMARY_COLUMNS.map(key => row[key] ?? null)) : rows,
    registry };
}
