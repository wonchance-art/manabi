'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { syncAuthDisplayName } from '../lib/authDisplayName';
import { useViewerLanguage } from '../lib/useViewerLanguage';
import { VIEWER_LOCALE_OPTIONS, t } from '../lib/viewerMessages';
import {
  asksLevel, buildProfileUpdate, emptySelection, initialUiLocale, learnableLanguages, levelForAnswer,
  makePrimary, orderedLanguages, prefillDisplayName, regularLevels, selectionForLocale, toggleLanguage,
  answersComplete,
} from '../lib/onboardingPlan';
import Button from './Button';

// 카드 기호는 그 언어 문자, 색은 언어 트랙 토큰(국기 대신 — D-X6). 한국어는 전용 토큰이 없어 중립 잉크색.
const CARD = {
  Japanese: { glyph: 'あ', name: '일본어', native: '日本語', lang: 'ja', color: 'var(--track-japanese)' },
  English: { glyph: 'A', name: '영어', native: 'English', lang: 'en', color: 'var(--track-english)' },
  French: { glyph: 'É', name: '프랑스어', native: 'Français', lang: 'fr', color: 'var(--track-french)' },
  Chinese: { glyph: '中', name: '중국어', native: '中文', lang: 'zh', color: 'var(--track-chinese)' },
  Korean: { glyph: '한', name: '한국어', native: '한국어', lang: 'ko', color: 'var(--text-primary)', preparing: true },
};

// /study q1과 같은 문항 — 언어별로 첫 걸음만 구체화한다.
const FRESH_HINT = { Japanese: '히라가나부터 차근차근', Chinese: '병음·성조부터 차근차근' };

function cardName(language, locale) {
  return language === 'Korean' ? t(locale, '한국어') : CARD[language].name;
}

export default function OnboardingModal() {
  const { user, profile, fetchProfile } = useAuth();
  const viewerLanguage = useViewerLanguage();
  const [uiLocale, setUiLocale] = useState('ko');
  const [selection, setSelection] = useState(() => emptySelection('ko'));
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(() => prefillDisplayName(profile, user));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  const ids = useId();

  // 내 언어는 기기 언어로 미리 맞춘다(서버 렌더와 첫 화면은 한국어, 마운트 뒤 한 번).
  useEffect(() => {
    const locale = initialUiLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (locale !== 'ko') { setUiLocale(locale); setSelection(emptySelection(locale)); }
  }, []);

  // 단계가 바뀌면 제목으로 초점을 옮긴다(키보드 · 화면 읽기).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const L = key => t(uiLocale, key);
  const options = learnableLanguages(uiLocale);
  const languages = orderedLanguages(selection);
  const twoSteps = asksLevel(uiLocale);
  const namePlaceholder = profile?.display_name && !displayName ? profile.display_name : '';

  function changeLocale(locale) {
    setUiLocale(locale);
    setSelection(prev => selectionForLocale(prev, locale));
    setFailed(false);
  }

  function setAnswer(language, answer) {
    setAnswers(prev => ({ ...prev, [language]: answer }));
    setFailed(false);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const { base, optional } = buildProfileUpdate({ selection, answers, displayName, uiLocale });
    // fr/zh 수준 컬럼은 마이그레이션(20260810120000_profile_levels_fr_zh.sql) 적용 후 생긴다.
    // 미적용 환경에서 미지 컬럼이 payload에 있으면 PostgREST가 요청 전체를 거부하므로,
    // 컬럼 오류일 때만 fr/zh를 빼고 재시도한다(writing_practice 폴백과 같은 패턴).
    let err = null;
    try {
      ({ error: err } = await supabase.from('profiles').update({ ...base, ...optional }).eq('id', user.id));
      if (err && Object.keys(optional).length && /column|schema/i.test(err.message || '')) {
        ({ error: err } = await supabase.from('profiles').update(base).eq('id', user.id));
      }
    } catch (thrown) { err = thrown; }
    if (err) {
      // 원문 오류는 콘솔에만 — 화면에는 정해진 문구와 고른 답을 그대로 둔다.
      console.error('[onboarding] profile save failed', err);
      setFailed(true);
      setSaving(false);
      return;
    }
    // 내 언어 = 기기별 viewer_language:v1(D-L2). 화면 · 해설 언어를 같은 값으로 시작한다.
    viewerLanguage.setUiLocale(uiLocale);
    viewerLanguage.setExplanationLocale(uiLocale);
    if (base.display_name) await syncAuthDisplayName(supabase, user, base.display_name);
    await fetchProfile(user.id, user.user_metadata);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (step === 1) {
      if (!languages.length) return;
      if (twoSteps) { setStep(2); return; }
      save();
      return;
    }
    if (answersComplete(languages, answers)) save();
  }

  const finalLabel = saving ? L('저장 중…') : L('시작하기');
  const summary = languages.length === 0
    ? L('배울 언어를 하나 이상 골라 주세요.')
    : twoSteps
      ? t(uiLocale, '{count}개 선택 · 주 언어 {name}', { count: languages.length, name: cardName(selection.primary, uiLocale) })
      : t(uiLocale, '선택: {name}', { name: languages.map(l => cardName(l, uiLocale)).join(', ') });

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`}
        lang={uiLocale === 'ko' ? 'ko' : uiLocale}>
        <div className="onboarding-modal__header">
          <span className="onboarding-modal__brand"><i aria-hidden="true" />manabi</span>
          {twoSteps && <span className="onboarding-modal__step">{step} / 2</span>}
        </div>

        <form onSubmit={handleSubmit} className="onboarding-modal__body" noValidate>
          {step === 1 ? (
            <>
              <div>
                <h2 id={`${ids}-title`} ref={headingRef} tabIndex={-1} className="onboarding-modal__title">{L('manabi에 오신 걸 환영해요')}</h2>
                <p className="onboarding-modal__sub">{L('배울 언어를 골라 주세요. 여러 개 골라도 되고, 나중에 내 정보에서 바꿀 수 있어요.')}</p>
              </div>

              <fieldset className="onb-field onb-locale">
                <legend className="onb-label">{L('내 언어')}</legend>
                <div className="onb-segment">
                  {VIEWER_LOCALE_OPTIONS.map(([locale, label]) => (
                    <label key={locale} className="onb-segment__item" lang={locale}>
                      <input type="radio" name={`${ids}-locale`} value={locale} checked={uiLocale === locale}
                        onChange={() => changeLocale(locale)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="onb-field">
                <legend className="onb-label">{L('배울 언어')}</legend>
                <div className="onb-cards">
                  {options.map(language => {
                    const card = CARD[language];
                    const checked = selection.picked.includes(language);
                    const primary = selection.primary === language;
                    return (
                      <div key={language} className={`onb-card${checked ? ' onb-card--checked' : ''}`}>
                        <label className="onb-card__main">
                          <input type="checkbox" checked={checked} onChange={() => setSelection(prev => toggleLanguage(prev, language))} />
                          <span className="onb-card__glyph" style={{ color: card.color }} lang={card.lang} aria-hidden="true">{card.glyph}</span>
                          <span className="onb-card__text">
                            <strong>{cardName(language, uiLocale)}</strong>
                            <small lang={card.lang}>{card.native}</small>
                          </span>
                          {card.preparing && <span className="onb-badge">{L('준비 중')}</span>}
                        </label>
                        {twoSteps && checked && (primary
                          ? <span className="onb-card__primary">{L('주 언어')}</span>
                          : <button type="button" className="onb-card__make-primary"
                              aria-label={t(uiLocale, '{name}를 주 언어로', { name: cardName(language, uiLocale) })}
                              onClick={() => setSelection(prev => makePrimary(prev, language))}>{L('주 언어로')}</button>)}
                      </div>
                    );
                  })}
                </div>
                {twoSteps
                  ? <p className="onb-note">{L('주 언어는 배움·복습·오늘의 학습이 먼저 여는 언어예요. 다른 언어는 언제든 바꿔 볼 수 있어요.')}</p>
                  : <p className="onb-note">{L('한국어 과정은 아직 준비 중이에요. 지금은 읽기 화면에서 한국어 글을 먼저 읽을 수 있고, 화면과 해설은 내 언어로 볼 수 있어요.')}</p>}
              </fieldset>

              <div className="onb-field">
                <label className="onb-label" htmlFor={`${ids}-name`}>{L('닉네임')}</label>
                <input id={`${ids}-name`} type="text" className="form-input" value={displayName} maxLength={20}
                  placeholder={namePlaceholder} aria-describedby={`${ids}-name-hint`}
                  onChange={e => setDisplayName(e.target.value)} />
                <p id={`${ids}-name-hint`} className="onb-note">
                  {displayName ? L('가입할 때 쓴 이름이에요. 그대로 둬도 돼요.') : L('비워 둬도 돼요. 나중에 바꿀 수 있어요.')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 id={`${ids}-title`} ref={headingRef} tabIndex={-1} className="onboarding-modal__title">어디서부터 시작할까요?</h2>
                <p className="onboarding-modal__sub">딱 맞는 곳에서 시작하도록 언어마다 하나만 골라 주세요. 학습하면서 언제든 바뀌어요.</p>
              </div>
              {languages.map(language => (
                <LevelQuestion key={language} language={language} primary={language === selection.primary}
                  answer={answers[language] || null} onAnswer={answer => setAnswer(language, answer)} groupId={`${ids}-${language}`} />
              ))}
            </>
          )}

          {failed && (
            <div className="onb-error" role="alert">
              <strong>{L('저장하지 못했어요.')}</strong>
              <span>{L('연결을 확인하고 「시작하기」를 다시 눌러 주세요. 고른 답은 그대로 있어요.')}</span>
            </div>
          )}

          <div className="onb-footer">
            {step === 1 ? (
              <>
                <p className="onb-summary" role="status">{summary}</p>
                <Button type="submit" size="lg" disabled={!languages.length || saving}>
                  {twoSteps ? L('다음') : finalLabel}
                </Button>
              </>
            ) : (
              <>
                <button type="button" className="onb-back" onClick={() => setStep(1)} disabled={saving}>← 이전</button>
                <Button type="submit" size="lg" disabled={!answersComplete(languages, answers) || saving}>{finalLabel}</Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function LevelQuestion({ language, primary, answer, onAnswer, groupId }) {
  const card = CARD[language];
  const regular = regularLevels(language);
  const choices = [
    { kind: 'fresh', title: '처음이에요', hint: FRESH_HINT[language] || '완전 처음부터 차근차근' },
    { kind: 'basics', title: '기초는 알아요', hint: '인사·기본 문형은 익숙해요' },
    { kind: 'learned', title: '배운 적 있어요', hint: '시작할 급수를 골라 주세요' },
  ];
  return (
    <fieldset className="onb-field onb-level">
      <legend className="onb-level__head">
        <span className="onb-card__glyph" style={{ color: card.color }} lang={card.lang} aria-hidden="true">{card.glyph}</span>
        <strong>{card.name}</strong>
        {primary && <span className="onb-card__primary">주 언어</span>}
      </legend>
      <div className="onb-choices">
        {choices.map(choice => {
          const preview = choice.kind === 'learned' ? null : levelForAnswer(language, { kind: choice.kind });
          return (
            <label key={choice.kind} className={`onb-choice${answer?.kind === choice.kind ? ' onb-choice--checked' : ''}`}>
              <input type="radio" name={groupId} checked={answer?.kind === choice.kind}
                onChange={() => onAnswer(choice.kind === 'learned' ? { kind: 'learned', level: answer?.kind === 'learned' ? answer.level : null } : { kind: choice.kind })} />
              <span className="onb-choice__text"><strong>{choice.title}</strong><small>{choice.hint}</small></span>
              {preview && <span className="onb-choice__level">{preview}부터</span>}
            </label>
          );
        })}
      </div>
      {answer?.kind === 'learned' && (
        <div className="onb-chips" role="radiogroup" aria-label={`${card.name} 시작 급수`}>
          {regular.map(level => (
            <label key={level} className={`onb-chip${answer.level === level ? ' onb-chip--checked' : ''}`}>
              <input type="radio" name={`${groupId}-level`} checked={answer.level === level}
                onChange={() => onAnswer({ kind: 'learned', level })} />
              <span>{level}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
