'use client';

import { useEffect, useRef, useState } from 'react';
import { useTTS } from '../lib/useTTS';

/**
 * 음성 선택기 — 드롭다운 형태.
 *  - 시스템에 깔린 일본어/영어 음성 목록을 보여주고 선택
 *  - 미리듣기 가능 (샘플 텍스트 재생)
 *  - 선택은 localStorage에 영속 (전 사이트 useTTS 공유)
 */
const SAMPLES = {
  Japanese: 'こんにちは。 これは サンプルです。',
  English: 'Hello, this is a sample.',
};

function describeVoice(v) {
  const tags = [];
  if (v.localService === false) tags.push('클라우드');
  if (/google/i.test(v.name)) tags.push('Google');
  if (/microsoft/i.test(v.name)) tags.push('MS');
  if (/apple|samantha|kyoko|otoya/i.test(v.name)) tags.push('Apple');
  return tags.length > 0 ? ` · ${tags.join(' · ')}` : '';
}

export default function TtsVoicePicker({ language = 'Japanese', compact = false }) {
  const { listVoices, getSelectedVoice, setSelectedVoice, speak, supported, voicesReady } = useTTS();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => getSelectedVoice(language));
  const popoverRef = useRef(null);

  const voices = listVoices(language);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (!popoverRef.current?.contains(e.target)) setOpen(false);
    }
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDoc);
    };
  }, [open]);

  function pick(voiceURI) {
    setSelected(voiceURI);
    setSelectedVoice(language, voiceURI);
  }

  function preview(voiceURI, e) {
    e.stopPropagation();
    setSelectedVoice(language, voiceURI);
    setSelected(voiceURI);
    speak(SAMPLES[language] || SAMPLES.Japanese, language);
  }

  if (!supported || !voicesReady || voices.length === 0) return null;

  const currentVoice = voices.find(v => v.voiceURI === selected) || voices[0];

  return (
    <div className="tts-voice" ref={popoverRef}>
      <button
        type="button"
        className="tts-voice__btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-expanded={open}
        title="발음 음성 선택"
      >
        <span className="tts-voice__name">{currentVoice.name.split(/[(\[]/)[0].trim()}</span>
        <span className="tts-voice__chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="tts-voice__popover" role="listbox" aria-label="음성 목록">
          <div className="tts-voice__head">
            <span>{voices.length}개 음성 사용 가능</span>
            <button
              type="button"
              className="tts-voice__sample"
              onClick={() => speak(SAMPLES[language] || SAMPLES.Japanese, language)}
            >▶ 미리듣기</button>
          </div>
          <ul className="tts-voice__list">
            {voices.map(v => {
              const isSel = v.voiceURI === selected || (!selected && v === voices[0]);
              return (
                <li key={v.voiceURI}>
                  <button
                    type="button"
                    onClick={() => pick(v.voiceURI)}
                    className={`tts-voice__option ${isSel ? 'is-selected' : ''}`}
                    role="option"
                    aria-selected={isSel}
                  >
                    <span className="tts-voice__option-name">
                      {v.name}
                      <span className="tts-voice__option-meta">{describeVoice(v)} · {v.lang}</span>
                    </span>
                    <button
                      type="button"
                      className="tts-voice__play"
                      onClick={(e) => preview(v.voiceURI, e)}
                      aria-label={`${v.name} 미리듣기`}
                      title="이 음성으로 미리듣기"
                    >▷</button>
                  </button>
                </li>
              );
            })}
          </ul>
          {voices.every(v => v.localService) && (
            <div className="tts-voice__hint">
              더 자연스러운 음성이 필요하면 Chrome 또는 Edge로 접속하면 Google·Microsoft 클라우드 음성이 추가됩니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
