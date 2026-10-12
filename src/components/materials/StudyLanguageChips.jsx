'use client';

import { useRef } from 'react';
import { studyLanguageLabel } from '@/lib/materialComposer';

const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// 「공부할 언어」 칩 줄 — 라디오 그룹(이름·화살표 이동·44px). 아무것도 고르지 않은 상태가 「나중에 정하기」이고,
// 고른 칩을 다시 누르면 선택을 푼다. 짐작으로 고른 값에는 「글자를 보고 골랐어요」를 작게 붙인다.
export default function StudyLanguageChips({ id, label = '공부할 언어', languages, value, onChange, guessed = false, disabled = false }) {
  const chips = useRef([]);
  const focusable = Math.max(0, languages.indexOf(value));
  function key(event, index) {
    let next = null;
    if (STEP[event.key]) next = (index + STEP[event.key] + languages.length) % languages.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = languages.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(languages[next]);
    chips.current[next]?.focus();
  }
  return <div className="study-language">
    <span id={`${id}-label`} className="study-language__label">{label}</span>
    <div className="study-language__chips" role="radiogroup" aria-labelledby={`${id}-label`}>
      {languages.map((language, index) => {
        const checked = value === language;
        return <button key={language} ref={element => { chips.current[index] = element; }} type="button" role="radio"
          aria-checked={checked} tabIndex={index === focusable ? 0 : -1} disabled={disabled} className="study-language__chip"
          onClick={() => onChange(checked ? '' : language)} onKeyDown={event => key(event, index)}>{studyLanguageLabel(language)}</button>;
      })}
    </div>
    {guessed && !!value && <small className="study-language__hint">글자를 보고 골랐어요</small>}
  </div>;
}
