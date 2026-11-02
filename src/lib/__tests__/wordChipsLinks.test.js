import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildOutput, unusedReviewedWords, wordsInWriting } from '../usedWords.js';
import { buildRemet, fadingWhenMet, remetInMaterial } from '../remetWords.js';
import { readWritingWords, writingWordsHref } from '../writingWordsParam.js';
import { orderWordChips } from '../../components/WordChips.jsx';
import { sliceBetween } from './helpers/sliceBetween.js';

/* 단어 칩 통합안 + 연계 넷(STATS-MAP-001 · 오너 「통합안으로 연계 넷이랑 같이 진행해」 2026-11-02 KST). */
const T = Date.parse('2026-10-29T03:00:00Z');
const H = 3600e3;
const iso = ms => new Date(ms).toISOString();
const read = f => fs.readFileSync(f, 'utf8');

// 학습 snapshot projection 모양(필요한 칸만) — review.available · memory.lastReview · review.nextQuestionAt · evaluatedAt.
const proj = (word_text, { last = null, next = null, available = true, language = 'Japanese', created = T - 240 * H } = {}) => ({
  kind: 'vocabulary-learning', version: 1, source: 'legacy',
  vocabulary: { id: `id-${word_text}`, word_text, base_form: word_text, language, created_at: iso(created) },
  memory: { lastReview: last == null ? null : iso(last), stability: 3, timeZone: 'Asia/Seoul', rolloverHour: 4 },
  review: { available, known: false, nextQuestionAt: next == null ? null : iso(next), evaluatedAt: iso(T) },
});

describe('칩 — 핵심 말이 앞 · 같은 묶음 순서 유지', () => {
  it('keys가 있으면 핵심을 앞으로, 없으면 그대로', () => {
    expect(orderWordChips(['約束', '駅', '予定', '近く'], new Set(['駅', '近く']))).toEqual(['駅', '近く', '約束', '予定']);
    expect(orderWordChips(['約束', '駅'], null)).toEqual(['約束', '駅']);
    expect(orderWordChips(null, null)).toEqual([]);
  });
  const chips = read('src/components/WordChips.jsx');
  const css = read('src/components/word-chips.css');
  it('다섯 개 + 「+N」은 그 자리에서 펼침(새 창 없음) · 화면 읽기 「駅 — 흐려지던 말 · 단어 카드」', () => {
    expect(chips).toContain('export const WORD_CHIPS_CAP = 5;');
    expect(chips).toContain("onClick={() => { moved.current = true; setOpen(true); }} aria-label={`${rest}개 더 보기`}>+{rest}</button>");
    expect(chips).toContain("const said = key && keyLabel ? `${w} — ${keyLabel}` : w;");
    expect(chips).toContain('aria-label={`${said} · 단어 카드`}');
    // 펼친 뒤 초점은 새로 보인 첫 칩으로(「+N」이 사라져 body로 떨어지지 않게).
    expect(chips).toContain('ref.current?.children?.[cap]?.focus?.();');
  });
  it('채운 칩은 한 번만 퍼진다 · 움직임 줄이기면 없음 · 토큰 색만', () => {
    expect(css).toContain('animation:word-chip-pulse 1.6s ease-out 1}');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.word-chips>.is-key{animation:none}}');
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(css).not.toContain('italic');
  });
});

describe('핵심 판정 — 들어옴 = 흐려지던 말 · 나감 = 처음 씀', () => {
  it('만났을 때 흐려지던 말 = 만난 뒤 복습 없음 · 다음 복습 시각이 만난 때 이전', () => {
    expect(fadingWhenMet(proj('駅', { last: T - 96 * H, next: T - 24 * H }), T)).toBe(true);
    expect(fadingWhenMet(proj('約束', { last: T - 96 * H, next: T + 24 * H }), T)).toBe(false);   // 아직 기한 전
    expect(fadingWhenMet(proj('予定', { last: T + 2 * H, next: T + 48 * H }), T)).toBe(false);    // 만난 뒤 복습 — 그때 상태 모름 → 거짓
    expect(fadingWhenMet(proj('近く', { last: T - 96 * H, next: T - 24 * H, available: false }), T)).toBe(false); // 이미 앎 · 제외
    expect(fadingWhenMet(proj('新', {}), T)).toBe(false);
  });
  it('buildRemet은 말마다 처음 다시 만난 시각(metAt)을 낸다', () => {
    const r = buildRemet({
      sources: [{ kind: 'reading', id: 1, title: '글', words: [{ key: '駅', text: '駅', base_form: '駅', at: T }] }],
      vocabRows: [{ word_text: '駅', base_form: '駅' }],
      reviewRows: [{ item_key: '駅', created_at: iso(T - 48 * H) }],
    });
    expect(r.metAt).toEqual({ 駅: T });
  });
  it('buildOutput은 그 주에 처음 쓴 말(firstWords)과 한 번이라도 쓴 말(everUsed)을 낸다', () => {
    const vocabRows = [{ word_text: '約束', created_at: iso(T - 72 * H) }, { word_text: '予定', created_at: iso(T - 72 * H) }];
    const sources = [
      { kind: 'writing', id: 1, texts: [{ text: '約束と予定', at: T }] },
      { kind: 'writing', id: 2, texts: [{ text: '予定', at: T - 48 * H }] },
    ];
    const r = buildOutput({ sources, vocabRows, fromMs: T - H, untilMs: T + H });
    expect(r.firstWords).toEqual(['約束']);
    expect(r.firstTime).toBe(1);
    expect(new Set(r.everUsed)).toEqual(new Set(['約束', '予定']));
  });
});

describe('연계 1 — 완독 창 「복습한 말 N개를 이 글에서 다시 만났어요」', () => {
  const processedJson = {
    sequence: ['a', 'b', 'c', 'd'],
    dictionary: {
      a: { text: '駅', base_form: '駅', pos: '名詞' },
      b: { text: '約束', base_form: '約束', pos: '名詞' },
      c: { text: '映画', base_form: '映画', pos: '名詞' },
      d: { text: '駅', base_form: '駅', pos: '名詞' },
    },
  };
  it('복습한 적 있는 담은 말만 · 겹침 없이 · 핵심 = 지금 복습할 때가 된 말', () => {
    const projections = [
      proj('駅', { last: T - 96 * H, next: T - 2 * H }),
      proj('約束', { last: T - 24 * H, next: T + 72 * H }),
      proj('映画', {}), // 담았지만 아직 복습 전 — 안 셈
    ];
    const r = remetInMaterial({ processedJson, projections, now: T });
    expect(r.words).toEqual(['駅', '約束']);
    expect([...r.keys]).toEqual(['駅']);
  });
  it('담은 말이 없거나 본문이 없으면 빈 줄(창에는 줄째 없음)', () => {
    expect(remetInMaterial({ processedJson, projections: [], now: T }).words).toEqual([]);
    expect(remetInMaterial({}).words).toEqual([]);
  });
  const modal = read('src/views/ViewerQuizModal.jsx');
  it('이미 받은 snapshot · 이 글 본문만(추가 조회 0) · 0이면 줄째 없음 · 칩 → 단어 카드 · Esc는 카드만', () => {
    expect(modal).toContain('remetInMaterial({ processedJson: material?.processed_json, projections: learning?.projections,');
    expect(modal).toContain('{remet?.words.length > 0 && (');
    expect(modal).toContain('복습한 말 <b>{remet.words.length}개</b>를 이 글에서 다시 만났어요');
    expect(modal).toContain('<WordChips words={remet.words} keys={remet.keys} keyLabel="흐려지던 말" onWord={onWord} />');
    expect(modal).toContain('() => { if (!wordDetail) setCompletionModal(null); }');
    expect(modal).not.toMatch(/supabase|fetch\(/);
    expect(read('src/index.css')).toContain('.completion-word-layer > .vocab-detail-overlay { z-index: 1200; }');
  });
});

describe('연계 2 — 첨삭 결과 「담은 말 N개를 직접 썼어요」', () => {
  const vocabRows = [
    { word_text: '約束', base_form: '約束', language: 'Japanese', created_at: iso(T - 72 * H) },
    { word_text: '予定', base_form: '予定', language: 'Japanese', created_at: iso(T - 72 * H) },
    { word_text: '映画', base_form: '映画', language: 'Japanese', created_at: iso(T + H) },     // 쓴 뒤에 담음
    { word_text: 'plan', base_form: 'plan', language: 'English', created_at: iso(T - 72 * H) }, // 다른 언어
    { word_text: '駅', base_form: '駅', language: 'Japanese', created_at: iso(T - 12 * H) },
  ];
  const text = '週末の予定は駅で映画の約束です plan';
  it('같은 대조(usesWord) · 그 언어 · 쓴 뒤에 담은 말 제외 · 처음 씀 = 그 전 작문 · 대화에 없던 말', () => {
    const sources = [
      { kind: 'writing', id: 9, texts: [{ text: '予定がある', at: T - 48 * H }] },      // 予定은 이미 씀
      { kind: 'writing', id: 8, texts: [{ text: '駅に行く', at: T - 24 * H }] },        // 駅을 담기 전에 쓴 글 — 쓴 말로 안 침
      { kind: 'writing', id: 10, texts: [{ text: text, at: T + 3000 }] },              // 방금 저장된 이 작문(내기 뒤) — 빠진다
    ];
    const r = wordsInWriting({ text, at: T, vocabRows, sources, language: 'Japanese' });
    expect(r.words).toEqual(['約束', '予定', '駅']);
    expect([...r.keys].sort()).toEqual(['約束', '駅'].sort());
  });
  it('처음 씀 재료를 못 받으면 핵심 표시만 없다', () => {
    expect([...wordsInWriting({ text, at: T, vocabRows, sources: null, language: 'Japanese' }).keys]).toEqual([]);
  });
  const page = read('src/views/WritingStudioPage.jsx');
  it('결과 아래 한 줄 · 0이면 줄째 없음 · snapshot은 넘겨받은 말 · 결과가 있을 때만', () => {
    expect(page).toContain('{written?.words.length > 0 && (');
    expect(page).toContain('담은 말 <b>{written.words.length}개</b>를 직접 썼어요');
    expect(page).toContain('<WordChips words={written.words} keys={written.keys} keyLabel="처음 씀" onWord={openWord} />');
    expect(page).toContain('enabled: !!user?.id && (!!handoff || !!result),');
    expect(page).toContain('queryFn: () => fetchSharedVocabularySummary(queryClient, user.id),');
    expect(page).toContain('enabled: !!user?.id && !!result && submittedAt != null,');
  });
});

describe('연계 3 · 4 — 두 창 아래 다음 행동 하나', () => {
  const page = read('src/views/ProfileStats.jsx');
  it('다시 만난 말 → 자료실 「다시 만난 말 먼저」(그 말이 나오는 글) · 없으면 「내 수준 맞춤」', () => {
    expect(page).toContain("? { href: `/materials?${new URLSearchParams({ sort: 'words', words: words.join(',') })}`, label: '이 말이 나오는 글 읽기' }");
    expect(page).toContain(": { href: '/materials?sort=fit', label: '내 수준 맞춤 글 읽기' };");
    const mats = read('src/views/MaterialsPage.jsx');
    expect(mats).toContain('{remetWords.length > 0 && <option value="words">다시 만난 말 먼저</option>}');
    expect(mats).toContain("if (sortBy === 'words') return sortByWordHits(materials, (m) => wordHitsById.get(m.id));");
    expect(mats).toContain('<span className="mat-card__fit-good">다시 만난 말 {hits}개</span>');
  });
  it('넘긴 말 정렬 — 많이 나오는 글 먼저 · 같으면 원래 순서 · 0개 글은 뒤에 남음 · 주소는 다시 좁힘', async () => {
    const { materialWordHits, sortByWordHits } = await import('../remetWords.js');
    const { materialLibraryFilters } = await import('../libraryDiscovery.js');
    const body = { sequence: ['a', 'b', 'c'], dictionary: { a: { text: '駅', base_form: '駅', pos: '名詞' }, b: { text: '食べた', base_form: '食べる', pos: '動詞' }, c: { text: '約束', base_form: '約束', pos: '名詞' } } };
    const words = new Set(['駅', '食べる', '予定']);
    expect(materialWordHits(body, words)).toBe(2);
    expect(materialWordHits({}, words)).toBe(0);
    const hits = { 1: 0, 2: 2, 3: 1, 4: 2 };
    expect(sortByWordHits([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], m => hits[m.id]).map(m => m.id)).toEqual([2, 4, 3, 1]);
    expect(materialLibraryFilters(new URLSearchParams('sort=words&words=駅,駅, 予定 ,'))).toMatchObject({ sort: 'words', words: ['駅', '予定'] });
    expect(materialLibraryFilters(new URLSearchParams('sort=words'))).toMatchObject({ sort: 'newest', words: [] });
  });
  it('직접 쓴 말 → 「아직 안 써 본 말로 작문」 · 넘길 말이 없으면 행동도 없음', () => {
    expect(page).toContain("return words.length ? { href: writingWordsHref({ words, language }), label: '아직 안 써 본 말로 작문' } : null;");
    expect(page).toContain('{footer && (');
  });
  it('아직 안 써 본 말 = 복습한 · 쓴 적 없는 · 복습 대상인 말, 최근 복습 순, 한 언어로', () => {
    const projections = [
      proj('約束', { last: T - 1 * H }),                       // 이미 씀
      proj('近く', { last: T - 2 * H }),
      proj('plan', { last: T - 0.5 * H, language: 'English' }), // 가장 최근 — 언어 English로 정해짐
      proj('meet', { last: T - 3 * H, language: 'English' }),
      proj('の', { last: T - 4 * H }),                          // 가나 한 글자 — 셀 수 없는 말
      proj('一緒に', { last: T - 5 * H }),
      proj('楽しみ', {}),                                       // 복습 전
      proj('known', { last: T - 0.1 * H, language: 'English', available: false }), // 이미 앎
    ];
    expect(unusedReviewedWords({ projections, everUsed: ['約束'] })).toEqual({ language: 'English', words: ['plan', 'meet'] });
    const ja = projections.filter(p => p.vocabulary.language === 'Japanese');
    expect(unusedReviewedWords({ projections: ja, everUsed: ['約束'] })).toEqual({ language: 'Japanese', words: ['近く', '一緒に'] });
    expect(unusedReviewedWords({})).toEqual({ language: null, words: [] });
  });
  it('작문 주소 — 쓰고 읽을 때 다시 좁힘(아는 언어만 · 다섯 개 · 40자 · 겹침 제거)', () => {
    const href = writingWordsHref({ words: ['近く', '一緒に', '楽しみ'], language: 'Japanese' });
    expect(href).toBe('/writing?words=%E8%BF%91%E3%81%8F%2C%E4%B8%80%E7%B7%92%E3%81%AB%2C%E6%A5%BD%E3%81%97%E3%81%BF&lang=Japanese');
    expect(readWritingWords(new URL(href, 'https://x.test').searchParams)).toEqual({ words: ['近く', '一緒に', '楽しみ'], language: 'Japanese' });
    const messy = new URLSearchParams({ words: `a, a ,,${'x'.repeat(41)},b,c,d,e,f`, lang: 'Klingon' });
    expect(readWritingWords(messy)).toEqual({ words: ['a', 'b', 'c', 'd', 'e'], language: null });
  });
  it('작문 화면 — 넘겨받은 말은 내 담은 말에서 뜻을 찾아 「아직 안 써 본 말 써먹기」 칩으로', () => {
    const writing = read('src/views/WritingStudioPage.jsx');
    expect(writing).toContain('<OutputWordChips words={handoffWords} label="✍️ 아직 안 써 본 말 써먹기:" />');
    expect(sliceBetween(writing, 'const handoffWords = useMemo(', ';\n')).toContain('projectionByWord.get(w)?.vocabulary');
  });
});

describe('한자 한 글자 말 — 더 긴 말의 일부면 안 셈(운영 실측: 중국어 쓴 말 맞음이 모두 한 글자 부분 일치)', () => {
  it('양옆이 한자가 아닐 때만 쓴 말', async () => {
    const { usesWord } = await import('../usedWords.js');
    expect(usesWord('駅に行きます', { word_text: '駅' })).toBe(true);
    expect(usesWord('学校に行きます', { word_text: '学' })).toBe(false);
    expect(usesWord('我去公园', { word_text: '去' })).toBe(false);
    expect(usesWord('去!', { word_text: '去' })).toBe(true);
    expect(usesWord('我们去公园', { word_text: '公园' })).toBe(true); // 두 글자 이상은 그대로
  });
  it('중국어 한자 한 글자 말은 「아직 안 써 본 말」로 권하지 않는다', () => {
    const projections = [proj('去', { last: T - H, language: 'Chinese' }), proj('公园', { last: T - 2 * H, language: 'Chinese' })];
    expect(unusedReviewedWords({ projections })).toEqual({ language: 'Chinese', words: ['公园'] });
  });
});


describe('서재 주소 — 넘긴 말 정렬도 자료 목록 도구로(서가가 아니라)', () => {
  it('LibraryPage와 서버 미리 받기가 같은 분기', async () => {
    const { isLibraryToolsView } = await import('../libraryDiscovery.js');
    expect(isLibraryToolsView(new URLSearchParams('sort=words&words=駅'))).toBe(true);
    expect(isLibraryToolsView(new URLSearchParams('sort=fit'))).toBe(true);
    expect(isLibraryToolsView(new URLSearchParams('tools=1'))).toBe(true);
    expect(isLibraryToolsView(new URLSearchParams('sort=title'))).toBe(false);
    expect(fs.readFileSync('src/components/web/LibraryPage.jsx', 'utf8')).toContain('if(isLibraryToolsView(params))return');
    expect(fs.readFileSync('src/lib/server/libraryPrefetch.js', 'utf8')).toContain("return params.get('tab') !== 'public' && !isLibraryToolsView(params);");
  });
});
