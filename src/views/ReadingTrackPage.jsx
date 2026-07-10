'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { logReviewEvents } from '../lib/reviewEvents';
import { enqueueGrammarReview } from '../lib/grammarSrs';
import {
  READING_LANG,
  readingSlug,
  loadPassedTexts,
  markReadingPassedLocal,
  markReadingPassedRemote,
  pullReadingProgress,
  pullApplies,
  buildNodes,
  nodeStates,
  computeTrackProgress,
  createPassGate,
} from '../lib/readingProgress';
import ReadingTextView, { ReadingDrillView } from './ReadingTextView';

/**
 * 독해 트랙 페이지 — "도쿄 도착"(JA N5 파일럿).
 *
 * 계정 전환 격리(P1-4): 내부 상태 루트(ReadingTrack)를 `user?.id ?? 'guest'` 키로 **remount** 한다.
 * auth 가 바뀌면 이전 계정의 활성 문항·통과 상태·in-flight 기록이 통째로 폐기되고 새 계정으로
 * 처음부터 재조회된다 — A 계정의 활성 문항 결과가 B 로 기록되는 교차 오염을 막는 가장 확실한 경계다.
 * 서버 payload(track prop)는 이전 계정 기준으로 렌더됐을 수 있어, 전환 감지 시 router.refresh 로
 * 새 계정용 payload 를 다시 받는다(이 바깥 컴포넌트는 전환에도 유지되므로 refresh 를 소유).
 */
export default function ReadingTrackPage({ track }) {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.id ?? 'guest';
  const prevUidRef = useRef(uid);
  useEffect(() => {
    if (prevUidRef.current === uid) return; // 최초 마운트는 서버 payload 가 이미 정합 — refresh 불필요
    prevUidRef.current = uid;
    // 계정 전환 — 새 계정용 서버 payload(열린 노드·스트립 범위) 재조회. 상태 폐기는 아래 key remount 담당.
    router.refresh();
  }, [uid, router]);

  return <ReadingTrack key={uid} track={track} user={user} />;
}

/**
 * 트랙 상태 루트(계정별 remount 단위) — 글 목록·뷰어·통과 기록.
 * 기록: user_ref_progress(rt: slug) + localStorage Set + review_events + 글 단위 grammar_review.
 */
function ReadingTrack({ track, user }) {
  const router = useRouter();
  const [passedSet, setPassedSet] = useState(() => new Set());
  const [active, setActive] = useState(null); // 열려 있는 노드 id (null = 목록)
  // 통과 저장 게이트(P2-4) — 노드별 진행 중 Promise Map + 직렬 체인을 캡슐화한다. 같은 노드
  // 재진입은 진행 중 Promise 를 그대로 반환해 'await undefined'(성공 오인)를 막고, 서로 다른
  // 노드는 직렬화로 경합 유실을 막는다. useRef 로 계정별 remount 시 새 게이트로 초기화된다.
  const gateRef = useRef(null);
  if (!gateRef.current) gateRef.current = createPassGate();
  // 실패 저장의 재시도 페이로드(events)를 노드 키로 보존 — 이탈 후 재열람 시 같은 페이로드로 재-push.
  const pendingEventsRef = useRef(new Map());
  const [saveError, setSaveError] = useState(() => new Set()); // 실패 노드 id 보존(재열람 재시도 UI 복원)
  const [savingNode, setSavingNode] = useState(null); // 현재 저장 중 node id — 뷰어 '← 목록' 이탈 비활성
  const [restore, setRestore] = useState(false); // 재열람 시 저장 상태 복원 패널 표시(활성 세션 UI 와 분리)

  // 프레시 마운트(계정별) — 로컬 로드 + 로그인 시 서버 병합(rt: 행만, 챕터 진도 오염 0).
  // 계정 전환은 상위 key remount 로 이 effect 가 새 계정에서 처음부터 다시 돈다.
  useEffect(() => {
    const reqUid = user?.id; // pull 요청 시점 uid — stale pull 폐기 태그(P1-4)
    setPassedSet(loadPassedTexts(reqUid));
    if (!reqUid) return undefined;
    let alive = true;
    pullReadingProgress(reqUid).then((changed) => {
      // 언마운트(전환)됐거나 uid 가 바뀌었으면 결과 폐기 — pullApplies 로 태그 검증.
      if (!alive || !pullApplies(reqUid, user?.id)) return;
      if (changed) setPassedSet(loadPassedTexts(reqUid));
    }).catch(() => {}); // bulk push 실패 등은 마운트 경로에선 조용히 무시(다음 pull 이 재시도)
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodes = useMemo(() => (track ? buildNodes(track) : []), [track]);
  const stated = useMemo(() => nodeStates(nodes, passedSet), [nodes, passedSet]);
  const progress = useMemo(
    () => (track ? computeTrackProgress(track, passedSet) : null),
    [track, passedSet]
  );

  // 훅 순서 보존을 위해 early return 앞에서 파생(훅 아님) — 아래 가드 effect 들이 쓴다
  const activeNode = active ? stated.find((n) => n.id === active) : null;

  // 잠금 회귀 가드(P1-4) — passedSet 재로드(전환·pull) 후 현재 열린 노드가 locked 가 되면 강제 닫기.
  // 선행 노드 미통과 상태로 열려 있던 문항을 그대로 두면 잠금 체인을 우회해 기록될 수 있다.
  const activeLocked = !!(activeNode && activeNode.status === 'locked');
  useEffect(() => {
    if (activeLocked) setActive(null);
  }, [activeLocked]);

  // 스트립 노드 열람 가드 — 서버는 열린 노드까지만 문항을 내려주므로(P2-7, readingPayload.js)
  // 로컬 진도가 서버 payload 보다 앞서면(멀티 기기·통과 직후 재조회 경합 잔재) 문항 미수신
  // 상태로 열릴 수 있다. 로그인 상태면 서버 재조회로 자동 회복한다(게스트는 로그인 안내 UI).
  const activeStripped = !!(activeNode && activeNode.ref?.stripped);
  useEffect(() => {
    if (activeStripped && user?.id) router.refresh();
  }, [activeStripped, user?.id, router]);

  if (!track) {
    return (
      <div className="page-container" style={{ maxWidth: 720 }}>
        <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>트랙을 불러올 수 없어요.</p>
      </div>
    );
  }

  // 노드 열기 — 재열람 시 보존된 저장 실패/진행이 있으면 복원 패널로 연다(활성 세션 UI 와 분리).
  function openNode(id) {
    setActive(id);
    setRestore(saveError.has(id) || savingNode === id);
  }
  // 뷰어 닫기 — 복원 플래그도 해제. 저장은 게이트가 계속 진행하므로 이탈해도 유실되지 않는다.
  function closeViewer() {
    setActive(null);
    setRestore(false);
  }

  // 통과 시점 기록 배선 — 로컬 Set·서버 upsert·review_events·글 단위 SRS 큐.
  // 반환 Promise 는 뷰어(QuestionFlow)가 await 한다: 성공(resolve) 후에만 완료 화면·다음 이동이
  // 열리고, 실패(reject) 시 뷰어가 "기록 중…"→재시도 UI 로 전환한다(P2-4·P2-8).
  // 게이트가 노드별 진행 중 Promise 를 반환하므로 재진입(빠른 이중 클릭·이탈 후 재완료)도
  // 같은 저장을 await 한다 — 기록·이벤트는 정확히 1회, undefined 즉시 성공 오인 없음(P2-4).
  function handlePass(node, events) {
    pendingEventsRef.current.set(node.id, events); // 재시도 페이로드 보존(재-push 시 재사용)
    setSaveError((s) => { if (!s.has(node.id)) return s; const n = new Set(s); n.delete(node.id); return n; });
    setSavingNode(node.id); // 저장 시작 — 이탈 비활성
    return gateRef.current.run(node.id, () => doPass(node, events)).then(
      (r) => {
        pendingEventsRef.current.delete(node.id);
        setSavingNode((c) => (c === node.id ? null : c));
        return r; // 성공 — 뷰어 완료 화면
      },
      (e) => {
        setSavingNode((c) => (c === node.id ? null : c));
        setSaveError((s) => new Set(s).add(node.id)); // 실패 보존(재열람 재시도 UI 복원)
        throw e; // 뷰어(활성 세션)로 전파 — 즉시 재시도 UI
      }
    );
  }

  // 단일 노드 통과 처리 — 로컬 기록 → 원격 upsert 확인 → pull → refresh 를 이 순서로 직렬화한다.
  // 원격 upsert 가 성공한 뒤에야(P2-8) 다음 단계로 진행하므로, refresh 시점엔 서버가 이번 통과를
  // 반드시 알고 있어 다음 노드 문항(선전송 제거된 P2-6)이 경합 없이 채워진다.
  async function doPass(node, events) {
    const next = markReadingPassedLocal(node.id, user?.id);
    setPassedSet(next);
    if (!user?.id) return; // 게스트 — 서버 payload 는 order 1 고정이라 재조회 무의미(로그인 안내 UI 담당)
    const ok = await markReadingPassedRemote(user.id, node.id);
    if (!ok) throw new Error('reading pass upsert failed'); // {error} → 뷰어 재시도 UI(재-push)
    logReviewEvents(user.id, events); // lang:'Japanese', source:'reading' — rung 미연결(vocab 전용)
    // 글 단위 재검증: grammar_review 에 rt: slug 등록(드릴은 글 단위 SRS 대상 아님)
    if (node.kind === 'text') enqueueGrammarReview(user.id, READING_LANG, readingSlug(node.id));
    // 다음 노드 문항 확보 — 서버는 열린 노드까지만 문항을 내려주므로(P2-6 선전송 제거) 재조회 필수.
    // pullReadingProgress 가 로컬 전용 통과분을 await 업서트하므로, 완료 시점엔 서버가 이번 통과를
    // 반드시 안다 — 그 뒤 refresh 는 경합 없이 다음 문항을 받는다.
    const changed = await pullReadingProgress(user.id);
    if (changed) setPassedSet(loadPassedTexts(user.id)); // 병합으로 타 기기 진도가 들어왔으면 반영
    router.refresh();
  }

  // ── 글/드릴 뷰어 ──
  if (activeNode) {
    // 스트립 노드 — 문항이 서버 payload 에 없다(readingPayload.js 의 stripped 표식).
    // 원래 빈 문항과 구분되는 명시 표식이므로 뷰어 대신 회복 UI 를 띄운다:
    // 로그인 사용자는 위 가드 effect 의 재조회를 기다리고, 게스트는 여기가 잠금 경계다.
    if (activeNode.ref?.stripped) {
      return (
        <div className="page-container" style={{ maxWidth: 720 }}>
          <button type="button" className="chip" onClick={closeViewer} style={{ marginBottom: 12 }}>← 목록</button>
          <div className="card" style={{ padding: '28px 18px', textAlign: 'center' }}>
            {user?.id ? (
              <>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                  문항을 불러오는 중이에요…
                </p>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => router.refresh()}>
                  다시 시도
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                  여기서부터는 로그인해야 진도가 저장되고 다음 글의 문항이 열려요.
                </p>
                <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
              </>
            )}
          </div>
        </div>
      );
    }
    // 재열람 복원 패널(P2-4) — 저장 중 이탈 후 다시 연 노드는 뷰어 대신 저장 상태를 복원한다.
    // '기록 중…'(진행)이면 이탈 비활성(← 목록 없음), 실패면 같은 페이로드로 재-push 재시도.
    // 저장은 게이트가 계속 진행하므로 이탈해도 유실되지 않고, 성공 시 목록으로 돌아가 ✓ 로 보인다.
    if (restore) {
      const isSaving = savingNode === activeNode.id;
      const isError = saveError.has(activeNode.id);
      const retry = () => {
        const ev = pendingEventsRef.current.get(activeNode.id);
        handlePass(activeNode, ev).then(() => closeViewer()).catch(() => {}); // 성공 시 목록 복귀
      };
      return (
        <div className="page-container" style={{ maxWidth: 720 }}>
          {!isSaving && (
            <button type="button" className="chip" onClick={closeViewer} style={{ marginBottom: 12 }}>← 목록</button>
          )}
          <div className="card" style={{ padding: '28px 18px', textAlign: 'center' }}>
            {isSaving ? (
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0 }}>기록 중이에요…</p>
            ) : isError ? (
              <>
                <p style={{ fontSize: '0.92rem', color: 'var(--danger)', marginBottom: 14 }}>
                  기록에 실패했어요. 다시 시도해 주세요.
                </p>
                <button type="button" className="btn btn--primary btn--md" onClick={retry}>다시 시도</button>
              </>
            ) : (
              // 저장이 이미 정리된 노드(경합 잔재) — 목록으로 안내
              <button type="button" className="btn btn--secondary btn--sm" onClick={closeViewer}>목록으로</button>
            )}
          </div>
        </div>
      );
    }
    if (activeNode.kind === 'text') {
      return (
        <div className="page-container" style={{ maxWidth: 720 }}>
          <ReadingTextView
            text={activeNode.ref}
            saving={savingNode === activeNode.id}
            onPass={(events) => handlePass(activeNode, events)}
            onBack={closeViewer}
          />
        </div>
      );
    }
    return (
      <div className="page-container" style={{ maxWidth: 720 }}>
        <ReadingDrillView
          drill={activeNode.ref}
          drillId={activeNode.id}
          saving={savingNode === activeNode.id}
          onPass={(events) => handlePass(activeNode, events)}
          onBack={closeViewer}
        />
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Link href="/lessons?lang=Japanese" className="chip">← 교재</Link>
        <span className="chip" style={{ background: 'var(--warning)', color: '#fff', fontWeight: 700 }}>파일럿</span>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0 2px' }}>{track.title}</h1>
      <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        실존 지명 여행 이야기를 쉬운 것부터 차례로 — 글을 다 읽고 문형 문항을 통과하면 다음 글이 열려요.
      </p>

      {/* 진도 헤더 */}
      {progress && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, fontSize: '0.9rem', fontWeight: 600 }}>
          글 {progress.textsPassed}/{progress.textsTotal} · 문형 {progress.patternsCovered}/{progress.patternsTotal} · 예상 잔여 ~{progress.weeksRemaining}주
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stated.map((n) => {
          const locked = n.status === 'locked';
          const passed = n.status === 'passed';
          const isDrill = n.kind === 'drill';
          const label = isDrill
            ? n.ref.title
            : `글 ${n.order} · ${n.ref.title}`;
          const mark = passed ? '✓' : locked ? '🔒' : '›';
          return (
            <li key={n.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => openNode(n.id)}
                className="card"
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                  border: isDrill ? '1px dashed var(--border)' : undefined,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1rem', width: 20, textAlign: 'center', color: passed ? 'var(--success, #4caf50)' : 'var(--text-muted)' }}>{mark}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span lang="ja" style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem' }}>{label}</span>
                  {isDrill ? (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>드릴 · 통과 요건</span>
                  ) : (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {n.ref.situation}{n.ref.newPatterns?.length ? ` · 신규 문형 ${n.ref.newPatterns.length}` : ''}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
