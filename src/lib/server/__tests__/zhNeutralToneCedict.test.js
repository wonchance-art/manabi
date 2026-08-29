import { describe, expect, it } from 'vitest';
import CEDICT from '../data/zhNeutralToneCedict.json';
import { ZH_NEUTRAL_TONE } from '../zhNeutralTone.js';

// 계약: 경성 사전 CEDICT 층 (분석 개선 R2 — 오너 승인 2026-08-29).
// scripts/build-zh-neutral-tone.mjs가 CC-CEDICT(© MDBG, CC BY-SA 4.0)에서 수제 층의
// 등재 기준 ①(라이브러리 정답 제외)·②(다의어 배제)·③(방향보어·边 배제)을 그대로
// 기계화해 생성한 데이터의 전량 자기검증 + 2층 병합(수제 우선)의 배선 핀.

const entries = Object.entries(CEDICT);
const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

describe('zhNeutralToneCedict 데이터 정본', () => {
  it('규모 — 수백~수천 항(실측 2,034 기준 하한 1,500)', () => {
    expect(entries.length).toBeGreaterThan(1500);
    expect(entries.length).toBeLessThan(5000);
  });

  it('형식 전수 — 키는 한자 2~4자, 값은 글자당 1음절(공백 구분)·기호 성조·얼화 없음', () => {
    const bad = [];
    for (const [k, v] of entries) {
      const syls = v.split(' ');
      if (!/^[一-鿿]{2,4}$/.test(k)) bad.push(`키 ${k}`);
      else if (syls.length !== [...k].length) bad.push(`음절수 ${k}=${v}`);
      else if (/[0-9A-Z:]/.test(v)) bad.push(`표기 ${k}=${v}`);
      else if (syls.includes('r')) bad.push(`얼화 ${k}=${v}`);
    }
    expect(bad).toEqual([]);
  });

  it('경성 실재 전수 — 모든 항목에 무성조(경성) 음절이 1개 이상', () => {
    const bad = entries.filter(([, v]) => !v.split(' ').some((s) => !TONE_MARK.test(s)));
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it('② 다의어 배제 — 이독 병존 표제어는 층에 없다(수제 판단만 실린다)', () => {
    for (const w of ['地道', '大意', '买卖', '东西', '告诉']) {
      expect(CEDICT[w]).toBeUndefined();
    }
  });

  it('③ 방향보어·접미 边 배제 / ① 라이브러리 정답(妈妈류) 배제', () => {
    for (const w of ['出来', '回来', '上边', '下边', '妈妈', '爸爸']) {
      expect(CEDICT[w]).toBeUndefined();
    }
  });

  it('스팟 핀 — 대표 추출값(생성 결정성의 표본 고정)', () => {
    expect(CEDICT['怪不得']).toBe('guài bu de');
    expect(CEDICT['朋友']).toBe('péng you');
    expect(CEDICT['名气']).toBe('míng qi');
    expect(CEDICT['凑热闹']).toBe('còu rè nao');
  });

  it('단어 내부 성조 변조(sandhi) 전수 — 원조 그대로 실은 회귀(不 bù+4성·비어말 一 yī)가 없다', () => {
    // CEDICT는 원조(citation)로 적는다. 오버라이드는 줄 병음을 토큰째 대체하므로 원조를
    // 그대로 실으면 pinyin-pro가 맞게 내던 변조를 되돌린다(전수 교차검증 실측 2026-08-29).
    const T4 = /[àèìòùǜ]/;
    const bad = [];
    for (const [k, v] of entries) {
      const chars = [...k];
      const syls = v.split(' ');
      syls.forEach((s, i) => {
        if (i === syls.length - 1) return; // 어말은 원조 유지가 정본
        if (chars[i] === '不' && s === 'bù' && T4.test(syls[i + 1])) bad.push(`${k}=${v}`);
        if (chars[i] === '一' && s === 'yī') bad.push(`${k}=${v}`);
      });
    }
    expect(bad).toEqual([]);
    // 변조 적용 표본 + ①필터와의 상호작용: 라이브러리가 이미 맞게 내는 不在乎(bú zài hu)는
    // 변조 후 일치해져 정상 제외되고, 라이브러리가 틀리는 不见得(dé)·不客气(qì)만 남는다.
    expect(CEDICT['不见得']).toBe('bú jiàn de');
    expect(CEDICT['不客气']).toBe('bú kè qi');
    expect(CEDICT['不在乎']).toBeUndefined();
  });
});

describe('2층 병합 — 수제 층이 항상 이긴다', () => {
  it('CEDICT가 원조를 고집하는 필독 경성(知道)은 수제 값이 정본', () => {
    expect(CEDICT['知道']).toBeUndefined(); // CEDICT는 zhi1 dao4 — 후보조차 아님
    expect(ZH_NEUTRAL_TONE['知道']).toBe('zhī dao');
  });

  it('수제 예외 항목(东西)·가능보어(对不起)가 병합본에 살아 있다', () => {
    expect(ZH_NEUTRAL_TONE['东西']).toBe('dōng xi');
    expect(ZH_NEUTRAL_TONE['对不起']).toBe('duì bu qǐ');
  });

  it('병합본은 CEDICT 층을 포함한다(대량 확장이 실제로 배선됨)', () => {
    expect(Object.keys(ZH_NEUTRAL_TONE).length).toBeGreaterThan(entries.length);
    expect(ZH_NEUTRAL_TONE['名气']).toBe('míng qi');
  });
});
