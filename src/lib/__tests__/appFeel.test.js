import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';
import VocabReview from '../../views/VocabReview';

vi.mock('../../components/learning/VocabularyContexts', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));

// 앱 손맛(웹·데스크톱) — 오너 「최적화뿐만 아니라 처음에 하려고 했던 앱처럼 효과 넣기 함께 고려」(2026-10-16).
// ① 단어 담기 순간(형광 긋기 · 담은 줄 내려앉기 · 수집 숫자 팝) ② 복습 끝 마무리(막대 솟기 · 제목) ⑨ 0.3초 상한 정리.
// 공통: 0.3초 이하 · 곡선 var(--ease-settle) · transform/opacity만 · 효과마다 모션 축소 블록.
// 움직임만 바꾼다 — 저장 · 채점 · 기록 호출은 그대로여야 한다(아래 마지막 묶음).
// 계약 = 배선 보증(ui-conventions §5). 실제 재생은 getAnimations() 실기 확인이 본다.
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const INDEX = 'src/index.css';
const ROOM = 'src/components/web/review-room.css';
const READER = 'src/components/viewer/reader-controls.css';
const LEARN = 'src/components/learn/learn.css';
const VIEWER = 'src/views/ViewerPage.jsx';
const REVIEW = 'src/views/VocabReview.jsx';

const seconds = (value) => (value.endsWith('ms') ? Number(value.slice(0, -2)) / 1000 : Number(value.slice(0, -1)));
/** 규칙 본문에서 `animation: <이름> <길이> <곡선>`을 뽑는다. */
function animationOf(css, selector, name) {
  const body = sliceBetween(css, `${selector} {`, '}');
  const m = body.match(new RegExp(`animation:\\s*${name}\\s+([\\d.]+m?s)\\s+([^;]+?)(?:\\s+both)?\\s*;`));
  expect(m, `${selector}에 ${name} 애니메이션이 없다`).not.toBeNull();
  return { duration: seconds(m[1]), easing: m[2].trim(), body };
}
/** 여는 중괄호 바로 뒤(start)부터 짝이 맞는 닫는 중괄호 앞까지 — 한 줄 · 여러 줄 블록 모두. */
function blockFrom(css, start) {
  let depth = 1;
  let i = start;
  for (; i < css.length && depth > 0; i += 1) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
  return css.slice(start, i - 1);
}
/** 모션 축소 @media 블록의 본문들. */
const reducedBlocks = (css) => [...css.matchAll(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{/g)].map((m) => blockFrom(css, m.index + m[0].length));
/** @keyframes 본문(없으면 앵커 오류). */
function keyframesOf(css, name) {
  const anchor = `@keyframes ${name} {`;
  sliceBetween(css, anchor);
  return blockFrom(css, css.indexOf(anchor) + anchor.length);
}
/** 모션 축소 블록 안에 그 선택자가 animation: none으로 있다. */
const reducedHas = (css, selector) => reducedBlocks(css).some((block) => {
  const i = block.indexOf(`${selector} {`);
  return i >= 0 && /^[^}]*animation:\s*none/.test(block.slice(i));
});

describe('곡선 토큰 — 효과마다 곡선을 새로 적지 않는다', () => {
  it(':root에 --ease-settle이 있고 카드 넘김도 그 토큰을 쓴다', () => {
    const css = read(INDEX);
    expect(sliceBetween(css, ':root {', '\n}')).toContain('--ease-settle: cubic-bezier(0.23, 1, 0.32, 1);');
    expect(animationOf(css, '.review-card--turn', 'reviewCardTurn').easing).toBe('var(--ease-settle)');
  });
});

describe('효과 규칙 — 0.3초 이하 · var(--ease-settle) · 모션 축소 블록', () => {
  const effects = [
    { file: INDEX, selector: '.word-token--just-saved .surface::before', name: 'hlStroke', max: 0.22 },
    // 선택 중 animation:none(.viewer-layout .word-token[data-selected="true"] .surface::before)을 이기는 되살림 — 없으면 담는 순간 그 토큰에서 안 돈다.
    { file: READER, selector: '.viewer-layout .word-token--just-saved[data-selected="true"] .surface::before', name: 'hlStroke', max: 0.22 },
    { file: READER, selector: '.save-grade__saved--fresh', name: 'settleIn', max: 0.16 },
    { file: ROOM, selector: '.review-done__bar', name: 'barGrow', max: 0.24 },
    { file: INDEX, selector: '.review-done__title', name: 'settleIn', max: 0.2 },
  ];
  for (const { file, selector, name, max } of effects) {
    it(`${selector} — ${name} ${max}s 이하 · 감속 토큰 · 축소 시 animation:none`, () => {
      const css = read(file);
      const { duration, easing } = animationOf(css, selector, name);
      expect(duration).toBeLessThanOrEqual(max);
      expect(duration).toBeLessThanOrEqual(0.3);
      expect(easing).toBe('var(--ease-settle)');
      expect(reducedHas(css, selector), `${file}에 ${selector}의 모션 축소 블록이 없다`).toBe(true);
    });
  }

  it('키프레임은 transform · opacity만 움직인다(레이아웃 · 좌표 불변)', () => {
    const all = [INDEX, ROOM].map(read).join('\n');
    for (const name of ['hlStroke', 'settleIn', 'barGrow']) {
      const frames = keyframesOf(all, name);
      const props = [...frames.matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length, `${name} 키프레임이 비었다`).toBeGreaterThan(0);
      for (const prop of props) expect(['transform', 'opacity'], `${name}이 ${prop}을 움직인다`).toContain(prop);
    }
  });

  it('형광 긋기는 왼쪽에서, 막대는 바닥에서 — 기점이 반대면 효과가 뒤집혀 보인다', () => {
    expect(sliceBetween(read(INDEX), '.word-token--just-saved .surface::before {', '}')).toMatch(/transform-origin:\s*left/);
    expect(animationOf(read(ROOM), '.review-done__bar', 'barGrow').body).toMatch(/transform-origin:\s*bottom/);
  });

  it('막대 뒤따름은 --i × 10ms이고, 모션 축소에서는 delay까지 0이다(전역 규칙은 delay를 남긴다)', () => {
    const css = read(ROOM);
    expect(animationOf(css, '.review-done__bar', 'barGrow').body).toContain('animation-delay:calc(var(--i, 0) * 10ms)');
    const block = reducedBlocks(css).find((b) => b.includes('.review-done__bar {'));
    expect(sliceBetween(block, '.review-done__bar {', '}')).toMatch(/animation-delay:\s*0s/);
  });

  it('형광 긋기의 모션 축소는 index.css가 직접 진다 — 뷰어 규칙(.viewer-layout *)은 ::before를 덮지 않는다', () => {
    expect(read(READER)).toMatch(/\.viewer-layout \*, \.reader-modal \*/);
    const block = reducedBlocks(read(INDEX)).find((b) => b.includes('.word-token--just-saved .surface::before'));
    expect(block).toMatch(/\.word-token--just-saved \.surface::before \{ animation: none; transform: none; \}/);
  });
});

describe('⑨ 0.3초 상한 위반 정리', () => {
  it('수집 팝 vocabCounterPop 0.2s · learnIn 0.24s', () => {
    const pop = sliceBetween(read(INDEX), '.viewer-badge--pop {', '}').match(/vocabCounterPop ([\d.]+)s/);
    expect(Number(pop[1])).toBeLessThanOrEqual(0.2);
    const learn = read(LEARN).match(/\.learn-review__cycle\{animation:learnIn ([\d.]+)s/);
    expect(Number(learn[1])).toBeLessThanOrEqual(0.3);
  });
});

describe('죽은 효과 재발 방지 — CSS만 있고 붙는 곳이 없으면 아무 일도 안 일어난다', () => {
  const viewer = read(VIEWER);
  it('ViewerPage가 담은 토큰에 word-token--just-saved, 수집 숫자에 viewer-badge--pop, 담은 줄에 --fresh를 붙인다', () => {
    expect(viewer).toContain("${isSaved && justSaved === tokenId ? ' word-token--just-saved' : ''}");
    expect(viewer).toContain("className={`viewer-stats__count${collectPopKey ? ' viewer-badge--pop' : ''}`}");
    expect(viewer).toContain('<span key={collectPopKey} ');
    expect(viewer).toContain("save-grade__saved${justSaved && justSaved === selectedToken?.id ? ' save-grade__saved--fresh' : ''}");
  });
  it('수집 팝은 수가 늘 때만 — 불러오기가 끝난 뒤 같은 자료 안에서 이전 값보다 클 때', () => {
    const effect = sliceBetween(viewer, 'const collectedPrev = useRef(null);', '}, [id, collectReady, collectedInMaterial]);');
    expect(effect).toContain('collectedPrev.current = collectReady ? { id, count: collectedInMaterial } : null;');
    expect(effect).toContain('if (prev && prev.id === id && collectedInMaterial > prev.count) setCollectPopKey(k => k + 1);');
  });
  it('담은 표시는 저장이 확인된 뒤에만 붙는다(낙관 표시 아님)', () => {
    const add = sliceBetween(viewer, 'const addToVocab = async (grade) => {', '\n  };');
    const confirmed = add.indexOf('insertConfirmedVocabulary(queryClient, user.id, inserted[0]);');
    expect(confirmed).toBeGreaterThan(0);
    expect(add.indexOf('{ saveCountRef.current += 1; markJustSaved(savedToken.id); }')).toBeGreaterThan(confirmed);
    expect(add).toContain('if (saved && saveScopeRef.current === saveScope) markJustSaved(savedToken.id);');
  });
  it('VocabReview가 막대마다 순번 --i를 숫자로 넘기고, .review-done__bar에 죽은 transition:height가 없다', () => {
    expect(read(REVIEW)).toContain(": '2px', '--i': i }} title={`${d.key}: ${d.count}개`} />");
    const css = read(ROOM);
    expect(css).not.toMatch(/\.review-done__bar \{[^}]*transition:\s*height/);
  });
  it('끝 화면을 실제로 그리면 7일 막대에 --i 0~6이 인라인으로 붙는다(React가 사용자 속성을 숫자 그대로 넘긴다)', () => {
    const word = { id: 'z1', word_text: '早餐', meaning: '아침 식사', furigana: 'zǎo cān', language: 'Chinese' };
    const html = renderToStaticMarkup(createElement(VocabReview, { vocab: [word], reviewWords: [word], reviewIdx: 0, currentWord: word, effectiveMode: 'flash',
      reviewFinished: true, showAnswer: false, contextOptions: [], speak() {}, ttsSupported: true, setShowHint() {}, finish: { total: 1 },
      learningAvailable: true, projections: [], now: '2026-10-16T00:00:00Z' }));
    const bars = html.match(/<div class="review-done__bar[^"]*" style="[^"]*"/g) || [];
    expect(bars).toHaveLength(7);
    bars.forEach((bar, i) => expect(bar).toContain(`--i:${i}`));
    // 끝 화면 제목은 마지막 채점 뒤 초점을 받는다(tabIndex −1 — VOCAB-FLOW-001, /study 「세션 완료」 선례).
    expect(html).toContain('<h2 tabindex="-1" class="review-done__title">오늘 몫 끝</h2>');
  });
});

describe('움직임만 바꾼다 — 저장 · 채점 · 기록 호출은 그대로', () => {
  it('뷰어 담기 · 인라인 복습 경로', () => {
    const viewer = read(VIEWER);
    for (const call of [
      'inserted = await upsertViewerVocabulary([row], VOCAB_UPSERT);',
      'insertConfirmedVocabulary(queryClient, user.id, inserted[0]);',
      'const saved = await saveKoreanVocabulary(savedToken, g);',
      'const linked = await attachReadingContext(savedToken);',
      "import { revertInlineGrade } from '../lib/inlineGradeUndo';",
      'await revertInlineGrade(supabase, { userId: user.id, last });',
      'const inlineReview = useInlineReview({ user, fetchProfile, toast });',
    ]) expect(viewer).toContain(call);
    expect(read('src/lib/inlineGradeUndo.js')).toContain('logReviewEvents(userId, [{');
  });
  it('복습 채점 경로(VocabReview → VocabPage handleScore → recordReviewCompleted · persistVocabGrade · logReviewEvents)', () => {
    expect(read(REVIEW)).toContain('<ScoreSection word={currentWord} onScore={handleScore} armed={armed} locked={!showAnswer} />');
    const page = read('src/views/VocabPage.jsx');
    for (const call of ['recordReviewCompleted(user.id, {', 'await persistVocabGrade(supabase, last.wordId, prevStats, prevReviewedAt,', 'await logReviewEvents(user.id, [{']) {
      expect(page).toContain(call);
    }
  });
});
