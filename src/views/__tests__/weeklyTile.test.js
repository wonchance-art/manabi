import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'src/views/ProfileStats.jsx'), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(cronRegistration 선례). */
const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * '오늘 활동' 타일 폐지 + '이번 주' 타일화 (오너 확정 2026-08-26).
 *
 * 오늘 활동은 ⑴ 챕터 수가 이 기기 localStorage 한정 ⑵ 단어 축은 '오늘 목표' 타일과
 * 중복 ⑶ 활동한 날에도 0을 크게 보여줘 0 무표기 원칙과 충돌 — 반쪽 지표였다.
 * 주간 거울은 4×1 카드에서 그 1×1 자리로 줄이고, 전체 내용은 탭 모달로 옮긴다.
 */
describe('홈 통계 그리드 — 오늘 활동 폐지·이번 주 타일화', () => {
  it("'오늘 활동' 타일과 그 반쪽 산식이 코드에 없다", () => {
    expect(code).not.toContain('오늘 활동');
    expect(code).not.toContain('chapterActivityToday');
    expect(code).not.toContain('todayActivity');
  });

  it('이번 주는 1×1 스탯 타일 — 4×1 와이드 카드로 되돌아가지 않는다', () => {
    expect(code).toMatch(/WeeklyTile[\s\S]{0,600}?bento--1x1/);
    // 지키려는 것은 "주간 거울이 와이드로 부활하지 않는다"이지 "4×1 카드가 몇 개냐"가
    // 아니다. 총량으로 세면 무관한 카드 하나(v2-D R2 궤도 줄)에도 깨져 의도를 못 말한다
    // — 통짜 문자열 배선 계약에서 겪은 그 일. 주간 컴포넌트 안쪽만 본다.
    for (const fn of ['function WeeklyTile(', 'function WeeklyReportCard(']) {
      const at = code.indexOf(fn);
      expect(at, `${fn} 를 못 찾았다`).toBeGreaterThan(-1);
      expect(code.slice(at, at + 1600)).not.toContain('bento--4x1');
    }
  });

  it('빈 주에도 타일은 자리를 지킨다(오너 확정 2026-08-30 상시 표시) — 게이트는 로드 대기만', () => {
    // hasAny 게이트 부활 금지 — 숨김이 "위젯 사라짐"으로 읽혔다. 값은 스트릭 '–' 선례.
    expect(code).toContain('weekly && <WeeklyTile');
    expect(code).not.toContain('weekly?.hasAny && <WeeklyTile');
    expect(code).toMatch(/readsCompleted > 0[\s\S]{0,120}?\['–', '이번 주'\]/);
  });

  it('빈 주 모달도 빈 껍데기가 아니다 — 기록 없음 한 줄', () => {
    expect(code).toMatch(/!weekly\.hasAny[\s\S]{0,200}?이번 주 기록이 아직 없어요/);
  });

  it('탭하면 전체 거울 — TileModal 정본 재사용, 카드 머리는 모달 제목과 중복 금지', () => {
    expect(code).toMatch(/WeeklyTile[\s\S]{0,1200}?<TileModal/);
    expect(code).toMatch(/<WeeklyReportCard weekly=\{weekly\} header=\{false\} \/>/);
  });

  it('대표 축 폴백 사슬 — 복습이 0이어도 빈 타일이 아니라 다음 축을 보여준다', () => {
    expect(code).toMatch(/reviews\.total > 0[\s\S]{0,200}?newWords > 0[\s\S]{0,120}?metWords > 0[\s\S]{0,120}?readsCompleted/);
  });
});
