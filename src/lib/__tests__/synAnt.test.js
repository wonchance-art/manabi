import { describe, expect, it } from 'vitest';
import { buildSynAntPrompt, parseSynAnt, synAntCacheKey, synAntEligible } from '../synAnt.js';

// 계약: 유의어·반의어(⑤) — 내용어만·상한 syn4/ant2·형식 어긋난 항목 조용히 폐기.

describe('synAntEligible — 내용어 게이트', () => {
  it('내용어(명사·동사·형용사·부사)는 허용, 겸류(pos_all)도 후보에 내용어가 있으면 허용', () => {
    expect(synAntEligible({ text: '高兴', meaning: '기쁘다', pos: '형용사' }, 'Chinese')).toBe(true);
    expect(synAntEligible({ text: '代表', meaning: '대표하다', pos: '', pos_all: '동사·명사' }, 'Chinese')).toBe(true);
  });

  it('기능어(조사·기호·접속사 등)와 뜻 없는 토큰은 조회하지 않는다 — 호출 낭비 차단', () => {
    expect(synAntEligible({ text: 'は', meaning: '~은/는', pos: '조사' }, 'Japanese')).toBe(false);
    expect(synAntEligible({ text: '。', meaning: '마침표', pos: '기호' }, 'Chinese')).toBe(false);
    expect(synAntEligible({ text: 'と', meaning: '그리고', pos: '접속사' }, 'Japanese')).toBe(false);
    expect(synAntEligible({ text: '高兴', meaning: '', pos: '형용사' }, 'Chinese')).toBe(false);
    expect(synAntEligible(null, 'Chinese')).toBe(false);
  });
});

describe('parseSynAnt — 방어적 파싱', () => {
  it('정상 JSON(코드펜스 포함)을 정리해 담는다', () => {
    const raw = '```json\n{"syn":[{"w":"愉快","r":"yúkuài","ko":"유쾌하다"}],"ant":[{"w":"难过","r":"nánguò","ko":"슬프다"}]}\n```';
    expect(parseSynAnt(raw)).toEqual({
      syn: [{ w: '愉快', r: 'yúkuài', ko: '유쾌하다' }],
      ant: [{ w: '难过', r: 'nánguò', ko: '슬프다' }],
    });
  });

  it('상한을 지킨다 — syn 4·ant 2 초과분은 버린다', () => {
    const syn = Array.from({ length: 6 }, (_, i) => ({ w: `w${i}` }));
    const out = parseSynAnt({ syn, ant: syn });
    expect(out.syn).toHaveLength(4);
    expect(out.ant).toHaveLength(2);
  });

  it('형식 어긋남(비문자 w·빈 w·비배열·비JSON)은 조용히 빈 배열/폐기', () => {
    expect(parseSynAnt('{"syn":[{"w":""},{"w":42},{"r":"x"}],"ant":"no"}')).toEqual({ syn: [], ant: [] });
    expect(parseSynAnt('유의어는 없습니다.')).toEqual({ syn: [], ant: [] });
    expect(parseSynAnt('{"syn":[{"w":"好","r":7}]}').syn).toEqual([{ w: '好', r: '', ko: '' }]);
  });
});

describe('프롬프트·캐시 키', () => {
  it('프롬프트 — 확신 없으면 빈 배열·JSON 외 텍스트 금지·언어별 읽기 라벨', () => {
    const p = buildSynAntPrompt({ text: '高兴', base_form: '高兴', meaning: '기쁘다' }, 'Chinese');
    expect(p).toContain('마땅한 것이 없으면 빈 배열');
    expect(p).toContain('JSON 외 텍스트 금지');
    expect(p).toContain('성조 부호 병음');
    expect(buildSynAntPrompt({ text: '嬉しい', meaning: '기쁘다' }, 'Japanese')).toContain('요미가나');
  });

  it('캐시 키에 버전이 있다 — 프롬프트·형식 변경 시 낡은 캐시 자연 폐기', () => {
    expect(synAntCacheKey('Chinese', '高兴')).toBe('pdf_cache:synant:v1:Chinese:高兴');
  });
});
