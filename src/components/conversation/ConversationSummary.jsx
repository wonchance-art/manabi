'use client';
// 대화 마치기 요약(v2-Z Z-R3, 시안 conv.html 「대화 마치기」) — 점수 없이 한 장으로:
// 써 본 말 ✓ · 스스로 고친 문장 · 다시 써서 맞힌 문형 · 다음에 볼 것 · 담은 말.
// 표시만 한다 — review_events·FSRS에 쓰지 않는다(v2 헌법 M7). 담은 말은 평소 저장 길로 이미 복습에 들어가 있다.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { conversationSummary } from '../../lib/conversation/conversationLoop';
import { conversationSavedWords } from '../../lib/conversation/conversationClient';
import { bcp47ForLanguage } from '../../lib/speechLang';

export default function ConversationSummary({ materialId, conversation, language, outputWords = [], onClose }) {
  const [saved, setSaved] = useState(null);
  useEffect(() => {
    let alive = true;
    conversationSavedWords(materialId).then((words) => { if (alive) setSaved(words); }, () => { if (alive) setSaved([]); });
    return () => { alive = false; };
  }, [materialId]);
  const s = conversationSummary(conversation, { outputWords: outputWords.map((w) => w.word_text), savedWords: saved || [] });
  const lang = bcp47ForLanguage(language);
  const head = ['대화를 마쳤어요', conversation.topic, `${s.myTurns}번 말함`, s.minutes ? `${s.minutes}분` : null].filter(Boolean).join(' · ');

  return (
    <section className="conv-summary" aria-labelledby="conv-summary-title">
      <h2 id="conv-summary-title">{head}</h2>
      {s.outputWords.length > 0 && (
        <div className="conv-summary__block">
          <h3>오늘 써 본 말 <span>{s.used.length} / {s.outputWords.length}</span></h3>
          <p lang={lang}>{s.outputWords.map((w) => (s.used.includes(w) ? `${w} ✓` : w)).join(' · ')}</p>
        </div>
      )}
      {(s.fixed.length > 0 || s.reaskOk.length > 0) && (
        <div className="conv-summary__block">
          <h3>고쳐 말한 문장</h3>
          {s.fixed.map((c, i) => (
            <p key={`f${i}`} className="conv-summary__pair" lang={lang}><s>{c.text}</s><br />{c.to}</p>
          ))}
          {s.fixed.length > 0 && <p className="conv-summary__note">스스로 고쳤어요 · 다음 대화에서 한 번 더 써 보게 물어볼게요</p>}
          {s.reaskOk.map((r, i) => (
            <p key={`r${i}`} className="conv-summary__note"><span lang={lang}>{r.to}</span> — 다시 써서 맞혔어요</p>
          ))}
        </div>
      )}
      {s.later.length > 0 && (
        <div className="conv-summary__block">
          <h3>다음에 볼 것 <span>{s.later.length}</span></h3>
          {s.later.map((c, i) => (
            <p key={i}><span lang={lang}>{c.to}</span>{c.state === 'later' ? ' — 대화를 위해 이번엔 넘어갔어요. 다음 대화에서 짚어 볼게요.' : ''}</p>
          ))}
        </div>
      )}
      <div className="conv-summary__block">
        <h3>담은 말 <span>{saved == null ? '…' : saved.length}</span></h3>
        {saved?.length > 0 ? <p><span lang={lang}>{saved.join(' · ')}</span> — 복습에 나와요</p> : saved && <p>이번 대화에서 담은 말은 없어요.</p>}
      </div>
      <div className="conv-summary__actions">
        <button type="button" className="conv-chip" onClick={onClose}>대화 이어 하기</button>
        <Link className="conv-chip conv-chip--link" href="/vocab">단어 복습</Link>
      </div>
    </section>
  );
}
