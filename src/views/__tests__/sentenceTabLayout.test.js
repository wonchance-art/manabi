import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages';

/**
 * 계약: [문장] 탭 — 목업 U 4판(오너 10-24, /mnt/project-files/viewer-audit/mockups/U-문장탭-문법-v4.png). AE-R2 PR ③ 배치를 대체한다.
 * - 순서: 문장 카드(원문 + 패턴 자리 표시 · 🔊 · 번역 · 회색 말투 · 교재 표시 — 맥락 줄은 없음, 오너 10-24) → 「패턴」 카드 → 「단어」 카드. 단추 줄 · 🎧 · 질문 · 노트 저장 없음.
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
  it('문장 카드(원문 → 번역) → 패턴 → 단어, 단추 줄은 없다', () => {
    const p = panel();
    const order = ['reader-sentence__original', 'reader-sentence__translation', 'reader-sentence-patterns', 'reader-sentence-words'];
    const at = order.map((marker) => { const i = p.indexOf(marker); expect(i, marker).toBeGreaterThan(-1); return i; });
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const gone of ['reader-sentence__actions', 'grammar-detail', 'setDictationSentence', 'name="headphones"', "vt('단어별 뜻')"]) expect(p, gone).not.toContain(gone);
  });

  it('듣기 단추는 단어 탭과 같은 단추(word-detail-card__speak)', () => {
    expect(sliceBetween(panel(), 'reader-sentence__source', 'reader-sentence__translation')).toContain('className="word-detail-card__speak"');
  });

  it('원문은 자르지 않고 누른 자리만 칠한다 — 120자 slice·따옴표 감싸기 없음, 패턴 자리 표시와 같은 묶음', () => {
    const p = panel();
    expect(p).not.toMatch(/\.slice\(0,\s*120\)/);
    expect(p).not.toContain('&quot;{');
    expect(p).toContain('sentencePatternMarks({ text: leftPanelText, card: picked, term, bounds })');
    expect(p).toMatch(/<mark key=\{j\} className="reader-card-sentence__term">/);
  });

  it('진행 표시는 번역 칸에만 — 탭 전체 로딩 화면이 없다, 패턴은 자리만 잡는다', () => {
    expect(viewer).not.toMatch(/const leftPanelContent = leftPanelLoading \?/);
    expect(viewer).not.toContain('번역 + 맥락 생성 중');
    const p = panel();
    const slot = sliceBetween(p, 'reader-sentence__translation', 'reader-sentence-patterns');
    expect(slot).toContain("vt('번역 중…')");
    expect(p).toContain('<div className="reader-pattern reader-pattern--pending" aria-busy="true" />');
  });

  it('단어 · 패턴 후보는 자료 토큰에서 — 재분석·드래그 목록·만남 기록을 쓰지 않는다', () => {
    const p = panel();
    expect(p).toContain('sentenceWordGlosses(');
    expect(p).toContain('sentencePatternCandidates(sentencePatternIndex.index, sentenceTokens)');
    for (const banned of ['dragTokens', '/api/analyze', 'recordVocabEncounters', 'logReviewEvents', 'setDragTokens']) expect(p, banned).not.toContain(banned);
  });

  it('상태 칸은 단어장 부품(StatusPill) — 단어는 기존 뷰어 저장 경로, 패턴은 bk: 큐', () => {
    const p = panel();
    expect(p).toContain('onSave={() => saveInlineVocabulary(token)}');
    expect(p).toContain('onSave={() => savePattern(card.entry)}');
    // 근거 없는 급수 · 담기 금지: 사전 항목(entry)이 있을 때만 태그 · ☆ · 링크. 「사전에 없음」 안내 문구는 없다(오너 10-24).
    expect(p).toContain("const slug = card.entry ? patternSlug(card.entry) : null;");
    expect(p).toContain("const tag = card.entry ? patternLevelTag(card.entry.level) : '';");
    for (const gone of ['문형 사전에 없음', 'AI가 나눈 패턴']) expect(p).not.toContain(gone);
  });

  it('패턴 머리 = 2열(공식 | 급수 딱지 / 뜻 | ☆) — 딱지와 ☆는 같은 세로축 가운데(오너 10-24 「서로 자리를 바꿔」)', () => {
    const head = sliceBetween(panel(), '<div className="reader-pattern__head">', '{card.note &&');
    const at = ['reader-pattern__formula', 'reader-pattern__tag', 'reader-pattern__ko', '<StatusPill'].map((m) => head.indexOf(m));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const css = read('src/components/viewer/reader-controls.css');
    expect(css).toMatch(/\.reader-pattern__head \{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(44px,max-content\);[^}]*justify-items:center/);
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

  it('안내는 번역 칸 안의 로그인 링크 — 로그인 뒤 이 자료로 돌아온다', () => {
    const slot = sliceBetween(panel(), 'reader-sentence__translation', 'reader-sentence-patterns');
    expect(slot).toContain('SENTENCE_TX_LOGIN_REQUIRED');
    expect(slot).toContain('href={signInHref}');
    expect(viewer).toMatch(/const signInHref = authEntryHref\(/);
    expect(slot).toContain("vt('로그인하면 이 문장의 번역을 볼 수 있어요 →')");
  });

  it('새 문구는 ko·zh-CN·zh-TW 세 언어', () => {
    for (const key of ['번역 중…', '패턴', '단어', '패턴 담기', '문장에 표시', '문형 목록에서 보기', '예문 듣기', '로그인하면 이 문장의 번역을 볼 수 있어요 →']) {
      for (const locale of VIEWER_MESSAGE_LOCALES) expect(VIEWER_MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
    }
  });
});
