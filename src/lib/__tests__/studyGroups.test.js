import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  GOAL_AXES,
  MAX_GROUPS_PER_USER,
  gateComments,
  goalProgress,
  groupErrorMessage,
  kstWeekStartDate,
  snapshotFromWeekly,
  sumGroupSnapshots,
} from '../studyGroups.js';
import { buildWeeklyReport } from '../weeklyReport.js';

// 계약: 학습 그룹 R1(rfc-study-groups §4.2, 오너 §9 권고안 승인 2026-08-23) —
// 원장 비공개(스냅샷 숫자만 공유)·등수 없음(합계만)·주간 경계는 kstWeekStartMs 정본.

describe('kstWeekStartDate — 스냅샷 week_start(KST 월요일 날짜)', () => {
  it('일요일(KST)도 그 주 월요일로 접힌다', () => {
    // 2026-08-23(일) 12:00 KST → 주 시작 2026-08-17(월)
    expect(kstWeekStartDate(Date.parse('2026-08-23T12:00:00+09:00'))).toBe('2026-08-17');
    // 월요일 0시 정각(KST)은 자기 자신
    expect(kstWeekStartDate(Date.parse('2026-08-17T00:00:00+09:00'))).toBe('2026-08-17');
    // 월요일 직전(일요일 23:59 KST)은 이전 주
    expect(kstWeekStartDate(Date.parse('2026-08-16T23:59:59+09:00'))).toBe('2026-08-10');
  });
});

describe('snapshotFromWeekly — 주간 리포트 → 스냅샷 행', () => {
  it('buildWeeklyReport 산출을 그대로 싣는다(정답률 대신 correct 정수 — 합계 재계산용)', () => {
    const now = Date.parse('2026-08-23T12:00:00+09:00');
    const weekly = buildWeeklyReport({
      events: [
        { source: 'vocab', correct: true, created_at: '2026-08-18T10:00:00+09:00' },
        { source: 'vocab', correct: false, created_at: '2026-08-19T10:00:00+09:00' },
        { source: 'ui', correct: true, created_at: '2026-08-19T11:00:00+09:00' }, // 비채점 — 제외
      ],
      vocabRows: [{ created_at: '2026-08-18T09:00:00+09:00' }],
      encounterRows: [{ first_met_at: '2026-08-20T09:00:00+09:00' }, { first_met_at: '2026-08-21T09:00:00+09:00' }],
      readRows: [],
      now,
    });
    expect(snapshotFromWeekly(weekly, now)).toEqual({
      week_start: '2026-08-17',
      reviews: 2,
      correct: 1,
      added: 1,
      met: 2,
      reads: 0,
    });
  });

  it('빈 리포트는 null', () => {
    expect(snapshotFromWeekly(null)).toBeNull();
  });
});

describe('sumGroupSnapshots — 이번 주 우리(그룹 합계, 등수 없음)', () => {
  it('행 합산 + 정답률 재계산', () => {
    const sum = sumGroupSnapshots([
      { reviews: 10, correct: 8, added: 3, met: 5, reads: 1 },
      { reviews: 20, correct: 14, added: 0, met: 2, reads: 0 },
    ]);
    expect(sum.reviews).toBe(30);
    expect(sum.correct).toBe(22);
    expect(sum.accuracy).toBeCloseTo(22 / 30);
    expect(sum.added).toBe(3);
    expect(sum.met).toBe(7);
    expect(sum.reads).toBe(1);
    expect(sum.hasAny).toBe(true);
  });

  it('복습 0이면 정답률 null(0 무표기 결), 전무하면 hasAny false', () => {
    const sum = sumGroupSnapshots([]);
    expect(sum.accuracy).toBeNull();
    expect(sum.hasAny).toBe(false);
    expect(sumGroupSnapshots([{ reviews: 0, correct: 0, added: 0, met: 1, reads: 0 }]).hasAny).toBe(true);
  });
});

describe('gateComments — 진도 게이트(R2, 내가 읽은 데까지만)', () => {
  const comments = [
    { id: 1, progress_pct: 0, content: 'a' },
    { id: 2, progress_pct: 40, content: 'b' },
    { id: 3, progress_pct: 82, content: 'c' },
    { id: 4, progress_pct: 95, content: 'd' },
  ];

  it('내 진도 이하만 보이고(경계 포함), 잠긴 것의 최소 지점을 안내한다', () => {
    const g = gateComments(comments, 40);
    expect(g.visible.map((c) => c.id)).toEqual([1, 2]);
    expect(g.lockedCount).toBe(2);
    expect(g.minLockedPct).toBe(82);
  });

  it('진도 0·미기록도 0% 지점 코멘트는 보인다(사전 토론 관례)', () => {
    expect(gateComments(comments, 0).visible.map((c) => c.id)).toEqual([1]);
    expect(gateComments(comments, null).visible.map((c) => c.id)).toEqual([1]);
  });

  it('전부 읽었으면 잠금 없음, 빈 목록은 전부 0', () => {
    const g = gateComments(comments, 100);
    expect(g.visible).toHaveLength(4);
    expect(g.lockedCount).toBe(0);
    expect(g.minLockedPct).toBeNull();
    expect(gateComments([], 50)).toEqual({ visible: [], lockedCount: 0, minLockedPct: null });
  });

  it('progress_pct 결측 행은 0% 취급(항상 보임)', () => {
    const g = gateComments([{ id: 9, content: 'x' }], 0);
    expect(g.visible.map((c) => c.id)).toEqual([9]);
  });
});

describe('goalProgress — 주간 공동 목표(R3, 무보상·조용한 달성)', () => {
  const sum = { reviews: 132, added: 24, met: 41, reads: 2 };

  it('축은 주간 거울 4축과 1:1(새 축 신설 금지)', () => {
    expect(Object.keys(GOAL_AXES).sort()).toEqual(['added', 'met', 'reads', 'reviews']);
  });

  it('진행은 스냅샷 합계에서 읽고, 달성 경계는 이상(≥)', () => {
    const p = goalProgress(sum, { axis: 'reviews', target: 300 });
    expect(p.current).toBe(132);
    expect(p.ratio).toBeCloseTo(132 / 300);
    expect(p.done).toBe(false);
    expect(goalProgress(sum, { axis: 'met', target: 41 }).done).toBe(true);
    expect(goalProgress(sum, { axis: 'reads', target: 1 }).ratio).toBe(1); // 초과는 100%로 접힘
  });

  it('미지정·모르는 축·target 0은 null(목표 줄 비표시)', () => {
    expect(goalProgress(sum, null)).toBeNull();
    expect(goalProgress(sum, { axis: 'streak', target: 7 })).toBeNull();
    expect(goalProgress(sum, { axis: 'reviews', target: 0 })).toBeNull();
    expect(goalProgress(null, { axis: 'reviews', target: 10 })).toBeNull();
  });
});

describe('groupErrorMessage — RPC 오류 문구', () => {
  it('세 예외를 사용자 문구로, 그 외는 일반 문구(원문 미노출)', () => {
    expect(groupErrorMessage({ message: 'invalid code' })).toContain('코드');
    expect(groupErrorMessage({ message: 'group full' })).toContain('정원');
    expect(groupErrorMessage({ message: 'group limit' })).toContain(String(MAX_GROUPS_PER_USER));
    expect(groupErrorMessage({ message: 'permission denied for table x' })).toBe('잠시 후 다시 시도해 주세요.');
  });
});

// 배선·스키마 계약 — 원칙이 코드로 표현되면 계약 테스트로 심는다(운영 규약).
describe('학습 그룹 배선 계약', () => {
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const migration = read('supabase/migrations/20260823120000_study_groups.sql');

  it('마이그레이션 — 멤버만 조회·본인 행 쓰기·anon 차단·정원 직렬화·상한 동치', () => {
    expect(migration).toContain('is_group_member');
    expect(migration).toContain('FOR UPDATE'); // join_group 정원 경쟁 직렬화
    expect(migration).toMatch(/REVOKE ALL ON public\.study_groups\s+FROM anon/);
    expect(migration).toContain('capacity   int  NOT NULL DEFAULT 8 CHECK (capacity BETWEEN 2 AND 15)');
    // 1인 그룹 상한 — 서버(RPC)와 클라이언트 상수가 같은 값(§9-2)
    expect(migration).toContain(`>= ${MAX_GROUPS_PER_USER}`);
    expect(MAX_GROUPS_PER_USER).toBe(3);
  });

  it('원장 비공개(§3-3) — 마이그레이션이 개인 학습 테이블의 RLS를 건드리지 않는다', () => {
    // 주석 제외 실제 SQL 문장만 — 원장 테이블 참조 0
    const sql = migration.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sql).not.toMatch(/review_events|user_vocabulary|user_vocab_encounters|reading_progress/);
  });

  it('그룹 화면 — 등수 없는 합계 표기·주간 재료는 프로필 카드와 같은 캐시 키·push는 스로틀 경유', () => {
    const src = read('src/views/GroupsPage.jsx');
    expect(src).toContain('등수 없음');
    expect(src).toContain("['weekly-report', user?.id]");
    expect(src).toContain('pushGroupSnapshots');
    expect(src).not.toMatch(/순위|랭킹/); // 압박 배제 결
  });

  it('홈 진입 카드(§9-5)가 홈에 배선되어 있다', () => {
    expect(read('src/views/HomePage.jsx')).toContain('useGroupEntryItem()'); // 덱 흡수(2026-08-24)
  });

  it('주간 재료 조회는 공용 모듈 하나만 — ProfileStats 중복 정의 제거', () => {
    const profile = read('src/views/ProfileStats.jsx');
    expect(profile).toContain("from '../lib/weeklyReportRows'");
    expect(profile).not.toMatch(/async function fetchWeeklyReportRows/);
  });

  /* ── R2 — 같이 읽기·진도 게이트 토론 ── */
  const r2 = read('supabase/migrations/20260823130000_study_group_reads.sql');

  it('R2 마이그레이션 — 공개 자료만 지정(서버 계약)·profiles FK·anon 차단', () => {
    expect(r2).toMatch(/visibility = 'public'/); // insert·update WITH CHECK
    expect(r2).toContain('study_group_members_user_profile_fk');
    expect(r2).toMatch(/user_id\s+uuid NOT NULL REFERENCES public\.profiles\(id\)/); // 작성자 조인 경로
    expect(r2).toMatch(/REVOKE ALL ON public\.study_group_reads\s+FROM anon/);
    expect(r2).toMatch(/REVOKE ALL ON public\.study_group_comments FROM anon/);
  });

  it('R2 마이그레이션 — 개인 원장 테이블 무접촉(자료 접근 정책도 무변경)', () => {
    const sql = r2.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sql).not.toMatch(/review_events|user_vocabulary|user_vocab_encounters|reading_progress/);
    expect(sql).not.toMatch(/ALTER TABLE public\.reading_materials|ON public\.reading_materials/);
  });

  it('뷰어 — 같이 읽기 진도 push 훅이 배선되어 있다(실패 조용히는 훅 계약)', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('useGroupReadPush(material?.id, user?.id, readProgress)');
  });

  it('그룹 화면 — 게이트 적용·잠금 안내 문구·공개 자료 후보만', () => {
    const src = read('src/views/GroupsPage.jsx');
    expect(src).toContain('gateComments');
    expect(src).toContain('거기까지 읽으면 열려요');
    const lib = read('src/lib/studyGroups.js');
    expect(lib).toContain(".eq('visibility', 'public')");
  });

  /* ── R3 — 주간 공동 목표 ── */
  it('R3 마이그레이션 — 축 CHECK·멤버 정책·anon 차단·원장 무접촉', () => {
    const r3 = read('supabase/migrations/20260823140000_study_group_goals.sql');
    expect(r3).toMatch(/axis IN \('reviews', 'added', 'met', 'reads'\)/);
    expect(r3).toContain('is_group_member');
    expect(r3).toMatch(/REVOKE ALL ON public\.study_group_goals FROM anon/);
    const sql = r3.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sql).not.toMatch(/review_events|user_vocabulary|user_vocab_encounters|reading_progress|reading_materials/);
  });

  it('목표 줄 — 조용한 달성 체크만(보상 요소 부재 계약, §9-6)', () => {
    const src = read('src/views/GroupsPage.jsx');
    expect(src).toContain('함께 해냈어요');
    expect(src).toContain('GroupGoalLine');
    // 주석(원칙 설명) 제외 코드·카피에 보상 요소 없음
    const code = src.split('\n').filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    }).join('\n');
    expect(code).not.toMatch(/보상|페널티|스탬프|젬|XP/);
  });
});
