import { describe, expect, it } from 'vitest';
import { normalizeFrHeadword, normalizeRefWordKey } from '../refWordNormalize.js';

// 🈁 fr/zh 뷰어 만남 대조 키(rfc-vocab-encounter §4.7) — 저작 표제어(관사형)와
// 뷰어 토큰(표면형)이 같은 키로 접히는지. fr 정규화는 본편 병합 dedup에서 이관한
// 정본이라, 여기 핀이 곧 병합 동작의 핀이기도 하다.

describe('normalizeFrHeadword — 저작 표제어 쪽', () => {
  it('관사·괄호·대안 표기·엘리지옹을 접는다', () => {
    expect(normalizeFrHeadword('la famille')).toBe('famille');
    expect(normalizeFrHeadword('les parents (m. pl.)')).toBe('parents');
    expect(normalizeFrHeadword("l'eau (f.)")).toBe('eau');
    expect(normalizeFrHeadword("d'accord")).toBe('accord');
    expect(normalizeFrHeadword('beau / belle')).toBe('beau');
    expect(normalizeFrHeadword('aller ou marcher')).toBe('aller');
    expect(normalizeFrHeadword('de la gare')).toBe('gare');
  });

  it('토큰 표면형 쪽 — 대소문자·타이포그래픽 아포스트로피', () => {
    expect(normalizeFrHeadword('Famille')).toBe('famille');
    expect(normalizeFrHeadword('l’hôpital')).toBe('hôpital');
  });

  it('관사가 아닌 짧은 단어·다단어 구는 보존한다(과잉 접기 금지)', () => {
    expect(normalizeFrHeadword('le')).toBe('le');
    expect(normalizeFrHeadword('bonne nuit')).toBe('bonne nuit');
    expect(normalizeFrHeadword('')).toBe('');
    expect(normalizeFrHeadword(undefined)).toBe('');
  });
});

describe('normalizeRefWordKey — 언어 분기', () => {
  it('fr는 표제어 정규화, en은 소문자화, ja·zh는 trim 원문(기존 비교 불변)', () => {
    expect(normalizeRefWordKey('fr', 'la famille')).toBe('famille');
    expect(normalizeRefWordKey('ja', '食券')).toBe('食券');
    expect(normalizeRefWordKey('zh', ' 你好 ')).toBe('你好');
    // en — 저작형 Monday·TV(전수 실측 32건)와 소문자 lemma 토큰이 같은 키로.
    // 관사 시작은 관용구 8건뿐이라 fr와 달리 접지 않는다(과잉 접기 금지).
    expect(normalizeRefWordKey('en', 'Family')).toBe('family');
    expect(normalizeRefWordKey('en', 'Monday')).toBe('monday');
    expect(normalizeRefWordKey('en', 'the last straw')).toBe('the last straw');
    expect(normalizeRefWordKey(undefined, ' x ')).toBe('x');
    expect(normalizeRefWordKey('fr', undefined)).toBe('');
  });
});
