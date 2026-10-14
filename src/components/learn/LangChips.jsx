'use client';
import { learnLangLabel } from '@/lib/learnDashboard';

/** 언어 칩 — 글자(「일본어」 · 「중국어」)로 쓴다. 국기는 쓰지 않는다(D-X6). 글자가 곧 이름이라 aria-label을 따로 달지 않는다. */
export default function LangChips({ langs, lang, onChange }) {
  if (!langs?.length) return null;
  if (langs.length === 1) {
    return <span className="learn-chips"><span className="learn-chip is-on"><span>{learnLangLabel(langs[0])}</span></span></span>;
  }
  return (
    <span className="learn-chips" role="group" aria-label="학습 언어">
      {langs.map(item => (
        <button key={item} type="button" className={`learn-chip${item === lang ? ' is-on' : ''}`} aria-pressed={item === lang}
          onClick={() => onChange(item)}>
          <span>{learnLangLabel(item)}</span>
        </button>
      ))}
    </span>
  );
}
