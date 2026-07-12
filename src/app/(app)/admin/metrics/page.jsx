import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: '학습 지표 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ko-KR'));

// 퍼널 다음 단계 유지율(전 단계 대비). 분모 0이면 '—'.
const step = (cur, prev) => (prev ? cur / prev : null);

const DAY_OPTIONS = [7, 30, 90];

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

/** 큰 숫자 한 칸 */
function Stat({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
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

  // ── admin 판정 — 본인 profiles.role (RPC 내부에서 재검사되지만 페이지 진입도 차단) ──
  const { data: prof } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (prof?.role !== 'admin') redirect('/home');

  // ── 기간 선택 (?days=7|30|90, 기본 30) ──
  const days = DAY_OPTIONS.includes(Number(sp?.days)) ? Number(sp.days) : 30;

  // ── 집계 RPC 병렬 호출 (RLS 우회 없음 — SECURITY DEFINER 집계 함수. 행 미반환) ──
  const [funnelRes, dailyRes, v3Res, healthRes] = await Promise.all([
    supabase.rpc('admin_funnel', { days }),
    supabase.rpc('admin_daily_metrics', { days }),
    supabase.rpc('admin_v3_metrics', { days }),
    supabase.rpc('admin_content_health', { days, top_n: 10 }),
  ]);

  // RPC 미배포(로컬 등) 대비 — 하나라도 에러면 안내 폴백(크래시 금지).
  const rpcError = funnelRes.error || dailyRes.error || v3Res.error || healthRes.error;
  if (rpcError) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-header__title">📊 학습 지표</h1>
          <p className="page-header__subtitle">집계 RPC 기반 · 전체 사용자</p>
        </div>
        <Card title="마이그레이션이 필요해요" hint="집계 함수가 아직 이 환경에 배포되지 않았습니다.">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <code>supabase/migrations/20260708000100_admin_metrics_rpc.sql</code>을 Supabase 대시보드
            SQL Editor에서 실행하면 아래 대시보드가 채워집니다. (집계 전용 함수 — 행·원문은
            반환하지 않습니다.)
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
            오류: {rpcError.message || String(rpcError)}
          </p>
        </Card>
      </div>
    );
  }

  // admin_funnel/admin_v3_metrics는 단일 행, daily/health는 행 배열.
  const funnel = funnelRes.data?.[0] || {};
  const v3 = v3Res.data?.[0] || {};
  const daily = dailyRes.data || [];
  const health = healthRes.data || [];

  const signups = Number(funnel.signups || 0);
  const reached = Number(funnel.reached_first_session || 0);
  const d1 = Number(funnel.d1_return || 0);
  const d7 = Number(funnel.d7_retained || 0);

  // 일별 막대 스케일 — active_users 최대값 기준.
  const dailyMax = Math.max(1, ...daily.map((d) => Number(d.active_users || 0)));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">📊 학습 지표</h1>
        <p className="page-header__subtitle">집계 RPC 기반 · 전체 사용자 · 최근 {days}일</p>
      </div>

      {/* 기간 칩 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {DAY_OPTIONS.map((d) => (
          <Link
            key={d}
            href={`/admin/metrics?days=${d}`}
            className={`tab-pills__item ${d === days ? 'tab-pills__item--primary' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            최근 {d}일
          </Link>
        ))}
      </div>

      {/* ① 가입 퍼널 */}
      <Card
        title="① 가입 퍼널"
        hint="가입 → 첫 세션(첫 학습 이벤트) → D1 재방문(가입 익일 이벤트) → D7 유지(가입 +7일 이벤트). 각 단계는 전 단계 대비 유지율. 최근 가입자는 D7 창이 아직 안 열려 D7이 낮게 잡힐 수 있음."
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Stat label="가입" value={num(signups)} />
          <Stat label="첫 세션 도달" value={num(reached)} sub={`가입 대비 ${pct(step(reached, signups))}`} />
          <Stat label="D1 재방문" value={num(d1)} sub={`첫 세션 대비 ${pct(step(d1, reached))}`} />
          <Stat label="D7 유지" value={num(d7)} sub={`D1 대비 ${pct(step(d7, d1))}`} />
        </div>
      </Card>

      {/* ② 일별 추이 */}
      <Card
        title="② 일별 추이"
        hint="일자별 활성 사용자 수(막대) · 세션 근사(일×유저 그룹) · vocab 정답률. UTC 날짜 기준. 막대 높이=활성 사용자, 위 숫자=vocab 정답률."
      >
        {daily.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>데이터 없음</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto', paddingBottom: 4, height: 130 }}>
            {daily.map((d, i) => (
              <div
                key={`${d.day}-${i}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30 }}
                title={`${d.day} · 활성 ${num(d.active_users)}명 · 세션 ${num(d.sessions)} · 정답률 ${pct(d.accuracy)}`}
              >
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{pct(d.accuracy)}</div>
                <div style={{ width: 16, height: 72, display: 'flex', alignItems: 'flex-end', background: 'var(--bg-subtle, rgba(128,128,128,0.12))', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: `${Math.max((Number(d.active_users) / dailyMax) * 100, 2)}%`, background: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 3, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                  {String(d.day).slice(5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ③ v3 지표 */}
      <Card
        title="③ v3 루프 지표"
        hint="예보 탭·어휘 산출 제출·공동작가 반영(내가 정한 전개가 문단에 반영된 수). 푸시 계열은 V4-2/3에서 채워짐 — 지금은 0이 정상."
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="예보 탭" value={num(v3.forecast_taps)} />
          <Stat label="산출 제출" value={num(v3.produce_submits)} />
          <Stat label="공동작가 반영" value={num(v3.coauthor_reflections)} />
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Stat label="푸시 옵트인" value={num(v3.push_optin)} />
          <Stat label="푸시 발송" value={num(v3.push_sent)} />
          <Stat label="푸시 열림" value={num(v3.push_open)} />
        </div>
      </Card>

      {/* ④ 불량 문항 top10 */}
      <Card
        title="④ 불량 문항 후보 (top 10)"
        hint="item_key별 오답률 상위. 노출 3회 이상만. 원문(detail)은 표시하지 않습니다 — 오답률·노출수만으로 후보를 좁힙니다."
      >
        {health.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>표본 부족 — 아직 후보 없음</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>항목(item_key)</th><th>오답률</th><th>노출</th></tr>
              </thead>
              <tbody>
                {health.map((it, i) => (
                  <tr key={`${it.item_key}-${i}`}>
                    <td className="admin-table__title">{it.item_key}</td>
                    <td>{pct(it.wrong_rate)}</td>
                    <td className="admin-table__muted">{num(it.exposures)}</td>
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
