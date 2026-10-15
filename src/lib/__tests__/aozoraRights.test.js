import { describe, expect, it } from 'vitest';
import {
  AOZORA_RIGHTS_BASIS,
  AOZORA_RIGHTS_STATUS,
  aozoraRightsPublishable,
  aozoraJurisdictionVerdict,
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

  it('검토 관할은 JP·KR 두 곳(D5 개정 2026-10-15) — 하나라도 빠지면 승인 기록이 아니다', () => {
    for (const jurisdictions of [['JP'], ['KR'], ['JP', 'US'], ['KR', 'US']]) {
      const rights = approved({ reviewedJurisdictions: jurisdictions });
      expect(() => validateAozoraRights(rights)).toThrow(/JP·KR/);
      expect(aozoraRightsPublishable(rights, originalOnly, early)).toBe(false);
    }
    // 개정 전 기록(JP·KR·US)도 그대로 유효하다
    expect(validateAozoraRights(approved({ reviewedJurisdictions: ['JP', 'KR', 'US'] }))).toBe(true);
    expect(validateAozoraRights(approved({ reviewedJurisdictions: ['KR', 'JP', 'TW'] }))).toBe(true);
  });

  it('D5 선정(오너 개정 2026-10-15 「일본에서만 끝나면 그만」) — 작가 1968년 이전 사망. 출판 연도·미국은 보지 않는다', () => {
    expect(aozoraWorkWithinSelection({ publishedYear: 1948, authorDeathYear: 1948 }), '太宰형 — 일본 만료(미국은 URAA로 보호 중이어도 된다)').toBe(true);
    expect(aozoraWorkWithinSelection({ publishedYear: 1946, authorDeathYear: 1955 }), '坂口安吾형').toBe(true);
    expect(aozoraWorkWithinSelection({ publishedYear: 1921, authorDeathYear: 1967 })).toBe(true);
    expect(aozoraWorkWithinSelection({ publishedYear: 1921, authorDeathYear: 1968 }), '경계 — 1968년 사망은 일본에서 보호(70년)').toBe(false);
    expect(aozoraWorkWithinSelection({ publishedYear: 1926, authorDeathYear: 1972 }), '川端형 — JP 보호').toBe(false);
    expect(aozoraWorkWithinSelection({ publishedYear: 1920, authorDeathYear: null }), '사망 연도 모름 — JP 판정 불가').toBe(false);
    expect(aozoraWorkWithinSelection({ publishedYear: '1920', authorDeathYear: '1920' }), '문자열 연도는 무효').toBe(false);
    expect(aozoraWorkWithinSelection({})).toBe(false);
    // US는 참고 표시만 — ok에 들어가지 않는다
    expect(aozoraJurisdictionVerdict({ publishedYear: 1948, authorDeathYear: 1948 })).toEqual({ JP: true, KR: true, US: false, ok: true });
    expect(aozoraJurisdictionVerdict({ publishedYear: 1926, authorDeathYear: 1972 })).toEqual({ JP: false, KR: false, US: true, ok: false });
    expect(aozoraJurisdictionVerdict({ publishedYear: 1925, authorDeathYear: 1965 })).toEqual({ JP: true, KR: true, US: true, ok: true });
    expect(aozoraRightsPublishable(approved(), originalOnly, { publishedYear: 1948, authorDeathYear: 1948 })).toBe(true);
    expect(aozoraRightsPublishable(approved(), originalOnly, { publishedYear: 1926, authorDeathYear: 1972 })).toBe(false);
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
