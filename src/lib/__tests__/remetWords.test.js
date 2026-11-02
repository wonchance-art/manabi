import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildRemet, conversationTokenTime, conversationWordsBetween } from '../remetWords.js';
import { sliceBetween } from './helpers/sliceBetween.js';

const T = Date.parse('2026-10-27T03:00:00Z'); // 이번 주 안 한 시각
const H = 3600e3;
const iso = ms => new Date(ms).toISOString();
const w = (text, at, base_form = text) => ({ key: base_form, text, base_form, at });

describe('다시 만난 말 — 셈 규칙(STATS-MAP-001 목업 「셈 규칙」 표)', () => {
  const vocabRows = [{ word_text: '約束', base_form: '約束' }, { word_text: '予定', base_form: '予定' },
    { word_text: '駅', base_form: '駅' }, { word_text: '食べる', base_form: '食べる' }];
  const reviewRows = [
    { item_key: '約束', created_at: iso(T - 48 * H) }, { item_key: '約束', created_at: iso(T - 24 * H) },
    { item_key: '予定', created_at: iso(T - 24 * H) },
    { item_key: '駅', created_at: iso(T + 1 * H) }, // 글을 다 읽은 뒤에 처음 복습 — 이 글에서는 안 셈
  ];

  it('그 글 전에 복습한 담은 말만 · 서로 다른 말로 · 많은 순', () => {
    const sources = [
      { kind: 'reading', id: 1, title: '도쿄 산책', words: [w('約束', T), w('駅', T), w('猫', T)] },
      { kind: 'conversation', id: 2, title: '주말 계획', words: [w('約束', T + 2 * H), w('予定', T + 2 * H), w('駅', T + 2 * H)] },
    ];
    const r = buildRemet({ sources, vocabRows, reviewRows });
    // 約束 · 予定 · 駅(대화 땐 이미 복습함) = 3 · 猫는 담은 말이 아님 · 約束은 두 곳이어도 1
    expect(r.total).toBe(3);
    expect(r.reading).toBe(1);
    expect(r.conversation).toBe(1);
    expect(r.sources.map(s => [s.kind, s.words])).toEqual([['conversation', ['約束', '予定', '駅']], ['reading', ['約束']]]);
    // 복습 = 각 말을 처음 다시 만나기 전까지의 복습 합: 約束 2(T 전) + 予定 1 + 駅 1(T+2H 전) = 4
    expect(r.reviews).toBe(4);
  });

  it('기본형으로도 맞춘다 — 활용형(食べた)이 담은 말(食べる)과 같은 말', () => {
    const r = buildRemet({ sources: [{ kind: 'reading', id: 3, title: '', words: [w('食べた', T, '食べる')] }],
      vocabRows, reviewRows: [{ item_key: '食べる', created_at: iso(T - H) }] });
    expect(r.total).toBe(1);
    expect(r.sources[0].words).toEqual(['食べる']);
  });

  it('막 담고 복습 전인 말 · 아무것도 없는 주는 0', () => {
    expect(buildRemet({ sources: [{ kind: 'reading', id: 1, words: [w('駅', T)] }], vocabRows, reviewRows }).total).toBe(0);
    expect(buildRemet({})).toEqual({ total: 0, reading: 0, conversation: 0, reviews: 0, sources: [] });
  });
});

describe('대화 — 그 주에 붙은 줄만(토큰 id의 시각)', () => {
  it('id_{줄}_{k}_{ts} · failed_{줄}_{ts}의 ts를 읽는다', () => {
    expect(conversationTokenTime(`id_3_0_${T}`)).toBe(T);
    expect(conversationTokenTime(`failed_4_${T}`)).toBe(T);
    expect(conversationTokenTime('id_3_0')).toBe(null); // 일반 자료 토큰 — 시각 없음
  });
  it('창 밖 줄 · 기능어는 빼고 단어마다 처음 나온 시각', () => {
    const json = { sequence: [`id_0_0_${T - 10 * 24 * H}`, `id_1_0_${T}`, `id_1_1_${T}`, `br_1_${T}`, `id_2_0_${T + H}`],
      dictionary: {
        [`id_0_0_${T - 10 * 24 * H}`]: { text: '昔', pos: '명사' },
        [`id_1_0_${T}`]: { text: '約束', base_form: '約束', pos: '명사' },
        [`id_1_1_${T}`]: { text: 'が', pos: '조사' },
        [`br_1_${T}`]: { text: '\n', pos: '개행' },
        [`id_2_0_${T + H}`]: { text: '約束', base_form: '約束', pos: '명사' },
      } };
    expect(conversationWordsBetween(json, T - H, T + 24 * H)).toEqual([{ key: '約束', text: '約束', base_form: '約束', at: T }]);
  });
});

describe('배선 — 이번 주 창 한 줄 → 다시 만난 말 창', () => {
  const page = fs.readFileSync('src/views/ProfileStats.jsx', 'utf8');
  const rows = fs.readFileSync('src/lib/remetRows.js', 'utf8');
  const css = fs.readFileSync('src/components/learn/learn.css', 'utf8');
  it('창을 연 사람에게만 조회한다 — 현황 첫 화면 비용 0, 담은 말은 현황 snapshot을 다시 쓴다', () => {
    const modal = sliceBetween(page, 'function WeeklyModal(', '\n}\n');
    expect(modal).toContain("queryKey: ['remet', user?.id, weekStartMs]");
    expect(modal).toContain('vocabRows: Array.isArray(vocab) ? vocab : null');
    expect(page).toContain('{open && (\n        <WeeklyModal');
  });
  it('완독은 이번 주 「완독」과 같은 출처 · 복습은 담은 말 복습(source vocab)', () => {
    expect(rows).toContain("supabase.from('reading_progress').select('material_id, completed_at')");
    expect(rows).toContain(".eq('source', 'vocab').in('item_key', keys)");
  });
  it('칩 → 단어 카드(복습실과 같은 VocabDetailCard, 누를 때만 받음) · 카드가 떠 있으면 Esc는 카드만 닫는다', () => {
    expect(page).toContain("const VocabDetailCard = dynamic(() => import('./VocabDetailCard'), { loading: () => null });");
    const modal = sliceBetween(page, 'function WeeklyModal(', '\n}\n');
    expect(modal).toContain('onClose={detail ? () => setDetail(null) : onClose}');
    expect(modal).toContain('<VocabDetailCard word={detail} projection={projectionById.get(detail.id)}');
    expect(page).toContain('aria-label={`${w} 단어 카드`}');
  });
  it('목업 그대로 — 0이면 줄째 없음 · 세 칸 글/대화/복습 · 칩 다섯 개 + N · 같은 폭 표시', () => {
    expect(page).toContain('{remetTotal > 0 && onOpenRemet && (');
    expect(page).toContain("cells: d => [[d.reading, '편', '글'], [d.conversation, '개', '대화'], [d.reviews, '번', '복습']],");
    expect(page).toContain('const REMET_CHIPS = 5;');
    expect(css).toMatch(/\.learn-remet__kind\{flex:none;box-sizing:border-box;width:3\.2em;/);
    // 기울임 금지(오너 「글/대화는 기울임 없이」) — 표시는 i/em이 아니다.
    expect(page).toContain('<span className="learn-remet__kind">');
    expect(page).not.toContain('그동안 복습');
  });
});
