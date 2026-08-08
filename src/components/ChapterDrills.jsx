'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import RefSpeak from './RefSpeak';
import { normalizeExerciseAnswer } from './ExerciseEnginePrototype';
import { useAuth } from '../lib/AuthContext';
import { recordChapterDrillResult, loadGuestDrillQueue } from '../lib/drillSrs';
import { countDueGrammar } from '../lib/grammarSrs';

/** 딕테 채점 — 구두점·아포스트로피 변형에는 관대, 철자·악상에는 엄격 */
// 힌트는 클릭해야 열린다 — 먼저 스스로 생각해 보게 하는 장치
function HintToggle({ hint }) {
  const [open, setOpen] = useState(false);
  if (!hint) return null;
  if (!open) {
    // 세로 패딩 1→3px: 실측 높이 23px이라 WCAG 2.5.8(AA) 최소 24px에 1px 모자랐다.
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
        힌트 보기
      </button>
    );
  }
  return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> · 힌트: {hint}</span>;
}

function dictNormalize(s) {
  return normalizeExerciseAnswer(String(s ?? '').replace(/[’]/g, "'"))
    .replace(/[.,!?…«»"”“:;—–-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(input, answer, accepts, loose) {
  const norm = loose ? dictNormalize : normalizeExerciseAnswer;
  const target = norm(input);
  return [answer, ...(accepts ?? [])].some((a) => norm(a) === target);
}

function OrderDrill({ drill, onResult, done }) {
  const tokens = useMemo(() => {
    const parts = drill.sentence.split(/\s+/);
    // 결정적 셔플(문장 기반) — 렌더마다 흔들리지 않게
    const arr = parts.map((w, i) => [w, (i * 2654435761) % 1013]);
    arr.sort((a, b) => (a[1] - b[1]) || a[0].localeCompare(b[0]));
    return arr.map(([w]) => w);
  }, [drill.sentence]);
  const [picked, setPicked] = useState([]);
  const built = picked.join(' ');
  const complete = picked.length === tokens.length;
  const correct = complete && normalizeExerciseAnswer(built) === normalizeExerciseAnswer(drill.sentence);
  return (
    <div>
      {drill.prompt && <p style={{ fontSize: '0.88rem', marginBottom: 6 }}>{drill.prompt}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tokens.map((w, i) => {
          const used = picked.includes(`${w}#${i}`);
          return (
            <button key={i} type="button" disabled={used || done}
              onClick={() => setPicked((p) => [...p, `${w}#${i}`])}
              style={{ minHeight: 44, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: used ? 'var(--bg-muted)' : 'var(--bg-secondary)', opacity: used ? 0.4 : 1 }}>
              {w}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" aria-atomic="true" style={{ minHeight: 22, fontStyle: 'italic', fontSize: '0.92rem' }}>
        {picked.map((t) => t.split('#')[0]).join(' ')}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn--sm drill-action" disabled={done} onClick={() => setPicked([])}>다시</button>
        <button type="button" className="btn btn--sm drill-action" disabled={!complete || done}
          onClick={() => onResult(normalizeExerciseAnswer(picked.map((t) => t.split('#')[0]).join(' ')) === normalizeExerciseAnswer(drill.sentence))}>
          확인
        </button>
      </div>
    </div>
  );
}

function InputDrill({ drill, lang, onResult, done, dictation }) {
  const [value, setValue] = useState('');
  const promptId = useId();
  return (
    <div>
      {dictation ? (
        <p id={promptId} style={{ fontSize: '0.88rem', marginBottom: 6 }}>
          {drill.prompt || '재생을 누르고, 들리는 문장을 그대로 입력해 보세요.'}{' '}
          <RefSpeak text={drill.sentence} lang={lang} />
        </p>
      ) : (
        <p id={promptId} style={{ fontSize: '0.95rem', marginBottom: 6 }}>{drill.prompt}<HintToggle hint={drill.hint} /></p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={value} disabled={done} onChange={(e) => setValue(e.target.value)}
          aria-labelledby={promptId}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
          placeholder={dictation ? '들리는 대로…' : '정답 입력'} lang={dictation ? undefined : 'fr'} />
        <button type="button" className="btn btn--sm drill-action" disabled={done || !value.trim()}
          onClick={() => onResult(matches(value, dictation ? drill.sentence : drill.answer, drill.accepts, dictation))}>
          확인
        </button>
      </div>
    </div>
  );
}

function ChoiceDrill({ drill, onResult, done, lang }) {
  return (
    <div>
      <p style={{ fontSize: '0.95rem', marginBottom: 8 }}>
        {drill.listen && <RefSpeak text={drill.listen} lang={lang} />}
        {drill.listen ? ' ' : ''}{drill.prompt}<HintToggle hint={drill.hint} />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drill.choices.map((c, i) => (
          <button key={i} type="button" disabled={done} onClick={() => onResult(c === drill.answer)}
            style={{ minHeight: 44, textAlign: 'left', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            {c}
          </button>
        ))}
      </div>
      {done && drill.listen && (
        <p style={{ fontSize: '0.82rem', marginTop: 8, color: 'var(--text-secondary)' }} lang="fr">들은 문장: {drill.listen}</p>
      )}
      {done && drill.speak && (
        <p style={{ fontSize: '0.85rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          실제 발음 확인: <RefSpeak text={drill.speak} lang={lang} />
        </p>
      )}
    </div>
  );
}

/**
 * 변형 드릴(RFC learning-path v1) — 새 문장으로 연습 후 관문 퀴즈(RefPatternCheck)로 가는 전 단계.
 * 채점 결과는 drill id 단위로 기존 문법 SRS와 review_events에 연결한다.
 */
// 드릴 채점 로컬 집계 — 기기에만 저장(약점 파악용). [시도, 오답] 누적.
function bumpDrillStat(lang, id, ok) {
  try {
    const key = `${lang}_drill_stats`;
    const all = JSON.parse(globalThis.localStorage?.getItem(key) ?? '{}') || {};
    const cur = Array.isArray(all[id]) ? all[id] : [0, 0];
    all[id] = [cur[0] + 1, cur[1] + (ok ? 0 : 1)];
    globalThis.localStorage?.setItem(key, JSON.stringify(all));
  } catch {}
}

function readChapterStat(lang, drills) {
  try {
    const all = JSON.parse(globalThis.localStorage?.getItem(`${lang}_drill_stats`) ?? '{}') || {};
    let t = 0;
    let w = 0;
    for (const d of drills) {
      const cur = all[d.id];
      if (Array.isArray(cur)) { t += cur[0]; w += cur[1]; }
    }
    return t > 0 ? { tries: t, right: t - w } : null;
  } catch { return null; }
}

export default function ChapterDrills({ lang, drills, title, intro }) {
  const { user } = useAuth();
  const [results, setResults] = useState({});
  const settled = useRef(new Set());
  // hydration 안전: 로컬 통계도 마운트 후에 읽는다(서버 렌더에는 없는 값).
  const [pastStat, setPastStat] = useState(null);
  const answered = Object.keys(results).length;
  const right = Object.values(results).filter(Boolean).length;

  // 로그인 유저는 서버 누적(review_events)이 정본 — 기기가 바뀌어도 기록이 이어진다.
  // source 태그는 시기별로 다르다(구 'drill' · SRS 통합 후 'grammar') — drill id가 전역
  // 유일하므로 item_key로만 거른다.
  // 게스트·초기 표시는 기기 통계로 채우고, 로그인 사용자는 아래에서 서버 값으로 덮어쓴다.
  useEffect(() => {
    setPastStat(readChapterStat(lang, drills));
  }, [lang, drills]);

  useEffect(() => {
    if (!user?.id || !Array.isArray(drills) || drills.length === 0) return undefined;
    let alive = true;
    supabase
      .from('review_events')
      .select('item_key, correct')
      .eq('user_id', user.id)
      .in('item_key', drills.map((d) => d.id))
      .limit(2000)
      .then(({ data }) => {
        if (!alive || !Array.isArray(data) || data.length === 0) return;
        setPastStat({ tries: data.length, right: data.filter((r) => r.correct).length });
      }, () => {});
    return () => { alive = false; };
  }, [user?.id, drills]);

  // 기록 정본은 drillSrs 단일 경로(review_events + FSRS 행) — 게스트 통계 카운터만 별도 유지.
  const record = (drill) => (ok) => {
    if (settled.current.has(drill.id)) return;
    settled.current.add(drill.id);
    // 로그인 사용자의 정본은 서버(review_events + FSRS)다 — 로컬 카운터를 겹쳐 쓰면 이중 집계가 된다.
    if (!user?.id) bumpDrillStat(lang, drill.id, ok);
    setResults((r) => ({ ...r, [drill.id]: ok }));
    // 기록이 실패하면 settled에서 풀어 같은 문항을 다시 시도할 수 있게 둔다(영구 차단 방지).
    Promise.resolve(recordChapterDrillResult(user?.id, { lang, drill, correct: ok }))
      .catch(() => { settled.current.delete(drill.id); });
  };
  return (
    <section className="card fr-section">
      <h2 className="fr-section__heading">{title ?? '변형 드릴 — 새 문장으로 손 풀기'}</h2>
      {pastStat && (
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          지금까지 이 챕터 드릴 {pastStat.tries}회 풀이 · 정답 {pastStat.right}회 ({Math.round((pastStat.right / pastStat.tries) * 100)}%)
        </p>
      )}
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
        {intro ?? '이 챕터의 뼈를 처음 보는 문장에 적용해 보세요. 다 풀면 아래 패턴 체크로 마무리해요.'}
      </p>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingLeft: 20, margin: 0 }}>
        {drills.map((d) => {
          const done = d.id in results;
          const ok = results[d.id];
          return (
            <li key={d.id}>
              {d.sourceLabel && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>복습 · {d.sourceLabel}</p>
              )}
              {d.type === 'choice' && <ChoiceDrill drill={d} done={done} onResult={record(d)} lang={lang} />}
              {d.type === 'fill' && <InputDrill drill={d} lang={lang} done={done} onResult={record(d)} />}
              {d.type === 'dictation' && <InputDrill drill={d} lang={lang} done={done} onResult={record(d)} dictation />}
              {d.type === 'order' && <OrderDrill drill={d} done={done} onResult={record(d)} />}
              {done && (
                <p role="status" aria-live="polite" style={{ fontSize: '0.82rem', marginTop: 6, color: ok ? 'var(--accent, #2d6a4f)' : 'var(--text-muted)' }}>
                  {ok ? '정답이에요!' : `아쉬워요 — 정답: ${d.type === 'fill' ? d.answer : d.sentence ?? d.answer}`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answered === drills.length && (
        <>
          <p role="status" aria-live="polite" style={{ marginTop: 14, fontWeight: 600, fontSize: '0.9rem' }}>
            {drills.length}문항 중 {right}개 정답 — {right === drills.length ? '완벽해요!' : '틀린 문항은 위 문형 설명을 다시 보고 와요.'}
          </p>
          <ReviewNudge userId={user?.id} />
        </>
      )}
    </section>
  );
}

function countGuestDueDrills() {
  const now = new Date().toISOString();
  return loadGuestDrillQueue().filter((r) => r?.next_review_at && r.next_review_at <= now).length;
}

/** 드릴 완주 직후 복습 동선 연결 — 방금 푼 문항은 미래 due라 '대기'엔 기존 카드만 잡힌다. */
function ReviewNudge({ userId }) {
  const [due, setDue] = useState(null);
  useEffect(() => {
    let alive = true;
    if (userId) {
      countDueGrammar(userId).then((n) => { if (alive) setDue(n); }, () => {});
    } else {
      setDue(countGuestDueDrills());
    }
    return () => { alive = false; };
  }, [userId]);
  // 게스트를 /review/grammar로 보내면 안 된다 — 그 페이지는 로그인 세션에서만 큐를 읽으므로
  // "복습 대기 N개"라고 해놓고 빈 화면이 나온다. 게스트에겐 기록이 이 기기에 남았다는 사실만
  // 정확히 알리고, 큐를 이어가려면 로그인이 필요하다고 그 자리에서 권유한다.
  if (!userId) {
    return (
      <p role="status" aria-live="polite" style={{ marginTop: 6, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
        풀이 기록은 이 기기에 쌓였어요.{' '}
        <Link href="/auth" prefetch={false} style={{ fontWeight: 600, color: 'var(--accent, #2d6a4f)' }}>
          로그인하면 며칠 뒤 복습 큐로 돌아와요 →
        </Link>
      </p>
    );
  }

  return (
    <p role="status" aria-live="polite" style={{ marginTop: 6, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
      풀이 기록은 복습 큐에 쌓였어요.{' '}
      <Link href="/review/grammar" style={{ fontWeight: 600, color: 'var(--accent, #2d6a4f)' }}>
        {typeof due === 'number' && due > 0 ? `지금 복습 대기 ${due}개 →` : '문법 복습에서 이어가기 →'}
      </Link>
    </p>
  );
}
