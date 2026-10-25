/**
 * 내 정보(`/profile`) 줄 값 — 순수 계산 (PROFILE-REDESIGN-001, 오너 승인 시안 A 2026-10-25 KST).
 *
 * 한 화면에 묶음 카드와 「라벨 — 지금 값 ›」 줄을 둔다. 줄마다 지금 값을 보여 줘야 열어 보지 않아도 안다(설계 P9).
 * 화면이 문구를 다시 짓지 않게 표시 재료만 여기서 만든다. 계산 정본은 그대로 쓴다:
 * 학습 언어 = learnDashboard.learnLanguages(첫 번째가 기본 언어) · 수준 = constants.profileLevel,
 * D 표기 = learnDashboard.dDayLabel(진행바 칸과 같은 표기), 날짜 = growthStats(KST).
 */
import { LANG_NAME_KO, LEVELS, profileLevel } from './constants.js';
import { dDayLabel, learnLanguages, shortDateLabel } from './learnDashboard.js';
import { kstDateString } from './growthStats.js';

/** 학습 언어 시트에 늘어놓는 순서(온보딩과 같은 네 트랙). */
export const PROFILE_LANGS = Object.freeze(['Japanese', 'English', 'French', 'Chinese']);

/** 고를 수 있는 수준 — 프랑스어 A0 · 중국어 OT(입문 과정)는 수준 선택에서 뺀다(예전 화면 · 온보딩과 같다). */
export function levelOptions(lang) {
  const all = LEVELS[lang] || [];
  return lang === 'French' || lang === 'Chinese' ? all.slice(1) : all;
}

/** 저장된 수준이 없을 때 시트가 미리 골라 두는 값(예전 화면의 기본값 그대로). */
export const DEFAULT_LEVEL = Object.freeze({ Japanese: 'N3 중급', English: 'B1 중급', French: 'B1 중급', Chinese: 'H3 중급' });

/** 「N3 중급」 → 「N3」 */
export const levelShort = level => (typeof level === 'string' && level.trim() ? level.trim().split(/\s+/)[0] : '');

/**
 * 학습 언어 줄 — 저장 순서대로(첫 번째 = 기본 언어). [{ lang, name, level, short, primary }]
 * 학습 언어가 비어 있으면 일본어(learnLanguages 규칙 — 배움 칩과 같은 답).
 */
export function languageEntries(profile) {
  return learnLanguages(profile).map((lang, i) => {
    const level = profileLevel(profile, lang);
    return { lang, name: LANG_NAME_KO[lang] || lang, level, short: levelShort(level), primary: i === 0 };
  });
}

/** 학습 언어 줄의 접근 가능한 이름 — 「학습 언어, 일본어 N3 기본, 중국어 H3」 */
export function languageAria(entries) {
  const parts = entries.map(e => [e.name, e.short, e.primary && entries.length > 1 ? '기본' : ''].filter(Boolean).join(' '));
  return ['학습 언어', ...parts].join(', ');
}

/** 시트에 늘어놓는 순서 — 지금 배우는 언어(저장 순서)를 먼저, 나머지는 네 트랙 순서. 시트를 여는 순간 한 번 정한다. */
export function sheetLanguageOrder(selected) {
  const chosen = (selected || []).filter(lang => PROFILE_LANGS.includes(lang));
  return [...new Set([...chosen, ...PROFILE_LANGS])];
}

/** 언어 켜고 끄기 — 하나는 남긴다. 새로 켠 언어는 맨 뒤(기본 언어는 그대로). */
export function toggleLanguage(selected, lang) {
  if (selected.includes(lang)) return selected.length > 1 ? selected.filter(l => l !== lang) : selected;
  return [...selected, lang];
}

/** 「기본으로」 — 그 언어를 맨 앞으로(learning_language 배열 순서가 곧 기본 언어 규칙이다. 새 필드는 없다). */
export const makePrimary = (selected, lang) => (selected.includes(lang) ? [lang, ...selected.filter(l => l !== lang)] : selected);

/** 하루 목표 기본값(예전 화면 · 배움 오늘 목표 산식과 같은 5). */
export const dailyGoals = profile => ({ review: profile?.goal_review ?? 5, words: profile?.goal_words ?? 5 });

/** 하루 목표 한 줄 — 「하루 복습 20 · 담기 10」. 「새 단어」는 단어장의 「하루 새 단어 한도」와 헷갈려(설계 P4) 「담기」라 부른다. */
export function dailyGoalLine(profile) {
  const { review, words } = dailyGoals(profile);
  return `하루 복습 ${review} · 담기 ${words}`;
}

/**
 * 목표 줄 — { head, daily }. head = 날짜 목표(「JLPT N3 · D-42」), 날짜 목표가 없으면 null.
 * 이름을 적지 않았으면 날짜(「12/6」)로 부른다.
 */
export function goalSummary(profile, now = Date.now()) {
  const date = profile?.dday_date;
  const d = date ? dDayLabel(date, now) : null;
  const name = (profile?.dday_label || '').trim() || shortDateLabel(date, { weekday: false });
  return { head: d ? [name, d].filter(Boolean).join(' · ') : null, daily: dailyGoalLine(profile) };
}

/** 알림 줄 — 푸시가 켜져 있으면 먼저 말하고, 이 브라우저의 시각 알림을 덧붙인다. */
export function reminderSummary({ pushOn = false, hour = '' } = {}) {
  const at = hour !== '' && hour != null ? `매일 ${hour}시` : '';
  if (pushOn) return at ? `푸시 · ${at}` : '푸시 켜짐';
  return at || '꺼짐';
}

/** 함께한 날 — 「3월 2일부터 함께하고 있어요」(KST). 올해가 아니면 연도를 붙인다. 날짜를 모르면 null. */
export function joinedLine(createdAt, now = Date.now()) {
  const at = Date.parse(createdAt || '');
  if (!Number.isFinite(at)) return null;
  const [y, m, d] = kstDateString(at).split('-').map(Number);
  const thisYear = Number(kstDateString(now).slice(0, 4));
  return `${y !== thisYear ? `${y}년 ` : ''}${m}월 ${d}일부터 함께하고 있어요`;
}

const PROVIDER_NAME = Object.freeze({ email: '이메일', google: 'Google', apple: 'Apple', github: 'GitHub', kakao: '카카오' });

/** 로그인 방법 — 「이메일」 · 「Google」 · 「Google · 이메일」. identities가 없으면 app_metadata로. */
export function signInMethods(user) {
  const ids = Array.isArray(user?.identities) && user.identities.length ? user.identities.map(i => i?.provider) : null;
  const raw = ids || (Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [user?.app_metadata?.provider]);
  const names = [...new Set(raw.filter(Boolean))].map(p => PROVIDER_NAME[p] || p);
  return names.length ? names.join(' · ') : '이메일';
}

/** 기록 칸 숫자 — 0 · 모름은 「–」(현황 칸의 0 무표기 선례), 그 밖은 천 단위 쉼표 + 단위. */
export const countValue = (n, unit = '') => (Number.isFinite(n) && n > 0 ? `${n.toLocaleString('ko-KR')}${unit}` : '–');

/** 단어 복습 줄 — 이 기기의 세션 길이(단어장 복습 설정). null = 전부. */
export const sessionLengthLabel = length => (length == null ? '한 번에 전부' : `한 번에 ${length}개`);
