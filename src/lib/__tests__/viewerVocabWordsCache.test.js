// 자료를 열 때마다 전체 단어 목록을 다시 받던 것(로그인 감사 F3③, 2026-10-25 KST) — 화면은 그대로, 같은 것을 다시 받지 않는다.
// 뷰어 저장 · 만기 색인(['vocab-words']): 앱 기본 신선도(2분 — 같은 키의 단어장 글자 칸과 같다), 단어장이 막 받은 같은 snapshot으로 시작.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { sliceBetween } from './helpers/sliceBetween';
import { legacyLearningSnapshot } from '../../../e2e/fixtures/learning-snapshot.mjs';

vi.mock('../supabase', () => ({ supabase: {} }));

const { VOCAB_WORDS_STALE_MS, vocabWordsFromLearningCache } = await import('../viewerVocabularyCache');
const { QUERY_CLIENT_DEFAULTS } = await import('../queryClientDefaults');
const { buildVocabularyWordIndex } = await import('../vocabularyDueIndex');
const { projectVocabularyLearningRows } = await import('../vocabularyLearningRows');
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const UID = '00000000-0000-4000-8000-000000000001';
function snapshotFor(actorId = UID) {
  const words = [{ id: 'w1', word_text: '本', base_form: '本', language: 'Japanese', meaning: '책', next_review_at: '2026-01-01T00:00:00.000Z' }];
  return projectVocabularyLearningRows(legacyLearningSnapshot({ actorId, rows: words }), { actorId });
}

describe('F3③ 뷰어 저장 · 만기 색인 — 단어장과 같은 snapshot · 같은 신선도', () => {
  it('신선도는 앱 기본값(2분) — 같은 키를 쓰는 단어장 글자 칸(기본값)과 같고, 뷰어만 30초로 줄이지 않는다', () => {
    expect(VOCAB_WORDS_STALE_MS).toBe(QUERY_CLIENT_DEFAULTS.queries.staleTime);
    const viewer = read('src/views/ViewerPage.jsx');
    const q = sliceBetween(viewer, "queryKey: ['vocab-words', user?.id],", '});');
    expect(q).toContain('staleTime: VOCAB_WORDS_STALE_MS,');
    expect(q).toContain('initialData: () => vocabWordsFromLearningCache(queryClient, user?.id),');
    expect(q).toContain("initialDataUpdatedAt: () => queryClient.getQueryState(['vocab', user?.id, 'learning'])?.dataUpdatedAt,");
    expect(viewer).not.toContain('staleTime: 1000 * 30,');
    // 조회 함수는 그대로(정본 하나 — 새 조회 함수 없음)
    expect(q).toContain('queryFn: async ({ signal }) => preservePendingVocabularyReviews(await fetchUserVocabWords(user.id, signal),');
    expect(read('src/components/levels/word/LevelWordScreen.jsx')).toContain("queryKey: ['vocab-words', userId],");
  });

  it('단어장이 막 받은 완전 snapshot이면 같은 색인(받아 온 것과 같은 함수 · 같은 입력)', () => {
    const client = new QueryClient();
    const snapshot = snapshotFor();
    client.setQueryData(['vocab', UID, 'learning'], snapshot);
    const index = vocabWordsFromLearningCache(client, UID);
    const expected = buildVocabularyWordIndex(snapshot);
    expect([...index.byKey.keys()]).toEqual([...expected.byKey.keys()]);
    expect(index.complete).toBe(true);
    expect(index.actorId).toBe(UID);
  });

  it.each([
    ['손님 · 계정 모름', (c) => c, undefined],
    ['단어장 snapshot 없음', (c) => c, UID],
    ['다른 계정의 snapshot', (c) => { c.setQueryData(['vocab', UID, 'learning'], { ...snapshotFor('00000000-0000-4000-8000-000000000002') }); return c; }, UID],
    ['기기 사본(끊긴 채 받은 불완전 목록)', (c) => { c.setQueryData(['vocab', UID, 'learning'], { ...snapshotFor(), offline: true, complete: false }); return c; }, UID],
    ['채점 뒤 낡음 표시(무효화)', (c) => { c.setQueryData(['vocab', UID, 'learning'], snapshotFor()); c.invalidateQueries({ queryKey: ['vocab', UID], refetchType: 'none' }); return c; }, UID],
    ['신선도 밖(2분 지남)', (c) => { c.setQueryData(['vocab', UID, 'learning'], snapshotFor(), { updatedAt: Date.now() - VOCAB_WORDS_STALE_MS - 1 }); return c; }, UID],
  ])('쓰지 않는다(지금처럼 받는다): %s', (_label, arrange, uid) => {
    expect(vocabWordsFromLearningCache(arrange(new QueryClient()), uid)).toBe(undefined);
  });

  it('오늘 학습(채점 · 새 단어 저장이 이 키를 무효화하지 않는다)을 떠날 때 세션 계정의 색인을 낡음으로만 표시한다(다시 읽지 않음)', () => {
    const study = read('src/views/StudySessionPage.jsx');
    expect(study).toContain("if (sessionUserRef.current) queryClient.invalidateQueries({ queryKey: ['vocab-words', sessionUserRef.current], refetchType: 'none' });");
    expect(study).toContain('useEffect(() => () => {');
  });
});
