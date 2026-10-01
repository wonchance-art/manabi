'use client';
import { scopedVocabularyExclusions } from '../lib/vocabularyExclusion';
import { LANG_NAME_KO } from '../lib/constants';
import { useVocabularyExclusions } from '../lib/useVocabularyExclusions';
export default function VocabularyExclusionList({ vocab = [], scopeIds = null }) {
  const state = useVocabularyExclusions();
  const items = scopedVocabularyExclusions(state.rows, vocab, scopeIds);
  if (state.isError) return <p role="alert">제외 상태를 확인하지 못했어요. <button type="button" className="btn btn--ghost btn--sm" onClick={() => state.refetch()}>다시 확인</button></p>;
  if (!items.length) return null;
  return <details className="vocabulary-exclusions">
    <summary>제외 <span>{items.length}</span></summary>
    <ul>{items.map(entry => {
      const word = vocab.find(row => row.id === entry.vocabulary_id);
      return <li key={entry.id}>
        <span><strong>{word?.word_text || entry.word_text}</strong> <small>{LANG_NAME_KO[entry.language] || '언어 미상'}</small>{word?.meaning && <small>{word.meaning}</small>}</span>
        <button type="button" className="btn btn--ghost btn--sm" disabled={state.mutation.isPending}
          onClick={() => state.mutation.mutate({ exclusionId: entry.id, excluded: false })}>제외 해제</button>
      </li>;
    })}</ul>
  </details>;
}
