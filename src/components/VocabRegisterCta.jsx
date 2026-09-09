'use client';

import { useState } from 'react';
import { registerLessonCards } from '../lib/learn/sandwichCards';
import { useAuth } from '../lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { saveContext } from './learning/SaveContextButton';

/** ⑤ 산출 단계 — 레슨 어휘를 단어장(카드)에 담는 명시적 버튼 */
export default function VocabRegisterCta({ lang, slug, vocabs, sectionIndex }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(null);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState('');
  const count = (vocabs ?? []).length;
  if (count === 0) return null;

  const onClick = async () => {
    if (pending) return;
    if (!user) { setDone(registerLessonCards(lang, slug, vocabs, {})); return; }
    setPending(true); setError('');
    const results = await Promise.allSettled(vocabs.map((vocab,vocabIndex)=>saveContext({
      word:{word_text:vocab.word,meaning:vocab.meanings.join(', '),language:lang},
      source:{kind:'textbook',chapterSlug:slug,sectionIndex,vocabIndex},
    })));
    const failed=results.filter(result=>result.status==='rejected');
    if(failed.length) setError(`${results.length-failed.length}개 저장, ${failed.length}개 확인 필요. 위 단어별 저장 버튼에서 뜻이나 연결 상태를 확인해 주세요.`);
    else setDone({added:results.filter(result=>result.value.created).length});
    for(const key of ['vocab','vocab-words']) queryClient.invalidateQueries({queryKey:[key,user.id]});
    setPending(false);
  };

  return (
    <div style={{ margin: '4px 0 16px' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={Boolean(done)||pending}
        className="btn btn--sm"
        style={{ fontWeight: 600 }}
      >
        {pending?'저장 중…':done
          ? `단어장에 담김 ✓${done.added > 0 ? ` (새 단어 ${done.added}개)` : ' (이미 전부 있음)'}`
          : `이 레슨 단어 ${count}개 단어장에 담기`}
      </button>
      {error&&<p role="alert" style={{fontSize:'.85rem',marginTop:8}}>{error}</p>}
    </div>
  );
}
