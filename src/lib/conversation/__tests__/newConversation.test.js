// 대화 모드 v2-Z Z-R2 — 새 대화 화면 선택지·입구·머리 ⋯(주제·수준 바꾸기 · 새 대화 · 지우기).
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../constants';
import {
  CONVERSATION_TOPICS, canStartConversation, conversationLevels, newConversationDefaults, newConversationHref, preferredConversationLanguage, recommendedLevel,
} from '../newConversation';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');

describe('새 대화 선택지', () => {
  it('주제 칩은 시안의 여섯 개', () => {
    expect(CONVERSATION_TOPICS).toEqual(['오늘 하루', '주말 계획', '여행', '음식', '학교·일', '취미']);
  });
  it('수준 = 학습 수준 정본, 추천 = 내 프로필 수준(없거나 옛 값이면 첫 단계)', () => {
    expect(conversationLevels('Chinese')).toBe(LEVELS.Chinese);
    expect(recommendedLevel('Chinese', 'H3 중급')).toBe('H3 중급');
    expect(recommendedLevel('Chinese', null)).toBe('OT 입문');
    expect(recommendedLevel('Japanese', 'HSK 9')).toBe('N5 기초');
  });
  it('「주제·수준 바꾸기」는 지금 대화 값으로 새 대화 화면을 연다', () => {
    const href = newConversationHref({ language: 'Japanese', level: 'N4 기본', topic: '여행' });
    expect(href).toBe('/conversation/new?lang=Japanese&level=N4+%EA%B8%B0%EB%B3%B8&topic=%EC%97%AC%ED%96%89');
    const d = newConversationDefaults(new URL(`https://x${href}`).searchParams);
    expect(d).toEqual({ language: 'Japanese', level: 'N4 기본', topic: '여행' });
  });
  it('모르는 언어·수준은 버리고 기본값으로', () => {
    const d = newConversationDefaults(new URLSearchParams('lang=Klingon&level=Z9'), { profileLevelOf: (l) => (l === 'Chinese' ? 'H2 초급' : null) });
    expect(d).toEqual({ language: 'Chinese', level: 'H2 초급', topic: '' });
  });
  it('처음 언어 = 프로필의 첫 학습 언어(배열 · 옛 문자열), 없거나 모르는 언어면 중국어', () => {
    expect(preferredConversationLanguage({ learning_language: ['Japanese', 'Chinese'] })).toBe('Japanese');
    expect(preferredConversationLanguage({ learning_language: 'French' })).toBe('French');
    expect(preferredConversationLanguage({ learning_language: ['Korean', 'English'] })).toBe('English');
    expect(preferredConversationLanguage({ learning_language: [] })).toBe('Chinese');
    expect(preferredConversationLanguage(null)).toBe('Chinese');
    // 주소의 lang이 있으면 그것이 먼저다(「주제·수준 바꾸기」)
    const d = newConversationDefaults(new URLSearchParams('lang=English'), { fallbackLanguage: preferredConversationLanguage({ learning_language: ['Japanese'] }) });
    expect(d.language).toBe('English');
    expect(newConversationDefaults(new URLSearchParams(''), { fallbackLanguage: 'Japanese' }).language).toBe('Japanese');
  });
  it('주제·언어·수준이 다 있어야 시작한다', () => {
    expect(canStartConversation({ topic: '여행', language: 'English', level: 'A2 초급' })).toBe(true);
    expect(canStartConversation({ topic: '  ', language: 'English', level: 'A2 초급' })).toBe(false);
    expect(canStartConversation({ topic: '여행', language: 'English', level: 'H2 초급' })).toBe(false);
  });
});

describe('입구와 머리 ⋯(정적 계약)', () => {
  it('새 대화 화면 경로가 있고 서버 시작 경로를 쓴다', () => {
    expect(existsSync(new URL('../../../app/(app)/conversation/new/page.jsx', import.meta.url))).toBe(true);
    const page = read('views/NewConversationPage.jsx');
    // CONV-CHAT-001 2차: 첫 화면 = 방 목록. 언어·수준 선택 칸 없이 학습 언어·학습 수준 정본으로 연다.
    expect(page).toContain('startTopicConversation({ topic: chosen, language, level');
    expect(page).toContain('const level = recommendedLevel(language, profileLevel(profile, language));');
    expect(page).toContain('useLearnLanguage(profile)');
    expect(page).not.toMatch(/말 수준|conversationLevels/);
  });
  it('자료 추가에 「새 대화」 입구(서재에는 대화를 두지 않는다 — 2026-10-17 · 배움 「말해 보기」 칸은 오너 지시로 뺐다 2026-10-25 KST — 하단 「대화」 탭이 남는다)', () => {
    expect(read('components/materials/MaterialEntry.jsx')).toContain('<Link href="/conversation/new">자료 없이 대화하기 ↗</Link>');
  });
  it('머리 ⋯ = 다른 대화방 · 새 대화 · 지우기(서재 휴지통, 무엇이 남는지 먼저)', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    for (const label of ['다른 대화방', '새 대화', '지우기', '이 대화를 휴지통으로 옮길까요?', '담은 표현과 복습 일정은 단어장에 그대로 남아요.']) {
      expect(thread).toContain(label);
    }
    expect(read('lib/conversation/conversationClient.js')).toContain("runLibraryOperation(supabase, 'trash', [target])");
    expect(read('views/ViewerPage.jsx')).toContain('onDelete={user?.id === material?.owner_id ? deleteConversation : null}');
  });
});
