import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getRefLang, REF_LANGS } from '@/content/refLangs';
import { computeEwma, dialFromEwma, deriveVocabRungs } from '@/lib/skillRung';
import {
  computeRecall,
  computeItemWrongRates,
  computeRtStats,
  computeDailyAccuracy,
  clusterSessions,
  computeAssistTop,
} from '@/lib/studyMetrics';

export const metadata = { title: '학습 지표 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

const DAY = 86400000;
const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
const ms1 = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}ms`);
const DIAL_LABEL = { easy: '쉬움(easy)', normal: '보통(normal)', hard: '어려움(hard)' };

/** 섹션 카드 — 제목 + 한 줄 설명 + 본문 */
function Card({ title, hint, children }) {
  return (
    <section className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      {hint && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>{hint}</p>
      )}
      {children}
    </section>
  );
}

/** D1/D7 재인률 한 칸 */
function RecallCell({ label, w }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label} (n={w.n})</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
        {w.rate === null ? <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>표본 부족</span> : pct(w.rate)}
      </div>
    </div>
  );
}

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  // ── admin 판정 — 본인 profiles.role ──
  const { data: prof } = await supabase
    .from('profiles').select('role, learning_language').eq('id', user.id).single();
  if (prof?.role !== 'admin') redirect('/home');

  // ── 언어 결정: ?lang= → 프로필 학습 언어 → 일본어 ──
  let lang = sp?.lang && REF_LANGS[sp.lang] ? sp.lang : null;
  if (!lang) {
    const fromProfile = Array.isArray(prof?.learning_language) ? prof.learning_language[0] : prof?.learning_language;
    lang = REF_LANGS[fromProfile] ? fromProfile : 'Japanese';
  }
  const ref = getRefLang(lang);

  // ── 병렬 조회 (모든 쿼리 명시적 상한) ──
  const since90 = new Date(Date.now() - 90 * DAY).toISOString();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const [{ data: eventRows }, { data: vocabRows }, { data: paraRows }] = await Promise.all([
    supabase.from('review_events')
      .select('source, item_key, correct, detail, created_at')
      .eq('user_id', user.id).eq('lang', lang)
      .gte('created_at', since90)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase.from('user_vocabulary')
      .select('word_text')
      .eq('user_id', user.id).eq('language', lang)
      .limit(2000),
    supabase.from('study_paragraphs')
      .select('id, status, created_at, used_at')
      .eq('user_id', user.id).eq('lang', lang)
      .gte('created_at', since30)
      .limit(200),
  ]);

  const events = eventRows || [];
  const vocab = vocabRows || [];
  const paras = paraRows || [];

  // ── 순수 함수 집계 ──
  const recall = computeRecall(events, {});
  const wrongItems = computeItemWrongRates(events, { days: 30, minTotal: 3, top: 20 });
  const rtStats = computeRtStats(events);
  const daily = computeDailyAccuracy(events, { days: 30 });
  const { sessions, completionRate } = clusterSessions(events, { days: 30 });
  const assistTop = computeAssistTop(events, { top: 10 });

  // ── rung 분포 (vocab 소스 이벤트로 유도) + 산출 게이트 ──
  const rungs = deriveVocabRungs(events, vocab);           // { word_text → 0..4 }
  const rungHist = [0, 0, 0, 0, 0];
  for (const r of Object.values(rungs)) rungHist[r] = (rungHist[r] || 0) + 1;
  const rungTop = rungHist[3] + rungHist[4];               // rung 3+ 단어 수
  const rungMax = Math.max(1, ...rungHist);
  const produceGateMet = rungTop >= 20;

  // ── EWMA · 난이도 다이얼 ──
  const graded = events.filter((e) => typeof e.correct === 'boolean').map((e) => ({ correct: e.correct }));
  const ewma = computeEwma(graded);
  const dial = dialFromEwma(ewma, 20, graded.length);

  // ── rt 게이트 ──
  const rtSampleN = events.filter((e) => typeof e.detail?.rt_ms === 'number').length;

  // ── 프리페치 전환율 ──
  const FIVE_MIN = 5 * 60 * 1000;
  let consumedPrefetch = 0, live = 0, expiredPrefetch = 0;
  const now = Date.now();
  for (const p of paras) {
    const created = new Date(p.created_at).getTime();
    if (p.status === 'used') {
      const used = p.used_at ? new Date(p.used_at).getTime() : created;
      if (used - created > FIVE_MIN) consumedPrefetch += 1;
      else live += 1;
    } else if (p.status === 'prefetched') {
      if (Number.isFinite(created) && now - created > 48 * 3600 * 1000) expiredPrefetch += 1;
    }
  }
  const prefetchDenom = consumedPrefetch + expiredPrefetch;
  const prefetchRate = prefetchDenom ? consumedPrefetch / prefetchDenom : null;

  // ── 언어 칩 ──
  const languages = Object.entries(REF_LANGS).map(([key, r]) => ({ key, name: r.name, flag: r.flag }));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">📊 학습 지표</h1>
        <p className="page-header__subtitle">본인({ref.name}) 데이터 기준 · 최근 90일 이벤트</p>
      </div>

      {/* 언어 칩 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {languages.map((l) => (
          <Link
            key={l.key}
            href={`/admin/metrics?lang=${l.key}`}
            className={`tab-pills__item ${l.key === lang ? 'tab-pills__item--primary' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            {l.flag} {l.name}
          </Link>
        ))}
      </div>

      {events.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          최근 90일 이벤트가 없어요. 아래 카드는 표본이 쌓이면 채워집니다.
        </p>
      )}

      {/* ① D1/D7 재인률 */}
      <Card
        title="① D1 · D7 재인률"
        hint="항목별 첫 학습 이후 하루(20~28h)·일주일(6~8일) 뒤 첫 복습의 정답률. 표본 n<10이면 '표본 부족'. 스케줄이 실제 기억을 지키는지 보는 지표."
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>어휘 (vocab)</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <RecallCell label="D1" w={recall.vocab.d1} />
              <RecallCell label="D7" w={recall.vocab.d7} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>문법 (grammar)</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <RecallCell label="D1" w={recall.grammar.d1} />
              <RecallCell label="D7" w={recall.grammar.d7} />
            </div>
          </div>
        </div>
      </Card>

      {/* ② 불량 문항 후보 */}
      <Card
        title="② 불량 문항 후보"
        hint="최근 30일 (유형·항목)별 오답률 상위. 표본 3회 이상만. 문법은 slug 그대로 표기. 문항 자체가 애매하거나 난도 오조정일 수 있는 후보."
      >
        {wrongItems.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>표본 부족 — 아직 후보 없음</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>항목</th><th>유형</th><th>오답률</th><th>n</th></tr>
              </thead>
              <tbody>
                {wrongItems.map((it, i) => (
                  <tr key={`${it.source}-${it.qtype}-${it.key}-${i}`}>
                    <td className="admin-table__title">{it.key}</td>
                    <td className="admin-table__muted">{it.source}·{it.qtype}</td>
                    <td>{pct(it.wrongRate)}</td>
                    <td className="admin-table__muted">{it.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ③ rung 분포 + 산출 게이트 */}
      <Card
        title="③ 숙련 사다리(rung) 분포"
        hint="어휘별 숙련 단계 — 0 노출 전 · 1 인지(choice) · 2 회상(typing) · 3 청각(listening) · 4 산출(produce). vocab 이벤트로만 유도."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {rungHist.map((cnt, r) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 44, fontSize: '0.75rem', color: 'var(--text-muted)' }}>rung {r}</span>
              <div style={{ flex: 1, background: 'var(--bg-subtle, rgba(128,128,128,0.15))', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                <div style={{ width: `${(cnt / rungMax) * 100}%`, height: '100%', background: r >= 3 ? 'var(--accent)' : 'var(--text-muted)', minWidth: cnt ? 2 : 0 }} />
              </div>
              <span style={{ width: 40, textAlign: 'right', fontSize: '0.8rem' }}>{cnt}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: produceGateMet ? 'var(--accent)' : 'var(--text-secondary)' }}>
          어휘 산출 도입 조건: rung 3+ 단어 ≥ 20 — 현재 {rungTop}개{produceGateMet ? ' ✓' : ''}
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
          현재 난이도 다이얼: <strong>{DIAL_LABEL[dial]}</strong>
          {' · '}EWMA {ewma === null ? '—' : ewma.toFixed(3)} (표본 {graded.length}, 20 미만이면 normal 고정)
        </p>
      </Card>

      {/* ④ rt 분포 + 게이트 */}
      <Card
        title="④ 응답시간(rt) 분포"
        hint="유형별 정답/오답 응답시간의 중앙값·p75. 오답이 정답보다 크게 느리면 인출 실패(추측)의 신호."
      >
        {Object.keys(rtStats).length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>rt_ms 표본 없음</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>유형</th><th>정답 중앙값</th><th>정답 p75</th><th>정답 n</th><th>오답 중앙값</th><th>오답 p75</th><th>오답 n</th></tr>
              </thead>
              <tbody>
                {Object.entries(rtStats).map(([qtype, s]) => (
                  <tr key={qtype}>
                    <td className="admin-table__title">{qtype}</td>
                    <td>{ms1(s.correct.median)}</td>
                    <td className="admin-table__muted">{ms1(s.correct.p75)}</td>
                    <td className="admin-table__muted">{s.correct.n}</td>
                    <td>{ms1(s.wrong.median)}</td>
                    <td className="admin-table__muted">{ms1(s.wrong.p75)}</td>
                    <td className="admin-table__muted">{s.wrong.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
          rt 표본 500 도달 시 FSRS 세분화 재론 — 현재 {rtSampleN}
        </p>
      </Card>

      {/* ⑤ 일별 정답률 */}
      <Card
        title="⑤ 일별 정답률"
        hint="최근 30일 하루 단위 채점 정답률(로컬 날짜). 막대 높이=정답률, 숫자=그날 총 문항."
      >
        {daily.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>데이터 없음</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto', paddingBottom: 4, height: 120 }}>
            {daily.map((d, i) => (
              <div key={`${d.date}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 26 }} title={`${d.date} · ${pct(d.rate)} · ${d.total}문항`}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{d.total}</div>
                <div style={{ width: 16, height: 72, display: 'flex', alignItems: 'flex-end', background: 'var(--bg-subtle, rgba(128,128,128,0.12))', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: `${Math.max(d.rate * 100, 2)}%`, background: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: 3, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{d.date}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ⑥ 세션 완주율 */}
      <Card
        title="⑥ 세션 완주율"
        hint="공부 모드 채점 이벤트를 30분 갭으로 세션 클러스터링. 완주=한 세션 7문항 이상. 최근 30일."
      >
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>세션 수</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{sessions.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>완주율 (≥7문항)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{sessions.length ? pct(completionRate) : '—'}</div>
          </div>
        </div>
      </Card>

      {/* ⑦ 프리페치 전환율 */}
      <Card
        title="⑦ 프리페치 전환율"
        hint="미리 생성해둔 내일의 문단이 실제로 소비된 비율. 소비=used_at−created_at>5분. 분모=소비+미소비 만료(48h 경과 prefetched). 최근 30일."
      >
        {prefetchRate === null ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>아직 데이터 없음</p>
        ) : (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>전환율</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{pct(prefetchRate)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>프리페치 소비</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{consumedPrefetch}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>만료(미소비)</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{expiredPrefetch}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>라이브 생성</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{live}</div>
            </div>
          </div>
        )}
      </Card>

      {/* ⑧ 어시스트 상위 */}
      <Card
        title="⑧ 어시스트 상위"
        hint="독해 중 요미가나·뜻풀이 등 어시스트를 가장 자주 요청한 항목. 아직 부담스러운 단어의 신호."
      >
        {assistTop.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>데이터 없음</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>항목</th><th>요청 횟수</th></tr>
              </thead>
              <tbody>
                {assistTop.map((a, i) => (
                  <tr key={`${a.key}-${i}`}>
                    <td className="admin-table__title">{a.key}</td>
                    <td className="admin-table__muted">{a.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
