import { describe, expect, it } from 'vitest';
import etym from '../data/hanjaEtym.json';
import ko from '../data/hanjaKo.json';

// 계약: hanjaEtym.json 데이터 정본(빌드 스크립트 scripts/build-hanja-etym.mjs 산출).
// 원천: Unihan per-property(Unicode License) + BabelStone IDS(자유 이용 명문 — 조사 2026-08-28).
// 여기 핀이 깨지면 재생성이 회귀한 것이다 — 원천 커밋은 스크립트 헤더가 정본.

describe('hanjaEtym 데이터 정본', () => {
  it('스팟 핀 — 想·语·干 (형식: [획수, 부수, 성분들, 번체, 간체])', () => {
    expect(etym['想']).toEqual([13, '心', '相心']);
    expect(etym['语'].slice(0, 4)).toEqual([9, '言', '讠吾', '語']);
    expect(etym['干'][3]).toContain('乾'); // 다중 번체(乾·幹) — 자기 제외 최대 2자
  });

  it('우주 = hanjaKo 키(URO 20,902)와 동일 — 획수·부수는 전량 커버', () => {
    const keys = Object.keys(etym);
    expect(keys.length).toBe(20902);
    const missing = keys.filter((k) => !ko[k]);
    expect(missing).toEqual([]);
  });

  it('닫힘성 — 모든 성분이 URO(hanjaKo 키)다: 성분 칩의 음 라벨이 항상 성립(빌드 규칙 계약)', () => {
    const bad = [];
    for (const [ch, e] of Object.entries(etym)) {
      for (const c of e[2] || '') {
        if (!ko[c]) bad.push(`${ch}:${c}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('분해에 IDC 연산자·비한자 잔재가 없다(부분 분해 금지 규칙)', () => {
    const idc = /[⿰-⿿㇯〾]/;
    const bad = [];
    for (const [ch, e] of Object.entries(etym)) {
      const c = e[2] || '';
      if (idc.test(c)) bad.push(ch);
      if (c && [...c].length < 2) bad.push(`${ch}(단일)`);
    }
    expect(bad).toEqual([]);
  });

  it('부수 글자는 자기 자신이 부수다 — 214 자기검증의 산물 스팟', () => {
    for (const r of ['心', '木', '水', '言', '金', '龠']) expect(etym[r][1]).toBe(r);
  });

  it('분해 커버리지가 크게 후퇴하면 원천·필터가 잘못된 것(실측 17,939 — 하한 16,000)', () => {
    const n = Object.values(etym).filter((e) => e[2]).length;
    expect(n).toBeGreaterThan(16000);
  });

  // R5(오너 승인 2026-08-28): 구자체 슬롯[5] — 신자체 고유 자형의 정자.
  it('구자체 스팟 핀 — 신자체 고유 자형에 正이 잡히고, 간체=신자체인 글자는 繁이 담당(중복 저장 금지)', () => {
    expect(etym['楽'][5]).toBe('樂');
    expect(etym['駅'][5]).toBe('驛');
    expect(etym['円'][5]).toBe('圓');
    expect(etym['塩'][5]).toBe('鹽');
    expect(etym['学'][3]).toBe('學');
    expect(etym['学'][5] || '').toBe('');
    const n = Object.values(etym).filter((e) => e[5]).length;
    expect(n).toBeGreaterThan(200); // 실측 280 — 급감하면 역전·필터 회귀
  });

  it('正 칩 무결 — 구자체 슬롯의 글자는 자기 번체를 따로 갖지 않는다(간체 침투 금지 실측 계약)', () => {
    // 침투 실측: hanjaJa 역전만 쓰면 楽→"乐樂"처럼 간체가 섞였다 — 빌드 필터의 계약.
    const bad = [];
    for (const [ch, e] of Object.entries(etym)) {
      for (const c of e[5] || '') {
        if (etym[c]?.[3]) bad.push(`${ch}:${c}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
