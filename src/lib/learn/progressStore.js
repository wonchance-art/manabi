/**
 * F2 — progressStore 학습 진도 단일화
 *
 * 모든 학습 이벤트(레슨·복습 완료)를 일괄 처리하는 통합 저장소.
 * 기존 readingProgress·grammarSrs·reviewEvents·streak·user_vocabulary
 * 기록을 중앙화하여 이중 기록 및 불일치를 제거한다.
 *
 * 설계:
 * - 이벤트 API: recordLessonCompleted(lessonRef)·recordReviewCompleted(itemRef)
 * - 처리: 진도 갱신 + SRS 백필 + 보상 지급을 **일괄** 처리
 * - 저장: 기존 키·테이블 계약 유지 (무손실 어댑터)
 * - 폴백: 게스트(localStorage)/로그인(Supabase) 양쪽 지원
 *
 * 신규 키: 최소화 (progressStore는 배경 조율일 뿐, 프론트에서 보이지 않음)
 */

import { supabase } from '../supabase';
import { VOCAB_UPSERT, buildVocabRow } from '../vocabIO';
import { normalizeSlug, slugAliases } from '../world/storageSchema.js';
import { recordLessonActivity } from './learningActivity';

export { normalizeSlug } from '../world/storageSchema.js';

const LESSON_READ_KEYS = {
  Japanese: 'ja_read_chapters',
  English: 'en_read_chapters',
  French: 'fr_read_chapters',
  Chinese: 'zh_read_chapters',
};

// ────────────────────────────────────────────────────────────────────
// 공개 인터페이스 (소비 페이지에서 이 함수들만 호출)
// ────────────────────────────────────────────────────────────────────

/**
 * 레슨 완료 진도 조회.
 *
 * 로그인 사용자는 user_ref_progress를 읽고, 게스트 또는 원격 조회 실패 시
 * 기존 localStorage 키를 사용한다. 원격과 로컬은 합집합으로 병합해 아직
 * 동기화되지 않은 이 기기 진도를 잃지 않는다.
 *
 * @param {string | undefined} userId
 * @param {Object} options
 * @param {"Japanese" | "French" | "English" | "Chinese"} options.lang
 * @param {string[]} [options.slugs]
 * @param {Array<{slug: string, storageKey: string, words: string[]}>} [options.vocabLessons]
 * @returns {Promise<{completedSlugs: string[], source: "remote" | "guest" | "local-fallback"}>}
 */
export async function getLessonProgress(userId, { lang, slugs = [], vocabLessons = [] } = {}) {
  if (!lang) return { completedSlugs: [], source: userId ? 'local-fallback' : 'guest' };

  const allowed = new Set(slugs.map((slug) => normalizeSlug(slug)).filter(Boolean));
  const localCompleted = readLocalLessonProgress(lang, allowed, vocabLessons);

  if (!userId || allowed.size === 0) {
    return {
      completedSlugs: [...localCompleted].sort(),
      source: userId ? 'local-fallback' : 'guest',
    };
  }

  try {
    const lookupSlugs = slugLookupCandidates(allowed);
    const { data, error } = await supabase
      .from('user_ref_progress')
      .select('slug, read, passed')
      .eq('user_id', userId)
      .eq('lang', lang)
      .in('slug', lookupSlugs);

    if (error) throw error;

    for (const row of data || []) {
      const normalizedSlug = normalizeSlug(row.slug);
      if (allowed.has(normalizedSlug) && (row.passed || row.read)) {
        localCompleted.add(normalizedSlug);
      }
    }

    return { completedSlugs: [...localCompleted].sort(), source: 'remote' };
  } catch {
    return { completedSlugs: [...localCompleted].sort(), source: 'local-fallback' };
  }
}

/**
 * 레슨(챕터·연재) 완료 → 진도+SRS+보상 일괄 처리
 *
 * @param {string} userId - user.id (로그인 시) 또는 undefined (게스트)
 * @param {Object} lessonRef - { lang, slug, source }
 *   - lang: 'Japanese' | 'French' | 'English' | 'Chinese'
 *   - slug: 챕터 slug (readKey, rt:prefix 등)
 *   - source: 'lesson' | 'material' | 'reading' 등 (진도 분류)
 * @param {Object} [options]
 *   - checkResult: { right, total, passed, at } (본편 챕터용)
 */
export async function recordLessonCompleted(userId, lessonRef, options = {}) {
  if (!lessonRef || !lessonRef.lang || !lessonRef.slug) return;

  const { lang, source } = lessonRef;
  const slug = normalizeSlug(lessonRef.slug);
  const { checkResult } = options;

  // 코스의 명시적 레슨 완료만 오늘 목표로 센다. 실패한 챕터 체크나
  // material/reading 이벤트는 기존 스트릭·진도 계약은 유지하되 일일 목표에서 제외한다.
  if (source === 'lesson' && checkResult?.passed !== false) {
    recordLessonActivity(userId);
  }

  // 게스트 경로: localStorage만
  if (!userId) {
    recordProgressLocal(slug, source, lang);
    return;
  }

  // 로그인 경로: 진도 + SRS + 보상
  try {
    // 1. 진도: user_ref_progress 갱신 (read:true 또는 passed:true)
    await recordProgressRemote(userId, lang, slug, checkResult);

    // 2. SRS: 통과 시 grammar_review 백필
    if (checkResult?.passed) {
      await enqueueReviewRemote(userId, lang, slug);
    }

    // 3. 보상: 활동 기록 (streak)
    await recordActivityRemote(userId, lang, 'lesson_completed', { slug });
  } catch (err) {
    // 부분 실패는 로그만 — 사용자 경험 단절 금지
    console.error('[progressStore] lessonCompleted 오류:', err);
  }
}

/**
 * 복습 완료 → 진도+SRS+보상 일괄 처리
 *
 * @param {string} userId
 * @param {Object} reviewRef - { type, itemKey, lang, correct, detail }
 *   - type: 'vocab' | 'grammar' | 'reading' | 'pattern'
 *   - itemKey: 단어·문형·문제 id
 *   - lang: 'Japanese' 등
 *   - correct: true | false
 *   - detail: { word_id, meaning, rating, ... } (메타)
 * @param {Object} [nextStats] - FSRS 결과 { interval, ease_factor, repetitions, next_review_at } — DB 컬럼과 동일한 snake_case여야 한다(미지 컬럼이 섞이면 PostgREST가 UPDATE 전체를 거부한다)
 */
export async function recordReviewCompleted(userId, reviewRef, nextStats = {}) {
  if (!reviewRef || !reviewRef.type || !reviewRef.itemKey) return;

  const { type, itemKey, lang, correct, detail } = reviewRef;

  // 게스트 경로: localStorage만
  if (!userId) {
    recordReviewLocal(type, itemKey);
    return { ok: true };
  }

  // 복습 시각을 여기서 한 번 찍어 이벤트·SRS·큐가 **같은 시각**을 쓰게 한다.
  // 큐가 서버 기본값 now()에 기대면 오프라인 복습이 동기화 시각으로 찍혀 14일 창·
  // 주 경계·연속 학습일이 밀린다(v2-N R2).
  const reviewedAt = new Date().toISOString();

  // 오프라인이면 네트워크를 아예 건드리지 않고 큐로 보낸다 — 부분 성공(이벤트는 갔는데
  // SRS는 실패)이 생길 여지를 없앤다. onLine===false는 '확실히 오프라인'만 뜻한다.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const queued = await queueReviewOffline(
      userId, { type, itemKey, lang, correct, detail }, nextStats, reviewedAt,
    );
    // 큐에 못 담았으면 그건 진짜 유실이다 — 성공이라 말하면 안 된다(사생활 모드 등).
    // reviewedAt 동봉(W R2) — undo가 outbox 항목(itemKey + reviewedAt)을 찾아 지우는 열쇠
    return queued ? { ok: true, queued: true, reviewedAt } : { ok: false, error: new Error('offline-queue-unavailable') };
  }

  // 로그인 경로: 복습 이벤트 + SRS + 보상
  try {
    // 1. 진도 이벤트: review_events 적재
    await recordReviewEventRemote(userId, { lang, source: type, item_key: itemKey, correct, detail, created_at: reviewedAt });

    // 2. SRS: 어휘·문법·문형 다음 복습 스케줄
    if (type === 'vocab' && detail?.word_id && nextStats.next_review_at) {
      await updateVocabNextReviewRemote(userId, detail.word_id, nextStats, reviewedAt);
    } else if (type === 'grammar' || type === 'pattern') {
      // 문법/문형은 기존 grammarSrs에서 처리 (이 함수는 진도만)
    }

    // 3. 보상: 활동 기록
    await recordActivityRemote(userId, lang, 'review_completed', { type, correct });
    // reviewedAt 동봉(W R2) — 원 이벤트는 못 지우므로(RLS SELECT·INSERT뿐) undo 보상 이벤트가
    // detail.undo_of.reviewed_at으로 원 채점을 가리킨다
    return { ok: true, reviewedAt };
  } catch (err) {
    // 온라인인데 실패했다 — 서버가 죽었거나 연결이 방금 끊겼다. 큐에 넣어 살린다.
    // 이벤트가 이미 착지했을 수도 있는데, 온라인 경로도 같은 reviewedAt을 실어 보내므로
    // flush의 완전 일치 대조가 그 중복을 걸러낸다.
    const queued = await queueReviewOffline(
      userId, { type, itemKey, lang, correct, detail }, nextStats, reviewedAt,
    );
    if (queued) return { ok: true, queued: true, reviewedAt };
    // 큐마저 못 쓰는 환경(사생활 모드 등)에서만 실패를 표면화한다 — 콘솔만 남기면
    // 채점 유실이 무증상이 된다(과거 조용한 실패 사고).
    console.error('[progressStore] reviewCompleted 오류:', err);
    return { ok: false, error: err };
  }
}

/**
 * 미전송 복습 큐로 보낸다(v2-N R2). 어휘가 아니거나 큐를 못 쓰면 false.
 * 동적 import — IndexedDB 계층을 로그인·온라인 정상 경로의 번들에서 떼어 놓는다.
 */
async function queueReviewOffline(userId, ref, nextStats, reviewedAt) {
  try {
    const { enqueueReview } = await import('../reviewOutbox');
    return await enqueueReview({
      userId,
      source: ref.type,
      itemKey: ref.itemKey,
      lang: ref.lang,
      correct: ref.correct,
      detail: ref.detail ?? null,
      nextStats: nextStats?.next_review_at ? nextStats : null,
      reviewedAt,
    });
  } catch {
    return false;
  }
}

/**
 * 신규 단어 등록 → 사전 + SRS 진도 기록
 * (StudySessionPage에서 새 단어 추가 시 호출)
 *
 * @param {string} userId
 * @param {Object} word - { word, pron, meaning, language, source_ref }
 */
export async function recordNewWord(userId, word) {
  if (!userId || !word?.word) return;

  try {
    const row = buildVocabRow({
      userId,
      surface: word.word,
      base: word.word,          // 세션 신규어는 정본 표제어다
      reading: word.pron,
      meaning: word.meaning,
      pos: '',
      language: word.language,
      sourceRef: word.source_ref,
    });

    // `insert`였다 — 이미 담긴 단어면 unique 위반이 나고 아래 catch가 삼켰다.
    // 정본 옵션(ignoreDuplicates)으로 바꾸면 **의도가 코드에 보인다**: 중복은 무시하되
    // 기존 기억은 건드리지 않는다.
    const { error } = await supabase
      .from('user_vocabulary')
      .upsert([row], VOCAB_UPSERT);

    if (error && /column|schema/i.test(error.message || '')) {
      // schema 미스매치 — base_form 없이 폴백.
      //
      // ⚠ 이 폴백은 고장나 있었다: 주석은 「base_form 없이」인데 구조분해가 **word_text까지**
      // 벗겨, 단어가 없는 행을 넣으려 했다(그래서 늘 조용히 실패했다). 벗길 건 하나다.
      // 재시도도 같은 정본 옵션을 타야 한다 — insert면 중복에서 또 다른 에러가 난다.
      const { base_form: _dropped, ...fallback } = row;
      await supabase.from('user_vocabulary')
        .upsert([fallback], VOCAB_UPSERT).then(() => {}, () => {});
    }
  } catch (err) {
    console.error('[progressStore] newWord 오류:', err);
  }
}

// ────────────────────────────────────────────────────────────────────
// 내부 구현 (기존 계약 유지)
// ────────────────────────────────────────────────────────────────────

function defaultLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function mergeSlugProgressResult(current, incoming) {
  if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return current;

  const merged = { ...current, ...incoming };
  if ('passed' in current || 'passed' in incoming) {
    merged.passed = Boolean(current.passed || incoming.passed);
  }
  return merged;
}

function migrateStoredSlugArray(storage, key, aliases) {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return false;
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) return false;

    let changed = false;
    const normalized = values.map((slug) => {
      const next = normalizeSlug(slug, aliases);
      if (next !== slug) changed = true;
      return next;
    });
    if (!changed) return false;

    storage.setItem(key, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

function migrateStoredSlugMap(storage, key, aliases) {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return false;
    const values = JSON.parse(raw);
    if (!values || typeof values !== 'object' || Array.isArray(values)) return false;

    let changed = false;
    const normalized = {};
    for (const [slug, result] of Object.entries(values)) {
      const next = normalizeSlug(slug, aliases);
      if (next !== slug) changed = true;
      normalized[next] = Object.prototype.hasOwnProperty.call(normalized, next)
        ? mergeSlugProgressResult(normalized[next], result)
        : result;
    }
    if (!changed) return false;

    storage.setItem(key, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/**
 * 기존 진도 키의 slug 값/프로퍼티를 제자리에서 신 slug로 옮긴다.
 *
 * 별도 완료 표식 키를 만들지 않고 실제 변경이 있을 때만 같은 키를 재기록한다.
 * 따라서 첫 성공 뒤 재호출은 쓰기 없는 no-op이며, 차단·손상 저장소는 그대로 둔다.
 */
export function migrateSlugProgressKeys(
  storage = defaultLocalStorage(),
  lang,
  aliases = slugAliases,
) {
  if (!storage || !aliases || typeof aliases !== 'object' || Object.keys(aliases).length === 0) {
    return false;
  }

  let changed = migrateStoredSlugArray(storage, 'studied_lesson', aliases);
  const readKey = LESSON_READ_KEYS[lang];
  if (readKey) {
    changed = migrateStoredSlugArray(storage, readKey, aliases) || changed;
    changed = migrateStoredSlugMap(storage, `${readKey}_check`, aliases) || changed;
  }
  return changed;
}

function slugLookupCandidates(allowed, aliases = slugAliases) {
  const candidates = new Set(allowed);
  for (const legacySlug of Object.keys(aliases)) {
    if (allowed.has(normalizeSlug(legacySlug, aliases))) candidates.add(legacySlug);
  }
  return [...candidates];
}

/**
 * 게스트 진도: localStorage Set에 기록
 * (기존 VocabPage.updateReadingProgress 등과 동일)
 */
function recordProgressLocal(slug, source, lang) {
  try {
    const storage = defaultLocalStorage();
    if (!storage || !slug) return;

    // 시리즈별 진도: studied_${source}
    const studiedKey = `studied_${source}`;
    migrateSlugProgressKeys(storage, lang);
    migrateStoredSlugArray(storage, studiedKey, slugAliases);
    const studied = new Set(JSON.parse(storage.getItem(studiedKey) || '[]'));
    studied.add(slug);
    storage.setItem(studiedKey, JSON.stringify([...studied]));
  } catch {}
}

function readLocalLessonProgress(lang, allowed, vocabLessons = []) {
  const completed = new Set();
  const storage = defaultLocalStorage();
  if (!storage) return completed;
  migrateSlugProgressKeys(storage, lang);

  const addStoredArray = (key) => {
    try {
      const values = JSON.parse(storage.getItem(key) || '[]');
      if (!Array.isArray(values)) return;
      for (const slug of values) {
        const normalizedSlug = normalizeSlug(slug);
        if (allowed.has(normalizedSlug)) completed.add(normalizedSlug);
      }
    } catch {}
  };

  // F2 게스트 이벤트 키.
  addStoredArray('studied_lesson');

  // 기존 레퍼런스 진도 키. progressStore가 유지하는 무손실 폴백 계약이다.
  const readKey = LESSON_READ_KEYS[lang];
  if (readKey) {
    addStoredArray(readKey);

    try {
      const checks = JSON.parse(storage.getItem(`${readKey}_check`) || '{}');
      if (checks && typeof checks === 'object' && !Array.isArray(checks)) {
        for (const [slug, result] of Object.entries(checks)) {
          const normalizedSlug = normalizeSlug(slug);
          if (allowed.has(normalizedSlug) && result?.passed) completed.add(normalizedSlug);
        }
      }
    } catch {}
  }

  for (const lesson of vocabLessons) {
    const normalizedSlug = normalizeSlug(lesson?.slug);
    if (!allowed.has(normalizedSlug) || !lesson.storageKey || !Array.isArray(lesson.words)) continue;
    if (lesson.words.length === 0) continue;

    try {
      const checked = new Set(JSON.parse(storage.getItem(lesson.storageKey) || '[]'));
      if (lesson.words.every((word) => checked.has(word))) completed.add(normalizedSlug);
    } catch {}
  }

  return completed;
}

/**
 * 게스트 복습: 진도 이벤트 기록 없음 (localStorage 제약)
 */
function recordReviewLocal(type, itemKey) {
  try {
    if (typeof window === 'undefined') return;
    // 게스트 복습은 localStorage 시각화 불가 — 로컬 통계만 가능
    // 진도 저장 불필요 (원본 설계)
  } catch {}
}

/**
 * user_ref_progress 갱신 (챕터·독해)
 * 기존 readingProgress.recordReading() + StudySessionPage.syncReadRemote 통합
 */
async function recordProgressRemote(userId, lang, slug, checkResult) {
  if (!userId || !slug) return;

  const isChapterCheck = checkResult != null;
  const payload = {
    user_id: userId,
    lang,
    slug,
    read: !isChapterCheck, // 독해/자료 진도는 read:true
    passed: isChapterCheck && checkResult.passed, // 챕터만 passed:true
    checked_at: isChapterCheck ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from('user_ref_progress')
    .upsert([payload], { onConflict: 'user_id,lang,slug' });

  if (error) throw error;
}

/**
 * grammar_review 백필 (통과 챕터 → SRS 큐)
 * 기존 StudySessionPage.enqueueGrammarReview() 호출
 */
async function enqueueReviewRemote(userId, lang, slug) {
  if (!userId || !lang || !slug) return;

  // 동적 import (순환 참조 회피)
  const { enqueueGrammarReview } = await import('../grammarSrs');
  return enqueueGrammarReview(userId, lang, slug);
}

/**
 * review_events 적재 (약점 진단 데이터)
 */
async function recordReviewEventRemote(userId, event) {
  if (!userId || !event) return;

  const { logReviewEvents } = await import('../reviewEvents');
  return logReviewEvents(userId, [event]);
}

/**
 * user_vocabulary next_review_at 갱신
 * 기존 VocabPage.scoreMutation 통합
 */
async function updateVocabNextReviewRemote(userId, wordId, nextStats, reviewedAt) {
  if (!userId || !wordId) return;
  // 채점 저장 정본(fsrs.persistVocabGrade)으로 수렴 — 4중복 페이로드의 단일화.
  // reviewedAt을 그대로 실어 SRS last_reviewed_at = 이벤트 created_at = 큐 항목 시각(한 시계).
  // 안 실으면 persistVocabGrade가 제 시계를 찍어 undo 대조·큐 중복 제거의 열쇠가 ms만큼 어긋난다(W 후속 ③).
  const { persistVocabGrade } = await import('../fsrs');
  return persistVocabGrade(supabase, wordId, nextStats, reviewedAt);
}

/**
 * streak 활동 기록
 * 기존 VocabPage/StudySessionPage.recordActivity() 통합
 */
async function recordActivityRemote(userId, lang, activity, detail) {
  if (!userId) return;

  const { recordActivity } = await import('../streak');
  return recordActivity(userId, () => {
    // fetchProfile 콜백은 외부에서만 (progressStore는 순수 기록만)
    return Promise.resolve();
  });
}

// ────────────────────────────────────────────────────────────────────
// 유틸리티
// ────────────────────────────────────────────────────────────────────

/**
 * 진도 기록 계약 검증 (테스트용)
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateProgressRecord(record) {
  const errors = [];

  if (record.type === 'lesson') {
    if (!record.lessonRef?.lang) errors.push('lessonRef.lang 필수');
    if (!record.lessonRef?.slug) errors.push('lessonRef.slug 필수');
  } else if (record.type === 'review') {
    if (!record.reviewRef?.type) errors.push('reviewRef.type 필수');
    if (!record.reviewRef?.itemKey) errors.push('reviewRef.itemKey 필수');
  } else {
    errors.push(`type은 'lesson'|'review'여야 함: ${record.type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
