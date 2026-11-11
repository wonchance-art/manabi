// VOA 반입 생성기 권리 거름(EN-SOURCE-001 ⓒ · 2026-11-09 KST) — 기자 줄로 통신사 각색을 뺀다. 마이그레이션 사전 검사와 같은 규칙.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVoaSeedRows, voaCleanParagraphs, voaCreditIsAgency, voaCreditIsOwn } from './voa-seed.mjs';

const article = (over = {}) => ({
  title: 'Skyscrapers, Made in America',
  url: 'https://learningenglish.voanews.com/a/skyscrapers-made-in-america-/7988815.html',
  date: '03 Mar 2025',
  section: 'All About America',
  credit: 'Jerilyn Watson reported this story for VOA Learning English. Jill Robbins adapted it for VOA Learning English with additional materials.',
  paras: ['No media source currently available', 'Tall buildings are common in American cities.', 'SOURCE: SOMEONE', 'They are called  skyscrapers.​'],
  ...over,
});

describe('voa-seed 권리 거름', () => {
  it('통신사 기자 줄은 거른다 — AFP · AP · Reuters · Associated Press', () => {
    for (const c of [
      'Robin Millard reported on this story for Agence France-Presse. John Russell adapted it for VOA Learning English.',
      'AP wrote this story. Anna Matteo adapted it for VOA Learning English.',
      'Some information came from Reuters. John Russell adapted it.',
      'The Associated Press reported this story. Ashley Thompson adapted it for VOA Learning English.',
      'AFP reported this story.',
    ]) {
      expect(voaCreditIsAgency(c), c).toBe(true);
      expect(voaCreditIsOwn(c), c).toBe(false);
    }
  });

  it('VOA 기자 줄은 통과 — 「app」 · 「map」 같은 낱말은 약칭으로 보지 않는다', () => {
    for (const c of [
      'Anna Matteo wrote this story for VOA Learning English.',
      'Mario Ritter, Jr. adapted this story for VOA Learning English from stories in the public domain.',
      'Marilyn Christiano wrote this program.',
      'Jill Robbins wrote this lesson about a map app for Learning English.',
    ]) {
      expect(voaCreditIsAgency(c), c).toBe(false);
      expect(voaCreditIsOwn(c), c).toBe(true);
    }
  });

  it('기자 줄이 없거나 동사가 없으면 fail-closed', () => {
    for (const c of ['', '   ', null, undefined, 'Caty Weaver was the editor.']) expect(voaCreditIsOwn(c)).toBe(false);
  });

  it('buildVoaSeedRows — 통신사 · 기자 줄 없음 · 허용 밖 주소는 빼고 이유를 남긴다', () => {
    const { rows, excluded } = buildVoaSeedRows([
      article(),
      article({ title: 'WHO Launches New Cancer Drug Plan for Children', credit: 'Robin Millard reported on this story for Agence France-Presse. John Russell adapted it for VOA Learning English.' }),
      article({ title: 'No byline', credit: '' }),
      article({ title: 'Elsewhere', url: 'https://example.com/a/x/1.html' }),
    ]);
    expect(rows.map((r) => r.title)).toEqual(['[A2] Skyscrapers, Made in America']);
    expect(excluded).toEqual([
      { title: 'WHO Launches New Cancer Drug Plan for Children', reason: 'agency-credit' },
      { title: 'No byline', reason: 'no-voa-credit' },
      { title: 'Elsewhere', reason: 'url' },
    ]);
    expect(rows[0].source).toEqual({
      kind: 'web', site: 'voa_le', channel: 'VOA Learning English', url: article().url, license: 'public-domain',
      section: 'All About America', credit: article().credit, feed_date: '2025-03-03',
    });
    expect(rows[0].body).toBe('Tall buildings are common in American cities.\nThey are called skyscrapers.');
  });

  it('본문 정리 — 영상 자리 표시 · 그림 출처 줄 · 폭 없는 공백 · 겹친 공백만', () => {
    expect(voaCleanParagraphs(['No media source currently available', ' A  b ', 'SOURCE: X', '​', 'Listen to a short conversation:']))
      .toEqual(['A b', 'Listen to a short conversation:']);
  });

  it('반입 마이그레이션의 26행 기자 줄이 모두 이 거름을 통과한다', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261112040000_voa_learning_english_import.sql', import.meta.url), 'utf8');
    const credits = [...sql.matchAll(/"credit":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`).replace(/''/g, "'"));
    expect(credits).toHaveLength(26);
    for (const c of credits) expect(voaCreditIsOwn(c), c).toBe(true);
  });
});
