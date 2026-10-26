// ACTIVITY-PROFILE-READ-001 — 학습 활동 뒤 프로필 재읽기는 「지금 프로필이 오늘(UTC 활동일)을 이미 셌으면」 건너뛴다.
// 근거는 정본 계산 함수 하나다: fsrs_private.project_activity_days_with_legacy(기준선, 활동일, legacy 활동일).
// 여기서는 그 함수를 마이그레이션 원문 그대로 PGlite에 올려, 무작위 기준선 · 활동일에서 「투영 결과의 last_streak_date가 오늘이면
// 오늘의 FSRS · legacy 영수증을 더해도 결과가 같다」를 확인한다. 함수 본문이 바뀌면(운영 함수와 같은 원문) 이 계약이 다시 판정한다.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { ACTIVITY_ROLLOVER_GUARD_MS, activityAlreadyCounted, nearActivityRollover } from '../learningActivity';
import { MIDNIGHT_GUARD_MS } from '../streak';

const MIGRATION = 'supabase/migrations/20261005081323_m09_management_repair_022_20261005.sql';
const FN = readFileSync(MIGRATION, 'utf8')
  .match(/CREATE FUNCTION fsrs_private\.project_activity_days_with_legacy\([\s\S]*?END \$\$;/)[0];

const DAY = 86400000;
const TODAY = Date.UTC(2026, 9, 26);
const iso = t => new Date(t).toISOString().slice(0, 10);

describe('정본 원문 — 운영 함수와 같은 본문 · 뒤 마이그레이션이 다시 정의하지 않음', () => {
  it('본문 md5 = 운영 pg_proc.prosrc md5(2026-10-26 KST 카탈로그 읽기 확인)', () => {
    const body = FN.match(/ AS \$\$([\s\S]*?)\$\$;/)[1];
    expect(createHash('md5').update(body).digest('hex')).toBe('be7f74e7dd3c767fded0e83cb68d9801');
  });
  it('이 파일 뒤 마이그레이션에 project_activity_days_with_legacy 재정의가 없다(있으면 이 계약을 그 본문으로 옮긴다)', () => {
    const later = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f > MIGRATION.split('/').pop())
      .filter(f => /CREATE (OR REPLACE )?FUNCTION fsrs_private\.project_activity_days_with_legacy/i.test(readFileSync(`supabase/migrations/${f}`, 'utf8')));
    expect(later).toEqual([]);
  });
});

describe('정본 투영: 오늘을 센 프로필은 오늘의 활동으로 바뀌지 않는다', () => {
  let db;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE SCHEMA fsrs_private; ${FN}`);
  }, 60000);
  afterAll(async () => { await db?.close(); });
  const project = async (baseline, days, legacy) => (await db.query(
    'SELECT fsrs_private.project_activity_days_with_legacy($1::jsonb, $2::date[], $3::date[]) r',
    [JSON.stringify(baseline), days, legacy])).rows[0].r;

  it('무작위 기준선 × 활동일 400건 — last_streak_date가 오늘이면 오늘 FSRS · legacy 영수증 추가는 결과 동일', async () => {
    let seed = 7, counted = 0;
    const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 400; i++) {
      const baseline = { streak_count: rand(30), streak_freeze_count: rand(3),
        last_streak_date: rand(5) === 0 ? null : iso(TODAY - rand(12) * DAY) };
      const pick = () => [...new Set(Array.from({ length: rand(6) }, () => iso(TODAY - rand(12) * DAY)))];
      const days = pick(), legacy = days.filter(() => rand(3) === 0);
      const before = await project(baseline, days, legacy);
      if (before.last_streak_date !== iso(TODAY)) continue;
      counted++;
      expect(await project(baseline, [...days, iso(TODAY)], legacy)).toEqual(before);
      expect(await project(baseline, [...days, iso(TODAY)], [...legacy, iso(TODAY)])).toEqual(before);
    }
    expect(counted).toBeGreaterThan(40);
  }, 60000);

  it('반례 — 늦게 온 어제 FSRS 영수증은 바꿀 수 있다(그래서 FSRS 채점은 이 판정을 쓰지 않는다)', async () => {
    const baseline = { streak_count: 4, streak_freeze_count: 0, last_streak_date: iso(TODAY - 3 * DAY) };
    expect(await project(baseline, [iso(TODAY)], [])).toEqual({ streak_count: 1, streak_freeze_count: 0, last_streak_date: iso(TODAY) });
    // 어제(T-1)가 늦게 들어오면 T-3 → T-1(끊김, 1) → T(연속, 2) — 오늘을 센 프로필(1)이 2로 바뀐다.
    expect(await project(baseline, [iso(TODAY), iso(TODAY - DAY)], [])).toEqual({ streak_count: 2, streak_freeze_count: 0, last_streak_date: iso(TODAY) });
  });

  it('오늘을 아직 안 센 프로필은 첫 활동이 바꾼다 — 그래서 첫 활동은 늘 다시 읽는다', async () => {
    const baseline = { streak_count: 6, streak_freeze_count: 0, last_streak_date: iso(TODAY - DAY) };
    expect(await project(baseline, [iso(TODAY)], [])).toEqual({ streak_count: 7, streak_freeze_count: 1, last_streak_date: iso(TODAY) });
  });
});

describe('activityAlreadyCounted — 건너뛰는 조건', () => {
  const at = (h, m = 0) => new Date(TODAY + h * 3600000 + m * 60000);
  const profile = (last, id = 'A') => ({ id, streak_count: 3, last_streak_date: last, streak_freeze_count: 0 });
  it('같은 계정 · 오늘(UTC)을 센 프로필만 건너뛴다', () => {
    expect(activityAlreadyCounted(profile(iso(TODAY)), 'A', at(3))).toBe(true);
    expect(activityAlreadyCounted(profile(iso(TODAY - DAY)), 'A', at(3))).toBe(false);
    expect(activityAlreadyCounted(profile(null), 'A', at(3))).toBe(false);
    expect(activityAlreadyCounted(profile(iso(TODAY), 'B'), 'A', at(3))).toBe(false);
    expect(activityAlreadyCounted(null, 'A', at(3))).toBe(false);
    expect(activityAlreadyCounted(profile(iso(TODAY)), '', at(3))).toBe(false);
  });
  it('KST 아침(UTC 전날 밤)도 UTC 날짜로 판정한다 — KST 10:00 = UTC 01:00', () => {
    expect(activityAlreadyCounted(profile(iso(TODAY)), 'A', at(1))).toBe(true);
    expect(activityAlreadyCounted(profile(iso(TODAY)), 'A', at(-1))).toBe(false); // UTC 전날 23:00
  });
  it('UTC 자정 ±15분은 늘 다시 읽는다(기기 시계 어긋남) — recordActivity와 같은 가드', () => {
    expect(ACTIVITY_ROLLOVER_GUARD_MS).toBe(MIDNIGHT_GUARD_MS);
    expect(activityAlreadyCounted(profile(iso(TODAY)), 'A', at(0, 14))).toBe(false);
    expect(activityAlreadyCounted(profile(iso(TODAY)), 'A', at(0, 15))).toBe(true);
    expect(activityAlreadyCounted(profile(iso(TODAY)), 'A', at(23, 45))).toBe(false);
    expect(nearActivityRollover(at(23, 44))).toBe(false);
  });
});

describe('배선 — 활동 뒤 재읽기는 refreshProfileAfterActivity, 설정 쓰기 뒤 재읽기는 fetchProfile 그대로', () => {
  const read = p => readFileSync(p, 'utf8');
  it('legacy 활동 경로 — 예전 채점 · update_streak 콜백', () => {
    const vocab = read('src/views/VocabPage.jsx');
    expect(vocab).toContain('if (!r?.queued) refreshProfileAfterActivity(actorId)?.catch(() => {});');
    const study = read('src/views/StudySessionPage.jsx');
    expect(study).toContain('recordActivity(recorder, () => refreshProfileAfterActivity?.(recorder));');
    const viewer = read('src/views/ViewerPage.jsx');
    for (const call of ['materialId: id, user, profile, fetchProfile: refreshProfileAfterActivity,',
      'useInlineReview({ user, fetchProfile: refreshProfileAfterActivity, toast });',
      'if (saveScopeRef.current === saveScope) refreshProfileAfterActivity(user.id);']) expect(viewer).toContain(call);
    expect(read('src/components/levels/word/LevelWordScreen.jsx')).toContain('useLevelWordGrade({ user, fetchProfile: refreshProfileAfterActivity,');
    expect(read('src/views/GrammarReviewSession.jsx')).toContain('recordActivity(user.id, () => refreshProfileAfterActivity(user.id));');
    expect(read('src/views/WritingStudioPage.jsx')).toContain('recordActivity(user.id, () => refreshProfileAfterActivity(user.id));');
  });
  it('FSRS 채점 · 세션 끝은 늘 새로 읽는다(영수증 날이 어제일 수 있다)', () => {
    expect(read('src/views/VocabPage.jsx')).toContain('if (isSettledFsrsActivity(event, actorId)) refreshProfileReadOnly(actorId)?.catch(() => {});');
    expect(read('src/views/StudySessionPage.jsx')).toContain('    fetchProfile?.(recorder);\n  }');
  });
  it('설정 화면(온보딩 · 내 정보 · 현황)은 늘 새로 읽는다', () => {
    for (const p of ['src/components/OnboardingModal.jsx', 'src/views/MyPage.jsx', 'src/views/ProfileStats.jsx']) {
      expect(read(p)).not.toContain('refreshProfileAfterActivity');
      expect(read(p)).toContain('fetchProfile(user.id, user.user_metadata)');
    }
  });
});
