import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildContextPrompt, buildGrammarPrompt, formatChapterCandidates,
  grammarCacheKey, parseGrammarResult,
} from '../grammarDetail.js';

// 계약(오너 확정 2026-08-18): 드래그 자동 경로가 이미 주는 번역·어휘는 문법 해설에서
// 반복하지 않는다. 남는 것은 구조+패턴(통합)과 정본 챕터 연결, 그리고 언어별 문법 축.

describe('buildGrammarPrompt — 언어별 축과 중복 금지', () => {
  it('중국어는 조사 대신 어순·개사·양사·보어를 묻고, 조사 금지를 명시한다', () => {
    const p = buildGrammarPrompt('今天我们学习中文。', 'Chinese');
    expect(p).toContain('중국어');
    expect(p).toMatch(/어순.*개사.*양사.*보어/);
    expect(p).toContain('중국어에는 조사가 없다');
    expect(p).toContain('병음'); // 예문에 병음 요구
  });

  it('일본어는 조사(격조사/부조사)·활용형 축을 쓴다', () => {
    const p = buildGrammarPrompt('今日は暑いですね。', 'Japanese');
    expect(p).toContain('조사');
    expect(p).toContain('활용형');
    expect(p).not.toContain('중국어에는 조사가 없다');
  });

  it('미지원 언어는 영어 축으로 폴백한다', () => {
    expect(buildGrammarPrompt('x', 'Klingon')).toContain('시제');
  });

  it('번역·단어 뜻은 요구하지 않는다(드래그 경로와 중복 제거)', () => {
    const p = buildGrammarPrompt('x', 'English');
    expect(p).toContain('뜻·번역·단어 뜻풀이는 쓰지 말 것');
    expect(p).toContain('구조와 패턴이 같은 말이 되지 않게');
  });

  it('챕터 목록이 있으면 slug 선택을 요구하고, 없으면 챕터 줄 자체를 넣지 않는다', () => {
    const withList = buildGrammarPrompt('x', 'Chinese', 'h1-01-a | H1 | 어순');
    expect(withList).toContain('챕터: (slug 하나)');
    expect(withList).toContain('h1-01-a | H1 | 어순');
    const without = buildGrammarPrompt('x', 'Chinese', '');
    expect(without).not.toContain('챕터:');
  });
});

describe('formatChapterCandidates — 후보 줄 구성', () => {
  const chapters = [
    { slug: 'a', level: 'H1', topic: '어순' },
    { slug: 'b', level: 'H2', title: '제목만' },
    { slug: '', level: 'H2', topic: '슬러그 없음' },
    { slug: 'd', level: 'H3' },
  ];
  it('slug와 주제(없으면 제목)가 있는 항목만 담는다', () => {
    expect(formatChapterCandidates(chapters)).toBe('a | H1 | 어순\nb | H2 | 제목만');
  });
  it('상한으로 토큰을 지킨다', () => {
    expect(formatChapterCandidates(chapters, 1)).toBe('a | H1 | 어순');
    expect(formatChapterCandidates(null)).toBe('');
  });
});

describe('parseGrammarResult — 챕터 줄 분리', () => {
  const valid = new Set(['h1-01-word-order']);
  it('챕터 줄은 본문에서 감추고 slug만 돌려준다', () => {
    const r = parseGrammarResult('구조: A\n패턴: B\n챕터: h1-01-word-order', valid);
    expect(r.body).toBe('구조: A\n패턴: B');
    expect(r.chapterSlug).toBe('h1-01-word-order');
  });
  it('목록에 없는 slug(환각)는 버린다 — 본문에서도 빠진다', () => {
    const r = parseGrammarResult('구조: A\n챕터: made-up-slug', valid);
    expect(r.chapterSlug).toBeNull();
    expect(r.body).toBe('구조: A');
  });
  it('굵게·따옴표 장식을 벗겨 매칭한다', () => {
    expect(parseGrammarResult('**챕터**: `h1-01-word-order`', valid).chapterSlug).toBe('h1-01-word-order');
  });
  it('챕터 줄이 없으면 본문 그대로', () => {
    const r = parseGrammarResult('구조: A\n패턴: B', valid);
    expect(r.chapterSlug).toBeNull();
    expect(r.body).toBe('구조: A\n패턴: B');
  });
});

describe('buildContextPrompt — 말투 조건부(맥락에 통합)', () => {
  it('번역·맥락 뒤에 말투를 두되 유의미할 때만 출력하도록 지시한다', () => {
    const p = buildContextPrompt('今天我们学习中文。', '중국어');
    expect(p.indexOf('**맥락**')).toBeGreaterThan(p.indexOf('**번역**'));
    expect(p.indexOf('**말투**')).toBeGreaterThan(p.indexOf('**맥락**'));
    expect(p).toContain('학습에 유의미할 때만');
    expect(p).toContain('통째로 생략');
  });
});

describe('grammarCacheKey', () => {
  it('언어·문장 단위 키(좌측 번역 viewer_tx와 같은 관례)', () => {
    expect(grammarCacheKey('Chinese', '今天')).toBe('viewer_gr:Chinese:今天');
    expect(grammarCacheKey('Chinese', 'x'.repeat(300)).length).toBe('viewer_gr:Chinese:'.length + 200);
  });
});

// 배선 계약 — 모달 제거와 인라인 경로 고정.
describe('문법 [자세히] 배선 계약', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

  it('모달·체크박스 경로는 제거됐다', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/views/ViewerGrammarModal.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/useGrammarAnalysis.js'))).toBe(false);
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).not.toContain('GRAMMAR_ACTIONS');
    expect(viewer).not.toContain('AI 문법 해설'); // 툴바 버튼 제거
  });

  it('시트 좌측에서 [자세히]로 펼치고 정본 챕터로 링크한다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('grammar.run(leftPanelText)');
    expect(viewer).toContain('자세히 ▾');
    expect(viewer).toContain('grammar.chapter.href');
    expect(viewer).toContain('grammar.ask(leftPanelText)');
  });

  it('문법 노트 저장 경로가 인라인에서도 유지된다(모달 이관 손실 방지)', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('saveGrammarNoteMutation.mutate()');
    expect(viewer).toContain('explanation: grammar.result');
  });

  it('문장을 새로 지정하면 이전 해설을 정리한다', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('grammar.reset()');
  });

  it('좌측 번역·맥락은 buildContextPrompt를 쓴다(말투 통합)', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('callGemini(buildContextPrompt(sel, langName))');
  });

  it('해설 결과는 문장 단위 캐시를 거친다(재열람 무료)', () => {
    const hook = read('src/lib/useGrammarDetail.js');
    expect(hook).toContain('grammarCacheKey');
    expect(hook).toContain('localStorage.getItem(key)');
    expect(hook).toContain('localStorage.setItem(key');
  });
});
