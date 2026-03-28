'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { LEVELS } from '../lib/constants';
import Button from './Button';

export default function OnboardingModal() {
  const { user, profile, fetchProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [languages, setLanguages] = useState(['Japanese']);
  const [levelJp, setLevelJp] = useState('N3 중급');
  const [levelEn, setLevelEn] = useState('B1 중급');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    if (!displayName.trim()) { setError('닉네임을 입력해주세요.'); return; }
    setSaving(true);
    setError('');

    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        learning_language: languages,
        learning_level_japanese: levelJp,
        learning_level_english: levelEn,
        onboarded: true,
      })
      .eq('id', user.id);

    if (err) {
      setError('저장 실패: ' + err.message);
      setSaving(false);
      return;
    }
    await fetchProfile(user.id, user.user_metadata);
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-modal__header">
          <div className="onboarding-modal__emoji">🧬</div>
          <h2 className="onboarding-modal__title">Anatomy Studio에 오신 걸 환영해요!</h2>
          <p className="onboarding-modal__sub">학습 시작 전에 몇 가지만 알려주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-modal__body">
          {/* 닉네임 */}
          <div className="form-field">
            <label className="form-label">닉네임</label>
            <input
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
            <label className="form-label">학습 언어 <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(복수 선택 가능)</span></label>
            <div className="toggle-group">
              <button
                type="button"
                onClick={() => toggleLanguage('Japanese')}
                className={`toggle-btn ${languages.includes('Japanese') ? 'toggle-btn--primary' : ''}`}
              >
                🇯🇵 Japanese
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage('English')}
                className={`toggle-btn ${languages.includes('English') ? 'toggle-btn--primary' : ''}`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* 일본어 레벨 */}
          {languages.includes('Japanese') && (
            <div className="form-field">
              <label className="form-label">🇯🇵 일본어 수준</label>
              <div className="level-group">
                {LEVELS.Japanese.map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelJp(lvl)}
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
              <label className="form-label">🇬🇧 영어 수준</label>
              <div className="level-group">
                {LEVELS.English.map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelEn(lvl)}
                    className={`level-btn ${levelEn === lvl ? 'level-btn--active' : ''}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}

          <Button type="submit" size="lg" disabled={saving} style={{ width: '100%', marginTop: '8px' }}>
            {saving ? '저장 중...' : '시작하기 🚀'}
          </Button>
        </form>
      </div>
    </div>
  );
}
