'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import LessonMatch from './LessonMatch';
import { toRomaji } from '../lib/kanaRomaji';

export default function LessonVocab({ items, lessonId, language = 'Japanese', ttsSupported, speak }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [savedSet, setSavedSet] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !items?.length) { setSavedSet(new Set()); return; }
    let cancel = false;
    (async () => {
      const words = items.map(v => v.ja);
      const { data } = await supabase
        .from('user_vocabulary')
        .select('word_text')
        .eq('user_id', user.id)
        .in('word_text', words);
      if (!cancel && data) setSavedSet(new Set(data.map(d => d.word_text)));
    })();
    return () => { cancel = true; };
  }, [user?.id, items]);

  function buildRow(v) {
    return {
      user_id: user.id,
      word_text: v.ja,
      base_form: v.ja,
      meaning: v.ko || '',
      pos: v.pos || '',
      language,
      source_material_id: lessonId != null ? Number(lessonId) : null,
    };
  }

  async function saveOne(v) {
    if (!user) return toast?.('로그인하면 저장할 수 있어요', 'info');
    if (savedSet.has(v.ja)) return;
    try {
      const { error } = await supabase
        .from('user_vocabulary')
        .upsert(buildRow(v), { onConflict: 'user_id,word_text' });
      if (error) throw error;
      setSavedSet(prev => new Set([...prev, v.ja]));
      toast?.(`⭐ "${v.ja}" 저장`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user.id] });
    } catch {
      toast?.('저장 실패', 'error');
    }
  }

  async function saveAll() {
    if (!user) return toast?.('로그인하면 저장할 수 있어요', 'info');
    const toSave = items.filter(v => !savedSet.has(v.ja));
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_vocabulary')
        .upsert(toSave.map(buildRow), { onConflict: 'user_id,word_text' });
      if (error) throw error;
      setSavedSet(new Set(items.map(v => v.ja)));
      toast?.(`⭐ ${toSave.length}개 단어 저장`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user.id] });
    } catch {
      toast?.('저장 실패', 'error');
    }
    setSaving(false);
  }

  const savedAll = items.length > 0 && savedSet.size === items.length;
  const [showMatch, setShowMatch] = useState(false);

  return (
    <div className="lesson-vocab">
      <div className="lesson-vocab__header">
        <span className="lesson-vocab__count">{items.length}개 단어</span>
        <div className="lesson-vocab__actions">
          {items.length >= 4 && (
            <button
              type="button"
              onClick={() => setShowMatch(s => !s)}
              className="btn btn--sm btn--ghost"
              aria-expanded={showMatch}
            >
              {showMatch ? '↑ 접기' : '🎮 단어 익히기'}
            </button>
          )}
          {user ? (
            <button
              type="button"
              onClick={saveAll}
              disabled={savedAll || saving}
              className={`btn btn--sm ${savedAll ? 'btn--ghost' : 'btn--primary'}`}
            >
              {saving ? '⏳' : savedAll ? '✓ 모두 저장됨' : '⭐ 모두 단어장에'}
            </button>
          ) : (
            <span className="lesson-vocab__hint">로그인하면 저장 가능</span>
          )}
        </div>
      </div>
      {showMatch && (
        <LessonMatch
          items={items}
          lessonId={lessonId}
          language={language}
          ttsSupported={ttsSupported}
          speak={speak}
        />
      )}
      <ul className="lesson-vocab__list">
        {items.map(v => {
          const saved = savedSet.has(v.ja);
          return (
            <li key={v.ja} className="lesson-vocab__item">
              <button
                type="button"
                className="lesson-vocab__ja"
                onClick={() => ttsSupported && speak(v.ja, language)}
                title="발음 듣기"
              >
                <span className="lesson-vocab__ja-text">{v.ja}</span>
                {(() => {
                  const r = v.romaji || toRomaji(v.ja);
                  return r ? <span className="lesson-vocab__romaji">{r}</span> : null;
                })()}
              </button>
              <span className="lesson-vocab__ko">{v.ko}</span>
              <button
                type="button"
                className="lesson-vocab__save"
                onClick={() => saveOne(v)}
                disabled={saved || !user}
                aria-label={saved ? '저장됨' : '단어장에 저장'}
                title={saved ? '저장됨' : user ? '단어장에 저장' : '로그인 필요'}
              >
                {saved ? '✓' : '⭐'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
