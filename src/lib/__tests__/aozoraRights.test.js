import { describe, expect, it } from 'vitest';
import {
  AOZORA_RIGHTS_BASIS,
  AOZORA_RIGHTS_STATUS,
  aozoraRightsPublishable,
  aozoraWorkWithinSelection,
  validateAozoraRights,
} from '../aozoraRights.js';
import { approvedRights as approved } from './helpers/aozoraFixtures.js';

const originalOnly = { translator: null, illustrator: null };
const early = { publishedYear: 1918, authorDeathYear: 1927 };

describe('Aozora rights gate — fail-closed 증거 계약', () => {
  it('완전한 검토 기록 + 퍼블릭 도메인 + 2차 저작자 없음 + D5 안일 때만 공개', () => {
    expect(validateAozoraRights(approved())).toBe(true);
    expect(aozoraRightsPublishable(approved(), originalOnly, early)).toBe(true);
    expect(aozoraRightsPublishable(approved({ basis: AOZORA_RIGHTS_BASIS.PERMISSION }), originalOnly, early)).toBe(false);
    expect(aozoraRightsPublishable(approved(), {}, early), '번역자·삽화가 키 누락 = 미검토').toBe(false);
    expect(aozoraRightsPublishable(approved(), { ...originalOnly, translator: '別の権利者' }, early)).toBe(false);
    expect(aozoraRightsPublishable(approved(), { ...originalOnly, illustrator: '別の権利者' }, early)).toBe(false);
    expect(aozoraRightsPublishable(approved(), originalOnly), '연도를 모르면 공개하지 않는다').toBe(false);
  });

  it('검토 관할은 JP·KR·US 셋 모두(D5) — 하나라도 빠지면 승인 기록이 아니다', () => {
    for (const jurisdictions of [['JP', 'KR'], ['JP', 'US'], ['KR', 'US'], ['JP']]) {
      const rights = approved({ reviewedJurisdictions: jurisdictions });
      expect(() => validateAozoraRights(rights)).toThrow(/JP·KR·US/);
      expect(aozoraRightsPublishable(rights, originalOnly, early)).toBe(false);
    }
    expect(validateAozoraRights(approved({ reviewedJurisdictions: ['US', 'KR', 'JP', 'TW'] }))).toBe(true);
  });

  it('D5 선정 — 1931년 이전 출판 또는 1945년 이전 사망, 경계값은 제외', () => {
    expect(aozoraWorkWithinSelection({ publishedYear: 1930, authorDeathYear: 1960 })).toBe(true);
    expect(aozoraWorkWithinSelection({ publishedYear: 1940, authorDeathYear: 1944 })).toBe(true);
    expect(aozoraWorkWithinSelection({ publishedYear: 1931, authorDeathYear: 1945 })).toBe(false);
    expect(aozoraWorkWithinSelection({ publishedYear: 1946, authorDeathYear: 1948 }), '다자이형 — 미국 URAA 회복 가능').toBe(false);
    expect(aozoraWorkWithinSelection({ publishedYear: '1920', authorDeathYear: null }), '문자열 연도는 무효').toBe(false);
    expect(aozoraWorkWithinSelection({})).toBe(false);
    expect(aozoraRightsPublishable(approved(), originalOnly, { publishedYear: 1946, authorDeathYear: 1948 })).toBe(false);
  });

  it('미승인 기록은 검토용으로 유효하지만 공개하지 않는다', () => {
    const candidate = { status: AOZORA_RIGHTS_STATUS.CANDIDATE, basis: AOZORA_RIGHTS_BASIS.UNKNOWN };
    expect(validateAozoraRights(candidate)).toBe(true);
    expect(aozoraRightsPublishable(candidate, originalOnly, early)).toBe(false);
  });

  it.each([
    [{ ...approved(), reviewedBy: '' }, 'reviewedBy'],
    [{ ...approved(), reviewedAt: '2026-02-30' }, 'reviewedAt'],
    [{ ...approved(), reviewedJurisdictions: [] }, 'reviewedJurisdictions'],
    [{ ...approved(), reviewedJurisdictions: ['JPN', 'KR', 'US'] }, 'ISO alpha-2'],
    [{ ...approved(), reviewedJurisdictions: ['JP', 'JP', 'KR', 'US'] }, 'duplicates'],
    [{ ...approved(), evidenceUrl: 'http://example.com' }, 'HTTPS'],
    [{ ...approved(), basis: 'unknown' }, 'known basis'],
  ])('불완전한 승인 기록을 거부한다 (%#)', (rights, message) => {
    expect(() => validateAozoraRights(rights)).toThrow(message);
    expect(aozoraRightsPublishable(rights, originalOnly, early)).toBe(false);
  });

  it('모르는 열거값을 거부한다', () => {
    expect(() => validateAozoraRights({ status: 'published', basis: 'public-domain' })).toThrow('status');
    expect(() => validateAozoraRights({ status: 'candidate', basis: 'free' })).toThrow('basis');
  });
});
