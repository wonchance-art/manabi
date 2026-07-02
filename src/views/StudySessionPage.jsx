'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import RefSpeak from '../components/RefSpeak';
import { JaText } from './refShared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { calculateFSRS } from '../lib/fsrs';
import { gradeGrammarReview, ratingFromScore, enqueueGrammarReview } from '../lib/grammarSrs';
import { syncCheckRemote, syncReadRemote } from '../lib/refProgress';
import { createReviewEventBatcher } from '../lib/reviewEvents';
import { recordActivity } from '../lib/streak';
import { gradeTyping, isChapterPassed, qtypeForItem, grammarDueChapterCounts } from '../lib/studySession';
import { mapParagraphToItems } from '../lib/studyParagraph';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 공부 모드 세션 — 서버가 조립한 ~12문항을 듀오링고식으로 진행한다.
 * 문항당 즉시 피드백, 오답은 세션 끝에 1회 재출제(첫 시도만 SRS·통과에 반영).
 * 종료 시: 어휘 FSRS 갱신 · 문법 due 재스케줄 · 신규 챕터 통과 처리 · 이벤트 적재.
 */
export default function StudySessionPage({
  session = null, paragraphMaterials = null, lang, langCode, langName, flag, readKey,
  band = 'beginner', languages = [], signedOut = false,
}) {
  // 입문 레벨(N5 등) 일본어 배려 — 답변 중에도 요미가나·후리가나를 보여준다.
  const kanjiCare = band === 'beginner' && langCode === 'ja';
  const { user, fetchProfile } = useAuth();
  const [queue, setQueue] = useState(() => session?.items || []);
  const [gradedBase, setGradedBase] = useState(session?.gradedCount || 0);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('answer');   // 'answer' | 'feedback'
  const [picked, setPicked] = useState(null);
  const [typing, setTyping] = useState('');
  const [orderPicks, setOrderPicks] = useState([]);
  const [firstResults, setFirstResults] = useState({}); // 원본 uid → { ok, item }
  const [requeued, setRequeued] = useState(() => new Set());
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState(() => new Set()); // 건너뛴 문항(듣기) — 집계·SRS 제외
  const [showTranslation, setShowTranslation] = useState(false);
  // 문단 생성 — 재료가 있으면 세션 시작 전에 오늘의 문단을 만든다. 실패 시 폴백(조립 세션).
  const [genStatus, setGenStatus] = useState(paragraphMaterials ? 'loading' : 'off');
  const genRan = useRef(false);
  const effectsFired = useRef(false);
  // 문항 확정(settle) 시점 사이드이펙트용 refs (렌더 유발 없이 동기 접근)
  const batcherRef = useRef(null);                 // review_events 마이크로배치 큐
  const grammarAggRef = useRef(new Map());         // slug → { srs, right, total } 챕터별 누적
  const recordedRef = useRef(new Set());           // 이미 기록한 orig uid (중복 방지)
  const itemShownAtRef = useRef(Date.now());       // 현재 문항 표시 시각 (rt_ms 계산)

  useEffect(() => {
    if (!paragraphMaterials || genRan.current) return;
    genRan.current = true;
    (async () => {
      try {
        let authHeader = {};
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s?.access_token) authHeader = { Authorization: `Bearer ${s.access_token}` };
        } catch {}
        const res = await fetch('/api/study-paragraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            language: paragraphMaterials.language,
            level: paragraphMaterials.level,
            newPattern: paragraphMaterials.newPattern,
            duePatterns: paragraphMaterials.duePatterns.map(p => ({ pattern: p.pattern, patternKo: p.patternKo })),
            dueWords: paragraphMaterials.dueWords.map(w => ({ word: w.word, meaning: w.meaning })),
            newWords: paragraphMaterials.newWords.map(w => ({ word: w.word, meaning: w.meaning })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.paragraph) {
          const mapped = mapParagraphToItems(data.paragraph, paragraphMaterials);
          if (mapped.gradedCount >= 3) {
            setQueue(mapped.items);
            setGradedBase(mapped.gradedCount);
            setGenStatus('ready');
            return;
          }
        }
        setGenStatus('fallback');
      } catch {
        setGenStatus('fallback');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = queue[idx] || null;

  // 문항 표시 시각 기록 — settle까지의 응답 시간(rt_ms) 계산용
  useEffect(() => { itemShownAtRef.current = Date.now(); }, [item?.uid]);

  // 문법 due 챕터별 문항 수 (재출제 제외) — 챕터 마지막 문항 판정에 사용
  const grammarCounts = useMemo(
    () => grammarDueChapterCounts(queue.filter(it => !String(it.uid).endsWith('-r'))),
    [queue]
  );

  // 문항별 셔플 보기·토큰 (uid 기준 1회)
  const prepared = useMemo(() => {
    if (!item) return null;
    if (item.options) return { options: shuffle(item.options) };
    if (item.quiz?.tokens) return { bank: shuffle(item.quiz.tokens.map((t, ti) => ({ t, ti }))) };
    if (item.quiz?.distractors) return { options: shuffle([item.quiz.correct, ...item.quiz.distractors.slice(0, 3)]) };
    return {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.uid]);

  const gradedTotal = Math.max(0, gradedBase - skipped.size);
  const firstAnswered = Object.keys(firstResults).length;
  const rightCount = Object.values(firstResults).filter(r => r.ok).length;

  function baseUid(u) { return String(u).replace(/-r$/, ''); }

  /** 듣기 문항 건너뛰기 — 채점 없이 다음으로 (집계·SRS 제외) */
  function skipItem() {
    if (!item || phase === 'feedback') return;
    setSkipped(prev => new Set(prev).add(baseUid(item.uid)));
    next();
  }

  /** review_events 마이크로배치 큐 — user 확정 후 1회 생성 */
  function getBatcher() {
    if (!batcherRef.current && user?.id) {
      batcherRef.current = createReviewEventBatcher(user.id, { size: 4 });
    }
    return batcherRef.current;
  }

  /**
   * 문항 확정 시점 사이드이펙트 (첫 시도만) —
   * 이벤트 즉시 적재(마이크로배치) · 어휘 FSRS 갱신 · 문법 챕터 마지막 문항에서 재스케줄.
   * 중도 이탈해도 여기까지의 기록은 남는다.
   */
  function recordSettle(ok, it) {
    if (!user?.id || !it?.effect) return;
    const batcher = getBatcher();
    const rt_ms = Date.now() - itemShownAtRef.current;
    const qtype = qtypeForItem(it.type);
    const eff = it.effect;

    if (eff.kind === 'vocab') {
      const w = it.word;
      const nextStats = calculateFSRS(ok ? 3 : 1, {
        interval: w.interval ?? 0, ease_factor: w.ease_factor ?? 0,
        repetitions: w.repetitions ?? 0, next_review_at: w.next_review_at,
      });
      supabase.from('user_vocabulary')
        .update({ ...nextStats, last_reviewed_at: new Date().toISOString() })
        .eq('id', w.id).then(() => {}, () => {});
      batcher?.add({ lang, source: 'vocab', item_key: w.word_text, correct: ok, detail: { word_id: w.id, meaning: w.meaning, mode: 'study', qtype, rt_ms } });
    } else if (eff.kind === 'grammar-due') {
      const slug = eff.srs.slug;
      batcher?.add({ lang, source: 'grammar', item_key: slug, correct: ok, detail: { ko: it.quiz?.ko, mode: 'study', qtype, rt_ms } });
      // 챕터별 정답 누적 → 마지막 문항에서 챕터 정답률로 재스케줄
      const agg = grammarAggRef.current.get(slug) || { srs: eff.srs, right: 0, total: 0 };
      agg.total++; if (ok) agg.right++;
      grammarAggRef.current.set(slug, agg);
      if (agg.total >= (grammarCounts[slug] || 0)) {
        gradeGrammarReview({ ...agg.srs, user_id: user.id }, ratingFromScore(agg.right, agg.total));
      }
    } else if (eff.kind === 'new-chapter') {
      // 통과 판정은 세션 말미(fireEffects)에서 — 여기선 이벤트만 즉시 적재
      batcher?.add({ lang, source: 'grammar', item_key: eff.meta.slug, correct: ok, detail: { ko: it.quiz?.ko, mode: 'study', qtype, rt_ms } });
    } else if (eff.kind === 'reading') {
      batcher?.add({ lang, source: 'reading', item_key: String(eff.key).slice(0, 80), correct: ok, detail: { mode: 'study', qtype, rt_ms } });
    }
  }

  /** 채점 확정 — 첫 시도만 집계·기록, 오답은 재출제 예약 */
  function settle(ok, pickedValue = null) {
    if (!item || phase === 'feedback') return;
    setPicked(pickedValue);
    setPhase('feedback');
    const orig = baseUid(item.uid);
    const isRetryItem = String(item.uid).endsWith('-r');
    if (!(orig in firstResults)) {
      setFirstResults(prev => ({ ...prev, [orig]: { ok, item } }));
      if (!ok && !requeued.has(orig)) {
        setRequeued(prev => new Set(prev).add(orig));
        setQueue(prev => [...prev, { ...item, uid: `${orig}-r` }]);
      }
    }
    // 재출제(-r)는 기록·SRS 제외. 첫 시도만 1회 기록.
    if (!isRetryItem && !recordedRef.current.has(orig)) {
      recordedRef.current.add(orig);
      recordSettle(ok, item);
    }
  }

  function next() {
    setPicked(null);
    setTyping('');
    setOrderPicks([]);
    setPhase('answer');
    if (idx + 1 >= queue.length) {
      setFinished(true);
      fireEffects();
    } else {
      setIdx(i => i + 1);
    }
  }

  /**
   * 세션 종료 사이드이펙트 — 1회.
   * 문항별 기록(이벤트·어휘 FSRS·문법 재스케줄)은 settle 시점에 이미 처리됐고,
   * 여기선 세션 전체로만 판정 가능한 것들만 남긴다:
   *  신규 챕터 통과 판정 · 새 단어 자동 등록 · 잔여 이벤트 flush · 활동 기록.
   */
  function fireEffects() {
    if (effectsFired.current || !user?.id) return;
    effectsFired.current = true;
    const results = Object.values(firstResults);

    // 신규 챕터 → 통과 판정 (통과 시 교재 진도·복습 큐에 연결)
    const newItems = results.filter(r => r.item.effect?.kind === 'new-chapter');
    if (newItems.length > 0) {
      const meta = newItems[0].item.effect.meta;
      const right = newItems.filter(r => r.ok).length;
      const passedNow = isChapterPassed(right, newItems.length);
      const checkResult = { right, total: newItems.length, passed: passedNow, at: Date.now() };
      try {
        const map = JSON.parse(localStorage.getItem(`${readKey}_check`) || '{}');
        map[meta.slug] = checkResult;
        localStorage.setItem(`${readKey}_check`, JSON.stringify(map));
        const reads = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'));
        reads.add(meta.slug);
        localStorage.setItem(readKey, JSON.stringify([...reads]));
      } catch {}
      syncReadRemote(user.id, lang, meta.slug);
      syncCheckRemote(user.id, lang, meta.slug, checkResult);
      if (passedNow) enqueueGrammarReview(user.id, lang, meta.slug);
    }

    // 오늘 배운 새 단어 → 단어장 등록 (FSRS 복습 루프 진입)
    if (genStatus === 'ready' && paragraphMaterials?.newWords?.length) {
      for (const w of paragraphMaterials.newWords) {
        const row = {
          user_id: user.id,
          word_text: w.word,
          base_form: w.word,
          furigana: w.pron || '',
          meaning: w.meaning,
          pos: '',
          language: lang,
          source_ref: '오늘 학습',
        };
        supabase.from('user_vocabulary').insert(row).then(({ error: err }) => {
          if (err && /column|schema/i.test(err.message || '')) {
            const { source_ref, base_form, ...base } = row;
            supabase.from('user_vocabulary').insert(base).then(() => {}, () => {});
          }
        }, () => {});
      }
    }

    // 잔여 이벤트 flush (마지막 마이크로배치)
    batcherRef.current?.flush();
    recordActivity(user.id, () => fetchProfile?.(user.id));
  }

  const renderMain = (text, pron) =>
    langCode === 'ja'
      ? <JaText ja={text} yomi={pron} />
      : <>{text}{pron && <span className="fr-check__pron"> {pron}</span>}</>;

  // ── 비로그인 ──
  if (signedOut) {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>오늘 학습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          로그인하면 어휘·문법·독해가 섞인 맞춤 세션으로 매일 이어서 학습할 수 있어요.
        </p>
        <Link href="/auth" className="btn btn--primary btn--md">로그인 →</Link>
      </div>
    );
  }

  // ── 오늘의 문단 생성 중 ──
  if (genStatus === 'loading') {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }} aria-hidden="true">✍️</div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>오늘의 문단을 만드는 중…</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          새로 배울 문법·단어와 복습할 것들을<br />하나의 이야기로 엮고 있어요
        </p>
      </div>
    );
  }

  // ── 세션 재료 부족 ──
  if (gradedBase === 0) {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>{flag} {langName} 학습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          아직 세션을 만들 재료가 부족해요. 교재를 한 챕터 읽거나 단어를 몇 개 모으면 시작할 수 있어요.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/lessons" className="btn btn--primary btn--md">교재 보기 →</Link>
          <Link href="/materials" className="btn btn--ghost btn--md">자료 읽기 →</Link>
        </div>
      </div>
    );
  }

  // ── 결과 화면 ──
  if (finished) {
    const newItems = Object.values(firstResults).filter(r => r.item.effect?.kind === 'new-chapter');
    const newMeta = newItems[0]?.item.effect.meta || session.newChapter;
    const newRight = newItems.filter(r => r.ok).length;
    const chapterPassed = newItems.length > 0 && isChapterPassed(newRight, newItems.length);
    const wrong = Object.values(firstResults).filter(r => !r.ok);
    const pct = gradedTotal ? Math.round((rightCount / gradedTotal) * 100) : 0;
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ textAlign: 'center', margin: '28px 0 20px' }}>
          <div style={{
            width: 92, height: 92, borderRadius: '50%', margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `6px solid ${pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'}`,
            fontSize: '1.5rem', fontWeight: 800,
          }}>{pct}%</div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>세션 완료</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {gradedTotal}문항 중 {rightCount}개 정답
            {skipped.size > 0 && ` · 듣기 ${skipped.size}개 건너뜀`}
            {' '}· 결과는 복습 스케줄에 반영됐어요
          </p>
          {genStatus === 'ready' && paragraphMaterials?.newWords?.length > 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
              새 단어 {paragraphMaterials.newWords.length}개({paragraphMaterials.newWords.map(w => w.word).join(' · ')})가 단어장에 추가돼 복습이 시작돼요
            </p>
          )}
        </div>

        {newMeta && newItems.length > 0 && (
          <Link href={newMeta.href} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 12 }}>
            <span style={{ fontSize: '1.3rem' }} aria-hidden="true">{chapterPassed ? '🎉' : '📖'}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700 }}>
                {chapterPassed ? '새 챕터 통과!' : '새 챕터 — 다음 세션에서 다시'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {newMeta.level} #{newMeta.order} {newMeta.title} · {newRight}/{newItems.length}
                {chapterPassed && ' · 며칠 뒤 복습으로 돌아와요'}
              </span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>
          </Link>
        )}

        {wrong.length > 0 && (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>다시 볼 것 {wrong.length}개</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {wrong.map((r, i) => (
                <li key={i} style={{ fontSize: '0.85rem', lineHeight: 1.6 }} lang={langCode}>
                  {r.item.word ? `${r.item.word.word_text} — ${r.item.word.meaning}`
                    : r.item.quiz ? (r.item.quiz.full || r.item.quiz.answer)
                    : r.item.sentence?.main}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <a href={`/study?lang=${lang}`} className="btn btn--primary btn--md" style={{ flex: 1.4, textAlign: 'center' }}>한 세션 더 →</a>
          <Link href="/lessons" className="btn btn--ghost btn--md" style={{ flex: 1, textAlign: 'center' }}>교재로</Link>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          파트별 연습: <Link href="/vocab" style={{ textDecoration: 'underline' }}>어휘</Link> ·{' '}
          <Link href="/review/grammar" style={{ textDecoration: 'underline' }}>문법 복습</Link> ·{' '}
          <Link href="/writing" style={{ textDecoration: 'underline' }}>작문</Link>
        </p>
      </div>
    );
  }

  // ── 진행 화면 ──
  const isRetry = item && item.uid.endsWith('-r');
  const q = item?.quiz;

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      {/* 헤더 — 나가기 · 진행바 · 언어 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 20px' }}>
        <Link href="/home" aria-label="나가기" style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>✕</Link>
        <div style={{ flex: 1, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)',
            width: `${gradedTotal ? Math.round((firstAnswered / gradedTotal) * 100) : 0}%`, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>
          {flag} {firstAnswered}/{gradedTotal}
        </span>
      </div>

      {isRetry && (
        <div style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 700, marginBottom: 8 }}>↻ 다시 도전</div>
      )}

      {/* ── 오늘의 문단 (읽기 카드) ── */}
      {item.type === 'paragraph' && (
        <div className="card" style={{ padding: '22px 20px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
            오늘의 문단
            {item.newChapter && <> · 새 문법 {item.newChapter.level} #{item.newChapter.order} {item.newChapter.title}</>}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>
            새로 배울 것과 복습할 것이 한 이야기에 담겨 있어요. 천천히 읽고, 이어지는 문제로 확인해요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {item.sentences.map((s, i) => (
              <div key={i} style={{ fontSize: '1.05rem', lineHeight: 2 }} lang={langCode}>
                {renderMain(s.text, s.pron)}
                <RefSpeak text={s.text} lang={lang} size="xs" />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowTranslation(v => !v)}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 14, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            {showTranslation ? '번역 접기 ▴' : '번역 보기 ▾'}
          </button>
          {showTranslation && (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 8, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              {item.translation}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <Button onClick={next} style={{ flex: 1 }}>문제 풀기 →</Button>
            {item.newChapter && (
              <Link href={item.newChapter.href} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline', flexShrink: 0 }}>
                새 문법 자세히
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── 티칭 카드 ── */}
      {item.type === 'teach' && (
        <div className="card" style={{ padding: '22px 20px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
            새로 배우기 · {item.chapter.level} #{item.chapter.order} {item.chapter.title}
          </div>
          <div className="fr-pattern" style={{ borderColor: 'var(--primary)' }}>
            <div className="fr-pattern__text" lang={langCode}>{item.pattern}</div>
            {item.patternKo && <div className="fr-pattern__ko">{item.patternKo}</div>}
          </div>
          <ul className="fr-examples" style={{ marginTop: 14 }}>
            {(item.examples || []).map((ex, i) => (
              <li key={i} className="fr-example">
                <div className="fr-example__fr">
                  {renderMain(ex.main, ex.pron)}
                  <RefSpeak text={ex.main} lang={lang} size="xs" />
                </div>
                <div className="fr-example__ko">{ex.ko}</div>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <Button onClick={next} style={{ flex: 1 }}>바로 문제로 →</Button>
            <Link href={item.chapter.href} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline', flexShrink: 0 }}>
              교재에서 자세히
            </Link>
          </div>
        </div>
      )}

      {/* ── 어휘: 뜻 고르기 ── */}
      {item.type === 'vocab-choice' && (
        <div className="fr-quiz__q">
          <div className="fr-quiz__prompt" lang={langCode} style={{ fontSize: '1.3rem' }}>
            {item.word.word_text}
            <RefSpeak text={item.word.word_text} lang={lang} size="xs" />
          </div>
          {item.word.furigana && (kanjiCare || phase === 'feedback') && (
            <div className="fr-quiz__sub">{item.word.furigana}</div>
          )}
          <div className="fr-quiz__opts fr-quiz__opts--col">
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === item.word.meaning ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === item.word.meaning, opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 어휘: 타이핑 / 듣기 ── */}
      {(item.type === 'vocab-typing' || item.type === 'vocab-listening') && (
        <div className="fr-quiz__q">
          {item.type === 'vocab-typing' ? (
            <div className="fr-quiz__prompt">“{item.word.meaning}”</div>
          ) : (
            <div className="fr-quiz__prompt" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              🔊 듣고 입력하세요 <RefSpeak text={item.word.word_text} lang={lang} size="sm" />
            </div>
          )}
          <input
            type="text" className="form-input" lang={langCode} value={typing}
            onChange={e => setTyping(e.target.value)} disabled={phase === 'feedback'}
            placeholder={langName + '로 입력'}
            onKeyDown={e => e.key === 'Enter' && typing.trim() && phase === 'answer' && settle(gradeTyping(typing, item.word), typing)}
            style={{ marginTop: 10, fontSize: '1.05rem' }}
            autoFocus
          />
          {phase === 'answer' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
              <Button onClick={() => settle(gradeTyping(typing, item.word), typing)} disabled={!typing.trim()}>
                확인
              </Button>
              {item.type === 'vocab-listening' && (
                <button type="button" onClick={skipItem}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                  넘어가기
                </button>
              )}
            </div>
          )}
          {phase === 'feedback' && (
            <div className="fr-quiz__answer">
              {firstResults[baseUid(item.uid)]?.ok || gradeTyping(typing, item.word) ? '○' : '×'}{' '}
              <span lang={langCode}>{item.word.word_text}</span>
              {item.word.furigana && <span style={{ color: 'var(--text-muted)' }}> ({item.word.furigana})</span>}
              {' — '}{item.word.meaning}
              <RefSpeak text={item.word.word_text} lang={lang} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* ── 문법: 빈칸 ── */}
      {item.type === 'grammar-cloze' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.effect.kind === 'grammar-due' ? '복습' : '새 패턴'} · {item.chapter.title}
          </div>
          <div className="fr-quiz__prompt" lang={langCode}>{q.sentence}</div>
          <div className="fr-quiz__sub">“{q.ko}”</div>
          <div className="fr-quiz__opts fr-quiz__opts--grid">
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === q.correct ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === q.correct, opt)} lang={langCode}>
                {opt}
              </button>
            ))}
          </div>
          {phase === 'feedback' && (
            <div className="fr-quiz__answer">
              <span lang={langCode}>{renderMain(q.full, q.pron)}</span>
              <RefSpeak text={q.full} lang={lang} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* ── 문법: 어순 배열 ── */}
      {item.type === 'grammar-order' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.effect.kind === 'grammar-due' ? '복습' : '새 패턴'} · {item.chapter.title}
          </div>
          <div className="fr-quiz__prompt">“{q.ko}”</div>
          <div className={`fr-quiz__line ${phase === 'feedback' ? (firstResults[baseUid(item.uid)]?.ok || orderPicks.map(bi => prepared.bank[bi].t).join(' ') === q.tokens.join(' ') ? 'is-correct' : 'is-wrong') : ''}`}>
            {orderPicks.map((bi, pos) => (
              <button key={pos} type="button" className="fr-quiz__token is-picked" disabled={phase === 'feedback'}
                onClick={() => setOrderPicks(prev => prev.filter((_, i2) => i2 !== pos))} lang={langCode}>
                {prepared.bank[bi].t}
              </button>
            ))}
            {orderPicks.length === 0 && <span className="fr-quiz__line-hint">단어를 순서대로 탭하세요</span>}
          </div>
          {phase === 'answer' && (
            <div className="fr-quiz__tokens">
              {prepared.bank.map((tok, bi) => (
                orderPicks.includes(bi) ? null : (
                  <button key={bi} type="button" className="fr-quiz__token" lang={langCode}
                    onClick={() => {
                      const nextPicks = [...orderPicks, bi];
                      setOrderPicks(nextPicks);
                      if (nextPicks.length === q.tokens.length) {
                        const built = nextPicks.map(b => prepared.bank[b].t).join(' ');
                        settle(built === q.tokens.join(' '), built);
                      }
                    }}>
                    {tok.t}
                  </button>
                )
              ))}
            </div>
          )}
          {phase === 'feedback' && (
            <div className="fr-quiz__answer">
              <span lang={langCode}>{renderMain(q.answer, q.pron)}</span>
              <RefSpeak text={q.answer} lang={lang} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* ── 독해: 뜻 고르기 / 내용 이해 ── */}
      {item.type === 'read-meaning' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.sentence.isKoreanPrompt ? '내용 이해' : '독해'}
          </div>
          {item.sentence.isKoreanPrompt ? (
            <div className="fr-quiz__prompt">{item.sentence.main}</div>
          ) : (
            <div className="fr-quiz__prompt" lang={langCode}>
              {renderMain(item.sentence.main, (kanjiCare || phase === 'feedback') ? item.sentence.pron : null)}
              <RefSpeak text={item.sentence.main} lang={lang} size="xs" />
            </div>
          )}
          <div className="fr-quiz__opts fr-quiz__opts--col">
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === item.correct ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === item.correct, opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 계속 버튼 */}
      {phase === 'feedback' && (
        <div style={{ marginTop: 18 }}>
          <Button onClick={next} style={{ width: '100%' }}>
            {idx + 1 >= queue.length ? '결과 보기 →' : '계속 →'}
          </Button>
        </div>
      )}

      {/* 언어 전환 (세션 시작 전 첫 문항에서만) */}
      {idx === 0 && phase === 'answer' && languages.length > 1 && (
        <div className="chip-group" style={{ marginTop: 26, justifyContent: 'center' }}>
          {languages.map(l => (
            l.key === lang
              ? <span key={l.key} className="chip chip--active">{l.flag} {l.name}</span>
              : <a key={l.key} href={`/study?lang=${l.key}`} className="chip">{l.flag} {l.name}</a>
          ))}
        </div>
      )}
    </div>
  );
}
