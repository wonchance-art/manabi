import { describe, expect, it } from 'vitest';
import { PROD, PROD_LATER, containsProductionConstants, localize } from '../../../supabase/tests/lib/production-constants.mjs';

// PGlite 검사의 운영 상수 → fixture 지역값 치환(FINGERPRINT-REPIN-002). 수리 마이그레이션 본문은 그대로, 여섯 양만 바꾼다.
const local = { pin: 'a'.repeat(32), live: 'b'.repeat(32), core: 'c'.repeat(32), manual: 'd'.repeat(32), admission: 'e'.repeat(32), profile: 'f'.repeat(32) };

describe('production-constants', () => {
  it('KO-CAP 전 상태의 여섯 상수를 같은 양의 지역값으로 바꾼다', () => {
    const sql = Object.entries(PROD).map(([key, value]) => `-- ${key}\nSELECT '${value}';`).join('\n');
    const out = localize(sql, local);
    for (const [key, value] of Object.entries(PROD)) {
      expect(out).not.toContain(value);
      expect(out).toContain(`-- ${key}\nSELECT '${local[key]}';`);
    }
  });
  it('191500 뒤 운영 core(b2771b04…)도 core 지역값으로 — P2 · P3 초안이 전제하는 상태', () => {
    expect(PROD_LATER.core).toEqual(['b2771b0426e2cb6aefe776edc9d0f108']);
    const sql = "IF core <> 'b2771b0426e2cb6aefe776edc9d0f108' OR live <> 'da2c7548aa782ebb81d55e69d913cd52' THEN RAISE";
    expect(containsProductionConstants(sql)).toBe(true);
    expect(localize(sql, local)).toBe(`IF core <> '${local.core}' OR live <> '${local.live}' THEN RAISE`);
  });
  it('운영 상수가 없는 파일은 대상이 아니고, 템플릿 · 지문 md5는 바꾸지 않는다', () => {
    expect(containsProductionConstants("SELECT '4a497440fb53bc1a27c1975875c7d737', '2e57290ce85b8f034f7f304dfdea3ad9'")).toBe(false);
    expect(localize("x '4a497440fb53bc1a27c1975875c7d737'", local)).toBe("x '4a497440fb53bc1a27c1975875c7d737'");
  });
  it('같은 양의 이전 · 나중 운영 값이 주석 밖에 함께 있으면 던진다 — 주석(-- · /* */) 속 언급은 괜찮다', () => {
    const [earlier, later] = [PROD.core, PROD_LATER.core[0]];
    expect(() => localize(`IF core = '${earlier}' THEN x; ELSIF core = '${later}' THEN y; END IF;`, local)).toThrow(/core의 운영 값 여럿/);
    expect(localize(`-- 예전 값 '${earlier}'을 재현함\n/* 메모: ${earlier} */\nIF core <> '${later}' THEN RAISE`, local))
      .toBe(`-- 예전 값 '${local.core}'을 재현함\n/* 메모: ${local.core} */\nIF core <> '${local.core}' THEN RAISE`);
    // 다른 양의 값은 함께 있어도 된다(core 이전 값 + live)
    expect(() => localize(`'${earlier}' '${PROD.live}'`, local)).not.toThrow();
  });
  it('코드에 쓰인 서로 다른 양이 같은 지역값이 되면 던진다 — 이미 고친 상태(게시 = 실제)를 지금 값으로 흉내 내지 않는다', () => {
    const sql = `IF pinned = '${PROD.pin}' THEN x; ELSIF pinned = '${PROD.live}' THEN y; END IF;`;
    expect(() => localize(sql, { ...local, pin: local.live })).toThrow(/pin와 live가 같은 지역값/);
    expect(localize(sql, local)).toBe(`IF pinned = '${local.pin}' THEN x; ELSIF pinned = '${local.live}' THEN y; END IF;`);
    // 코드에 한쪽만 있으면(다른 쪽은 주석뿐) 상관없다
    expect(() => localize(`-- 예전 게시값 ${PROD.pin}\nIF live <> '${PROD.live}' THEN RAISE`, { ...local, pin: local.live })).not.toThrow();
  });
  it('지역값이 빠지면 던진다(일부만 바꾸면 검사가 엉뚱한 이유로 실패한다)', () => {
    const { profile, ...partial } = local;
    expect(profile).toBeTruthy();
    expect(() => localize(`'${PROD.core}'`, partial)).toThrow(/profile/);
    expect(() => localize(`'${PROD.core}'`, { ...local, core: 'not-a-hash' })).toThrow(/core/);
  });
});
