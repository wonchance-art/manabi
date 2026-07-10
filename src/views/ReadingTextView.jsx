'use client';

import { useMemo, useRef, useState } from 'react';
import { JaText } from './refShared';
import { buildReadingEvents, accumulateAnswer } from '../lib/readingProgress';

/**
 * 독해 글 뷰어 + 문항 흐름 (신규 컴포넌트).
 * RefPatternCheck 는 80% 통과·3단계 구조라 재사용 불가(RT-11) — 셔플만 관행 참조.
 *
 * 문항 흐름 규칙(기획 §5·RT-14):
 * - pattern 문항 전부 정답이 통과 조건. content 문항은 출제하되 통과 판정에서 제외.
 * - 오답 시 근거(본문)로 스크롤·재독 후 재시도(무한). 시도 횟수(tries)를 기록한다.
 * - 이벤트 계약은 buildReadingEvents(readingProgress.js)가 단일 원천 — correct 는 최초 시도
 *   기준(재시도 횟수는 detail.tries), 미응답 content 는 발행하지 않는다.
 */

function shuffleWithAnswer(choices, answerIdx) {
  // 정답 문자열을 보존한 채 보기 순서만 섞는다(정답 인덱스는 셔플 후 재계산)
  const answer = choices[answerIdx];
  const arr = choices.map((c, i) => ({ c, i }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { choices: arr.map((x) => x.c), answer };
}

// ── 신유형 순수 헬퍼(단위 테스트 대상) — order 채점·결정적 셔플·fill 정규화 ──
// 두 뷰어(QuestionFlow·AirportQuiz)가 같은 규약을 쓰도록 단일 원천으로 export 한다.

/** 배열 동치(원소 문자열 비교) — order 채점·"정답 순서로 시작 금지" 판정 공용 */
export function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * order 채점 — 조립한 배열이 정답 순서와 완전히 일치할 때만 정답.
 * fail-closed(P2-4): answer가 비어 있으면(스키마 불충족 문항이 방어망을 뚫고 여기까지 온 경우)
 * 무조건 오답 — arraysEqual([], [])===true 를 그대로 두면 tiles/answer 가 둘 다 []로 정규화된
 * 콘텐츠 오류 문항이 "0개 조립"만으로 자동 통과해버린다. normalizeQuestion 이 이런 문항을
 * qtype:'error'로 갈라내 이 함수 자체가 호출되지 않게 막지만, 이 가드는 그 경로가 우회되거나
 * 다른 호출부가 생겨도 같은 구멍이 재발하지 않도록 하는 2차 방어선이다.
 */
export function gradeOrder(assembled, answer) {
  if (!Array.isArray(answer) || answer.length === 0) return false;
  return arraysEqual(assembled, answer);
}

// 결정적 PRNG(문항 id 시드) — 셔플이 매 렌더·기기에서 같아 하이드레이션 불일치·재셔플 튐이 없다.
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드 결정적 Fisher-Yates(원본 불변) */
export function seededShuffle(arr, seedStr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  const rand = mulberry32(hashSeed(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * order 타일 초기 배치 — 시드 결정적 셔플이되 **정답 순서로 시작 금지**.
 * 셔플 결과가 정답과 같으면 시드를 바꿔 재시도하고, 그래도 같으면(원소 중복 등) 서로 다른
 * 두 타일을 스왑해 강제로 어긋낸다. 타일이 0·1개면 섞을 여지가 없어 그대로 둔다.
 */
export function shuffleOrderTiles(tiles, answer, seedStr) {
  const arr = Array.isArray(tiles) ? tiles.slice() : [];
  if (arr.length <= 1) return arr;
  let out = seededShuffle(arr, seedStr);
  for (let n = 1; n <= 8 && arraysEqual(out, answer); n++) {
    out = seededShuffle(arr, `${seedStr}#${n}`);
  }
  if (arraysEqual(out, answer)) {
    for (let i = 1; i < out.length; i++) {
      if (out[i] !== out[0]) { [out[0], out[i]] = [out[i], out[0]]; break; }
    }
  }
  return out;
}

/** fill 입력 정규화 — NFKC(전각→반각 통일) 후 공백(半角·全角) 전부 제거 */
export function normalizeFill(s) {
  return String(s ?? '').normalize('NFKC').replace(/[\s　]+/g, '').trim();
}

/** fill 채점 — 정규화한 입력이 answer 또는 accept[] 중 하나와 같으면 정답(빈 입력은 오답) */
export function checkFill(input, answer, accept) {
  const norm = normalizeFill(input);
  if (!norm) return false;
  const candidates = [answer, ...(Array.isArray(accept) ? accept : [])].filter((x) => x != null);
  return candidates.some((c) => normalizeFill(c) === norm);
}

/** fill 문항의 빈칸 마커 — 콘텐츠 계약의 전각 대괄호+전각 공백 */
export const FILL_BLANK = '［　］';
/** 후리가나 표시 선호(전역 뷰 설정 — 계정 무관) localStorage 키 */
const FURIGANA_PREF_KEY = 'reading_furigana_pref';
/** ja 문장을 빈칸 기준 앞/뒤로 분리(마커 없으면 통째로 앞) */
export function splitFill(ja) {
  const s = String(ja ?? '');
  const i = s.indexOf(FILL_BLANK);
  if (i < 0) return { before: s, after: '' };
  return { before: s.slice(0, i), after: s.slice(i + FILL_BLANK.length) };
}

// ── 런타임 스키마 검증(P2-4, fail-closed) ──
// check-reading.mjs가 콘텐츠 빌드 시점에 order/fill 스키마를 게이트하지만, 뷰어는 그 검증을
// 다시 거치지 않고 콘텐츠 JSON을 직접 소비한다. 기존 normalizeQuestion은 q.tiles/q.answer가
// 누락·빈 배열이면 조용히 []/[]로 정규화했고, gradeOrder([], [])===true라 "0개 조립"만으로
// 자동 통과하는 구멍이 있었다(Codex P2-4). 여기서 스키마를 다시 검증해 불충족 문항은 정상
// order/fill로 정규화하지 않고 qtype:'error'로 갈라내 게이트를 영구히 막는다(정답 처리 금지).
/** order 문항 런타임 스키마 — tiles·answer 비어있지 않고 각 원소가 비어있지 않은 문자열. */
function isOrderSchemaValid(q) {
  const tiles = q.tiles, answer = q.answer;
  if (!Array.isArray(tiles) || tiles.length === 0) return false;
  if (!Array.isArray(answer) || answer.length === 0) return false;
  const strOk = (x) => typeof x === 'string' && x.trim().length > 0;
  return tiles.every(strOk) && answer.every(strOk);
}
/**
 * fill 문항 런타임 스키마 — ja에 빈칸 마커 정확히 1개 + answer가 비어있지 않은 문자열
 * + accept(있으면) 배열이고 각 원소도 비어있지 않은 문자열(P2-8).
 * 빌드 게이트(scripts/check-reading.mjs Q-fill)는 accept 원소를 검증하지만 런타임 정규화는
 * 그동안 blank·answer만 봤다 — accept:[{}] 같은 문항도 fill 로 정규화돼 checkFill 이
 * normalizeFill({}) → "[object Object]" 문자열과 비교했고, 사용자가 그 문자열 그대로
 * 입력하면 정답 처리되는 경로가 열려 있었다(Codex 재현). 여기서 빌드 게이트와 대칭으로
 * fail-closed — 위반 시 fill 로 정규화하지 않고 qtype:'error'(기존 fail-closed 경로)로 갈라낸다.
 */
function isFillSchemaValid(q) {
  const ja = typeof q.ja === 'string' ? q.ja : '';
  const blanks = ja.split(FILL_BLANK).length - 1;
  if (blanks !== 1) return false;
  if (!(typeof q.answer === 'string' && q.answer.trim().length > 0)) return false;
  if (q.accept !== undefined) {
    if (!Array.isArray(q.accept)) return false;
    if (!q.accept.every((x) => typeof x === 'string' && x.trim().length > 0)) return false;
  }
  return true;
}

/**
 * 콘텐츠 문항 → 뷰어 공용 정규화 형태(단일 원천 — 두 뷰어가 같은 필드를 소비).
 * gating = order·fill·pattern(전부 정답이 통과 조건). content·produce 는 비게이트.
 * itemKey = 문형(pattern) — order·fill 도 pattern 과 같은 키로 약점 신호가 합류한다.
 * 신유형이 없는 기존 글(선다만)은 pattern/content 로 종전과 동일하게 매핑돼 하위 호환된다.
 */
export function normalizeQuestion(q, key) {
  const base = { key, id: q.id, why: q.why || '' };
  if (q.type === 'order') {
    // fail-closed(P2-4): 스키마 불충족(tiles/answer 누락·빈 배열·비문자열/빈 문자열 원소)이면
    // []/[]로 조용히 정규화하지 않고 qtype:'error'로 갈라낸다 — 이 문항은 콘텐츠 오류로 렌더되고
    // gating:true인 채 채점 경로 자체가 없어(픽커·확정 버튼 미노출) 게이트를 영구히 막는다.
    if (!isOrderSchemaValid(q)) {
      return { ...base, qtype: 'error', gating: true, itemKey: q.pattern || null, prompt: q.q || '' };
    }
    return { ...base, qtype: 'order', gating: true, itemKey: q.pattern, prompt: q.q,
      tiles: q.tiles, answerTiles: q.answer, ko: q.ko || '' };
  }
  if (q.type === 'fill') {
    // fail-closed(P2-4): 빈칸 마커 부재/복수·answer 누락이면 fill로 정규화하지 않고 콘텐츠 오류로.
    if (!isFillSchemaValid(q)) {
      return { ...base, qtype: 'error', gating: true, itemKey: q.pattern || null, prompt: q.q || '' };
    }
    return { ...base, qtype: 'fill', gating: true, itemKey: q.pattern, prompt: q.q,
      ja: q.ja || '', fillAnswer: q.answer, accept: Array.isArray(q.accept) ? q.accept : [] };
  }
  if (q.type === 'produce') {
    return { ...base, qtype: 'produce', gating: false, itemKey: null,
      prompt: q.prompt || q.q || '', model: Array.isArray(q.model) ? q.model : [], guide: q.guide || '' };
  }
  if (q.type === 'pattern') {
    return { ...base, qtype: 'pattern', gating: true, itemKey: q.pattern, prompt: q.q,
      choices: q.choices, answerText: q.choices[q.answer] };
  }
  // content(기본)
  return { ...base, qtype: 'content', gating: false, itemKey: 'content', prompt: q.q,
    choices: q.choices, answerText: q.choices[q.answer] };
}

/**
 * 공용 문항 흐름 — 글·드릴 모두 사용.
 * questions: [{ key, qtype:'pattern'|'content', itemKey, prompt, contextJa?, choices, answerText, gating, why }]
 * onScrollToEvidence: 오답 시 근거로 스크롤(뷰어가 주입, 드릴은 없음)
 * onPass(events): 통과(모든 gating 정답) 시 1회 — review_events 페이로드 배열
 */
function QuestionFlow({ questions, textId, onScrollToEvidence, onPass, passLabel = '통과' }) {
  // 최초 1회 셔플 — 뷰어는 클라이언트 상태 진입 후에만 렌더되므로 하이드레이션 불일치 없음.
  // 선다(pattern·content)는 랜덤 셔플, order 타일은 문항 id 시드 결정적 셔플(정답 순서로 시작 금지),
  // fill·produce 는 셔플 대상이 아니다.
  const shuffled = useMemo(() => {
    return questions.map((q) => {
      if (q.qtype === 'order') {
        return { ...q, tiles: shuffleOrderTiles(q.tiles, q.answerTiles, q.id || q.key) };
      }
      if (!Array.isArray(q.choices)) return q; // fill·produce 는 보기 없음
      const s = shuffleWithAnswer(q.choices, q.choices.indexOf(q.answerText));
      return { ...q, choices: s.choices, answerText: s.answer };
    });
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [answers, setAnswers] = useState({}); // key → { picked, ok, tries, firstOk }
  const [orderPicks, setOrderPicks] = useState({}); // order key → 선택 타일 인덱스 배열(탭 순서)
  const [fillInputs, setFillInputs] = useState({}); // fill key → 현재 입력 문자열
  const [produceInputs, setProduceInputs] = useState({}); // produce key → 입력(선택)
  const [produceShown, setProduceShown] = useState({});    // produce key → 모범답 공개 여부
  const [passed, setPassed] = useState(false);
  const [saving, setSaving] = useState(false);      // onPass 대기 중("기록 중…") — 완료·이동 차단(P2-7)
  const [saveError, setSaveError] = useState(false); // 기록 실패 → 재시도 UI(P2-8)
  // 동기 잠금 — state 반영 전 재클릭이 이중 채점되지 않게 답안을 ref 로도 즉시 확정한다(P2-8).
  const answeringRef = useRef({}); // key → { picked, ok, tries, firstOk }(진실원)
  const savingRef = useRef(false); // onPass 중복 발화 동기 가드(state 반영 전 이중 클릭 차단)
  const eventsRef = useRef(null);  // 통과 시 조립한 이벤트 — 재시도가 같은 페이로드로 push 부터 재시도

  const gating = shuffled.filter((q) => q.gating);
  const allGatingOk = gating.length > 0 && gating.every((q) => answers[q.key]?.ok);

  function pick(q, opt) {
    const cur = answeringRef.current[q.key]; // state 아닌 ref 가 진실원 — 동기 이중 클릭 차단
    const ok = opt === q.answerText;
    // 게이팅·잠금·firstOk 규칙은 accumulateAnswer(단일 원천). null 이면 이번 클릭 무시.
    const next = accumulateAnswer(cur, { ok, gating: q.gating });
    if (!next) return;
    const rec = { ...next, picked: opt };
    answeringRef.current[q.key] = rec;                 // 동기 확정(다음 클릭이 즉시 본다)
    setAnswers((prev) => ({ ...prev, [q.key]: rec })); // 렌더 반영
    if (!ok && q.gating && onScrollToEvidence) onScrollToEvidence();
  }

  // order·fill 공용 채점 확정 — pick 과 같은 accumulateAnswer 규약(선택지가 아니라 조립·입력 채점).
  function commitGated(q, ok) {
    const cur = answeringRef.current[q.key];
    const next = accumulateAnswer(cur, { ok, gating: q.gating });
    if (!next) return; // 이미 정답 확정 → 무시
    answeringRef.current[q.key] = next;
    setAnswers((prev) => ({ ...prev, [q.key]: next }));
    if (!ok && q.gating && onScrollToEvidence) onScrollToEvidence();
  }

  // order 타일 탭 — 풀→조립(추가), 조립→풀(되돌리기·재배열). 정답 확정 후엔 잠금.
  function tapOrderTile(q, tileIdx, inAssembled) {
    if (answeringRef.current[q.key]?.ok) return;
    setOrderPicks((prev) => {
      const cur = prev[q.key] || [];
      const next = inAssembled ? cur.filter((x) => x !== tileIdx) : [...cur, tileIdx];
      return { ...prev, [q.key]: next };
    });
  }
  function confirmOrder(q) {
    if (answeringRef.current[q.key]?.ok) return;
    const picks = orderPicks[q.key] || [];
    if (picks.length !== (q.tiles || []).length) return; // 전부 배치해야 채점
    const assembled = picks.map((i) => q.tiles[i]);
    commitGated(q, gradeOrder(assembled, q.answerTiles));
  }

  function submitFill(q) {
    if (answeringRef.current[q.key]?.ok) return;
    commitGated(q, checkFill(fillInputs[q.key] || '', q.fillAnswer, q.accept));
  }

  // produce 는 비게이트 — 제출/건너뛰기 모두 모범답 공개만, 채점·이벤트 없음.
  function revealProduce(q) {
    setProduceShown((prev) => ({ ...prev, [q.key]: true }));
  }

  // onPass(원격 기록) 를 await — 성공 후에만 완료 화면으로, 실패면 재시도 UI 로 전환(P2-7·P2-8).
  async function runSave() {
    if (savingRef.current) return; // 동기 가드 — 저장 중 재클릭·중복 재시도 차단
    savingRef.current = true;
    setSaveError(false);
    setSaving(true);
    try {
      await onPass?.(eventsRef.current);
      setPassed(true); // 성공 뒤에만 완료 화면
    } catch {
      setSaveError(true); // 실패 — 재시도 버튼 노출(재-push)
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  function finish() {
    if (passed || savingRef.current) return; // 이미 통과했거나 저장 중이면 무시
    // 페이로드는 buildReadingEvents(단일 원천)가 조립 — lang:'Japanese' 고정,
    // correct=최초 시도(firstOk), 미응답(tries 0) content 는 이벤트 자체를 내지 않는다.
    // content 는 안정 문항 id(q.id)를 넘겨 글별 고유 item_key 로 집계된다(P3-11, index 는 폴백용).
    eventsRef.current = buildReadingEvents(
      textId,
      shuffled.map((q, idx) => {
        const a = answeringRef.current[q.key];
        return { itemKey: q.itemKey, id: q.id, qtype: q.qtype, firstOk: !!a?.firstOk, tries: a?.tries || 0, index: idx };
      })
    );
    runSave();
  }

  return (
    <div>
      <ol className="fr-quiz" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {shuffled.map((q, i) => {
          const a = answers[q.key];
          const locked = a?.ok || (!q.gating && !!a);
          const label =
            q.qtype === 'content' ? '내용 확인 (통과 판정 제외)'
            : q.qtype === 'order' ? '문장 만들기'
            : q.qtype === 'fill' ? '빈칸 채우기'
            : q.qtype === 'produce' ? '문장 만들기 (선택 · 통과 판정 제외)'
            : q.qtype === 'error' ? '콘텐츠 오류'
            : '문형';
          return (
            <li key={q.key} className="fr-quiz__item">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                {i + 1}. {label}
              </div>
              {q.contextJa && (
                <div lang="ja" style={{ marginBottom: 6, fontSize: '1rem' }}>{q.contextJa}</div>
              )}

              {/* ── order: 타일 조립 ── */}
              {q.qtype === 'order' ? (() => {
                const picks = orderPicks[q.key] || [];
                const assembled = picks.map((idx) => q.tiles[idx]);
                const remaining = q.tiles.map((t, idx) => idx).filter((idx) => !picks.includes(idx));
                const full = picks.length === q.tiles.length;
                return (
                  <>
                    <div className="fr-quiz__prompt" style={{ marginBottom: 8 }}>{q.prompt}</div>
                    {/* 조립 줄 */}
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 44, padding: '8px 10px',
                      border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)', marginBottom: 8,
                      background: 'var(--surface-2, rgba(127,127,127,0.06))',
                    }}>
                      {assembled.length === 0 ? (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          아래 타일을 순서대로 탭하세요
                        </span>
                      ) : (
                        picks.map((idx, pos) => (
                          <button
                            key={`${idx}-${pos}`} type="button" lang="ja" disabled={a?.ok}
                            className="chip" onClick={() => tapOrderTile(q, idx, true)}
                            style={{ fontSize: '1rem' }}
                          >
                            {q.tiles[idx]}
                          </button>
                        ))
                      )}
                    </div>
                    {/* 풀(남은 타일) */}
                    {!a?.ok && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {remaining.map((idx) => (
                          <button
                            key={idx} type="button" lang="ja" className="chip"
                            onClick={() => tapOrderTile(q, idx, false)} style={{ fontSize: '1rem' }}
                          >
                            {q.tiles[idx]}
                          </button>
                        ))}
                      </div>
                    )}
                    {!a?.ok && (
                      <button
                        type="button" className="btn btn--primary btn--sm"
                        disabled={!full} onClick={() => confirmOrder(q)}
                      >
                        확정
                      </button>
                    )}
                  </>
                );
              })() : q.qtype === 'fill' ? (() => {
                // ── fill: 인라인 입력 ──
                const { before, after } = splitFill(q.ja);
                const val = fillInputs[q.key] || '';
                return (
                  <>
                    <div className="fr-quiz__prompt" style={{ marginBottom: 8 }}>{q.prompt}</div>
                    <div lang="ja" style={{ fontSize: '1.05rem', lineHeight: 2, marginBottom: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                      <span>{before}</span>
                      {a?.ok ? (
                        <span style={{ fontWeight: 700, color: 'var(--accent, #6c7cff)', margin: '0 2px' }}>{q.fillAnswer}</span>
                      ) : (
                        <input
                          type="text" lang="ja" value={val} inputMode="text"
                          onChange={(e) => setFillInputs((prev) => ({ ...prev, [q.key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitFill(q); } }}
                          aria-label="빈칸에 들어갈 말"
                          style={{ width: '4.5em', textAlign: 'center', fontSize: '1rem', padding: '2px 6px', margin: '0 2px', border: '1px solid var(--border)', borderRadius: 6 }}
                        />
                      )}
                      <span>{after}</span>
                    </div>
                    {!a?.ok && (
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => submitFill(q)}>
                        제출
                      </button>
                    )}
                  </>
                );
              })() : q.qtype === 'produce' ? (() => {
                // ── produce: 비게이트 산출(선택) ──
                const shown = !!produceShown[q.key];
                const val = produceInputs[q.key] || '';
                return (
                  <>
                    <div className="fr-quiz__prompt" style={{ marginBottom: 6 }}>{q.prompt}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                      선택 문항이에요 — 직접 써 보거나 건너뛸 수 있어요. 채점하지 않아요.
                    </div>
                    {!shown ? (
                      <>
                        <textarea
                          lang="ja" value={val} rows={2}
                          onChange={(e) => setProduceInputs((prev) => ({ ...prev, [q.key]: e.target.value }))}
                          placeholder="여기에 일본어로 써 보세요(선택)"
                          style={{ width: '100%', fontSize: '1rem', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn btn--primary btn--sm" onClick={() => revealProduce(q)}>제출</button>
                          <button type="button" className="chip" onClick={() => revealProduce(q)}>건너뛰기</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {val.trim() && (
                          <div style={{ fontSize: '0.9rem' }} lang="ja">
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>내가 쓴 문장</span>
                            {val}
                          </div>
                        )}
                        {(q.model || []).length > 0 && (
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>모범답</span>
                            {q.model.map((m, mi) => (
                              <div key={mi} lang="ja" style={{ fontSize: '1rem', marginBottom: 2 }}>· {m}</div>
                            ))}
                          </div>
                        )}
                        {q.guide && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{q.guide}</div>}
                      </div>
                    )}
                  </>
                );
              })() : q.qtype === 'error' ? (
                // ── error: 콘텐츠 스키마 불충족(P2-4 fail-closed) — 게이트 상태로 영구 잠금,
                // 채점 UI 자체를 노출하지 않는다(정답 처리 금지). "← 목록"으로만 이탈 가능.
                <div style={{ fontSize: '0.86rem', color: 'var(--danger)', lineHeight: 1.6 }}>
                  ⚠ 이 문항은 콘텐츠 형식 오류로 표시할 수 없어요. 통과 판정에서 제외되지 않으며
                  담당자 확인 전까지는 통과할 수 없어요.
                </div>
              ) : (
                // ── pattern·content: 기존 선다 ──
                <>
                  <div className="fr-quiz__prompt" style={{ marginBottom: 8 }} lang="ja">{q.prompt}</div>
                  <div className="fr-quiz__opts fr-quiz__opts--col">
                    {q.choices.map((opt) => {
                      const isPicked = a?.picked === opt;
                      const cls = a
                        ? opt === q.answerText && (a.ok || locked)
                          ? 'is-correct'
                          : isPicked && !a.ok
                          ? 'is-wrong'
                          : locked
                          ? 'is-locked'
                          : ''
                        : '';
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`fr-quiz__opt ${cls}`}
                          onClick={() => pick(q, opt)}
                          disabled={locked}
                          lang="ja"
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {a && !a.ok && q.gating && (
                <div className="fr-quiz__answer" style={{ color: 'var(--danger)' }}>
                  × 다시 — {q.why || '본문을 다시 읽고 재도전하세요.'} (시도 {a.tries}회)
                </div>
              )}
              {a?.ok && (
                <div className="fr-quiz__answer">
                  ○ {q.why || '정답입니다.'}{a.tries > 1 ? ` (${a.tries}회 시도)` : ''}
                  {q.qtype === 'order' && q.ko && (
                    <div style={{ marginTop: 4 }}>
                      <span lang="ja" style={{ fontWeight: 700 }}>{(q.answerTiles || []).join('')}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{q.ko}</span>
                    </div>
                  )}
                </div>
              )}
              {a && !a.ok && !q.gating && q.qtype === 'content' && (
                <div className="fr-quiz__answer">정답: <span lang="ja">{q.answerText}</span></div>
              )}
            </li>
          );
        })}
      </ol>

      <div style={{ marginTop: 18 }}>
        {allGatingOk ? (
          passed ? (
            <div className="fr-check__verdict is-pass" style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
              <strong>{passLabel} 완료</strong> — 문형 문항을 전부 맞혔어요.
            </div>
          ) : saving ? (
            // 원격 기록 대기 — 성공 전엔 완료 화면·다음 이동을 열지 않는다(P2-7)
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '12px 4px' }}>
              기록 중이에요…
            </div>
          ) : saveError ? (
            // 원격 upsert 실패({error}) — push 부터 다시 시도(P2-8)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--danger)', margin: 0 }}>
                기록에 실패했어요. 잠시 후 다시 시도해 주세요.
              </p>
              <button type="button" className="btn btn--primary btn--md" onClick={runSave}>
                다시 시도
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--md" onClick={finish}>
              {passLabel}하기 →
            </button>
          )
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            문형 문항을 모두 맞히면 {passLabel}돼요. 틀리면 본문을 다시 읽고 재도전하세요.
          </p>
        )}
      </div>
    </div>
  );
}

/** 신규 문형 사전 카드 팝오버 — bunkei explain·contrast·ex 이관분 표시 */
function PatternCard({ card, onClose }) {
  if (!card) return null;
  return (
    <div
      role="dialog"
      aria-label={`문형 ${card.pattern}`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, borderRadius: '16px 16px 0 0', padding: '18px 18px 26px', maxHeight: '78vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span lang="ja" style={{ fontSize: '1.15rem', fontWeight: 700 }}>{card.pattern}</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{card.ko}</span>
          <button type="button" className="chip" style={{ marginLeft: 'auto' }} onClick={onClose}>닫기</button>
        </div>
        {card.explain && (
          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 10 }}>{card.explain}</p>
        )}
        {card.contrast && (
          <p style={{ fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: 10 }}>🇰🇷 {card.contrast}</p>
        )}
        {card.ex && (
          <div style={{ fontSize: '0.95rem', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <JaText ja={card.ex.ja} yomi={card.ex.yomi} />
            {card.ex.ko && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>{card.ex.ko}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 글 뷰어 — 문장별 어시스트 계층(원문 → 요미 → 한국어, 문장 단위 토글).
 * 상단 신규 문형 칩 → 사전 카드 팝오버. 읽기 후 "문제 풀기" → 문항 흐름.
 */
export default function ReadingTextView({ text, onPass, onBack, saving = false }) {
  const [revealed, setRevealed] = useState({}); // 문장 index → 한국어 뜻 펼침 여부
  // 후리가나 루비 — 기본 표시(초심자 배려)하되, 사용자가 끄면 localStorage에 기억한다.
  // (컴포넌트 상태만 쓰면 글을 열 때마다 ON으로 되살아나 오너 리포트의 "자꾸 자동으로 켜짐"이 된다.)
  // SSR 하이드레이션 불일치를 피하려고 초기값은 true, 마운트 후 저장값을 적용한다.
  const [furigana, setFurigana] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(FURIGANA_PREF_KEY) === '0') setFurigana(false); } catch { /* 무시 */ }
  }, []);
  const [card, setCard] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const bodyRef = useRef(null);

  const toggleKo = (i) => setRevealed((prev) => ({ ...prev, [i]: !prev[i] }));
  // narr 문단이 섞인 그레이디드 리더 형식인지 — ja 없는 body 항목이 하나라도 있으면 참
  const graded = (text.body || []).some((b) => b.narr != null);

  const questions = useMemo(() => (text.questions || []).map((q, i) => normalizeQuestion(q, `${text.id}-q${i}`)), [text]);

  const placeName = typeof text.place === 'string' ? text.place : text.place?.ja || text.place?.name;

  return (
    <div>
      {/* 저장(기록) 진행 중엔 이탈 비활성(P2-4) — 게이트가 저장을 계속하므로 완료 후 목록으로 */}
      <button type="button" className="chip" onClick={onBack} disabled={saving} style={{ marginBottom: 12, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>← 목록</button>

      <header style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          글 {text.order} · {placeName} · {text.situation}
        </div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: 4 }} lang="ja">{text.title}</h1>
      </header>

      {/* 신규 문형 칩 — 탭 시 사전 카드 */}
      {(text.patternCards || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 6 }}>이 글의 신규 문형 — 탭하면 설명</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(text.patternCards || []).map((c) => (
              <button key={c.pattern} type="button" className="chip" lang="ja" onClick={() => setCard(c)}>
                {c.pattern}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 본문 — 이야기(한국어 내레이션) + 학습 문장(일본어 카드) */}
      <div ref={bodyRef} className="card" style={{ padding: '18px 16px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: '1 1 180px' }}>
            {graded
              ? '일본어 문장을 탭하면 한국어 뜻이 열려요. 후리가나(요미)는 위 버튼으로 켜고 끌 수 있어요.'
              : '일본어 문장을 탭하면 한국어 뜻이 열려요.'}
          </div>
          <button
            type="button"
            className="chip"
            aria-pressed={furigana}
            onClick={() => setFurigana((v) => {
              const next = !v;
              try { localStorage.setItem(FURIGANA_PREF_KEY, next ? '1' : '0'); } catch { /* 무시 */ }
              return next;
            })}
            style={{ flex: '0 0 auto', opacity: furigana ? 1 : 0.55 }}
          >
            {furigana ? '가나 ON' : '가나 OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(text.body || []).map((b, i) => {
            // 내레이션 문단 — 이야기용 세리프 본문 타이포
            if (b.narr != null) {
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: 'var(--font-serif, Georgia, "Nanum Myeongjo", "Apple SD Gothic Neo", serif)',
                    fontSize: '1.02rem',
                    lineHeight: 1.9,
                    color: 'var(--text-primary, var(--text-secondary))',
                    margin: '4px 0',
                    letterSpacing: '0.01em',
                  }}
                >
                  {b.narr}
                </p>
              );
            }
            // 학습 대상 일본어 문장 카드
            const open = !!revealed[i];
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => toggleKo(i)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleKo(i))}
                style={{
                  cursor: 'pointer',
                  background: 'var(--surface-2, rgba(127,127,127,0.06))',
                  borderLeft: '3px solid var(--accent, var(--brand, #6c7cff))',
                  borderRadius: '4px 8px 8px 4px',
                  padding: '11px 13px',
                }}
              >
                <div lang="ja" style={{ fontSize: '1.12rem', lineHeight: furigana ? 2.1 : 1.7 }}>
                  {furigana ? (
                    <JaText ja={b.ja} yomi={b.yomi} fallbackPron={false} />
                  ) : (
                    <span lang="ja">{b.ja}</span>
                  )}
                </div>
                {open ? (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 6 }}>{b.ko}</div>
                ) : (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>탭하면 한국어 뜻 ▾</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!quizOpen ? (
        <button type="button" className="btn btn--primary btn--md" onClick={() => setQuizOpen(true)}>
          문제 풀기 →
        </button>
      ) : (
        <section className="card" style={{ padding: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>문항</h2>
          <QuestionFlow
            questions={questions}
            textId={text.id}
            onScrollToEvidence={() => bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onPass={onPass}
            passLabel="통과"
          />
        </section>
      )}

      <PatternCard card={card} onClose={() => setCard(null)} />
    </div>
  );
}

/**
 * 드릴 뷰 — 같은 문항 흐름의 간소판(items 전부 정답 = 통과).
 * 드릴 items: { q, ja?, choices, answer, why }
 */
export function ReadingDrillView({ drill, drillId, onPass, onBack, saving = false }) {
  const [card, setCard] = useState(null);

  const questions = useMemo(() => {
    return (drill.items || []).map((it, i) => ({
      key: `${drillId}-i${i}`,
      id: it.id, // 안정 문항 id(detail 보존용) — item_key 는 문형(pattern) 단위 집계(P2-6)
      qtype: 'pattern',
      // 드릴 이벤트 키는 **문형(it.pattern)** 단위 — drillId 로 뭉치면 드릴 A 의 〜は/〜を 가
      // 한 키로 합쳐져 문형별 약점 신호가 소실된다. pattern 문항과 같은 키 규약으로 정합(P2-6).
      // 문형 누락 시에만 drillId 로 폴백(이벤트 유실 방지).
      itemKey: it.pattern || drillId,
      prompt: it.q,
      contextJa: it.ja || null,
      choices: it.choices,
      answerText: it.choices[it.answer],
      gating: true,
      why: it.why || '',
    }));
  }, [drill, drillId]);

  return (
    <div>
      {/* 저장 진행 중엔 이탈 비활성(P2-4) */}
      <button type="button" className="chip" onClick={onBack} disabled={saving} style={{ marginBottom: 12, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>← 목록</button>
      <header style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>드릴</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{drill.title}</h1>
      </header>

      {(drill.patternCards || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(drill.patternCards || []).map((c) => (
            <button key={c.pattern} type="button" className="chip" lang="ja" onClick={() => setCard(c)}>
              {c.pattern}
            </button>
          ))}
        </div>
      )}

      <section className="card" style={{ padding: '16px' }}>
        <QuestionFlow questions={questions} textId={drillId} onPass={onPass} passLabel="통과" />
      </section>

      <PatternCard card={card} onClose={() => setCard(null)} />
    </div>
  );
}
