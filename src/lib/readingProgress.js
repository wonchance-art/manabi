/**
 * 독해 트랙 진행 동기화 — "도쿄 도착"(JA N5 파일럿) 전용.
 *
 * 설계 근거(docs/plan-reading-track-pilot.md §5, RT-12):
 * - 챕터 완주율 오염을 막기 위해 독해는 **전용 readKey(ja_reading_texts)** 와
 *   **slug 접두사(rt:)** 로 챕터 진도와 물리적으로 분리한다.
 * - refProgress.js(챕터용)는 손대지 않는다 — 이 파일이 독해 신설분이다.
 * - user_ref_progress 서버 반영은 read:true 만 사용한다. passed=true 는 쓰지 않는다:
 *   LearnPage 등이 lang·passed=true 로 "통과 챕터" 수를 집계하므로, passed 를 세우면
 *   독해 통과가 챕터 통계에 섞여 RT-12(오염 0) 를 위반한다.
 */
import { supabase } from './supabase';
import { enqueueGrammarReview } from './grammarSrs';

/**
 * 통과 글 id 를 담는 localStorage Set 키의 **베이스**(챕터용 Set 과 절대 혼합 금지).
 * 실제 저장은 사용자 스코프 키(`ja_reading_texts:<uid>`, 게스트는 `:guest`)에 한다 —
 * 계정 전환 시 A 진도가 B 로 복제되는 것을 막기 위해(P2-7). 이 베이스 문자열 자체(콜론 없음)는
 * 스코프 도입 이전의 레거시 무스코프 키이기도 해서, 발견 시 **격리 키**(`:legacy`)로 1회
 * 이관 후 삭제한다(P2-9 — 아래 legacyReadingKey 주석 참조).
 */
export const READING_KEY = 'ja_reading_texts';
/** 게스트(비로그인) 스코프 키 — 로그인 시 사용자 키로 1회 승계 후 비운다 */
const guestReadingKey = () => `${READING_KEY}:guest`;
/**
 * 레거시(무스코프) 격리 키(P2-9) — 스코프 도입 전 저장된 `ja_reading_texts`(콜론 없음)의 이관처.
 * 이 데이터는 **소유자 불명**이다: 스코프가 없던 시절엔 게스트/여러 계정이 같은 기기에서 한 키를
 * 공유했을 수 있어, 이걸 `:guest` 로 옮기면 승계 루프가 남의 진도를 임의 계정에 자동 귀속시킨다.
 * 그래서 별도 격리 키에 가둔다 — **게스트 화면 진도 표시에만** 읽기 병합하고, 계정 승계·서버
 * upsert·SRS 백필 대상에서는 전면 제외한다(Codex P2-9: 소유자 불명 데이터의 자동 귀속 금지).
 * 업그레이드 후 정상 생성된 진짜 `:guest` 키만 로그인 시 승계된다.
 */
const legacyReadingKey = () => `${READING_KEY}:legacy`;
/** 사용자 스코프 키 — userId 없으면 게스트 키(GameCanvas 등 userId 미전달 호출 하위호환) */
const scopedReadingKey = (userId) => (userId ? `${READING_KEY}:${userId}` : guestReadingKey());
/**
 * user_ref_progress·grammar_review·review_events 에 쓰는 lang 값 — 독해 트랙의 단일 원천.
 * 다른 학습 기능이 전부 'Japanese' 를 쓰므로 'ja' 를 섞으면 약점 집계·난이도 다이얼이
 * lang='Japanese' 조회에서 독해 신호를 통째로 놓친다. 이벤트 생성은 buildReadingEvents 로만.
 */
export const READING_LANG = 'Japanese';
/** 파일럿 단일 트랙 id */
export const READING_TRACK_ID = 'n5-tokyo';

/** 글/드릴 통과 기록의 서버 slug — rt: 접두로 챕터 slug 와 네임스페이스 분리 */
export const readingSlug = (id) => `rt:${id}`;
export const isReadingSlug = (slug) => typeof slug === 'string' && slug.startsWith('rt:');
export const readingIdFromSlug = (slug) => (isReadingSlug(slug) ? slug.slice(3) : null);
/** 드릴 노드 id — 콘텐츠 스키마에 드릴 id 가 없어 index 로 합성(잠금 체인·기록 공용) */
export const drillId = (i) => `${READING_TRACK_ID}-drill-${i}`;

// ── 순수 함수(단위 테스트 대상) ─────────────────────────────────────────────

/** 0.5 단위 반올림 — 진도 헤더의 "예상 잔여 ~k주" 표기용 */
export function roundHalf(x) {
  return Math.round(Number(x) * 2) / 2;
}

/**
 * 계정 전환 중 stale pull 폐기 판정(순수, P1-4).
 * pull 요청을 건 시점의 uid(requestUid)와 응답을 반영하려는 시점의 현재 uid(currentUid)가
 * 같을 때만 true. 전환됐으면(다르거나 로그아웃) 결과를 버려 A 계정의 서버 진도가 B 화면·기록으로
 * 새지 않게 한다. 호출부(ReadingTrackPage)는 이 판정이 false 면 setPassedSet 을 건너뛴다.
 */
export function pullApplies(requestUid, currentUid) {
  return !!requestUid && requestUid === currentUid;
}

/**
 * 서버 행(user_ref_progress) → 통과 글 id 집합.
 * rt: 접두 + read:true 행만 취해 챕터 진도(rt: 아닌 slug)를 절대 섞지 않는다(RT-12).
 */
export function readingIdsFromRows(rows) {
  const ids = new Set();
  for (const r of rows || []) {
    if (r && r.read && isReadingSlug(r.slug)) ids.add(readingIdFromSlug(r.slug));
  }
  return ids;
}

/** localStorage Set 과 서버 행을 합집합 병합(양방향 동기화의 서버→로컬 방향) */
export function mergeReadingSet(localSet, rows) {
  const merged = new Set(localSet);
  for (const id of readingIdsFromRows(rows)) merged.add(id);
  return merged;
}

/** 드릴 합성 id 판별 — drillId() 규칙(-drill-<index>)의 역. 글 단위 SRS 대상 제외에 쓴다 */
export const isReadingDrillId = (id) => typeof id === 'string' && /-drill-\d+$/.test(id);

/**
 * 백필 대상 slug 계산(순수) — 통과 집합 중 grammar_review 큐에 아직 없는 '글'만.
 * - 드릴 제외: 글 단위 재검증 SRS 는 글에만 건다(ReadingTrackPage.handlePass 와 동일 규약).
 * - queuedSlugs(기존 큐 조회 결과)로 중복 등록을 막는다 — grammarSrs.staggerBackfillRows 의
 *   existingKeys 관행과 같은 원리. enqueue 자체도 ignoreDuplicates upsert 라 이중 안전으로,
 *   경합이 나도 기존 SRS 진행(interval·next_review_at)을 절대 덮지 않는다.
 * @param {Iterable<string>} passedIds - 통과한 글/드릴 id 집합
 * @param {Iterable<string>} queuedSlugs - grammar_review 에 이미 있는 rt: slug 목록
 * @returns {string[]} 등록해야 할 rt: slug
 */
export function missingReviewSlugs(passedIds, queuedSlugs) {
  const queued = new Set(queuedSlugs || []);
  const out = [];
  for (const id of passedIds || []) {
    if (!id || isReadingDrillId(id)) continue;
    const slug = readingSlug(id);
    if (!queued.has(slug)) out.push(slug);
  }
  return out;
}

/**
 * 문항 응답 → review_events 페이로드(순수) — 독해 이벤트 계약의 단일 원천.
 * 소비처(본편 ReadingTextView·월드 AirportQuiz)가 각자 페이로드를 만들면 계약이 갈라지므로
 * 세 규칙을 여기서 강제한다:
 * - lang 은 READING_LANG('Japanese') 고정 — 'ja' 표기 혼용 금지(상수 주석 참조).
 * - correct 는 **최초 시도**의 정오만 기록 — 게이팅 문항을 재시도 끝 정답으로 덮으면 전부
 *   correct:true 가 되어 약점 신호가 소실된다. 재시도 횟수는 detail.tries 로 남긴다.
 * - 미응답(tries 0) 문항은 이벤트를 만들지 않는다 — 응답하지 않은 content 를 오답으로
 *   집계하면 정답률(EWMA·다이얼)이 부당하게 깎인다. 응답한 문항만 기록.
 * - content 문항의 item_key 는 글마다 'content' 로 겹쳐, 서로 다른 글의 내용 문항이
 *   한 키로 뭉개져 약점 집계가 오염된다 → **안정 문항 id(q.id)** 로 글·위치별 고유화(P3-11).
 *   콘텐츠 전 문항에 `n5-tokyo-NN-qK` id 가 부여돼 있어, 호출부가 그 id 를 넘기면 그대로 키가 된다.
 *   id 부재 시에만 레거시 `textId#c<index>` 로 폴백(index, 없으면 순번) — 위치 파생은 문항 추가·
 *   재배열에 취약하므로 안정 id 가 우선이다. pattern 문항 키는 문형 문자열을 유지한다(문형 단위 집계).
 * @param {string} textId - 글/드릴 id (detail.text_id 로 실림)
 * @param {Array<{itemKey: string, qtype: 'pattern'|'content', firstOk: boolean, tries: number, index?: number, id?: string}>} results
 * @returns {Array} logReviewEvents 에 그대로 넘길 수 있는 이벤트 배열
 */
export function buildReadingEvents(textId, results) {
  const out = [];
  const list = results || [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || !(r.tries > 0)) continue; // 미응답 → 발행 자체를 생략
    // content 는 안정 문항 id(q.id)를 우선 사용, 없으면 위치 파생 키로 폴백(P3-11).
    const itemKey = r.qtype === 'content'
      ? (r.id || `${textId}#c${r.index != null ? r.index : i}`)
      : r.itemKey;
    if (!itemKey) continue; // pattern 인데 itemKey 없음 → 방어적으로 생략
    out.push({
      lang: READING_LANG,
      source: 'reading',
      item_key: itemKey,
      correct: !!r.firstOk,
      detail: { text_id: textId, qtype: r.qtype, tries: r.tries },
    });
  }
  return out;
}

/**
 * 문항 응답 누적(순수) — QuestionFlow 의 게이팅·잠금 규칙 단일 원천(P2-8).
 * cur(이전 기록 | undefined)에 이번 선택을 반영해 다음 기록을 만든다. 잠금 규칙:
 * - cur.ok(정답 확정) → null 반환(무시): 확정 문항 재선택 차단.
 * - content(비게이팅)이면서 cur 존재 → null: 첫 응답으로 잠금(재응답·이중 클릭 차단).
 * firstOk 는 첫 응답에서 확정·고정 — 재시도 끝의 정답이 최초 시도 기록을 덮지 않는다
 * (이벤트 correct 는 최초 시도 기준, buildReadingEvents 참조). 동기 ref 에 이 결과를
 * 즉시 써 두면 state 반영 전 재클릭이 cur 로 이 값을 보고 이중 채점되지 않는다.
 * @returns {{ok:boolean, tries:number, firstOk:boolean} | null} null 이면 이번 클릭 무시
 */
export function accumulateAnswer(cur, { ok, gating }) {
  if (cur?.ok) return null;        // 정답 확정 문항은 고정
  if (!gating && cur) return null; // content 는 첫 응답으로 잠금
  const tries = (cur?.tries || 0) + 1;
  return { ok, tries, firstOk: cur ? cur.firstOk : ok };
}

/**
 * 진도 산식(순수) — 헤더 "글 n/30 · 문형 m/125 · 예상 잔여 ~k주".
 * - n = 통과 글 수
 * - m = 통과한 글의 newPatterns ∪ 통과한 드릴의 patterns (중복 문형은 1회만 계상)
 * - total 문형 = 전 글 newPatterns ∪ 전 드릴 patterns (= bunkei N5 125 전수)
 * - k = roundHalf((textsTotal - n) / 7)  — 하루 1글 기준 잔여 주수
 */
export function computeTrackProgress(track, passedSet) {
  const texts = track?.texts || [];
  const drills = track?.drills || [];
  const set = passedSet instanceof Set ? passedSet : new Set(passedSet || []);

  const textsTotal = texts.length;
  const textsPassed = texts.filter((t) => set.has(t.id)).length;

  const allPatterns = new Set();
  for (const t of texts) for (const p of t.newPatterns || []) allPatterns.add(p);
  for (const d of drills) for (const p of d.patterns || []) allPatterns.add(p);

  const covered = new Set();
  for (const t of texts) {
    if (!set.has(t.id)) continue;
    for (const p of t.newPatterns || []) covered.add(p);
  }
  for (let i = 0; i < drills.length; i++) {
    if (!set.has(drillId(i))) continue;
    for (const p of drills[i].patterns || []) covered.add(p);
  }

  return {
    textsTotal,
    textsPassed,
    patternsTotal: allPatterns.size,
    patternsCovered: covered.size,
    weeksRemaining: roundHalf((textsTotal - textsPassed) / 7),
  };
}

/**
 * 동선 순 노드 목록(글 + 드릴) — 드릴은 afterOrder 위치(해당 글 뒤)에 끼워 넣는다.
 * 드릴도 잠금 체인에 포함되므로 통과 요건이다(RT-6·7).
 */
export function buildNodes(track) {
  const texts = [...(track?.texts || [])].sort((a, b) => a.order - b.order);
  const drills = (track?.drills || []).map((d, i) => ({ ...d, index: i, id: drillId(i) }));
  const nodes = [];
  for (const t of texts) {
    nodes.push({ kind: 'text', id: t.id, order: t.order, ref: t });
    for (const d of drills) {
      if (d.afterOrder === t.order) {
        nodes.push({ kind: 'drill', id: d.id, index: d.index, afterOrder: d.afterOrder, ref: d });
      }
    }
  }
  return nodes;
}

/**
 * 잠금 상태 부여 — 직전 노드까지 전부 통과했을 때만 다음 노드가 열린다.
 * status: 'passed' | 'open'(다음 통과 대상) | 'locked'.
 */
export function nodeStates(nodes, passedSet) {
  const set = passedSet instanceof Set ? passedSet : new Set(passedSet || []);
  let prevAllPassed = true;
  const out = [];
  for (const n of nodes) {
    const passed = set.has(n.id);
    const status = passed ? 'passed' : prevAllPassed ? 'open' : 'locked';
    out.push({ ...n, status });
    prevAllPassed = prevAllPassed && passed;
  }
  return out;
}

// ── 부수효과(localStorage · 서버) ───────────────────────────────────────────

/** 임의 키에서 Set 로드(방어적) */
function readSetFromKey(key) {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

/** 임의 키에 Set 저장(방어적) */
function writeSetToKey(key, set) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {}
}

/**
 * 레거시 무스코프 키(`ja_reading_texts`) → **격리 키**(`:legacy`)로 1회 이관 후 삭제(P2-9).
 * 소유자 불명 데이터라 게스트 키가 아니라 격리 키에 가둔다(legacyReadingKey 주석 참조):
 * 게스트 화면 표시에만 병합될 뿐, 승계·upsert·백필에는 절대 흘러가지 않는다.
 */
function migrateLegacyReadingKey() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(READING_KEY) == null) return; // 콜론 없는 정확한 레거시 키
    const legacy = readSetFromKey(READING_KEY);
    const lk = legacyReadingKey();
    writeSetToKey(lk, new Set([...readSetFromKey(lk), ...legacy]));
    localStorage.removeItem(READING_KEY);
  } catch {}
}

/**
 * **저장 대상** 순수 스코프 집합(격리 레거시 제외) — write 경로 전용.
 * loadPassedTexts 가 게스트에 병합하는 레거시 격리분은 여기 포함하지 않는다: 그대로 persist 하면
 * 소유자 불명 진도가 게스트 키로 새어 승계 대상이 돼 P2-9 를 위반한다.
 */
function readScopedSet(userId) {
  if (typeof window === 'undefined') return new Set();
  migrateLegacyReadingKey();
  return readSetFromKey(scopedReadingKey(userId));
}

/**
 * 사용자 스코프 통과 Set 로드(**화면 표시용**) — userId 없으면 게스트.
 * 게스트일 때만 레거시 격리분을 읽기 병합해 진도 표시에 반영한다(P2-9 — 승계·저장엔 미포함).
 */
export function loadPassedTexts(userId) {
  if (typeof window === 'undefined') return new Set();
  const set = readScopedSet(userId);
  if (!userId) {
    // 게스트 화면에만 소유자 불명 레거시 격리분을 병합(진도 표시 용도). 저장·승계 대상 아님.
    for (const id of readSetFromKey(legacyReadingKey())) set.add(id);
  }
  return set;
}

/** 사용자 스코프 통과 Set 저장 — userId 없으면 게스트 키 */
export function persistPassedTexts(set, userId) {
  writeSetToKey(scopedReadingKey(userId), set);
}

/**
 * 통과 시 로컬 Set 갱신 후 **표시용 집합** 반환(호출부가 상태 재설정). userId 없으면 게스트 스코프.
 * 저장은 순수 스코프 집합(readScopedSet)에만 하고, 반환은 게스트면 레거시 병합분을 포함한다.
 */
export function markReadingPassedLocal(id, userId) {
  if (typeof window === 'undefined') return new Set([id]);
  const set = readScopedSet(userId); // 격리 레거시 제외 — 저장 대상은 순수 스코프뿐
  set.add(id);
  persistPassedTexts(set, userId);
  return loadPassedTexts(userId); // 표시용(게스트면 레거시 병합)
}

/**
 * 통과 시 서버 반영 — user_ref_progress rt: slug 에 read:true upsert.
 * supabase `{error}` 를 확인해 **성공/실패(boolean)를 반환**한다(P2-8): 호출부(handlePass·recordPass)가
 * 실패 시 재시도 UI 를 띄우고 push 부터 다시 시도할 수 있게. userId/id 누락은 false.
 * @returns {Promise<boolean>} upsert 성공 여부
 */
export async function markReadingPassedRemote(userId, id) {
  if (!userId || !id) return false;
  try {
    const { error } = await supabase
      .from('user_ref_progress')
      .upsert(
        { user_id: userId, lang: READING_LANG, slug: readingSlug(id), read: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,lang,slug' }
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * 서버 ↔ localStorage 양방향 병합(rt: 행만). 챕터 진도 오염 0(RT-12).
 * 반환: 로컬이 갱신됐으면 true(호출부가 상태 재로딩).
 */
export async function pullReadingProgress(userId) {
  if (!userId || typeof window === 'undefined') return false;
  migrateLegacyReadingKey();
  const uk = scopedReadingKey(userId);
  const initial = readSetFromKey(uk); // 승계·병합 전 기준(변경 감지·복제 차단 판정용)
  let local = initial;

  // 게스트(비로그인) 진행분 1회 승계 — 같은 사람의 로그인 전 진행은 이 계정으로 정당 승계다.
  // 승계 후 게스트 키를 즉시 비워, 뒤이어 다른 계정(B)이 로그인해도 A 진도가 복제되지 않게 한다.
  const guestSet = readSetFromKey(guestReadingKey());
  if (guestSet.size) {
    local = new Set([...initial, ...guestSet]);
    if (local.size !== initial.size) writeSetToKey(uk, local); // 승계분 즉시 영속(서버 실패에도 보존)
    writeSetToKey(guestReadingKey(), new Set());               // 게스트 비움(A→B 복제 차단)
  }

  try {
    const { data, error } = await supabase
      .from('user_ref_progress')
      .select('slug, read')
      .eq('user_id', userId)
      .eq('lang', READING_LANG);
    if (error) return local.size !== initial.size; // 서버 실패 — 게스트 승계 변경만 알린다

    const rows = (data || []).filter((r) => isReadingSlug(r.slug));
    const merged = mergeReadingSet(local, rows);

    let changed = merged.size !== initial.size;
    if (merged.size !== local.size) {
      persistPassedTexts(merged, userId);
    }

    // 로컬 전용(서버 미기록) 통과분은 서버로 밀어 올린다
    const remoteIds = readingIdsFromRows(rows);
    const toPush = [...merged]
      .filter((id) => !remoteIds.has(id))
      .map((id) => ({ user_id: userId, lang: READING_LANG, slug: readingSlug(id), read: true }));
    if (toPush.length) {
      await supabase.from('user_ref_progress').upsert(toPush, { onConflict: 'user_id,lang,slug' });
    }

    // 로그인 동기화 백필 — 통과(rt:) 글인데 grammar_review 에 재검증 큐가 없는 것을 등록한다.
    // 통과 시점 등록(handlePass·recordPass)이 비로그인·타기기에서 일어났으면 이 계정 큐가
    // 비어 있으므로, pull 이 유일한 회복 지점이다. 기존 큐를 먼저 조회해 중복을 걸러낸다
    // (missingReviewSlugs — grammarSrs 백필 관행). 조회 실패 시엔 건너뛴다: 중복 방지
    // 근거 없이 enqueue 하지 않는다(다음 pull 에서 자연 재시도).
    if (merged.size) {
      const { data: queued, error: qErr } = await supabase
        .from('grammar_review')
        .select('slug')
        .eq('user_id', userId)
        .eq('lang', READING_LANG)
        .like('slug', 'rt:%');
      if (!qErr) {
        for (const slug of missingReviewSlugs(merged, (queued || []).map((r) => r.slug))) {
          enqueueGrammarReview(userId, READING_LANG, slug); // fire-and-forget·ignoreDuplicates
        }
      }
    }
    return changed;
  } catch {
    return local.size !== initial.size; // 예외 시에도 게스트 승계 변경은 알린다
  }
}
