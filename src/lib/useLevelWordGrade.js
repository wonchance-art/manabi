'use client';
// HSK 단어 페이지 — 네 칸 채점 한 길(오너 확정 2026-10-19 KST). 새 저장 · 새 표 없이 이미 있는 정본만 잇는다:
//   담지 않은 단어 = 뷰어 「등급과 함께 담기」(buildVocabRow + VOCAB_UPSERT · insertConfirmedVocabulary · 되돌리기 viewer_undo_vocabulary_save)
//   옛 일정 카드 = 뷰어 인라인 복습(useInlineReview → recordReviewCompleted · 되돌리기 revertInlineGrade)
//   엄격 FSRS 카드 = 복습실 컨트롤러(question → reveal → grade · undo) — 복습 차례일 때만
// 결과마다 되돌리기 꾸러미를 돌려준다(화면이 「알맞음 · 2일 뒤 다시 [되돌리기]」와 Ctrl/⌘+Z에 쓴다).
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { failureMessage } from './errorMessage';
import { VOCAB_UPSERT, buildVocabRow } from './vocabIO';
import { insertConfirmedVocabulary, refreshVocabWordsCards } from './viewerVocabularyCache';
import { prepareViewerSaveUndo, undoViewerSave } from './viewerSaveUndo';
import { patchVocabWordsCache, useInlineReview } from './useInlineReview';
import { revertInlineGrade } from './inlineGradeUndo';
import { recordActivity } from './streak';
import { entryKeys, gradeEngine, levelRowProjection } from './levelWordStatus';
import { disposeLevelFsrs, gradeLevelFsrs, undoLevelFsrs } from './levelFsrsGrade';

const UNDO_MS = 8000;
const vocabKey = (userId) => ['vocab-words', userId];

/** 막 담은 행을 색인에서 뺀다(담기 되돌리기 뒤 — 새로 받기 전까지 ☆로 보이게). */
function dropVocabRow(queryClient, userId, rowId) {
  queryClient.setQueryData(vocabKey(userId), (cur) => {
    if (!cur?.byKey) return cur;
    const byKey = new Map([...cur.byKey].filter(([, row]) => row?.id !== rowId));
    return byKey.size === cur.byKey.size ? cur : { ...cur, byKey };
  });
}

export function useLevelWordGrade({ user, fetchProfile, language = 'Chinese', onError }) {
  const queryClient = useQueryClient();
  const userId = user?.id || null;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const inline = useInlineReview({ user, fetchProfile,
    // 성공 알림은 화면의 되돌리기 안내가 맡는다 — 실패만 알린다.
    toast: (message, type) => { if (type === 'error') errorRef.current?.(message); } });
  useEffect(() => () => disposeLevelFsrs(), [userId]);

  const indexOf = useCallback(() => queryClient.getQueryData(vocabKey(userId)), [queryClient, userId]);
  const lookup = useCallback((key) => levelRowProjection(indexOf(), key, language), [indexOf, language]);

  const save = useCallback(async (entry, rating) => {
    const row = buildVocabRow({ userId, surface: entry.key, base: entry.key, meaning: String(entry.fullMeaning ?? entry.meaning).slice(0, 2000),
      pos: String(entry.pos || '').slice(0, 80), reading: String(entry.reading || '').slice(0, 500), language, grade: rating });
    const { data, error } = await supabase.from('user_vocabulary').upsert([row], VOCAB_UPSERT).select('*');
    if (error) throw error;
    const inserted = data?.[0];
    if (!inserted) return null; // 이미 있던 행 — 색인이 늦었다. 호출부가 새로 받아 그 행으로 채점한다.
    insertConfirmedVocabulary(queryClient, userId, inserted);
    // 색인은 그 카드만 받아 붙인다(SNAPSHOT-CARDS-001 — 뷰어 저장과 같은 길). 실패하면 전처럼 전체.
    void refreshVocabWordsCards(queryClient, userId, [inserted.id]);
    queryClient.invalidateQueries({ queryKey: ['vocab', userId] });
    recordActivity(userId, () => fetchProfile?.(userId));
    const snapshot = await prepareViewerSaveUndo(supabase, inserted, null, false).catch(() => null);
    return { kind: 'save', snapshot, rowId: inserted.id };
  }, [userId, language, queryClient, fetchProfile]);

  const legacy = useCallback(async (row, rating) => {
    const res = await inline.mutateAsync({ vocab: row, rating, userId });
    return { kind: 'legacy', last: { wordId: row.id, itemKey: row.word_text, lang: row.language, rating,
      prev: res.prev, reviewedAt: res.reviewedAt, queued: res.queued } };
  }, [inline, userId]);

  /**
   * 채점 — { ok, undo, reason }. reason: 'not-due'(FSRS 카드 · 복습 차례 아님) · 'new-limit'(오늘 새 단어 몫을 다 씀 — limit) · 'failed'.
   * undo는 UNDO_MS 안에만 쓸 수 있다(뷰어 담기 되돌리기와 같은 창).
   */
  const grade = useCallback(async (entry, rating) => {
    if (!userId) return { ok: false, reason: 'guest' };
    try {
      let { row, projection } = lookup(entryKeys(entry));
      let engine = gradeEngine({ projection, row });
      if (engine === 'save') {
        const undo = await save(entry, rating);
        if (undo) return { ok: true, undo: { ...undo, expiresAt: Date.now() + UNDO_MS } };
        await queryClient.refetchQueries({ queryKey: vocabKey(userId), exact: true });
        ({ row, projection } = lookup(entryKeys(entry)));
        engine = gradeEngine({ projection, row });
        if (engine === 'save') throw new Error('단어장을 다시 읽지 못했어요.');
      }
      if (engine === 'legacy') {
        // 실패 알림은 인라인 복습 훅이 이미 띄운다(한 번만).
        const done = await legacy(row, rating).catch(() => null);
        return done ? { ok: true, undo: { ...done, expiresAt: Date.now() + UNDO_MS } } : { ok: false, reason: 'failed' };
      }
      if (engine === 'fsrs') {
        const result = await gradeLevelFsrs({ accountId: userId, row, rating });
        if (!result.ok && result.reason === 'new-limit') return { ok: false, reason: 'new-limit', limit: result.limit };
        if (!result.ok) throw result.error;
        void refreshVocabWordsCards(queryClient, userId, [row.id]);
        return { ok: true, undo: { kind: 'fsrs', expiresAt: Date.now() + UNDO_MS } };
      }
      return { ok: false, reason: 'not-due' };
    } catch (error) {
      errorRef.current?.(failureMessage('채점을 저장하지 못했어요.', error));
      return { ok: false, reason: 'failed' };
    }
  }, [userId, lookup, save, legacy, queryClient]);

  const undo = useCallback(async (u) => {
    if (!u || !userId || Date.now() > u.expiresAt) throw new Error('되돌릴 수 있는 시간이 지났어요.');
    if (u.kind === 'save') {
      await undoViewerSave(supabase, u.snapshot, userId);
      dropVocabRow(queryClient, userId, u.rowId);
    } else if (u.kind === 'legacy') {
      await revertInlineGrade(supabase, { userId, last: u.last });
      patchVocabWordsCache(queryClient, userId, u.last.wordId, u.last.prev || {});
    } else if (u.kind === 'fsrs') {
      await undoLevelFsrs({ accountId: userId });
    }
    queryClient.invalidateQueries({ queryKey: vocabKey(userId) });
  }, [userId, queryClient]);

  /** ☆ — 등급 없이 담기(뷰어 원탭 담기와 같은 행 · 다음 복습 지금). 되돌리기 꾸러미를 돌려준다. */
  const star = useCallback(async (entry) => {
    if (!userId) return { ok: false, reason: 'guest' };
    try {
      const undo = await save(entry, undefined);
      if (!undo) { queryClient.invalidateQueries({ queryKey: vocabKey(userId) }); return { ok: true, undo: null }; }
      return { ok: true, undo: { ...undo, expiresAt: Date.now() + UNDO_MS } };
    } catch {
      errorRef.current?.('담지 못했어요. 잠시 후 다시 시도해 주세요');
      return { ok: false, reason: 'failed' };
    }
  }, [userId, save, queryClient]);

  /** 되돌릴 수 있는 꾸러미인가 — 담기는 새 행 확인(스냅샷)이 있을 때만. */
  const undoable = (u) => !!u && Date.now() <= u.expiresAt && (u.kind !== 'save' || !!u.snapshot);

  return { grade, star, undo, undoable, lookup, pending: inline.isPending };
}
