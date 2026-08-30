import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  PACE_SLACK_DAYS, PACE_WINDOW_DAYS, countRecentDone, pace, perDayLabel,
} from '../goalPace.js';
import { buildPlan } from '../studyPlan.js';
import { REF_GRAMMAR_MANIFEST } from '../../content/refGrammarManifest.js';
import { buildContinueManifest } from '../../content/refManifest.js';

/**
 * 계약: v2-D R2 목표와 궤도 (#1077 설계 §2·§4).
 * 목표는 이미 있는 `dday_date`를 그대로 쓰고 언어·레벨 2컬럼만 는다(중복 신설 금지).
 * 계산은 순수 — 0 나눗셈을 막고, 목표가 없으면 화면이 **침묵**한다.
 * 마이그레이션은 코드로만 쓰고 컬럼 부재 폴백을 둔다(오너 적용 전에도 무해).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** KST 자정 기준으로 고정한 '지금' — 날짜 경계가 테스트 실행 시각에 흔들리지 않게. */
const NOW = Date.parse('2026-08-31T03:00:00+09:00');
const D = (n) => new Date(NOW + n * 86400000).toISOString();

describe('§4-5 침묵 — 목표가 없으면 아무 말도 하지 않는다', () => {
  it('목표일이 없으면 null', () => {
    expect(pace({ remaining: 50, now: NOW })).toBeNull();
    expect(pace({ remaining: 50, targetDate: '', now: NOW })).toBeNull();
    expect(pace({ remaining: 50, targetDate: '뭐라고?', now: NOW })).toBeNull();
  });

  it('남은 수를 모르면 null — 짐작으로 궤도를 그리지 않는다', () => {
    expect(pace({ targetDate: '2026-12-31', now: NOW })).toBeNull();
    expect(pace({ remaining: NaN, targetDate: '2026-12-31', now: NOW })).toBeNull();
  });
});

describe('§2 역산 — 남은 일수·필요 속도·예상 완료일', () => {
  it('하루에 몇 개가 필요한지 = 남은 것 ÷ 남은 날', () => {
    const p = pace({ remaining: 50, targetDate: '2026-12-31', recentDone: 7, now: NOW });
    expect(p.daysLeft).toBe(122);
    expect(p.needPerDay).toBeCloseTo(50 / 122, 5);
    expect(p.actualPerDay).toBeCloseTo(0.5, 5);      // 14일에 7개
  });

  it('지금 속도면 언제 끝나는지 — 목표일과의 차이가 판정의 근거', () => {
    // 남은 50, 하루 0.5 → 100일 뒤(12/09). 목표 12/31보다 22일 이르다.
    const p = pace({ remaining: 50, targetDate: '2026-12-31', recentDone: 7, now: NOW });
    expect(p.etaDate).toBe('2026-12-09');
    expect(p.gapDays).toBe(-22);
    expect(p.verdict).toBe('여유');
  });

  it('판정은 세 단계뿐 — 벌칙도 독촉도 없다(Beeminder 배제)', () => {
    expect(PACE_SLACK_DAYS).toBe(7);
    const at = (recentDone) => pace({ remaining: 50, targetDate: '2026-12-31', recentDone, now: NOW }).verdict;
    expect(at(7)).toBe('여유');      // 22일 이름
    expect(at(6)).toBe('적정');      // 117일 → 5일 이름
    expect(at(5)).toBe('이탈');      // 140일 → 18일 늦음
  });

  it('기한이 지났는데 남아 있으면 이탈 — 남은 날로 나누지 않는다(0 나눗셈)', () => {
    const p = pace({ remaining: 5, targetDate: '2026-08-01', recentDone: 7, now: NOW });
    expect(p.daysLeft).toBeLessThan(0);
    expect(Number.isFinite(p.needPerDay)).toBe(true);
    expect(p.needPerDay).toBe(5);
    expect(p.verdict).toBe('이탈');
  });

  it('오늘이 목표일이어도 나눗셈이 성립한다', () => {
    const p = pace({ remaining: 3, targetDate: '2026-08-31', recentDone: 7, now: NOW });
    expect(p.daysLeft).toBe(0);
    expect(p.needPerDay).toBe(3);
  });

  it('최근 진도가 0이면 예상 완료일을 짓지 않는다 — ∞ 대신 모른다고 말한다', () => {
    const p = pace({ remaining: 50, targetDate: '2026-12-31', recentDone: 0, now: NOW });
    expect(p.actualPerDay).toBe(0);
    expect(p.etaDate).toBeNull();
    expect(p.gapDays).toBeNull();
    expect(p.verdict).toBeNull();
  });

  it('다 했으면 궤도가 없다 — 축하 한 줄이면 된다', () => {
    const p = pace({ remaining: 0, targetDate: '2026-12-31', recentDone: 7, now: NOW });
    expect(p.done).toBe(true);
    expect(p.verdict).toBeNull();
  });

  it('표기는 소수 한 자리 — "하루 0.4챕터"', () => {
    expect(perDayLabel(0.44)).toBe('0.4');
    expect(perDayLabel(2)).toBe('2');
    expect(perDayLabel(0)).toBe('0');
    expect(perDayLabel(NaN)).toBe('0');
  });
});

describe('최근 속도 — 무엇을 "요즘 하고 있는 것"으로 치는가', () => {
  const slugs = new Set(['a', 'b', 'c']);

  it('창 안에서 끝낸 계획 챕터만 센다', () => {
    expect(PACE_WINDOW_DAYS).toBe(14);
    const rows = [
      { slug: 'a', read: true, updated_at: D(-1) },
      { slug: 'b', passed: true, updated_at: D(-13) },
      { slug: 'c', read: true, updated_at: D(-30) },   // 창 밖
    ];
    expect(countRecentDone(rows, slugs, { now: NOW })).toBe(2);
  });

  it('안 끝난 챕터·계획 밖 slug는 속도가 아니다 — 독해 트랙(rt:)이 섞여도 부풀지 않는다', () => {
    const rows = [
      { slug: 'a', read: false, updated_at: D(-1) },
      { slug: 'a', passed: false, read: true, updated_at: D(-1) },  // 체크 탈락
      { slug: 'rt:zh-001', read: true, updated_at: D(-1) },
      { slug: 'zzz', read: true, updated_at: D(-1) },
    ];
    expect(countRecentDone(rows, slugs, { now: NOW })).toBe(0);
  });

  it('같은 챕터가 두 행으로 와도 한 번만 센다(옛 slug 별칭 포함)', () => {
    const frSlugs = new Set(['a1-11-gender']);
    const rows = [
      { slug: 'a1-11-gender', read: true, updated_at: D(-1) },
      { slug: 'a0-06-gender', passed: true, updated_at: D(-2) },   // rename 전 이름
    ];
    expect(countRecentDone(rows, frSlugs, { now: NOW })).toBe(1);
  });

  it('망가진 시각·빈 입력은 조용히 버린다 — 진단 도구가 화면을 깨뜨리지 않는다', () => {
    expect(countRecentDone([{ slug: 'a', read: true, updated_at: null }], slugs, { now: NOW })).toBe(0);
    expect(countRecentDone(null, slugs, { now: NOW })).toBe(0);
    expect(countRecentDone([{ slug: 'a', read: true, updated_at: D(-1) }], new Set(), { now: NOW })).toBe(0);
  });
});

describe('정본의 두 투영 — 홈과 관리자 진도표가 같은 계획을 본다', () => {
  it('continueManifest로 세운 계획이 정본 계획과 같다 — 갈리면 "남은 47"이 화면마다 달라진다', () => {
    const cont = buildContinueManifest();
    for (const lang of ['Chinese', 'French', 'Japanese', 'English']) {
      const canon = buildPlan(REF_GRAMMAR_MANIFEST, lang);
      const home = buildPlan({ languages: cont }, lang);
      expect(home.totalChapters, `${lang} 챕터 수`).toBe(canon.totalChapters);
      expect(home.levels.map((l) => l.key), `${lang} 레벨 순서`).toEqual(canon.levels.map((l) => l.key));
      expect(home.levels.flatMap((l) => l.chapters).map((c) => c.slug), `${lang} slug 순서`)
        .toEqual(canon.levels.flatMap((l) => l.chapters).map((c) => c.slug));
    }
  });

  it('레벨 이름은 어느 투영에서든 나온다 — levelMeta가 없으면 레벨 자신의 것', () => {
    const home = buildPlan({ languages: buildContinueManifest() }, 'Chinese', { upto: 'H5' });
    expect(home.levels[0].label).toBeTruthy();
    expect(home.levels[0].label).not.toBe(home.levels[0].key);
  });
});

describe('조회 — 이미 쌓이는 것을 읽기만 한다', () => {
  const rows = codeOf(read('src/lib/goalRows.js'));

  it('R1과 같은 테이블·같은 행, 속도를 재려고 updated_at 한 칸만 더', () => {
    expect(rows).toContain("from('user_ref_progress')");
    expect(rows).toContain("select('lang, slug, read, passed, updated_at')");
    for (const banned of ['insert(', 'upsert(', 'delete(', 'update(']) {
      expect(rows, `궤도 조회가 ${banned}를 하면 안 된다`).not.toContain(banned);
    }
  });

  it('실패는 빈 배열 — 궤도 줄만 빠지고 홈은 그대로 돈다', () => {
    expect(rows).toContain('if (!userId || !lang) return [];');
    expect(rows).toMatch(/catch \{[\s\S]*?return \[\];/);
  });
});

describe('§2 저장 — dday_date 재사용 + 2컬럼, 그리고 적용 전 무해', () => {
  const stats = read('src/views/ProfileStats.jsx');

  it('마이그레이션은 컬럼 2개뿐 — 날짜 컬럼을 새로 만들지 않는다', () => {
    const sql = read('supabase/migrations/20260831010000_profile_goal.sql');
    expect(sql).toContain('add column if not exists goal_lang');
    expect(sql).toContain('add column if not exists goal_level');
    expect(sql).not.toMatch(/add column if not exists goal_date/);
    expect(sql).not.toMatch(/create table/i);
  });

  it('컬럼 부재 폴백 — 오너가 적용하기 전에도 D-Day 저장이 깨지지 않는다', () => {
    const persist = sliceBetween(stats, 'async function persist(', '\n  }');
    expect(persist).toContain('goal_lang:');
    expect(persist).toContain('goal_level:');
    // 미적용 환경에서 미지 컬럼이 payload에 있으면 PostgREST가 요청 전체를 거부한다
    expect(persist).toMatch(/column\|schema/);
    expect(persist).toContain('dday_date:');
    // 폴백을 조용히 삼키면 "과정을 골랐는데 궤도가 안 뜬다"가 된다
    expect(persist).toContain('목표 과정은 아직 준비 중이에요');
  });

  it('목표 날짜는 dday_date 하나 — 두 날짜가 서로 다른 날을 가리키면 안 된다', () => {
    expect(codeOf(stats)).not.toContain('goal_date');
  });
});

describe('배선 — 목표를 세운 사람에게만, 세울 곳은 한 군데', () => {
  const stats = read('src/views/ProfileStats.jsx');

  it('궤도 줄은 목표가 다 갖춰졌을 때만 뜬다(설계 §4 계약 5)', () => {
    expect(stats).toContain('if (!goalLang || !goalLevel || !goalDate) return null;');
  });

  it('D-Day 타일은 목표가 없어도 자리를 지킨다 — 숨김이 "위젯 사라짐"으로 읽혔다', () => {
    // 타일 자체는 조건 없이 그려진다(2026-08-30 오너 확정 "상시 표시"의 결).
    expect(stats).toContain('<DdayTile refManifest={refManifest} />');
    expect(stats).not.toMatch(/\{\s*\w+\s*&&\s*<DdayTile/);
  });

  it('목표를 고치는 자리는 D-Day 모달 하나 — 날짜와 과정이 두 화면으로 갈리지 않는다', () => {
    expect(stats).toContain('목표 · D-Day');
    expect(stats).toContain('setGoalLang(');
    expect(stats).toContain('setGoalLevel(');
  });

  it('궤도는 순수 함수가 계산한다 — 화면이 날짜 산수를 다시 하지 않는다', () => {
    const card = codeOf(sliceBetween(stats, 'function GoalTrackCard(', '\n}'));
    expect(card).toContain('pace({');
    expect(card).toContain('countRecentDone(');
    // 하루의 밀리초가 카드 안에 다시 나타나면 KST 경계가 두 벌이 된다
    expect(card).not.toMatch(/86400000/);
    // 계획도 관리자 진도표와 같은 함수로 — 챕터 수가 갈리면 남은 수가 갈린다
    expect(card).toContain('buildPlan({ languages: refManifest }');
    expect(card).toContain('markProgress(plan, rows)');
  });
});
