// ONB-001 첫 방문 온보딩 — 선택 · 저장 규칙과 「준비 중 언어」 가드의 계약.
// 수용 기준(#1337 ONB-001 §6) 번호를 각 it 이름에 단다.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  answersComplete, buildProfileUpdate, emptySelection, initialUiLocale, learnableLanguages, levelForAnswer,
  makePrimary, orderedLanguages, prefillDisplayName, profileLevelForStudyKey, regularLevels, selectionForLocale,
  studyKeyForProfileLevel, toggleLanguage,
} from '../onboardingPlan';
import { isPreparingLearningLanguage, primaryLearningLanguage } from '../viewerLanguage';
import { LANG_NAME_KO, LEVELS, PROFILE_LEVEL_COLUMN } from '../constants';
import { t } from '../viewerMessages';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', user_metadata: {} }, profile: { display_name: '새로운 학습자', onboarded: false }, fetchProfile: () => {} }),
}));
vi.mock('../supabase', () => ({ supabase: {} }));

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const pick = (...languages) => languages.reduce(toggleLanguage, emptySelection('ko'));

describe('ONB-001 선택 규칙', () => {
  it('① 처음 열면 배울 언어 · 수준이 선택돼 있지 않다 — 내 언어만 기기 언어로 맞춘다', () => {
    expect(emptySelection('ko')).toEqual({ picked: [], primary: null });
    expect(levelForAnswer('Japanese', null)).toBeNull();
    expect(initialUiLocale(['zh-TW', 'ko-KR'])).toBe('zh-TW');
    expect(initialUiLocale(['zh-CN'])).toBe('zh-CN');
    expect(initialUiLocale(['ko-KR'])).toBe('ko');
    // 못 맞추면 한국어 — zh(지역 없음)는 简体 · 繁體를 단정하지 않는다.
    expect(initialUiLocale(['en-US', 'ja-JP'])).toBe('ko');
    expect(initialUiLocale(['zh'])).toBe('ko');
    expect(initialUiLocale([])).toBe('ko');
  });

  it('① 모달 화면에 미리 체크된 언어 · 수준이 없다', () => {
    return import('../../components/OnboardingModal.jsx').then(({ default: OnboardingModal }) => {
      const html = renderToStaticMarkup(createElement(OnboardingModal));
      expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
      expect(html).toContain('manabi에 오신 걸 환영해요');
      // 내 언어 라디오만 한국어가 골라져 있다(서버 렌더 기본값).
      expect(html.match(/type="radio"[^>]*checked/g)).toHaveLength(1);
      // 구글 가입자(「새로운 학습자」)는 빈칸 + 자리표시.
      expect(html).toMatch(/placeholder="새로운 학습자"/);
      expect(html).not.toMatch(/value="새로운 학습자"/);
      // 그라데이션 머리띠 · 서버 오류 원문 경로가 없다.
      const src = read('src/components/OnboardingModal.jsx');
      expect(src).not.toMatch(/useState\(\['Japanese'\]\)/);
      expect(src).not.toMatch(/'(N3|B1|H3) 중급'/);
      expect(src).not.toMatch(/저장 실패: '|friendlyToastMessage|err\.message\s*\)/);
    });
  });

  it('② 중국어 → 일본어 순이면 [Chinese, Japanese] — 주 언어 변경 · 해제 시 이어받기', () => {
    const s = pick('Chinese', 'Japanese');
    expect(orderedLanguages(s)).toEqual(['Chinese', 'Japanese']);
    expect(orderedLanguages(makePrimary(s, 'Japanese'))).toEqual(['Japanese', 'Chinese']);
    const three = pick('French', 'Chinese', 'Japanese');
    expect(orderedLanguages(toggleLanguage(three, 'French'))).toEqual(['Chinese', 'Japanese']);
    // 주 언어를 바꾼 뒤 해제하면 「고른 순서」상 먼저 고른 언어가 이어받는다.
    const moved = makePrimary(three, 'Japanese');
    expect(orderedLanguages(moved)).toEqual(['Japanese', 'French', 'Chinese']);
    expect(orderedLanguages(toggleLanguage(moved, 'Japanese'))).toEqual(['French', 'Chinese']);
    // 고르지 않은 언어는 주 언어가 될 수 없다.
    expect(makePrimary(s, 'English')).toBe(s);
  });

  it('③ 매핑대로 저장되고, 고르지 않은 언어의 수준 열은 쓰지 않는다', () => {
    expect(regularLevels('Chinese')[0]).toBe('H1 기초');
    expect(regularLevels('French')[0]).toBe('A1 기초');
    const expected = {
      Japanese: ['N5 기초', 'N4 기본'], English: ['A1 기초', 'A2 초급'], French: ['A1 기초', 'A2 초급'], Chinese: ['H1 기초', 'H2 초급'],
    };
    for (const [language, [fresh, basics]] of Object.entries(expected)) {
      expect(levelForAnswer(language, { kind: 'fresh' })).toBe(fresh);
      expect(levelForAnswer(language, { kind: 'basics' })).toBe(basics);
    }
    expect(levelForAnswer('Chinese', { kind: 'learned', level: 'H4 상급' })).toBe('H4 상급');
    expect(levelForAnswer('Chinese', { kind: 'learned', level: 'OT 입문' })).toBeNull();
    expect(levelForAnswer('Chinese', { kind: 'learned', level: null })).toBeNull();

    const { base, optional } = buildProfileUpdate({
      selection: pick('Chinese'), answers: { Chinese: { kind: 'basics' }, Japanese: { kind: 'fresh' } }, displayName: '  ', uiLocale: 'ko',
    });
    expect(base).toEqual({ learning_language: ['Chinese'], onboarded: true });
    expect(optional).toEqual({ learning_level_chinese: 'H2 초급' });
    const both = buildProfileUpdate({ selection: pick('Japanese', 'English'), answers: { Japanese: { kind: 'fresh' }, English: { kind: 'learned', level: 'B2 상급' } }, uiLocale: 'ko' });
    expect(both.base).toMatchObject({ learning_level_japanese: 'N5 기초', learning_level_english: 'B2 상급' });
    expect(both.base).not.toHaveProperty('learning_level_french');
    expect(both.optional).toEqual({});
  });

  it('③ 고른 언어마다 답해야 「시작하기」가 켜진다', () => {
    expect(answersComplete([], {})).toBe(false);
    expect(answersComplete(['Chinese', 'Japanese'], { Chinese: { kind: 'fresh' } })).toBe(false);
    expect(answersComplete(['Chinese', 'Japanese'], { Chinese: { kind: 'learned', level: null }, Japanese: { kind: 'fresh' } })).toBe(false);
    expect(answersComplete(['Chinese', 'Japanese'], { Chinese: { kind: 'learned', level: 'H3 중급' }, Japanese: { kind: 'fresh' } })).toBe(true);
  });

  it('④ 내 언어가 중국어면 배울 언어는 한국어 하나 · 미리 체크 · 수준 없이 저장', () => {
    for (const locale of ['zh-CN', 'zh-TW']) {
      expect(learnableLanguages(locale)).toEqual(['Korean']);
      const selection = emptySelection(locale);
      expect(selection).toEqual({ picked: ['Korean'], primary: 'Korean' });
      const { base, optional } = buildProfileUpdate({ selection, answers: { Korean: { kind: 'fresh' } }, uiLocale: locale });
      expect(base).toEqual({ learning_language: ['Korean'], onboarded: true });
      expect(optional).toEqual({});
    }
    // 내 언어를 바꾸면 새 목록에 없는 기존 선택은 해제된다.
    expect(selectionForLocale(pick('Chinese', 'Japanese'), 'zh-CN')).toEqual({ picked: ['Korean'], primary: 'Korean' });
    expect(selectionForLocale({ picked: ['Korean'], primary: 'Korean' }, 'ko')).toEqual({ picked: [], primary: null });
    expect(t('zh-CN', '시작하기')).toBe('开始');
    expect(t('zh-TW', '준비 중')).toBe('準備中');
  });

  it('⑥ 닉네임은 비워도 저장되고(기존 값 유지), 가입 이름만 미리 채운다', () => {
    expect(buildProfileUpdate({ selection: pick('English'), answers: { English: { kind: 'fresh' } }, displayName: ' 하나 ' }).base.display_name).toBe('하나');
    expect(prefillDisplayName({ display_name: '하나' }, { user_metadata: { display_name: '하나' } })).toBe('하나');
    expect(prefillDisplayName({ display_name: '새로운 학습자' }, { user_metadata: {} })).toBe('');
    // 구글 실명은 자동으로 채우지 않는다(D-O5).
    expect(prefillDisplayName({ display_name: 'Kim Hana' }, { user_metadata: { full_name: 'Kim Hana' } })).toBe('');
  });

  it('⑦ /study 레벨 키 ↔ 프로필 급수 — LIFE처럼 LEVELS 밖 키는 매핑하지 않는다', () => {
    expect(studyKeyForProfileLevel('H3 중급')).toBe('H3');
    expect(profileLevelForStudyKey('Chinese', 'H3')).toBe('H3 중급');
    expect(profileLevelForStudyKey('Japanese', 'N4')).toBe('N4 기본');
    expect(profileLevelForStudyKey('Chinese', 'LIFE')).toBeNull();
    expect(profileLevelForStudyKey('Chinese', 'OT')).toBeNull();
    const src = read('src/views/StudyOnboarding.jsx');
    expect(src).toContain('부터 시작할까요?');
    expect(src).toContain('이대로 시작');
    expect(src).toContain('다른 수준 고르기');
    expect(src).toContain('PROFILE_LEVEL_COLUMN[lang]');
  });
});

describe('ONB-001 「준비 중」 언어 가드 (D-L4) — ⑤ 한국어 주 언어 계정은 일본어로 열리지 않는다', () => {
  it('판정은 등록부 하나 — 한국어만 준비 중이고, 4종 강제 상수에는 넣지 않는다', () => {
    expect(isPreparingLearningLanguage('Korean')).toBe(true);
    for (const language of Object.keys(LEVELS)) expect(isPreparingLearningLanguage(language)).toBe(false);
    expect(isPreparingLearningLanguage('Klingon')).toBe(false);
    expect(isPreparingLearningLanguage(null)).toBe(false);
    expect(LEVELS).not.toHaveProperty('Korean');
    expect(LANG_NAME_KO).not.toHaveProperty('Korean');
    expect(PROFILE_LEVEL_COLUMN).not.toHaveProperty('Korean');
    expect(primaryLearningLanguage({ learning_language: ['Korean'] })).toBe('Korean');
    expect(primaryLearningLanguage({ learning_language: 'Chinese' })).toBe('Chinese');
    expect(primaryLearningLanguage({})).toBeNull();
  });

  it.each(['src/app/(app)/study/page.jsx', 'src/app/(app)/study/library/page.jsx'])('%s — 일본어 폴백 전에 준비 중 안내로 돌아간다', file => {
    const src = read(file);
    const guard = src.indexOf('if (isPreparingLearningLanguage(fromProfile)) return <PreparingLanguagePage />;');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(src.indexOf("lang = REF_LANGS[fromProfile] ? fromProfile : 'Japanese';"));
  });

  it('작문 — 고른 작문 언어가 없고 주 언어가 준비 중이면 안내', () => {
    const src = read('src/views/WritingStudioPage.jsx');
    expect(src).toContain('setPreparingLanguage(!saved && isPreparingLearningLanguage(fromProfile));');
    expect(src).toContain('if (preparingLanguage) return <PreparingLanguagePage />;');
  });

  it('배움 홈 · 단어 통계 · 내 정보 — 안내 줄과 보이는 한국어 값', () => {
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain('isPreparingLearningLanguage(primaryLearningLanguage(profile))');
    expect(home).toContain('{!onlyPreparing && <LangChips');
    expect(home).toContain('{preparingLanguage && <PreparingLanguageLine />}');
    const stats = read('src/views/VocabStats.jsx');
    expect(stats).toContain('{showLevels && preparingOnly && <PreparingLanguageLine />}');
    const my = read('src/views/MyPage.jsx');
    expect(my).toContain("['Korean', '한국어 (준비 중)']");
    expect(my).toContain('VIEWER_LOCALE_OPTIONS');
  });

  it('안내 문구는 내 언어 세 가지로 모두 있다', () => {
    for (const locale of ['ko', 'zh-CN', 'zh-TW']) {
      for (const key of ['한국어 과정은 준비 중이에요', '읽기 화면에서 한국어 글을 먼저 읽을 수 있어요', '한국어 글 읽으러 가기']) {
        expect(t(locale, key).length).toBeGreaterThan(0);
      }
    }
  });
});
