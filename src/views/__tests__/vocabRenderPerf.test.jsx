import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import VocabList from '../VocabList.jsx';

vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));

const page = fs.readFileSync('src/views/VocabPage.jsx', 'utf8');

// LOGGED-IN-PERF F7(2026-10-25 KST, 3,000단어 합성 계정 · 모바일 CPU ×4): 채점 1번에 작업 공간이 4–6번 다시 그려지며
// 복습방에만 그려지는 계산(오늘 개수 countReviewScope · 단계 집계 · 목록 정렬 · 집중 연습 후보 · 헷갈린 표현 …)을 매번 다시 했다.
// 세션 중에는 그 값들을 멈춰 두고(useRoomMemo), 세션 화면이 쓰는 값(지금 카드 · 줄 · FSRS 범위)은 그대로 살아 있어야 한다.
describe('세션 중 복습방 계산 멈춤(useRoomMemo)', () => {
  it('복습방 전용 계산만 멈춘다', () => {
    for (const name of ['vocabSearchIndex', 'filteredVocab', 'deckScope', 'deckStats', 'scopeCount', 'practiceWords', 'restorable', 'confused', 'weakDrill']) {
      expect(page, name).toMatch(new RegExp(`const ${name} = useRoomMemo\\(inSession,`));
    }
    // 세션 화면 · 채점 경로가 읽는 값은 멈추지 않는다 — 멈추면 다음 카드 · 「다시」 재노출 · FSRS 출제가 낡은 값을 본다.
    for (const name of ['learningById', 'vocab', 'scopedProjections', 'fsrsScopeIds', 'reviewSessionWords', 'againWord', 'candidateWord', 'languageCounts', 'waitingFsrs']) {
      expect(page, name).not.toMatch(new RegExp(`const ${name} = useRoomMemo`));
    }
  });
  it('멈춤 판정은 세션 크롬 · 미룬 조회와 같은 inSession이고, 끝 화면(세션 밖)에서는 다시 계산한다', () => {
    expect(page.match(/const inSession = /g)).toHaveLength(1);
    expect(page).toContain("const inSession = tab === 'review' && !reviewFinished || tab === 'practice' && !!practice && !practice.finished;");
    expect(page.indexOf('const inSession = ')).toBeLessThan(page.indexOf('useRoomMemo(inSession,'));
    const hook = sliceBetween(page, 'function useRoomMemo(frozen, factory, deps) {', '\n}');
    expect(hook).toContain('const effective = frozen && lastDeps.current ? lastDeps.current : deps;');
    expect(hook).toContain('return useMemo(factory, effective);');
  });
});

// LOGGED-IN-PERF F4: 「더 보기」 INP가 줄 수에 비례해 커졌다(모바일 184 → 392 ms) — 줄이 인라인 JSX였고 펼침 수가 작업 공간 상태였다.
describe('담은 표현 목록 — memo 줄 · 목록 안 펼침 수', () => {
  const list = fs.readFileSync('src/views/VocabList.jsx', 'utf8');
  const words = Array.from({ length: 100 }, (_, i) => ({ id: `w${i}`, user_id: 'actor', word_text: `語${i}`, meaning: `뜻 ${i}`, language: 'Japanese', pos: '' }));
  const props = extra => ({ vocab: words, filteredVocab: words, search: '', sortBy: 'due', langFilter: 'Japanese', setLangFilter: () => {},
    setSearch: () => {}, setSortBy: () => {}, setConfirmAction: () => {}, deleteMutation: { mutate: () => {} }, updateVocabMutation: { mutate: () => {} },
    ttsSupported: true, speak: () => {}, now: Date.parse('2026-10-25T00:00:00.000Z'), ...extra });
  const rows = html => (html.match(/class="card vocab-row/g) || []).length;

  it('줄은 memo 컴포넌트이고 처리기는 목록이 한 번 만든 안정 함수다(줄마다 새 함수 0)', () => {
    expect(list).toContain('const VocabRow = memo(function VocabRow(');
    const loop = sliceBetween(list, 'filteredVocab.slice(0, visibleCount).map(v => {', '}) : (');
    expect(loop).toContain('onActivate={activateRow} onSpeak={speakRow} onEdit={openEdit} onDelete={confirmDelete}');
    expect(loop).not.toMatch(/=\{\s*\(?[a-z, ]*\)?\s*=>/); // 화살표 함수 속성 없음
    for (const name of ['activateRow', 'speakRow', 'confirmDelete', 'openEdit', 'showMore']) expect(list).toMatch(new RegExp(`const ${name} = useCallback\\(`));
  });
  it('「더 보기」 수는 목록 상태 — 부모 ref(pageStore)로 탭을 오가도 기억하고, 토큰이 바뀌면 30으로 돌아간다', () => {
    const token = {};
    expect(rows(renderToStaticMarkup(createElement(VocabList, props({}))))).toBe(30);
    expect(rows(renderToStaticMarkup(createElement(VocabList, props({ pageStore: { token, count: 60 }, pageToken: token }))))).toBe(60);
    expect(rows(renderToStaticMarkup(createElement(VocabList, props({ pageStore: { token, count: 60 }, pageToken: {} }))))).toBe(30);
    expect(renderToStaticMarkup(createElement(VocabList, props({ pageStore: { token, count: 60 }, pageToken: token })))).toContain('더 보기 (40개 남음)');
    expect(page).not.toContain('setVisibleCount');
    expect(page).toContain('const listPageToken = useMemo(() => ({}), [search, sortBy, scopeKey]);');
    expect(page).toContain('pageStore={listPageStore.current}');
  });
});
