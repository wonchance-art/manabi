import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  confusedVocabWords, CONFUSED_CAP, CONFUSED_MIN, CONFUSED_SINCE_DAYS,
} from '../confusedQueue.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
/** 주석 제거 — 설명 문구(이 모듈은 이음새 해설이 길다)가 계약에 잡히지 않게(cronRegistration 선례). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NOW = Date.UTC(2026, 7, 26, 12);
const ev = (item_key, correct, { source = 'vocab', ageDays = 1 } = {}) => ({
  source, item_key, correct,
  created_at: new Date(NOW - ageDays * 86400000).toISOString(),
});
const rows = (...texts) => texts.map((t, i) => ({ id: i + 1, word_text: t, meaning: `뜻${i}` }));

describe('confusedVocabWords — 오답 가중 상위 선택 (computeWeakness 정본 재사용)', () => {
  it('자주 틀린 단어를 점수 내림차순으로 고른다', () => {
    const events = [
      ev('提高', false), ev('提高', false), ev('提高', true),   // 2/3 오답
      ev('环境', false), ev('环境', true),                      // 1/2 오답
      ev('保护', true), ev('保护', true),                       // 전부 정답 → 제외
    ];
    const out = confusedVocabWords(events, rows('提高', '环境', '保护'), { now: NOW });
    expect(out.map((c) => c.word.word_text)).toEqual(['提高', '环境']);
    expect(out[0].wrong).toBe(2);
    expect(out[0].total).toBe(3);
  });

  it('vocab 소스만 — grammar·ui 이벤트가 cap 자리를 먹지 않는다', () => {
    const events = [
      ev('조사', false, { source: 'grammar' }), ev('조사', false, { source: 'grammar' }),
      ev('提高', false), ev('提高', false),
    ];
    const out = confusedVocabWords(events, rows('提高', '조사'), { now: NOW });
    expect(out.map((c) => c.word.word_text)).toEqual(['提高']);
  });

  it('14일 창 밖 이벤트는 세지 않는다 — 주간 약점 세션과 같은 창', () => {
    const events = [ev('옛말', false, { ageDays: 20 }), ev('옛말', false, { ageDays: 21 })];
    expect(confusedVocabWords(events, rows('옛말'), { now: NOW })).toEqual([]);
    expect(CONFUSED_SINCE_DAYS).toBe(14);
  });

  it('표본 1건짜리는 노이즈 — computeWeakness total>=2 계승', () => {
    const events = [ev('한번', false)];
    expect(confusedVocabWords(events, rows('한번'), { now: NOW })).toEqual([]);
  });

  it('단어장에서 지워진 단어는 큐에서 자연 탈락한다', () => {
    const events = [ev('지운말', false), ev('지운말', false), ev('提高', false), ev('提高', false)];
    const out = confusedVocabWords(events, rows('提高'), { now: NOW });
    expect(out.map((c) => c.word.word_text)).toEqual(['提高']);
  });

  it('cap을 넘지 않는다 — 재대결은 짧게 끊는 집중 세션', () => {
    const events = [];
    const texts = [];
    for (let i = 0; i < 20; i++) {
      const t = `말${i}`;
      texts.push(t);
      events.push(ev(t, false), ev(t, false));
    }
    const out = confusedVocabWords(events, rows(...texts), { now: NOW });
    expect(out.length).toBeLessThanOrEqual(CONFUSED_CAP);
    expect(CONFUSED_CAP).toBe(12);
  });

  it('빈 입력·게스트(행 없음)에도 터지지 않는다', () => {
    expect(confusedVocabWords(null, null)).toEqual([]);
    expect(confusedVocabWords([], [])).toEqual([]);
  });
});

describe('재대결 — 정본 재사용·이음새 계약 (오너 승인 2026-08-26)', () => {
  const src = codeOf(read('src/lib/confusedQueue.js'));
  const page = read('src/views/VocabPage.jsx');

  it('집계는 computeWeakness 정본만 — 신규 카운터 금지', () => {
    expect(src).toContain("from './skillRung'");
    expect(src).toContain('computeWeakness(');
    // 자체 정오답 집계를 다시 만들면 두 화면의 "헷갈림"이 갈라진다.
    expect(src).not.toContain('.correct');
  });

  it('선택 모듈은 순수 — 조회·기록 없음(배너는 조회만이라는 승인 사항의 절반)', () => {
    expect(src).not.toContain('supabase');
    expect(src).not.toContain('study_paragraphs');
    expect(src).not.toContain('studyMaterials');
  });

  it('채점 경로는 하나 — 재대결이 기록 경로를 새로 만들지 않는다(승인 사항의 나머지 절반)', () => {
    // 재대결은 공통 세션(startSession)으로 들어가고, 기록은 기존 handleScore 한 곳뿐이다.
    // 원장이 공유되므로 재대결 정답이 약점 점수를 내리는 것이 곧 일요일 세션과의 dedup이다.
    expect(page).toMatch(/const startRematch = \(\) => startSession\(/);
    expect(page).toMatch(/const startReview = \(\)[\s\S]{0,120}?startSession\(/);
    expect(page.match(/recordReviewCompleted\(/g)).toHaveLength(1);
  });

  it('배너는 최소 개수 미만이면 숨는다 — 1개짜리 재대결 호들갑 금지', () => {
    expect(page).toContain('confused.length >= CONFUSED_MIN');
    expect(CONFUSED_MIN).toBe(2);
  });

  it('이벤트 조회는 vocab 소스·14일 창을 서버에서 거른다 — 쿼리 다이어트', () => {
    expect(page).toMatch(/\.eq\('source', 'vocab'\)[\s\S]{0,120}?\.gte\('created_at'/);
    expect(page).toContain('CONFUSED_SINCE_DAYS');
  });
});
