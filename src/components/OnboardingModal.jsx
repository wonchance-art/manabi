'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { LEVELS } from '../lib/constants';
import { syncAuthDisplayName } from '../lib/authDisplayName';
import Button from './Button';
import { failureMessage } from '../lib/errorMessage';

export default function OnboardingModal() {
  const { user, profile, fetchProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [languages, setLanguages] = useState(['Japanese']);
  // 기본 수준은 가장 낮은 단계(발매 점검 #2 — 오너 승인 2026-11-06 KST). 예전엔 N3 · B1 · H3 중급이 눌려 있어 처음 배우는 사람이
  // 그대로 시작하면 중급으로 남았다. 자가 진단에서 뺀 프랑스어 A0 · 중국어 OT 다음 단계부터.
  const [levelJp, setLevelJp] = useState(LEVELS.Japanese[0]);
  const [levelEn, setLevelEn] = useState(LEVELS.English[0]);
  const [levelFr, setLevelFr] = useState(LEVELS.French[1]);
  const [levelZh, setLevelZh] = useState(LEVELS.Chinese[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);

  // 접근성(발매 점검 #3, 2026-11-06 KST): 첫 화면을 덮는 필수 창이라 열리면 닉네임 칸으로 포커스를 옮기고,
  // Tab이 가려진 배경 링크로 새지 않게 창 안에서 돈다(WordSheets · ConfirmModal과 같은 방식). 닫기는 없다(온보딩 필수).
  useEffect(() => {
    modalRef.current?.querySelector('input')?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key !== 'Tab' || !modalRef.current) return;
      const nodes = [...modalRef.current.querySelectorAll('button:not(:disabled), [href], input, select, textarea')];
      const first = nodes[0], last = nodes.at(-1), inside = modalRef.current.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (!inside || document.activeElement === last)) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  function toggleLanguage(lang) {
    setLanguages(prev => {
      if (prev.includes(lang)) {
        if (prev.length === 1) return prev; // 최소 1개
        return prev.filter(l => l !== lang);
      }
      return [...prev, lang];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) { setError('닉네임을 입력해 주세요.'); return; }
    setSaving(true);
    setError('');

    // fr/zh 수준 컬럼은 마이그레이션(20260810120000_profile_levels_fr_zh.sql) 적용 후 생긴다.
    // 미적용 환경에서 미지 컬럼이 payload에 있으면 PostgREST가 요청 전체를 거부하므로,
    // 컬럼 오류일 때만 fr/zh를 빼고 재시도한다(writing_practice 폴백과 같은 패턴).
    const base = {
      display_name: displayName.trim(),
      learning_language: languages,
      learning_level_japanese: levelJp,
      learning_level_english: levelEn,
      onboarded: true,
    };
    let { error: err } = await supabase
      .from('profiles')
      .update({ ...base, learning_level_french: levelFr, learning_level_chinese: levelZh })
      .eq('id', user.id);
    if (err && /column|schema/i.test(err.message || '')) {
      ({ error: err } = await supabase.from('profiles').update(base).eq('id', user.id));
    }

    if (err) {
      setError(failureMessage('프로필을 저장하지 못했어요.', err));
      setSaving(false);
      return;
    }
    await syncAuthDisplayName(supabase, user, base.display_name);
    await fetchProfile(user.id, user.user_metadata);
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-sub">
        <div className="onboarding-modal__header">
          <h2 className="onboarding-modal__title" id="onboarding-title">처음 설정</h2>
          <p className="onboarding-modal__sub" id="onboarding-sub">학습 시작 전에 몇 가지만 알려 주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-modal__body">
          {/* 닉네임 */}
          <div className="form-field">
            <label className="form-label" htmlFor="onboarding-name">닉네임</label>
            <input
              id="onboarding-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="사용할 닉네임을 입력하세요"
              className="form-input"
              maxLength={20}
            />
          </div>

          {/* 학습 언어 — 복수 선택 */}
          <div className="form-field">
            <label className="form-label" id="onboarding-lang-label">학습 언어 <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(복수 선택 가능)</span></label>
            <div className="toggle-group" role="group" aria-labelledby="onboarding-lang-label">
              <button
                type="button"
                onClick={() => toggleLanguage('Japanese')}
                aria-pressed={languages.includes('Japanese')}
                className={`toggle-btn ${languages.includes('Japanese') ? 'toggle-btn--primary' : ''}`}
              >
                일본어
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage('English')}
                aria-pressed={languages.includes('English')}
                className={`toggle-btn ${languages.includes('English') ? 'toggle-btn--primary' : ''}`}
              >
                영어
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage('French')}
                aria-pressed={languages.includes('French')}
                className={`toggle-btn ${languages.includes('French') ? 'toggle-btn--primary' : ''}`}
              >
                프랑스어
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage('Chinese')}
                aria-pressed={languages.includes('Chinese')}
                className={`toggle-btn ${languages.includes('Chinese') ? 'toggle-btn--primary' : ''}`}
              >
                중국어
              </button>
            </div>
          </div>

          {/* 일본어 레벨 */}
          {languages.includes('Japanese') && (
            <div className="form-field">
              <label className="form-label" id="onboarding-level-jp">일본어 수준</label>
              <div className="level-group" role="group" aria-labelledby="onboarding-level-jp">
                {LEVELS.Japanese.map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelJp(lvl)}
                    aria-pressed={levelJp === lvl}
                    className={`level-btn ${levelJp === lvl ? 'level-btn--active' : ''}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 영어 레벨 */}
          {languages.includes('English') && (
            <div className="form-field">
              <label className="form-label" id="onboarding-level-en">영어 수준</label>
              <div className="level-group" role="group" aria-labelledby="onboarding-level-en">
                {LEVELS.English.map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelEn(lvl)}
                    aria-pressed={levelEn === lvl}
                    className={`level-btn ${levelEn === lvl ? 'level-btn--active' : ''}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 프랑스어 레벨 — A0(오리엔테이션)는 온보딩 자가 진단 대상에서 제외, A1부터 */}
          {languages.includes('French') && (
            <div className="form-field">
              <label className="form-label" id="onboarding-level-fr">프랑스어 수준</label>
              <div className="level-group" role="group" aria-labelledby="onboarding-level-fr">
                {LEVELS.French.slice(1).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFr(lvl)}
                    aria-pressed={levelFr === lvl}
                    className={`level-btn ${levelFr === lvl ? 'level-btn--active' : ''}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 중국어 레벨 — OT(오리엔테이션)는 온보딩 자가 진단 대상에서 제외, H1부터 */}
          {languages.includes('Chinese') && (
            <div className="form-field">
              <label className="form-label" id="onboarding-level-zh">중국어 수준</label>
              <div className="level-group" role="group" aria-labelledby="onboarding-level-zh">
                {LEVELS.Chinese.slice(1).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelZh(lvl)}
                    aria-pressed={levelZh === lvl}
                    className={`level-btn ${levelZh === lvl ? 'level-btn--active' : ''}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="onboarding-modal__hint">잘 모르겠으면 그대로 두세요. 오늘 학습에서 한 번 더 맞춰요.</p>

          {error && <p role="alert" style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{error}</p>}

          <Button type="submit" size="lg" disabled={saving} style={{ width: '100%', marginTop: '8px' }}>
            {saving ? '저장 중…' : '시작하기'}
          </Button>
        </form>
      </div>
    </div>
  );
}
