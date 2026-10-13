// 배움 국기 칩 언어(REV-SCOPE D1 · AK). 배움 화면과 복습방이 같은 「지금 언어」를 쓴다.
// 이 기기에서 마지막으로 고른 칩 → 프로필의 첫 학습 언어 → 일본어 순. 저장은 기기별 편의라
// 실패해도 화면은 프로필 값으로 그대로 돈다.
import { REVIEW_SCOPE_LANGS } from './reviewScope';

const KEY = 'manabi_learning_lang';

export function profileLearningLangs(profile) {
  const raw = Array.isArray(profile?.learning_language) ? profile.learning_language : [profile?.learning_language];
  return raw.filter(lang => REVIEW_SCOPE_LANGS.includes(lang));
}

/** SSR · hydration 첫 렌더에서는 부르지 않는다(마운트 뒤 effect에서). */
export function readStoredLearningLang() {
  try {
    const value = localStorage.getItem(KEY);
    return REVIEW_SCOPE_LANGS.includes(value) ? value : null;
  } catch { return null; }
}

export function saveLearningLang(lang) {
  if (!REVIEW_SCOPE_LANGS.includes(lang)) return;
  try { localStorage.setItem(KEY, lang); } catch { /* 저장소 차단 — 이번 화면만 그 언어 */ }
}

export function currentLearningLang(profile, stored = null) {
  return REVIEW_SCOPE_LANGS.includes(stored) ? stored : profileLearningLangs(profile)[0] || 'Japanese';
}
