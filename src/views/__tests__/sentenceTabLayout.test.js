import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages';

/**
 * 계약: [문장] 탭 재배치 — 뷰어 v2 AE-R2 PR ③(설계서 docs/manabi-viewer-v2-ae-r2.md §3·§8 PR③·§11 목업, 정본 §4).
 * - 순서: 원문 줄(누른 단어 칠) → 번역 → [더 쉽게][자세히] → 문형 → 단어별 뜻. 120자 표시 자르기 없음.
 * - 진행 표시는 번역 칸에만 — 로딩이 탭 전체를 덮지 않는다(「번역 + 맥락 생성 중...」 한 줄 화면 폐지).
 * - 단어별 뜻·문형은 자료 토큰에서(재분석·드래그 목록·만남 기록 0).
 * - 게스트는 캐시·교재 맵이 없으면 AI를 부르지 않고 로그인 안내(Q4). 「AI」 표시 0(오너 결정 10-07 23:45).
 * 행동은 e2e/viewer-focus-move.e2e.mjs 「AE-R2 ③」 시나리오가 본다.
 */
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const sliceBetween = (src, start, end) => {
  const i = src.indexOf(start);
  expect(i, `missing ${start}`).toBeGreaterThan(-1);
  const j = src.indexOf(end, i + start.length);
  expect(j, `missing end after ${start}`).toBeGreaterThan(i);
  return src.slice(i, j);
};
const panel = () => sliceBetween(viewer, 'const renderSentencePanel = () => {', '\n  // --dragging');

describe('[문장] 탭 — 목업 순서', () => {
  it('원문 → 번역 → [더 쉽게][자세히] → 문형 → 단어별 뜻', () => {
    const p = panel();
    const order = ['pdf-context__original', 'reader-sentence__translation', 'reader-sentence__actions', 'easier.run(leftPanelText)',
      'grammar.run(leftPanelText)', 'reader-sentence__patterns', 'reader-sentence__glosses'];
    const at = order.map((marker) => { const i = p.indexOf(marker); expect(i, marker).toBeGreaterThan(-1); return i; });
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('원문은 자르지 않고 누른 자리만 칠한다 — 120자 slice·따옴표 감싸기 없음', () => {
    const p = panel();
    expect(p).not.toMatch(/\.slice\(0,\s*120\)/);
    expect(p).not.toContain('&quot;{');
    expect(p).toContain('sentencePanelOriginal(');
    expect(p).toMatch(/<mark className="reader-card-sentence__term">/);
  });

  it('진행 표시는 번역 칸에만 — 탭 전체 로딩 화면이 없다', () => {
    expect(viewer).not.toMatch(/const leftPanelContent = leftPanelLoading \?/);
    expect(viewer).not.toContain('번역 + 맥락 생성 중');
    const p = panel();
    const slot = sliceBetween(p, 'reader-sentence__translation', 'reader-sentence__actions');
    expect(slot).toContain("vt('번역 중…')");
  });

  it('단어별 뜻·문형은 자료 토큰과 문형 스캔에서 — 재분석·드래그 목록·만남 기록을 쓰지 않는다', () => {
    const p = panel();
    expect(p).toContain('sentenceWordGlosses(');
    expect(p).toContain('sentencePatternHits(visibleScan');
    expect(p).toContain('<PatternCard');
    for (const banned of ['dragTokens', '/api/analyze', 'recordVocabEncounters', 'logReviewEvents', 'setDragTokens']) expect(p, banned).not.toContain(banned);
  });

  it('「AI」 표시가 없다 — 탭 안 문구·라벨 어디에도', () => {
    const p = panel();
    expect(p).not.toMatch(/>[^<{}]*\bAI\b/);
    expect(p).not.toMatch(/vt\((['"])[^'"]*\bAI\b/);
  });
});

describe('[문장] 탭 — 게스트(Q4)', () => {
  it('비로그인이면 AI 앞에서 멈추고(beforeAi) 로그인 안내 상태로 둔다', () => {
    const run = sliceBetween(viewer, 'const runSelectedSentence = async', 'explainSelectedSentenceRef.current = runSelectedSentence;');
    expect(run).toMatch(/user \? \{\} : \{ beforeAi: \(\) => false \}/);
    expect(run).toContain('SENTENCE_TX_LOGIN_REQUIRED');
  });

  it('안내는 번역 칸 안의 /auth 링크', () => {
    const slot = sliceBetween(panel(), 'reader-sentence__translation', 'reader-sentence__actions');
    expect(slot).toContain('SENTENCE_TX_LOGIN_REQUIRED');
    expect(slot).toContain('href="/auth"');
    expect(slot).toContain("vt('로그인하면 이 문장의 번역을 볼 수 있어요 →')");
  });

  it('새 문구는 ko·zh-CN·zh-TW 세 언어', () => {
    for (const key of ['번역 중…', '단어별 뜻', '로그인하면 이 문장의 번역을 볼 수 있어요 →']) {
      for (const locale of VIEWER_MESSAGE_LOCALES) expect(VIEWER_MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
    }
  });
});
