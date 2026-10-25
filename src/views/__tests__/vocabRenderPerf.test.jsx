import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

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
