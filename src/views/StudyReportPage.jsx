'use client';

/**
 * 학습 진단지(/progress/report · STATS-MAP-001 기간 요약 — 오너 2026-11-02 KST: 진단지 컨셉 「ㅇㅇ」 · 단추 「자세히 보기」 ·
 * 기준 「표준」 · 머리 숫자 「권장대로(공부한 날)」 · 메일은 별도 승인(이번엔 복사)). 인바디 결과지의 흐름(구성 → 균형 → 판정 →
 * 부위별 → 변화 → 조절 → 세부)을 학습 순환으로 옮긴 한 장. 새 셈 · 새 기록 없음 — 모든 숫자는 이미 있는 정본에서 온다:
 *  ① ② ⑤ ⑦ = weeklyReport.buildRangeReport(이번 주 창과 같은 셈) · remet/usedWords · ③ = 실제 기억률(trueRetention) · 기억 건강(memoryHealth)
 *  ④ = 레벨 어휘(useLevelRows) · ⑥ = 연계(흐릿한 표현 복습 · 아직 안 써 본 말 · 다시 만난 말이 나오는 글) · 머리 = 공부한 날(studyDayCounts).
 * 「요약 복사」 = periodSummaryText(같은 꾸러미). 거울 규약: 빨강 · 초록 · 화살표 없음, 표준 띠는 회색.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { authEntryHref } from '../lib/authRedirect';
import { buildRangeReport, periodRange, PERIOD_KINDS } from '../lib/weeklyReport';
import { fetchWeeklyReportRows } from '../lib/weeklyReportRows';
import { fetchSharedVocabularySummary } from '../lib/vocabularyLearningShare';
import { fetchRemetWeeks } from '../lib/remetRows';
import { fetchOutputWeeks } from '../lib/usedWordsRows';
import { unusedReviewedWords } from '../lib/usedWords';
import { writingWordsHref } from '../lib/writingWordsParam';
import { LIBRARY_WORDS_MAX } from '../lib/libraryDiscovery';
import { memoryHealth } from '../lib/memoryHealth';
import { buildTrueRetention, retentionTargetPercent } from '../lib/trueRetention';
import { fetchTrueRetentionRows, trueRetentionQueryKey } from '../lib/trueRetentionRows';
import { serializeReviewScope, wordScopeLanguage, scopeLevelLabel } from '../lib/reviewScope';
import { fetchKnownWords, knownWordsLang } from '../lib/knownWords';
import { detectLang, langNameKo } from '../lib/constants';
import { fetchStudyAnswerRows, studyDayCounts } from '../lib/studyDays';
import { PERIOD_LABEL, PREV_LABEL, STANDARD_BAND, ZONE_LABEL, balanceRows, historyBuckets, periodDates, periodStandards, periodSummaryText, studyDaysIn } from '../lib/periodSummary';
import useLearnLanguage from '../components/learn/useLearnLanguage';
import LangChips from '../components/learn/LangChips';
import { useLevelRows } from '../components/learn/LevelVocabCard';
import '../components/learn/learn.css';
import '../components/learn/study-report.css';

const DAY_MS = 86400000;
const HISTORY_BUCKETS = 8;
const bandX = pct => ((Math.min(Math.max(pct, STANDARD_BAND.min), STANDARD_BAND.max) - STANDARD_BAND.min) / (STANDARD_BAND.max - STANDARD_BAND.min)) * 100;

export default function StudyReportPage() {
  const signInHref = authEntryHref(usePathname());
  const params = useSearchParams();
  const kind = PERIOD_KINDS.includes(params?.get('period')) ? params.get('period') : '30d';
  const { user, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const range = useMemo(() => periodRange(kind), [kind]);
  // ⑤ 변화 기록(7일씩 8칸)과 비교 기간을 모두 덮게 받는다 — 지난 30일이면 60일, 이번 주면 56일.
  const sinceMs = Math.min(range.prevStartMs, range.endMs - HISTORY_BUCKETS * 7 * DAY_MS);

  const { data: learning } = useQuery({
    queryKey: ['report-vocab', user?.id],
    queryFn: () => fetchSharedVocabularySummary(queryClient, user.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const vocab = useMemo(() => learning?.rows || [], [learning]);
  const projections = useMemo(() => learning?.projections || [], [learning]);
  const vocabCounts = useMemo(() => vocab.reduce((all, v) => {
    const key = v.language || detectLang(v.word_text || ''); all[key] = (all[key] || 0) + 1; return all;
  }, {}), [vocab]);
  const { langs, lang, choose } = useLearnLanguage(profile, vocabCounts);

  const { data: rows } = useQuery({
    queryKey: ['report-rows', user?.id, sinceMs],
    queryFn: () => fetchWeeklyReportRows(user.id, { sinceMs }),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const spanMs = range.days * DAY_MS;
  const { data: remet } = useQuery({
    queryKey: ['remet', user?.id, range.startMs, range.kind],
    queryFn: () => fetchRemetWeeks(user.id, { weekStartMs: range.startMs, spanMs, vocabRows: vocab }),
    enabled: !!user?.id && !!learning,
    staleTime: 1000 * 60 * 5,
  });
  const { data: output } = useQuery({
    queryKey: ['output-words', user?.id, range.startMs, range.kind],
    queryFn: () => fetchOutputWeeks(user.id, { weekStartMs: range.startMs, spanMs, vocabRows: vocab }),
    enabled: !!user?.id && !!learning,
    staleTime: 1000 * 60 * 5,
  });
  const { data: retentionRows } = useQuery({
    queryKey: trueRetentionQueryKey(user?.id, 'recent'),
    queryFn: () => fetchTrueRetentionRows(user.id, { range: 'recent' }),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
  const knownLang = knownWordsLang(lang);
  const { data: knownRows } = useQuery({
    queryKey: ['known-words', user?.id, knownLang],
    enabled: !!user?.id && !!knownLang,
    queryFn: async () => { try { return await fetchKnownWords(user.id, knownLang); } catch { return null; } },
    staleTime: 1000 * 60 * 5,
  });

  // 공부한 날 — 현황 「공부한 날」 칸 · 이번 주 창과 같은 재료(fetchStudyAnswerRows + 담은 말)와 같은 셈(studyDayCounts).
  const { data: answerRows } = useQuery({
    queryKey: ['study-days', user?.id, range.startMs],
    queryFn: () => fetchStudyAnswerRows(user.id, new Date(range.startMs).toISOString()),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const report = useMemo(() => (rows ? buildRangeReport(rows, range) : null), [rows, range]);
  const studied = useMemo(() => (answerRows && learning ? studyDaysIn(studyDayCounts({ answers: answerRows, saved: vocab, sinceMs: range.startMs }), range) : null), [answerRows, learning, vocab, range]);
  const standards = useMemo(() => periodStandards(profile, range.days), [profile, range.days]);
  const balance = useMemo(() => (report ? balanceRows({ report, output: output?.week, standards }) : []), [report, output, standards]);
  const history = useMemo(() => (rows ? historyBuckets(rows, { endMs: range.endMs, buckets: HISTORY_BUCKETS, buildRange: buildRangeReport }) : null), [rows, range.endMs]);
  const mine = useMemo(() => projections.filter(p => wordScopeLanguage(p?.vocabulary) === lang), [projections, lang]);
  const health = useMemo(() => (learning ? memoryHealth(mine, Date.parse(learning.now) || Date.now()) : null), [learning, mine]);
  const retention = useMemo(() => {
    if (!retentionRows) return null;
    const table = buildTrueRetention({ ...retentionRows, lang });
    const cell = table?.periods?.find(p => p.key === 'month')?.all;
    return cell && cell.total > 0 && cell.rate != null
      ? { pct: Math.round(cell.rate * 100), target: Number(retentionTargetPercent(table.target).replace('%', '')), total: cell.total } : null;
  }, [retentionRows, lang]);
  const { supported: levelsSupported, rows: levelRows } = useLevelRows({ lang, vocab, projections, knownRows: knownRows || [] });
  const levels = useMemo(() => (levelRows || []).filter(r => r.total > 0).map(r => ({
    key: r.level, label: scopeLevelLabel(r.level), have: r.have, total: r.total, pct: Math.round((r.have / r.total) * 100),
  })), [levelRows]);
  const next = useMemo(() => {
    const out = [];
    const fragile = health ? health.buckets.low + health.buckets.forgotten : 0;
    if (fragile > 0) out.push({ key: 'fragile', text: `흐릿 · 위험 말 ${fragile}개 복습`, href: serializeReviewScope({ lang, state: 'fragile' }), go: '복습실' });
    const unused = unusedReviewedWords({ projections: mine, everUsed: output?.week?.everUsed || [] });
    if (unused.words.length) out.push({ key: 'write', text: `아직 안 써 본 말 ${unused.words.join(' · ')}로 작문`, href: writingWordsHref(unused), go: '작문' });
    const remetWords = [...new Set((remet?.week?.sources || []).flatMap(src => src.words))].slice(0, LIBRARY_WORDS_MAX);
    if (remetWords.length) out.push({ key: 'read', text: `다시 만난 말 ${remet.week.total}개가 나오는 글 읽기`, href: `/materials?${new URLSearchParams({ sort: 'words', words: remetWords.join(',') })}`, go: '서재' });
    return out;
  }, [health, lang, mine, output, remet]);

  const text = () => periodSummaryText({
    range, report, studyDays: studied, balance, output: output?.week, remet: remet?.week, retention, health,
    levels, history, next, language: langNameKo(lang),
  });

  if (!authLoading && !user) {
    return (
      <div className="manabi-page learn-page">
        <Link href="/progress" prefetch={false} className="learn-crumb">← 현황</Link>
        <div className="manabi-inline-state learn-login" role="status"><span>로그인이 필요해요.</span><Link href={signInHref} prefetch={false} className="learn-button-s">로그인</Link></div>
      </div>
    );
  }
  const r = report;
  const acc = r?.reviews?.accuracy == null ? null : Math.round(r.reviews.accuracy * 100);
  return (
    <div className="manabi-page learn-page">
      <Link href="/progress" prefetch={false} className="learn-crumb">← 현황</Link>
      <div className="learn-top">
        <div className="learn-top__title"><h1>학습 진단지</h1><LangChips langs={langs} lang={lang} onChange={choose} /></div>
      </div>
      <nav className="learn-period" aria-label="기간">
        {PERIOD_KINDS.map(k => (
          <Link key={k} href={`/progress/report?period=${k}`} prefetch={false} replace scroll={false}
            aria-current={k === kind ? 'page' : undefined} className={k === kind ? 'is-on' : undefined}>{PERIOD_LABEL[k]}</Link>
        ))}
      </nav>

      <article className="rep-sheet" aria-labelledby="rep-title">
        <header className="rep-top">
          <div className="rep-top__id">
            <h2 id="rep-title">{PERIOD_LABEL[kind]} <span>진단 결과</span></h2>
            <p>
              <span>기간 <b>{PERIOD_LABEL[kind]} · {periodDates(range)}</b></span>
              <span>기준 <b>04시 학습일</b></span>
              <span>언어 <b>{langNameKo(lang)}</b> <small>(③ ④ ⑥)</small></span>
              <span>비교 <b>표준 · {PREV_LABEL[kind]}</b></span>
            </p>
          </div>
          <div className="rep-top__num"><b>{studied ?? '–'}<small>/{range.days}</small></b><span>공부한 날</span></div>
        </header>

        <section className="rep-blk" aria-labelledby="rep-1">
          <h3 id="rep-1"><span>① 학습 구성 분석</span><small>이 기간에 한 일 — 순환 네 정거장</small></h3>
          <div className="rep-comp">
            <div><b>들어옴</b><strong>{r ? r.metWords.toLocaleString('ko-KR') : '–'}</strong><span>만난 말 · 완독 {r?.readsCompleted ?? 0}편</span></div>
            <div><b>담기</b><strong>{r ? r.newWords.toLocaleString('ko-KR') : '–'}</strong><span>새로 담은 말</span></div>
            <div><b>다지기</b><strong>{r ? r.reviews.total.toLocaleString('ko-KR') : '–'}</strong><span>복습 문항{acc != null ? ` · 정답 ${acc}%` : ''}</span></div>
            <div><b>내보내기</b><strong>{output ? output.week.total.toLocaleString('ko-KR') : '–'}</strong><span>직접 쓴 말 · 대화 {r?.conversation?.turns ?? 0}마디</span></div>
          </div>
        </section>

        <section className="rep-blk" aria-labelledby="rep-2">
          <h3 id="rep-2"><span>② 순환 균형 분석</span><small>표준 = 100% · 점선</small></h3>
          <div className="rep-zones" aria-hidden="true"><span /><div style={{ gridTemplateColumns: `${bandX(STANDARD_BAND.low)}fr ${bandX(STANDARD_BAND.high) - bandX(STANDARD_BAND.low)}fr ${100 - bandX(STANDARD_BAND.high)}fr` }}>
            <span>{ZONE_LABEL.under}</span><span>{ZONE_LABEL.standard}</span><span>{ZONE_LABEL.over}</span></div><span /></div>
          {balance.map(b => (
            <div key={b.key} className="rep-bar" role="img" aria-label={`${b.label} ${b.value.toLocaleString('ko-KR')}${b.unit} · 표준 ${b.standard?.toLocaleString('ko-KR')}${b.unit}의 ${b.pct}% · ${ZONE_LABEL[b.zone]}`}>
              <span className="rep-bar__k">{b.label}</span>
              <span className="rep-bar__track"><i style={{ width: `${bandX(b.pct ?? STANDARD_BAND.min)}%` }} /><b style={{ left: `${bandX(100)}%` }} /></span>
              <span className="rep-bar__v">{b.value.toLocaleString('ko-KR')}{b.unit} <small>{b.pct}%</small></span>
            </div>
          ))}
          <div className="rep-scale" aria-hidden="true"><span /><div>{[0, 50, 100, 150].map(t => <span key={t} style={{ left: `${bandX(t)}%` }}>{t}{t === 150 ? '%' : ''}</span>)}</div><span /></div>
          <p className="rep-note">표준 = 하루 기준 × {range.days}일. 복습 · 담기는 목표 창의 하루 목표, 나머지는 manabi 기본값(만난 말 10 · 대화 10마디 · 완독 주 2편 · 직접 쓴 말 이틀에 1개).</p>
        </section>

        <section className="rep-blk" aria-labelledby="rep-3">
          <h3 id="rep-3"><span>③ 기억 분석</span><small>복습 답으로 잰 기억 — {langNameKo(lang)}</small></h3>
          <div className="rep-mem">
            <div>
              <span className="rep-sub">실제 기억률(지난 30일)</span>
              {retention ? <>
                <div className="rep-big"><b>{retention.pct}%</b><small>목표 {retention.target}% · 기한 된 복습 답 {retention.total.toLocaleString('ko-KR')}</small></div>
                <div className="rep-goal" role="img" aria-label={`실제 기억률 ${retention.pct}% · 목표 ${retention.target}%`}><i style={{ width: `${retention.pct}%` }} /><b style={{ left: `${retention.target}%` }} /></div>
              </> : <p className="rep-empty">아직 잴 만큼 답이 쌓이지 않았어요.</p>}
            </div>
            <div>
              <span className="rep-sub">기억 건강(복습 중인 담은 말 {health?.measured?.toLocaleString('ko-KR') ?? '–'}개)</span>
              <div className="rep-dist">
                {[['high', '선명'], ['mid', '양호'], ['low', '흐릿'], ['forgotten', '위험']].map(([key, label]) => (
                  <div key={key}><b>{health ? health.buckets[key].toLocaleString('ko-KR') : '–'}</b>{label}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rep-blk" aria-labelledby="rep-4">
          <h3 id="rep-4"><span>④ 수준별 분석</span><small>급수 어휘 중 확보(아는 단어 + 복습 중)</small></h3>
          {!levelsSupported ? <p className="rep-empty">{langNameKo(lang)}의 급수 목록은 준비 중이에요.</p>
            : !levelRows ? <p className="rep-empty" aria-busy="true">불러오는 중…</p>
              : levels.map(l => (
                <div key={l.key} className="rep-bar" role="img" aria-label={`${l.label} 어휘 ${l.total.toLocaleString('ko-KR')}개 중 ${l.have.toLocaleString('ko-KR')}개 확보 · ${l.pct}%`}>
                  <span className="rep-bar__k">{l.label}</span>
                  <span className="rep-bar__track"><i style={{ width: `${l.pct}%` }} /></span>
                  <span className="rep-bar__v">{l.pct}% <small>{l.have.toLocaleString('ko-KR')} / {l.total.toLocaleString('ko-KR')}</small></span>
                </div>
              ))}
        </section>

        <section className="rep-blk" aria-labelledby="rep-5">
          <h3 id="rep-5"><span>⑤ 변화 기록</span><small>최근 56일을 7일씩 · 점 = 최근 7일</small></h3>
          <div className="rep-hist">
            {history && [['reviews', '복습(문항)'], ['accuracy', '정답률(%)'], ['newWords', '새로 담은 말']].map(([key, label]) => (
              <Spark key={key} label={label} values={history.map(h => h[key])} />
            ))}
          </div>
        </section>

        <section className="rep-blk" aria-labelledby="rep-6">
          <h3 id="rep-6"><span>⑥ 다음 조절</span><small>지금 숫자에서 바로 이어지는 행동</small></h3>
          {next.length ? (
            <ol className="rep-next">
              {next.map(n => <li key={n.key}><span>{n.text}</span><Link href={n.href} prefetch={false}>{n.go} <span aria-hidden="true">›</span></Link></li>)}
            </ol>
          ) : <p className="rep-empty">지금은 이어 갈 행동이 없어요.</p>}
        </section>

        <section className="rep-blk" aria-labelledby="rep-7">
          <h3 id="rep-7"><span>⑦ 세부 수치</span><small>연구 항목 자리</small></h3>
          <div className="rep-params">
            <div>다시 만난 말<b>{remet ? remet.week.total : '–'}</b></div>
            <div>처음 씀<b>{output ? output.week.firstTime : '–'}</b></div>
            <div>고친 문장<b>{r ? r.conversation.fixed : '–'}</b></div>
            <div className="wide">담은 곳{r ? `(${r.newWords})` : ''}<b>{r ? sourceLine(r.savedBySource) : '–'}</b></div>
          </div>
        </section>

        <footer className="rep-foot">
          <span>판정색 · 화살표 없음 — 표준 띠는 회색으로만 그립니다.</span>
          <CopyButton text={r ? text : null} />
        </footer>
      </article>
    </div>
  );
}

const SOURCE_LABEL = { reading: '읽기', conversation: '대화', level: '목록', study: '오늘 학습', manual: '직접' };
function sourceLine(by = {}) {
  const parts = Object.entries(by).filter(([, n]) => n > 0).map(([k, n]) => `${SOURCE_LABEL[k] || k} ${n}`);
  return parts.length ? parts.join(' · ') : '–';
}

/** 작은 줄그래프 — 한 값에 한 줄(축 하나) · 마지막 점만 숫자. 빈 값(정답률 없음)은 건너뛴다. */
function Spark({ label, values }) {
  const w = 150, h = 38, p = 5;
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (pts.length < 2) return <div className="rep-spark"><span>{label}</span><span className="rep-empty">기록이 더 쌓이면 보여요</span><span /></div>;
  const vs = pts.map(([, v]) => v);
  const min = Math.min(...vs), max = Math.max(...vs), span = (max - min) || 1;
  const xy = pts.map(([i, v]) => [p + (i * (w - 2 * p)) / (values.length - 1), h - p - ((v - min) / span) * (h - 2 * p)]);
  const [lx, ly] = xy[xy.length - 1];
  return (
    <div className="rep-spark">
      <span>{label}</span>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label} 최근 7일씩: ${values.map(v => v ?? '–').join(', ')}`}>
        <polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke="var(--ja)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r="4" fill="var(--ja)" stroke="var(--sheet)" strokeWidth="2" />
      </svg>
      <span className="rep-spark__v">{last ?? '–'}<small>앞 7일 {prev ?? '–'}</small></span>
    </div>
  );
}

/** 요약 복사 — 같은 꾸러미의 글. 복사가 막히면 글을 펼쳐 직접 고르게 한다. */
function CopyButton({ text }) {
  const [state, setState] = useState(null);
  const [manual, setManual] = useState(null);
  const area = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (manual) area.current?.select(); }, [manual]);
  const copy = async () => {
    const value = text();
    try {
      await navigator.clipboard.writeText(value);
      setManual(null);
      setState('done');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState(null), 2000);
    } catch { setManual(value); }
  };
  return (
    <>
      <button type="button" className={`learn-week__copy${state === 'done' ? ' is-done' : ''}`} onClick={copy} disabled={!text}>
        <span aria-live="polite">{state === 'done' ? '복사됨 ✓' : '요약 복사'}</span>
      </button>
      {manual && (
        <div className="rep-manual">
          <label htmlFor="rep-manual">복사하지 못했어요. 아래 글을 직접 골라 복사해 주세요.</label>
          <textarea id="rep-manual" ref={area} readOnly value={manual} rows={10} className="form-input" />
        </div>
      )}
    </>
  );
}
