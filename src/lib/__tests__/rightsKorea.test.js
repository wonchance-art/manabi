import { describe, expect, it } from 'vitest';
import { KR_PRE_EXTENSION_DEATH_YEAR, koreaPublicDomainVerdict, koreaTermExpired, originTermExpired } from '../rightsKorea.js';

// 정본 책 권리 선의 공통 정본(오너 「미국 기준 없애」 2026-10-17 KST) — 한국 저작권법: ① 한국 보호기간 만료(1962년 이전 사망 —
// 2013-07-01 연장 전에 끝남 — 또는 사후 70년) · ② 본국 만료(제3조 제4항 상호주의). 미국 선은 미국 원산의 ②에서만.

const at = (fields) => koreaPublicDomainVerdict({ publishedYear: 1940, rights: { reviewedAt: '2026-10-17' }, ...fields });

describe('① 한국 보호기간', () => {
  it('1962년 이전 사망은 만료(사후 50년 시절에 끝남) · 그 뒤는 사후 70년', () => {
    expect(KR_PRE_EXTENSION_DEATH_YEAR).toBe(1962);
    expect(koreaTermExpired(1962, 2026)).toBe(true);
    expect(koreaTermExpired(1963, 2026)).toBe(false);
    expect(koreaTermExpired(1963, 2034)).toBe(true); // 사후 70년 — 2033년 말 만료
    expect(koreaTermExpired(undefined, 2026)).toBe(false);
  });
});

describe('② 본국 보호기간', () => {
  it('중국 50 · 영국·아일랜드·한국 70 · 프랑스 70(+전쟁 30) · 미국은 출판 95년 · 규칙 없는 나라는 막힌다', () => {
    expect(originTermExpired({ authorDeathYear: 1975, countryOfOrigin: 'CN' }, 2026).expired).toBe(true);
    expect(originTermExpired({ authorDeathYear: 1976, countryOfOrigin: 'CN' }, 2026).expired).toBe(false);
    expect(originTermExpired({ authorDeathYear: 1955, countryOfOrigin: 'IE' }, 2026).expired).toBe(true);
    expect(originTermExpired({ authorDeathYear: 1950, countryOfOrigin: 'FR', mortPourLaFrance: true }, 2026).expired).toBe(false);
    expect(originTermExpired({ authorDeathYear: 1950, countryOfOrigin: 'FR' }, 2026).reason).toMatch(/mortPourLaFrance/u);
    expect(originTermExpired({ publishedYear: 1930, countryOfOrigin: 'US' }, 2026).expired).toBe(true);
    expect(originTermExpired({ publishedYear: 1931, countryOfOrigin: 'US' }, 2026).expired).toBe(false);
    expect(originTermExpired({ authorDeathYear: 1900, countryOfOrigin: 'DE' }, 2026).reason).toMatch(/판정 규칙이 없다/u);
  });
});

describe('한국 공개 가능 = ① 또는 ②', () => {
  it('이번 묶음 실제 작가들', () => {
    expect(at({ authorDeathYear: 1961, publishedYear: 1952, countryOfOrigin: 'US' })).toMatchObject({ ok: true, basis: 'korea-term' }); // 헤밍웨이 「노인과 바다」
    expect(at({ authorDeathYear: 1960, publishedYear: 1942, countryOfOrigin: 'FR', mortPourLaFrance: false })).toMatchObject({ ok: true, basis: 'korea-term' }); // 카뮈
    expect(at({ authorDeathYear: 1944, publishedYear: 1943, countryOfOrigin: 'FR', mortPourLaFrance: true })).toMatchObject({ ok: true, basis: 'korea-term' }); // 생텍쥐페리
    expect(at({ authorDeathYear: 1950, publishedYear: 1949, countryOfOrigin: 'GB' })).toMatchObject({ ok: true, basis: 'korea-term' }); // 오웰
    expect(at({ authorDeathYear: 1966, countryOfOrigin: 'CN' })).toMatchObject({ ok: true, basis: 'origin-term' }); // 老舍 — 중국 사후 50년
    expect(at({ authorDeathYear: 1970, countryOfOrigin: 'GB' }).ok).toBe(false); // 버트런드 러셀형 — 두 쪽 모두 보호 중
    expect(at({ authorDeathYear: 2000, countryOfOrigin: 'KR' }).ok).toBe(false); // 황순원
  });
  it('기록 누락 · 번역본은 불가(fail-closed)', () => {
    expect(at({ authorDeathYear: 1900, countryOfOrigin: 'GB', translator: 'X' }).ok).toBe(false);
    expect(at({ authorDeathYear: 1900, countryOfOrigin: 'GB', rights: {} }).ok).toBe(false);
    expect(at({ authorDeathYear: 1900 }).ok).toBe(false);
  });
});
