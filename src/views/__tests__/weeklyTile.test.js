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
    // 4x1은 오류 배너 하나만 남는다(주간 카드가 와이드로 부활하면 2개가 된다)
    expect(code.match(/bento--4x1 card/g)).toHaveLength(1);
  });

  it('전 축 0이면 타일 자체가 없다 — hasAny 게이트(0 무표기)', () => {
    expect(code).toContain('weekly?.hasAny && <WeeklyTile');
  });

  it('탭하면 전체 거울 — TileModal 정본 재사용, 카드 머리는 모달 제목과 중복 금지', () => {
    expect(code).toMatch(/WeeklyTile[\s\S]{0,1200}?<TileModal/);
    expect(code).toMatch(/<WeeklyReportCard weekly=\{weekly\} header=\{false\} \/>/);
  });

  it('대표 축 폴백 사슬 — 복습이 0이어도 빈 타일이 아니라 다음 축을 보여준다', () => {
    expect(code).toMatch(/reviews\.total > 0[\s\S]{0,200}?newWords > 0[\s\S]{0,120}?metWords > 0[\s\S]{0,120}?readsCompleted/);
  });
});
