import { describe, expect, it } from 'vitest';
import {
  AOZORA_RIGHTS_BASIS,
  AOZORA_RIGHTS_STATUS,
  aozoraRightsPublishable,
  validateAozoraRights,
} from '../aozoraRights.js';

const approved = (overrides = {}) => ({
  status: AOZORA_RIGHTS_STATUS.APPROVED,
  basis: AOZORA_RIGHTS_BASIS.PUBLIC_DOMAIN,
  reviewedBy: 'owner',
  reviewedAt: '2026-09-09',
  reviewedJurisdictions: ['JP', 'KR'],
  evidenceUrl: 'https://www.aozora.gr.jp/cards/000000/card1.html',
  ...overrides,
});

describe('Aozora rights gate', () => {
  it('accepts a complete review but only publishes public-domain originals without secondary creators', () => {
    expect(validateAozoraRights(approved())).toBe(true);
    expect(aozoraRightsPublishable(approved(), { translator: null, illustrator: null })).toBe(true);
    expect(aozoraRightsPublishable(approved({ basis: 'permission' }), {})).toBe(false);
    expect(aozoraRightsPublishable(approved(), {})).toBe(false);
    expect(aozoraRightsPublishable(approved(), { translator: '別の権利者' })).toBe(false);
    expect(aozoraRightsPublishable(approved(), { illustrator: '別の権利者' })).toBe(false);
  });

  it('keeps non-approved records valid for review but not publishable', () => {
    const candidate = { status: 'candidate', basis: 'unknown' };
    expect(validateAozoraRights(candidate)).toBe(true);
    expect(aozoraRightsPublishable(candidate)).toBe(false);
  });

  it.each([
    [{ ...approved(), reviewedBy: '' }, 'reviewedBy'],
    [{ ...approved(), reviewedAt: '2026-02-30' }, 'reviewedAt'],
    [{ ...approved(), reviewedJurisdictions: [] }, 'reviewedJurisdictions'],
    [{ ...approved(), reviewedJurisdictions: ['JPN'] }, 'ISO alpha-2'],
    [{ ...approved(), reviewedJurisdictions: ['JP', 'JP'] }, 'duplicates'],
    [{ ...approved(), evidenceUrl: 'http://example.com' }, 'HTTPS'],
    [{ ...approved(), basis: 'unknown' }, 'known basis'],
  ])('rejects incomplete approved reviews', (rights, message) => {
    expect(() => validateAozoraRights(rights)).toThrow(message);
    expect(aozoraRightsPublishable(rights)).toBe(false);
  });

  it('rejects unknown enum values', () => {
    expect(() => validateAozoraRights({ status: 'published', basis: 'public-domain' })).toThrow('status');
    expect(() => validateAozoraRights({ status: 'candidate', basis: 'free' })).toThrow('basis');
  });
});
