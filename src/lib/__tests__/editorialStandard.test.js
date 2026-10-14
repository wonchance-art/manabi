import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  AI_SIGNALS_S1, BANNED_LEAD_PATTERNS, CLICHES, MAX_COMMAS, MAX_SENTENCE_CHARS, PREACHY_ENDINGS,
  REDUNDANT_PHRASES, SPELLING_DICTIONARY, WEAK_PHRASES, lintEditorial, splitSentences,
} from '../editorialRules';

// EDIT-STD-001 · EDIT-STD-002 — 매거진 『となり』 기사 본문 문체 계약.
// 근거: docs/japanology/magazine/report-editorial-craft.md §3.1 규칙 10·11·12·13·16·17·18(S1)·23·26, §3.4.
// 규칙 목록의 정본은 src/lib/editorialRules.js 하나다(/magazine-edit가 가리킨다). 여기서는 다시 적지 않는다.
//
// 실제 말뭉치는 오너 승인 표본(docs/japanology/magazine/style-samples/*.md)이다 — 표본이 규칙보다 우선하므로
// 표본이 위반을 내면 표본을 고치지 않고 규칙을 의심한다. 처음 켤 때(2026-10-14 KST) 표본 2편 위반 0으로 시작했다.
// 허용 목록은 파일 · 그 문장의 고유 조각 · 이유를 함께 적는다.

const SAMPLE_DIR = join(process.cwd(), 'docs', 'japanology', 'magazine', 'style-samples');

const ALLOWLIST = [];

const REGISTER_OF = { 해라체: 'haera', 해요체: 'haeyo' };

// 표본의 본문 = 첫 ##/### 제목부터 끝까지(앞의 「- 승인」 메타 줄은 제외). 문체는 메타 줄의 「문체: …」.
function readSample(file) {
  const src = readFileSync(join(SAMPLE_DIR, file), 'utf8');
  const heading = src.match(/^#{2,3} .+$/m);
  if (!heading) throw new Error(`${file}: 본문 제목(## 또는 ###) 없음`);
  const register = REGISTER_OF[(src.match(/문체:\s*(해라체|해요체)/) || [])[1]];
  if (!register) throw new Error(`${file}: 메타 줄에 「문체: 해라체|해요체」 없음`);
  return { file, register, body: sliceBetween(src, `\n${heading[0]}`) };
}

const SAMPLES = readdirSync(SAMPLE_DIR).filter(name => name.endsWith('.md')).sort().map(readSample);

function corpusViolations(samples) {
  return samples.flatMap(({ file, register, body }) => lintEditorial(body, { register })
    .filter(v => !ALLOWLIST.some(a => a.file === file && v.excerpt.includes(a.fragment)))
    .map(v => `${file} ${v.rule} 「${v.form}」 ${v.excerpt}`));
}

const rules = (text, options) => lintEditorial(text, options).map(v => `${v.rule} ${v.form}`);

describe('EDIT-STD-001 — 실제 말뭉치: 오너 승인 표본', () => {
  it('검사 대상이 실제로 있다(경로·본문 추출이 무너져 공허 통과하지 않는다)', () => {
    expect(SAMPLES.map(s => s.file)).toEqual(expect.arrayContaining(['first-scene-land.md', 'launch-editorial.md']));
    for (const { file, body } of SAMPLES) {
      expect(body, file).not.toContain('- 승인');
      expect(splitSentences(body).length, file).toBeGreaterThan(10);
    }
    expect(SAMPLES.map(s => s.register).sort()).toEqual(['haera', 'haeyo']);
  });

  it('표본 본문에 위반이 0이다', () => {
    expect(corpusViolations(SAMPLES)).toEqual([]);
  });

  it('깨뜨려 확인 — 표본에 위반을 끼우면(메모리 안에서만) 계약이 잡는다', () => {
    const mutated = SAMPLES.map((sample) => {
      if (sample.file === 'first-scene-land.md') {
        expect(sample.body).toContain('도쿄의 한 주택가');
        return { ...sample, body: sample.body.replace('도쿄의 한 주택가', '토쿄의 한 주택가') };
      }
      if (sample.file === 'launch-editorial.md') {
        expect(sample.body).toContain('인사는 금방 배워요.');
        return { ...sample, body: sample.body.replace('인사는 금방 배워요.', '인사는 그야말로 금방 배워야 해요.') };
      }
      return sample;
    });
    const found = corpusViolations(mutated);
    expect(found.some(v => v.startsWith('first-scene-land.md R26 「토쿄→도쿄」'))).toBe(true);
    expect(found.some(v => v.startsWith('launch-editorial.md R11 「그야말로」'))).toBe(true);
    expect(found.some(v => v.startsWith('launch-editorial.md R23 「~해야 한다」'))).toBe(true);
  });

  it('허용 목록의 각 조각은 지금도 그 표본 본문에 있고, 실제로 위반 하나를 가린다(고쳐진 예외를 남기지 않는다)', () => {
    for (const { file, fragment, reason } of ALLOWLIST) {
      expect(reason.length, file).toBeGreaterThan(5);
      const sample = SAMPLES.find(s => s.file === file);
      expect(sample?.body, `${file}: ${fragment}`).toContain(fragment);
      expect(lintEditorial(sample.body, { register: sample.register }).some(v => v.excerpt.includes(fragment)), fragment).toBe(true);
    }
  });
});

describe('EDIT-STD-001 — lintEditorial 규칙', () => {
  it('사전이 비어 있지 않다(목록이 통째로 사라져 공허 통과하지 않는다)', () => {
    for (const list of [BANNED_LEAD_PATTERNS, CLICHES, WEAK_PHRASES, REDUNDANT_PHRASES, AI_SIGNALS_S1, PREACHY_ENDINGS]) {
      expect(list.length).toBeGreaterThan(2);
      expect(Object.isFrozen(list)).toBe(true);
    }
    expect(MAX_SENTENCE_CHARS).toBe(70);
    expect(MAX_COMMAS).toBe(2);
  });

  it('규칙 10 — 리드 상투형', () => {
    expect(rules('여러분은 조나이카이를 아시나요?')).toEqual(['R10 여러분은 ~을 아시나요?']);
    expect(rules('일본에는 "일기일회"라는 말이 있다.')).toEqual(['R10 ~라는 말이 있다']);
    expect(rules('오늘은 부카쓰에 대해 알아보자.')).toEqual(expect.arrayContaining(['R10 ~에 대해 알아보자', 'R17 ~에 대해']));
  });

  it('규칙 11 — 상투구·과장어', () => {
    expect(rules('그야말로 일본 최고의 축제다.')).toEqual(['R11 그야말로', 'R11 최고의']);
    expect(rules('모든 일본인이 줄을 선다.')).toEqual(['R11 모든 일본인이']);
    expect(rules('말 그대로 힐링이다.')).toEqual(['R11 말 그대로', 'R11 힐링']);
  });

  it('규칙 12 — 문장 길이는 70자까지 통과, 71자부터 위반', () => {
    const at = (n) => `${'가'.repeat(n - 1)}다.`;
    expect(rules(at(70))).toEqual([]);
    expect(rules(at(71))).toEqual(['R12 71자 > 70자']);
    // 짧은 두 문장은 합쳐 세지 않는다
    expect(rules(`${at(40)} ${at(40)}`)).toEqual([]);
  });

  it('규칙 13 — 쉼표는 한 문장에 2개까지(인용 안 쉼표는 세지 않는다)', () => {
    expect(rules('아침, 점심, 저녁에 종이 울린다.')).toEqual([]);
    expect(rules('아침, 점심, 저녁, 밤에 종이 울린다.')).toEqual(['R13 쉼표 3개 > 2개']);
    expect(rules('그는 「하나, 둘, 셋, 넷」 하고 센다.')).toEqual([]);
    // 숫자 자릿점은 쉼표가 아니다(1호 04·06 원고 2,847곳 오탐 — 2026-10-14)
    expect(rules('A는 2,847곳, B는 1,234곳, C는 3,456곳이다.')).toEqual([]);
    expect(rules('2,847곳, 1,234곳, 3,456곳, 9,999곳이다.')).toEqual(['R13 쉼표 3개 > 2개']);
  });

  it('규칙 16 — 약한 표현', () => {
    expect(rules('이 동네는 조용한 것 같다.')).toEqual(['R16 ~것 같다']);
    expect(rules('아마도 비가 온다.')).toEqual(['R16 아마도']);
    expect(rules('그것이 답이 아닐까. 답이라고 할 수 있다.')).toEqual(['R16 ~라고 할 수 있다']);
    expect(rules('정말 그렇지 않을까?')).toEqual(['R16 ~지 않을까']);
  });

  it('규칙 17 — 장황 표현·번역투', () => {
    expect(rules('회의를 통해 정한다.')).toEqual(['R17 ~를 통해']);
    expect(rules('조사를 진행했다.')).toEqual(['R17 ~을 진행하다']);
    expect(rules('누구나 참여하는 것이 가능하다.')).toEqual(['R17 ~하는 것이 가능하다']);
    expect(rules('교육에 있어서 문화적인 부분이 크다.')).toEqual(['R17 ~에 있어서', 'R17 ~적인 부분']);
  });

  it('규칙 18 S1 — 어휘로 잡히는 AI 신호', () => {
    expect(rules('이 변화는 시사하는 바가 크다.')).toEqual(['R18-S1 시사하는 바가 크다']);
    expect(rules('이제 일본을 다시 볼 때다.')).toEqual(['R18-S1 ~할 때다']);
    expect(rules('전문가들은 새 지평을 연 이정표라고 본다.')).toEqual(['R18-S1 새 지평', 'R18-S1 이정표', 'R18-S1 전문가들은']);
    // 「~할 때다」는 문장 끝에서만
    expect(rules('집에 갈 때다 싶으면 노래가 나온다.')).toEqual([]);
  });

  it('규칙 23 — 설교 종결은 문장 끝에서만, 「~자」 명사와 「~죠」는 통과', () => {
    expect(rules('쓰레기는 아침에 내놓아야 한다.')).toEqual(['R23 ~해야 한다']);
    expect(rules('규칙을 지켜야 해요.', { register: 'haeyo' })).toEqual(['R23 ~해야 한다']);
    expect(rules('함께 읽어 보자.')).toEqual(['R23 ~하자']);
    expect(rules('이제 떠납시다.')).toEqual(['R23 ~합시다']);
    expect(rules('해야 한다는 생각이 든다. 글자를 적는 남자. 물을 마시다. 그렇죠.')).toEqual([]);
  });

  it('인용 「」·『』·"" 안은 검사하지 않는다(인용 안의 ?·.도 문장 경계가 아니다)', () => {
    expect(rules('그는 「아마도 그럴 것 같다」라고 말했다.')).toEqual([]);
    expect(rules('간판에 "반드시 정숙"이라고 적혀 있다.')).toEqual([]);
    expect(rules('『그야말로 완벽한 하루』라는 책이 있다.')).toEqual([]);
    expect(splitSentences('교재 9과 「내 가방은 어디에?」에서 배운다.').map(s => s.original)).toEqual(['교재 9과 「내 가방은 어디에?」에서 배운다']);
  });

  it('마크다운 제목·표·인용 표시·목록 번호는 본문 문장으로 보지 않는다', () => {
    expect(rules('## 그야말로 완벽한 제목\n| 반드시 | 최고의 |\n---')).toEqual([]);
    expect(splitSentences('1. 땅과 동네다.\n2. 배우다.\n> **편집 노트**다.\n- 3.5킬로미터를 걷는다.').map(s => s.original))
      .toEqual(['땅과 동네다', '배우다', '편집 노트다', '3.5킬로미터를 걷는다']);
  });

  it('문체 값은 haera · haeyo만 받는다', () => {
    expect(() => lintEditorial('본문이다.', { register: 'formal' })).toThrow('알 수 없는 문체');
    expect(lintEditorial('본문이다.', { register: 'haera' })).toEqual([]);
    expect(lintEditorial('')).toEqual([]);
  });
});

describe('EDIT-STD-002 — 일본어 고유명사 한글 표기 사전(prh 형식, 규칙 26)', () => {
  it('사전이 자기 자신을 검증한다 — 각 spec의 from은 패턴에 걸리고, 바꾸면 to가 된다', () => {
    expect(SPELLING_DICTIONARY.length).toBeGreaterThanOrEqual(9);
    for (const { expected, patterns, specs } of SPELLING_DICTIONARY) {
      expect(patterns.length, expected).toBeGreaterThan(0);
      expect(specs.length, expected).toBeGreaterThan(0);
      for (const re of patterns) {
        expect(re.flags, `${expected} ${re}`).not.toContain('g'); // 전역 플래그는 lastIndex 상태를 남긴다
        expect(re.test(expected), `${expected}가 자기 오표기 패턴 ${re}에 걸리면 고친 뒤에도 다시 걸린다`).toBe(false);
      }
      for (const { from, to } of specs) {
        expect(patterns.some(re => re.test(from)), `${expected}: ${from}`).toBe(true);
        const fixed = patterns.reduce((acc, re) => acc.replace(new RegExp(re.source, 'g'), expected), from);
        expect(fixed, from).toBe(to);
        expect(lintEditorial(from).some(v => v.rule === 'R26'), from).toBe(true);
        expect(lintEditorial(to).filter(v => v.rule === 'R26'), to).toEqual([]);
      }
    }
  });

  it('보고서 규칙 26의 필수 표기가 모두 있다', () => {
    const expected = SPELLING_DICTIONARY.map(e => e.expected);
    for (const word of ['부카쓰', '조나이카이', '게이고', '도쿄', '교토', '홋카이도', '오사카', '마쓰리', '쓰나미']) expect(expected).toContain(word);
    expect(new Set(expected).size).toBe(expected.length);
  });

  it('본문의 오표기를 잡는다', () => {
    expect(rules('토쿄와 쿄토, 오오사카를 돈다.')).toEqual(['R26 토쿄→도쿄', 'R26 쿄토→교토', 'R26 오오사카→오사카']);
    expect(rules('도쿄와 교토, 오사카를 돈다.')).toEqual([]);
  });

  it('쟈·쥬·챠·츄 계열은 사전 밖 이름도 잡고, 예외 상·쨩(오너 결정 2026-10-14)과 「~죠」는 통과', () => {
    expect(rules('저녁에 쥬쿠(塾)에 간다.')).toEqual(['R26 쥬 계열 표기']);
    expect(rules('츄하이를 마신다.')).toEqual(['R26 츄 계열 표기']);
    expect(rules('다나카 상과 하나 쨩이 웃는다. 그렇죠.')).toEqual([]);
  });
});
