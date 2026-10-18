'use client';
import { scopedVocabularyExclusions } from '../lib/vocabularyExclusion';
import { KNOWN_LANGUAGES, knownWordKeys, scopedKnownWords } from '../lib/knownWordControl';
import { LANG_NAME_KO } from '../lib/constants';
import { useVocabularyExclusions } from '../lib/useVocabularyExclusions';
import { useKnownWords } from '../lib/useKnownWords';
import { useLearningCapabilities } from '../lib/useLearningCapabilities';
// capabilities: 부모(복습방)가 이미 읽은 한국어 학습 능력(useLearningCapabilities('Korean')). 넘겨받으면 다시 읽지 않는다
// (VOCAB-FLOW-001 D) — 이 목록이 마운트될 때마다 staleTime 0 쿼리가 능력 읽기를 한 번 더 보냈고(진입 · 목록 전환마다),
// 그동안 부모의 한국어 능력이 「확인 중」으로 깜빡였다. staleTime 0 계약(능력은 늘 서버에서 새로)은 그대로 — 부모의 한 읽기를 같이 쓴다.
// 넘겨받지 않으면 예전처럼 스스로 읽는다(언어 null = 쿼리 꺼짐).
export default function VocabularyExclusionList({ vocab = [], scopeIds = null, capabilities = null }) {
  const state = useVocabularyExclusions(), known = useKnownWords();
  const own = useLearningCapabilities(capabilities ? null : 'Korean');
  const korean = capabilities || own;
  const items = scopedVocabularyExclusions(state.rows, vocab, scopeIds);
  const marks = scopedKnownWords(known.rows, state.rows, vocab, scopeIds).filter(row => KNOWN_LANGUAGES[row.lang]);
  const legacy = items.filter(entry => !known.rows.some(row => KNOWN_LANGUAGES[row.lang] === entry.language
    && knownWordKeys([row], row.lang, { text: entry.word_text }, state.rows).length));
  if (state.isError || known.isError) return <p role="alert">상태를 확인하지 못했어요. <button type="button" className="btn btn--ghost btn--sm" onClick={() => { state.refetch(); known.refetch(); }}>다시 시도</button></p>;
  return <>
    {!!marks.length && <details className="vocabulary-exclusions vocabulary-known-words">
      <summary>아는 단어 <span>{marks.length}</span></summary>
      <ul>{marks.map(row => <li key={`${row.lang}:${row.word_text}`}>
        <span><strong>{row.word_text}</strong> <small>{row.lang === 'ko' ? '한국어' : LANG_NAME_KO[KNOWN_LANGUAGES[row.lang]]}</small></span>
        <button type="button" className="btn btn--ghost btn--sm" disabled={known.mutation.isPending || !state.isSuccess || (row.lang === 'ko' && !korean.known)}
          onClick={() => known.mutation.mutate({ lang: row.lang, wordText: row.word_text, known: false, removeKeys: [row.word_text] })}>표시 해제</button>
      </li>)}</ul>
    </details>}
    {!!legacy.length && <details className="vocabulary-exclusions vocabulary-legacy-exclusions">
      <summary>이전 복습 제외 <span>{legacy.length}</span></summary>
      <ul>{legacy.map(entry => {
        const word = vocab.find(row => row.id === entry.vocabulary_id);
        return <li key={entry.id}>
          <span><strong>{word?.word_text || entry.word_text}</strong> <small>{entry.language === 'Korean' ? '한국어' : LANG_NAME_KO[entry.language] || '언어 미상'}</small>{word?.meaning && <small>{word.meaning}</small>}</span>
          <button type="button" className="btn btn--ghost btn--sm" disabled={state.mutation.isPending || !known.isSuccess || (entry.language === 'Korean' && !korean.exclude)}
            onClick={() => state.mutation.mutate({ exclusionId: entry.id, excluded: false })}>제외 해제</button>
        </li>;
      })}</ul>
    </details>}
  </>;
}
