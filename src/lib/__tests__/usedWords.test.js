import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildOutput, usesWord } from '../usedWords.js';
import { sliceBetween } from './helpers/sliceBetween.js';

const W = Date.parse('2026-10-27T03:00:00Z'); // 이번 주 안
const H = 3600e3;
const iso = ms => new Date(ms).toISOString();
const vocabRows = [
  { word_text: '約束', base_form: '約束', created_at: iso(W - 72 * H) },
  { word_text: '予定', base_form: '予定', created_at: iso(W - 72 * H) },
  { word_text: '映画', base_form: '映画', created_at: iso(W + 5 * H) }, // 쓴 뒤에 담음
  { word_text: 'の', base_form: 'の', created_at: iso(W - 72 * H) },     // 가나 한 글자 — 세지 않음
  { word_text: 'rendez-vous', base_form: 'rendez-vous', created_at: iso(W - 72 * H) },
  { word_text: 'art', base_form: 'art', created_at: iso(W - 72 * H) },
];

describe('직접 쓴 말 — 셈 규칙(STATS-MAP-001 목업 「셈 규칙」 표)', () => {
  it('표기 대조 — 라틴 문자는 단어 경계, 가나 한 글자는 세지 않음', () => {
    expect(usesWord('週末の予定は約束です', { word_text: '約束' })).toBe(true);
    expect(usesWord('週末の予定', { word_text: 'の' })).toBe(false);
    expect(usesWord("J'ai un rendez-vous demain", { word_text: 'rendez-vous' })).toBe(true);
    expect(usesWord('a party at the start', { word_text: 'art' })).toBe(false); // party · start 속 art는 아님
    expect(usesWord('食べた', { word_text: '食べる', base_form: '食べる' })).toBe(false); // 활용형 — 알려진 한계(작게 셈)
  });

  it('그 전에 담은 말만 · 서로 다른 말 · 처음 씀 · 많은 순', () => {
    const sources = [
      { kind: 'writing', id: 1, title: '주말에 하고 싶은 일', texts: [{ text: '週末の予定は映画の約束です', at: W }] },
      { kind: 'conversation', id: 2, title: '주말 계획', texts: [{ text: '約束があるよ', at: W + 2 * H }] },
      { kind: 'writing', id: 3, title: '지난주 작문', texts: [{ text: '予定がある', at: W - 48 * H }] }, // 창 밖(지난번에 이미 씀)
    ];
    const r = buildOutput({ sources, vocabRows, fromMs: W - H, untilMs: W + 24 * H });
    expect(r.total).toBe(2);                 // 約束 · 予定 (映画는 쓴 뒤에 담음, の는 세지 않음)
    expect(r.writing).toBe(1);
    expect(r.conversation).toBe(1);
    expect(r.firstTime).toBe(1);             // 予定은 창 밖에서 이미 씀 → 約束만 처음
    expect(r.sources.map(s => [s.kind, s.words])).toEqual([['writing', ['約束', '予定']], ['conversation', ['約束']]]);
  });

  it('아무것도 없으면 0', () => {
    expect(buildOutput({})).toEqual({ total: 0, writing: 0, conversation: 0, firstTime: 0, sources: [], firstWords: [], everUsed: [] });
  });
});

describe('배선 — 이번 주 창 두 줄(들어옴 ↔ 나감) · 같은 창 부품', () => {
  const page = fs.readFileSync('src/views/ProfileStats.jsx', 'utf8');
  const rows = fs.readFileSync('src/lib/usedWordsRows.js', 'utf8');
  it('창을 연 사람에게만 조회 · 담은 말은 현황 snapshot 재사용', () => {
    const modal = sliceBetween(page, 'function WeeklyModal(', '\n}\n');
    expect(modal).toContain("queryKey: ['output-words', user?.id, weekStartMs]");
    expect(modal).toContain('vocabRows: Array.isArray(vocab) ? vocab : []');
  });
  it('작문은 writing_practice(작문 화면 · 오늘 학습 쓰기 문항) · 대화는 내 말(who me)', () => {
    expect(rows).toContain("supabase.from('writing_practice').select('id, created_at, sentence, prompt'");
    expect(rows).toContain("t?.who === 'me'");
  });
  it('목업 그대로 — 이름 「직접 쓴 말」 · 세 칸 작문/대화/처음 씀 · 0이면 줄 없음', () => {
    expect(page).toContain("title: '직접 쓴 말',");
    expect(page).toContain("cells: d => [[d.writing, '편', '작문'], [d.conversation, '개', '대화'], [d.firstTime, '개', '처음 씀']],");
    expect(page).toContain('{outputTotal > 0 && onOpenOutput && (');
    // 지표 이름 후보였던 말은 쓰지 않는다 — 연계 4 행동 문구 「아직 안 써 본 말로 작문」(오너 승인 2026-11-02 KST)만 예외.
    const named = page.replaceAll('아직 안 써 본 말', '');
    for (const banned of ['연습한 표현', '써 본 말']) expect(named).not.toContain(banned);
  });
});
