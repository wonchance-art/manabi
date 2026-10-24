import { describe, expect, it } from 'vitest';
import {
  buildPatternPromptBlock, isPatternSlug, parsePatternSlug, patternAnchor, patternCells, patternLevelTag, patternListHref,
  patternSlug, resolvePatternCards, sentencePatternMarks, splitPatternSection,
} from '../sentencePattern';
import { loadSentencePatternIndex, sentencePatternCandidates } from '../sentencePatternScan';
import { blankExample, buildPatternReviewItem, loadBunkeiEntries, patternDistractors } from '../patternReview';
import { patternQueueRow, patternStatus } from '../patternSave';
import { sliceBetween } from './helpers/sliceBetween.js';

const toks = (...words) => words.map((text, i) => ({ id: `t${i}`, text }));

describe('공식 → 칸 (목업 U 4판 — 자리는 회색 이름, 고정 글자는 흰 칸)', () => {
  it('「+」 공식 · 띄어 쓴 공식 · 붙은 공식 · 선택 요소 · 일본어 〜', () => {
    expect(patternCells('주어 + 很 + 형용사')).toEqual([
      { kind: 'slot', text: '주어' }, { kind: 'fixed', text: '很' }, { kind: 'slot', text: '형용사' }]);
    expect(patternCells('A 是 B')).toEqual([{ kind: 'slot', text: 'A' }, { kind: 'fixed', text: '是' }, { kind: 'slot', text: 'B' }]);
    expect(patternCells('太…了')).toEqual([{ kind: 'fixed', text: '太' }, { kind: 'slot', text: '…' }, { kind: 'fixed', text: '了' }]);
    expect(patternCells('正在・在 + 동사 (+ 呢)')).toEqual([
      { kind: 'fixed', text: '正在・在' }, { kind: 'slot', text: '동사' }, { kind: 'fixed', text: '呢', optional: true }]);
    expect(patternCells('〜では ありません')).toEqual([{ kind: 'slot', text: '〜' }, { kind: 'fixed', text: 'では' }, { kind: 'fixed', text: 'ありません' }]);
  });
});

describe('사전 후보 — 한 글자 표지도 문장 안에서는 고른다, 고정 글자가 모두 있어야 한다', () => {
  it('很 문장은 형용사 술어 문형, 把 문장은 고정 글자가 더 맞는 쪽, 除了…以外는 다섯 글자가 맞는 쪽', async () => {
    const ix = await loadSentencePatternIndex('Chinese');
    expect(sentencePatternCandidates(ix, toks('我们', '今天', '很', '忙', '。'))[0].pattern).toMatch(/很 \+ 형용사/);
    // 今天・明天・昨天(자리 없는 어휘 항목)은 후보가 아니다.
    expect(sentencePatternCandidates(ix, toks('我们', '今天', '很', '忙')).some((e) => e.pattern.includes('明天'))).toBe(false);
    expect(sentencePatternCandidates(ix, toks('他', '把', '书', '放', '在', '桌子', '上', '。'))[0].pattern).toBe('把 + 목적어 + 동사 + 给/在/到 + …');
    expect(sentencePatternCandidates(ix, toks('除了', '他', '以外', '，', '大家', '都', '来', '了', '。'))[0].pattern).toBe('除了 … 以外, 都/还 …');
    // 是…的는 的가 없으면 후보가 아니다.
    const shi = sentencePatternCandidates(ix, toks('我', '是', '学生'));
    expect(shi[0].pattern).toBe('A 是 B');
    expect(shi.some((e) => e.pattern.includes('的'))).toBe(false);
  });
  it('후보는 상한까지만(프롬프트 길이)', async () => {
    const ix = await loadSentencePatternIndex('Chinese');
    expect(sentencePatternCandidates(ix, toks('他', '把', '书', '放', '在', '桌子', '上', '了', '。')).length).toBeLessThanOrEqual(8);
  });
});

describe('번역 요청의 문형 칸 — 같은 요청 하나, 응답에서 떼어 낸다', () => {
  const candidates = [{ id: 'H1-2', level: 'H1', pattern: '주어 + 很 + 형용사', ko: 'A는 ~하다', ex: { zh: '今天很热。', pinyin: 'jīntiān hěn rè', ko: '오늘은 더워요.' } }];
  it('후보가 있으면 번호 줄과 후보 목록, 없으면 공식만', () => {
    const withList = buildPatternPromptBlock('Chinese', candidates);
    expect(withList.format).toContain('번호:');
    expect(withList.rules).toContain('1 | 주어 + 很 + 형용사 | A는 ~하다');
    const none = buildPatternPromptBlock('Chinese', []);
    expect(none.format).not.toContain('번호:');
    expect(none.rules).not.toContain('후보');
  });
  it('응답의 **문형** 칸을 떼고, 번호 · 칸 대응을 읽는다 — 번역 · 맥락은 그대로', () => {
    const raw = '**번역**\n오늘은 날씨가 좋다.\n\n**맥락**\n일상 서술문이에요.\n\n**문형**\n번호: 1\n칸: 주어=今天天气 | 很=很 | 형용사=好';
    const { text, pick } = splitPatternSection(raw);
    expect(text).toBe('**번역**\n오늘은 날씨가 좋다.\n\n**맥락**\n일상 서술문이에요.');
    expect(pick.numbers).toEqual([1]);
    expect(pick.slots).toEqual([{ label: '주어', text: '今天天气' }, { label: '很', text: '很' }, { label: '형용사', text: '好' }]);
    const cards = resolvePatternCards({ candidates, pick });
    expect(cards).toHaveLength(1);
    expect(cards[0].entry).toBe(candidates[0]);
    expect(cards[0].ex).toEqual({ text: '今天很热。', reading: 'jīntiān hěn rè', ko: '오늘은 더워요.' });
  });
  it('사전에 없으면 AI 공식 · 뜻 · 예문으로 — 급수 · 담기 근거(entry)가 없다', () => {
    const raw = '**번역**\n경치가 정말 웅장하다!\n**문형**\n공식: 주어 + 非常 + 형용사\n뜻: A가 아주 ~하다\n예문: 这里的菜非常好吃。 / zhèlǐ de cài fēicháng hǎochī / 여기 음식은 아주 맛있어요.\n칸: 주어=景色 | 非常=非常 | 형용사=壮观';
    const { pick } = splitPatternSection(raw);
    const [card] = resolvePatternCards({ candidates: [], pick });
    expect(card.entry).toBeNull();
    expect(card.ko).toBe('A가 아주 ~하다');
    expect(card.ex).toEqual({ text: '这里的菜非常好吃。', reading: 'zhèlǐ de cài fēicháng hǎochī', ko: '여기 음식은 아주 맛있어요.' });
  });
  it('문형 칸이 없는 옛 캐시 · 교재 뜻은 사전 첫 후보(자리 표시 없이)', () => {
    const { text, pick } = splitPatternSection('**번역**\n오늘은 바빠요.');
    expect(text).toBe('**번역**\n오늘은 바빠요.');
    expect(pick).toBeNull();
    expect(resolvePatternCards({ candidates, pick })[0].slots).toEqual([]);
    expect(resolvePatternCards({ candidates: [], pick: null })).toEqual([]);
  });
  it('범위 밖 번호는 버리고, 카드는 둘까지', () => {
    const two = [...candidates, { ...candidates[0], id: 'H1-3', pattern: 'A 是 B' }, { ...candidates[0], id: 'H1-4', pattern: 'A 有 B' }];
    expect(resolvePatternCards({ candidates: two, pick: { numbers: [9], slots: [] } })[0].entry.id).toBe('H1-2');
    expect(resolvePatternCards({ candidates: two, pick: splitPatternSection('**문형**\n번호: 3, 2, 1').pick })).toHaveLength(2);
  });
});

describe('원문 위 표시 — 자리는 AI 칸 대응이 있을 때만, 없으면 고정 글자만 굵게', () => {
  const card = { cells: patternCells('주어 + 很 + 형용사'), slots: [] };
  const flat = (groups) => groups.map((g) => `${g.kind}${g.label ? `(${g.label})` : ''}:${g.pieces.map((p) => (p.term ? `[${p.text}]` : p.text)).join('')}`);
  it('칸 대응 → 주어 · 형용사 자리 + 很 고정, 누른 단어(天气)는 자리 안에서 칠한다', () => {
    const marks = sentencePatternMarks({ text: '今天天气很好。', card: { ...card, slots: [{ label: '주어', text: '今天天气' }, { label: '很', text: '很' }, { label: '형용사', text: '好' }] },
      term: { start: 2, end: 4 } });
    expect(flat(marks)).toEqual(['slot(주어):今天[天气]', 'fixed:很', 'slot(형용사):好']);
    expect(marks.at(-1).tail).toBe('。');
  });
  it('칸 대응에 고정 글자가 빠져도(자리 이름만) 고정 글자는 공식에서 찾아 함께 표시한다', () => {
    const cmp = { cells: patternCells('A 比 B 更/还 + 형용사'), slots: [{ label: 'A', text: '眼前的体育场' }, { label: 'B', text: '照片上' }, { label: '형용사', text: '壮观' }] };
    expect(flat(sentencePatternMarks({ text: '眼前的体育场比照片上更壮观。', card: cmp }))).toEqual(
      ['slot(A):眼前的体育场', 'fixed:比', 'slot(B):照片上', 'fixed:更', 'slot(형용사):壮观']);
    // 칸 바로 뒤 마침표는 그 칸에 붙어(tail) 혼자 다음 줄로 떨어지지 않는다.
    expect(sentencePatternMarks({ text: '眼前的体育场比照片上更壮观。', card: cmp }).at(-1).tail).toBe('。');
  });
  it('칸 대응 없음 → 고정 글자만', () => {
    expect(flat(sentencePatternMarks({ text: '今天天气很好。', card }))).toEqual(['plain:今天天气', 'fixed:很', 'plain:好。']);
  });
  it('패턴이 없으면 누른 단어만', () => {
    expect(flat(sentencePatternMarks({ text: '你好。', term: { start: 0, end: 2 } }))).toEqual(['plain:[你好]。']);
  });
});

describe('담기 열쇠 · 급수 · 목록 링크', () => {
  it('bk: slug는 레벨 + 공식, 되읽을 수 있다', () => {
    const slug = patternSlug({ level: 'H1', pattern: '주어 + 很 + 형용사' });
    expect(slug).toBe('bk:H1:주어 + 很 + 형용사');
    expect(parsePatternSlug(slug)).toEqual({ level: 'H1', pattern: '주어 + 很 + 형용사' });
    expect(isPatternSlug('rt:abc')).toBe(false);
    expect(patternSlug(null)).toBeNull();
  });
  it('급수 태그와 레벨 문형 목록 앵커 링크', () => {
    expect(patternLevelTag('H1')).toBe('HSK 1');
    expect(patternLevelTag('N4')).toBe('JLPT N4');
    expect(patternListHref({ level: 'H1', pattern: 'A 是 B' })).toBe(`/chinese/bunkei/h1#${patternAnchor('A 是 B')}`);
    expect(patternListHref({ level: 'N4', pattern: '〜てから' })).toMatch(/^\/japanese\/bunkei\/n4#bk-[0-9a-z]+$/);
    expect(patternListHref({ level: null, pattern: 'x' })).toBeNull();
  });
  it('상태 — 담은 날은 「오늘」, 다음 학습일 뒤면 「복습」, 아직 모르면 자리만', () => {
    const now = Date.parse('2026-10-24T03:00:00Z');
    expect(patternStatus(null, 'bk:H1:x', now)).toBeNull();
    expect(patternStatus(new Map(), 'bk:H1:x', now)).toBe('new');
    expect(patternStatus(new Map([['bk:H1:x', patternQueueRow('u', 'Chinese', 'bk:H1:x', new Date(now)).next_review_at]]), 'bk:H1:x', now)).toBe('today');
    expect(patternStatus(new Map([['bk:H1:x', '2026-10-30T03:00:00Z']]), 'bk:H1:x', now)).toBe('review');
  });
});

describe('문법 복습 — bk: 행은 예문 빈칸 고르기', () => {
  it('사전 예문의 고정 글자를 비우고 같은 급수 다른 고정 글자를 보기로', async () => {
    const entries = await loadBunkeiEntries('Chinese');
    expect(blankExample('今天很热。', '주어 + 很 + 형용사')).toEqual({ prompt: '今天＿＿热。', answer: '很' });
    const entry = entries.find((e) => e.pattern === '주어 + 很 + 형용사');
    const d = patternDistractors(entries, entry, '很');
    expect(d).toHaveLength(3);
    expect(d).not.toContain('很');
    const item = buildPatternReviewItem({ lang: 'Chinese', slug: 'bk:H1:주어 + 很 + 형용사', interval: 0, ease_factor: 0, repetitions: 0, next_review_at: null }, entries);
    expect(item.langCode).toBe('zh');
    expect(item.level).toBe('HSK 1');
    expect(item.quiz.meaning[0]).toMatchObject({ sentence: '今天＿＿热。', full: '今天很热。', correct: '很', pron: 'jīntiān hěn rè' });
    expect(buildPatternReviewItem({ lang: 'Chinese', slug: 'bk:H1:없는 공식' }, entries)).toBeNull();
  });
  it('일본어도 같은 모양(요미가 발음)', async () => {
    const entries = await loadBunkeiEntries('Japanese');
    const entry = entries.find((e) => e.level === 'N5' && blankExample((e.ex?.ja || ''), e.pattern));
    const item = buildPatternReviewItem({ lang: 'Japanese', slug: patternSlug(entry) }, entries);
    expect(item.langCode).toBe('ja');
    expect(item.quiz.meaning[0].sentence).toContain('＿＿');
  });
});

// 이음새 계약(제품 나침반 ⑶) — grammar_review에 bk: 행이 섞여도 챕터 큐를 읽는 곳이 오염되지 않고, 복습 화면이 문항을 낸다.
describe('bk: 큐 행의 이음새', () => {
  const read = (f) => require('node:fs').readFileSync(f, 'utf8');
  it('일일 세션 조립은 bk: 행을 챕터 복습 자리(limit 2)에서 뺀다 — rt: · drill:과 같은 자리', () => {
    const src = read('src/lib/studyMaterials.js');
    const at = src.indexOf(".not('slug', 'like', 'bk:%')");
    expect(at).toBeGreaterThan(src.indexOf(".not('slug', 'like', 'drill:%')"));
    expect(at).toBeLessThan(src.indexOf('.limit(2)', at));
  });
  it('문법 복습은 bk: 행을 사전 문항 · 예정 줄로 바꾼다(챕터 조회로 떨어지지 않게 맨 앞 분기)', () => {
    const page = read('src/app/(app)/review/grammar/page.jsx');
    const toItem = sliceBetween(page, 'function toItem(', null);
    expect(toItem.indexOf('isPatternSlug(row.slug)')).toBeLessThan(toItem.indexOf('drillIdFromQueueSlug(row.slug)'));
    expect(page).toContain('if (isPatternSlug(row.slug)) return patternUpcomingRow(row, bunkei.get(row.lang));');
  });
  it('담기 · 상태는 bk: 접두 행만 읽고 쓴다 — 기존 행은 덮지 않는다', () => {
    const save = read('src/lib/patternSave.js');
    expect(save).toContain(".like('slug', `${PATTERN_SLUG_PREFIX}%`)");
    expect(save).toContain("ignoreDuplicates: true");
  });
});
