// 학습 언어 칩 목록(learnLanguages · LEARN_LANGS) — 정본 이름 사전(LANG_NAME_KO) 하나만 쓴다. learnDashboard가 그대로 다시 내보낸다(부르는 곳은 그대로).
// 학습 출처 · 복습 범위 언어(learningLanguages.js — 한국어 포함 5개)와는 다른 목록이다(이쪽은 배움 화면 언어 칩 — LANG_NAME_KO 키).
// 따로 둔 까닭(FIRSTLOAD-AUTH-001, 2026-11-01 KST): 간체 글꼴 힌트(scFontHint)가 이 둘만 쓰는데 learnDashboard를 통째로 부르면
// AuthContext → scFontHint → learnDashboard → growthStats · goalPace · learningActivity → fsrsScheduler → ts-fsrs가 루트 레이아웃
// 첫 JS(모든 화면)에 실렸다. 계약 authFirstLoad.test.js.
import { LANG_NAME_KO } from './constants.js';

export const LEARN_LANGS = Object.freeze(Object.keys(LANG_NAME_KO));

/**
 * 학습 언어 칩 목록 — 프로필 학습 언어(배열 · 문자열) 중 이름이 있는 언어. 학습 언어가 비어 있으면 담은 표현이 많은
 * 언어 순(복습방 기본 언어 규칙 — REV-SCOPE-R1A §9-4와 같은 결), 그것도 없으면 일본어.
 */
export function learnLanguages(profile, vocabCounts = null) {
  const raw = profile?.learning_language;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(lang => LEARN_LANGS.includes(lang));
  if (list.length) return [...new Set(list)];
  const saved = Object.entries(vocabCounts || {}).filter(([lang, n]) => LEARN_LANGS.includes(lang) && n > 0)
    .sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
  return saved.length ? saved : ['Japanese'];
}
