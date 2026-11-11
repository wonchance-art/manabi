import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseText, kanaForm, n5Inline, n5Phrase, n5Ruby } from './n5-markup.mjs';
import { notationOnlyReport } from './n5-notation-contract.mjs';

// N5-RENDERER-001(2026-11-11 KST) — 원 N5 도구가 없어 운영 판본 8a8c의 출력에서 일본어 조각 규칙을 다시 찾았다. 이 계약은 그 규칙이
// 8a8c를 바이트 단위로 재현하는 범위를 고정하고(쪽 틀은 범위 밖), 「표기만 바꾼 파생 판본」 계약이 바뀌면 안 되는 것을 잡는지 본다.
const E = 'src/content/textbookEditions/8a8c1c1fd452773810abaf8c';
const html = fs.readFileSync(`${E}/index.html`, 'utf8');
const base = JSON.parse(fs.readFileSync(`${E}/bundle.json`, 'utf8')).manuscript;
const count = (get, render) => {
  let total = 0, exact = 0;
  for (const lesson of base.lessons) for (const text of get(lesson)) { total++; if (html.includes(render(text, lesson.kanji))) exact++; }
  return { total, exact };
};

describe('N5 일본어 조각 렌더 — 운영 8a8c와 바이트 대조', () => {
  it.each([
    ['대화', l => (l.dialog || []).map(t => t.ja), 184],
    ['문형 예문', l => (l.patterns || []).flatMap(p => (p.examples || []).map(x => x.ja)), 170],
    ['말할 단어', l => (l.words || []).map(w => w.ja), 253],
    ['쓰기 예시', l => (l.writing_sample ? [l.writing_sample.ja] : []), 41],
  ])('본문 틀(구 단위 + 루비) — %s 전부 같다', (_name, get, total) => {
    expect(count(get, n5Phrase)).toEqual({ total, exact: total });
  });

  it('인라인 틀(답 · 선택지, 루비 없음)의 현재 재현 범위 — 줄면 규칙이 깨진 것', () => {
    // 남은 차이(말하기 답 6 · 선택지 24)는 숫자 · 한국어 선택지 · 화살표 단서처럼 다른 틀이다(관문 보고 참조).
    expect(count(l => (l.oral || []).map(o => o.answer), n5Inline).exact).toBeGreaterThanOrEqual(76);
    expect(count(l => (l.checks || []).flatMap(c => c.options || []), n5Inline).exact).toBeGreaterThanOrEqual(254);
  });

  it('이웃 글자 검사 없이 가장 긴 키 — 1時半 · 4月20日이 N5 출력과 같다', () => {
    expect(n5Ruby('1時半ごろ', { '1時': 'いちじ', '半': 'はん' })).toBe('<ruby>1時<rt>いちじ</rt></ruby><ruby>半<rt>はん</rt></ruby>ごろ');
    expect(n5Phrase('4月20日です。', { '4月': 'しがつ', '20日': 'はつか' })).toBe('<span lang="ja"><span class="phrase"><ruby>4月<rt>しがつ</rt></ruby><ruby>20日<rt>はつか</rt></ruby>です。</span></span>');
  });

  it('인라인 읽기 확장 {바탕|읽기} — 루비로 그리고, 바탕 글자 · 가나형을 낸다(8a8c 원고에는 { } 0개)', () => {
    expect(JSON.stringify(base)).not.toMatch(/[{}]\S*\|/);
    expect(n5Ruby('{一日|ついたち}と {一日|いちにち}', {})).toBe('<ruby>一日<rt>ついたち</rt></ruby>と <ruby>一日<rt>いちにち</rt></ruby>');
    expect(baseText('{今日|きょう}は')).toBe('今日は');
    expect(kanaForm('{今日|きょう}は 町です', { 町: 'まち' })).toBe('きょうは まちです');
  });
});

describe('「표기만 바꾼」 계약 초안 — 가나형으로 되돌리면 8a8c와 같다', () => {
  const edit = mutate => { const next = structuredClone(base); mutate(next); return notationOnlyReport(base, next); };
  const u12 = next => next.lessons.find(l => l.id === 'u12');

  it('8a8c 자신은 위반 0', () => {
    expect(notationOnlyReport(base, structuredClone(base)).violations).toEqual([]);
  });
  it('가나를 한자 + 인라인 읽기로 바꾸면 통과한다(정답 문자열도 같은 규칙)', () => {
    const report = edit(next => {
      u12(next).dialog[0].ja = u12(next).dialog[0].ja.replace('にぎやか', '{賑|にぎ}やか');
      u12(next).dialog[1].ja = 'いいえ。{静|しず}かです。';
      u12(next).words[0].ja = '{静|しず}か';
    });
    expect(report.violations).toEqual([]);
  });
  it.each([
    ['낱말을 바꾸면', next => { u12(next).dialog[1].ja = 'いいえ。にぎやかです。'; }, 'kana-form-differs'],
    ['띄어쓰기를 지우면(N5 동안 유지)', next => { u12(next).dialog[0].ja = u12(next).dialog[0].ja.replace(' ', ''); }, 'kana-form-differs'],
    ['읽기를 잘못 달면', next => { u12(next).dialog[1].ja = 'いいえ。{静|せい}かです。'; }, 'kana-form-differs'],
    ['한국어 해석을 바꾸면', next => { u12(next).dialog[0].ko = '이 동네는 시끄러워요?'; }, 'kana-form-differs'],
    ['지도의 기존 읽기를 바꾸면', next => { u12(next).kanji['町'] = 'ちょう'; }, 'map-reading-changed'],
    ['지도에 키를 더하면(키 집합 잠김 — 인라인 읽기로)', next => { u12(next).kanji['静'] = 'しず'; }, 'shape'],
    ['문항을 빼면', next => { u12(next).checks.pop(); }, 'shape'],
    ['과 ID를 바꾸면', next => { u12(next).id = 'u12b'; }, 'shape'],
  ])('%s 걸린다', (_name, mutate, kind) => {
    expect(edit(mutate).violations.map(v => v.kind)).toContain(kind);
  });
});
