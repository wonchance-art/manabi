// FSRS 엔진 고정(FSRS-ENGINE-PIN-001, 2026-11-04 KST — 오케스트레이션 주간 트렌드 발주 「ts-fsrs 5.3.2 → 5.4.2 패치 검토」).
//
// 저장된 카드마다 engine 문자열(`FSRS_POLICY.engine` = ts-fsrs의 FSRSVersion)이 실려 있고, 두 곳이 그 문자열과 정확히 같을 때만 받는다:
//   ① 브라우저 validateFsrsCard — `FSRSVersion !== FSRS_POLICY.engine`이면 unverified_fsrs_engine, 카드 engine이 다르면 unsupported_fsrs_card
//   ② DB fsrs_private.valid_card — 같은 문자열 리터럴(마이그레이션 20261005081200 · core 계약 지문 안)
// 그래서 ts-fsrs 판을 올리는 것은 「패치」가 아니라 계약 변경이다 — 모든 카드의 engine · valid_card · core 지문 재게시를 같이 옮겨야 한다.
// 예전 범위 `^5.3.2`는 잠금 파일을 새로 풀기만 해도 5.4.x를 받아 모든 카드를 거절할 수 있었다 → 정확한 판으로 묶는다.
//
// 5.4.2 검토(같은 날, 읽기 · 로컬 대조): 바뀐 셈은 w17/w18 상한(재학습 단계 2개 이상일 때만) · 매개변수 clip · NaN · 0점 거부.
// 우리 설정(기본 매개변수 · 재학습 1단계 · enable_short_term · fuzz 끔)으로 두 판을 나란히 돌린 결과 — 기본 w 같음,
// next_state/next_interval 격자 15,504칸 차이 0, 무작위 채점 200카드 × 40회 갈라짐 0. 일정이 바뀌지 않으므로 지금 올릴 이득이 없다(보류).
// 올릴 때의 길: engine 두 문자열을 함께 받는 판(DB valid_card · validateFsrsCard) → 카드 engine 일괄 이전 → 옛 문자열 거절, 지문 재게시는 각 단계 마이그레이션.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FSRSVersion } from 'ts-fsrs';
import { FSRS_POLICY } from '../fsrsScheduler.js';

const PIN = '5.3.2';
const read = f => fs.readFileSync(f, 'utf8');

describe('FSRS 엔진 판 — 카드 · DB 계약과 같은 판으로 묶는다', () => {
  it('package.json은 범위가 아니라 정확한 판', () => {
    expect(JSON.parse(read('package.json')).dependencies['ts-fsrs']).toBe(PIN);
  });
  it('잠금 파일 · 설치본이 같은 판', () => {
    const lock = JSON.parse(read('package-lock.json'));
    expect(lock.packages['']?.dependencies?.['ts-fsrs']).toBe(PIN);
    expect(lock.packages['node_modules/ts-fsrs'].version).toBe(PIN);
    expect(JSON.parse(read('node_modules/ts-fsrs/package.json')).version).toBe(PIN);
  });
  it('설치된 엔진 문자열 = 카드 · 정책의 engine', () => {
    expect(FSRSVersion).toBe(FSRS_POLICY.engine);
    expect(FSRS_POLICY.engine.startsWith(`v${PIN} `)).toBe(true);
  });
  it('DB valid_card가 받는 문자열도 같다(마이그레이션 리터럴)', () => {
    const files = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'));
    const carriers = files.filter(f => read(`supabase/migrations/${f}`).includes(`'${FSRS_POLICY.engine}'`));
    expect(carriers.length).toBeGreaterThan(0);
  });
});
