import { describe, expect, it } from 'vitest';
import { friendlyToastMessage } from '../errorMessage';
import { conversationErrorView } from '../../components/conversation/ConversationThread';

// OFFLINE-SWEEP-001 — 대화 턴은 연결 실패를 Error('offline') · status 0으로 감싼다(conversationClient.postConversationTurn).
// 390 실측(2026-10-23 KST): 끊긴 채 「대화 시작」 → 「문제가 발생했어요. 잠시 후 다시 시도해 주세요.」(원인 모름 문구).
const offline = () => Object.assign(new Error('offline'), { status: 0, code: 'offline' });

describe('대화 — 끊김은 연결 안내로', () => {
  it('새 대화 시작 실패(friendlyToastMessage)는 연결 끊김 표준 문구', () => {
    expect(friendlyToastMessage(offline())).toBe('인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대개 해결돼요.');
  });
  it('대화 안 턴은 예전 그대로 「연결이 끊겼어요 · 다시 시도」', () => {
    expect(conversationErrorView(offline())).toEqual({ text: '연결이 끊겼어요 · 다시 시도', retry: true });
  });
  it('「offline」이 낱말로 들어간 말만 — 다른 낱말 속 글자는 아니다', () => {
    expect(friendlyToastMessage(new Error('offlineCache quota'))).not.toBe('인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대개 해결돼요.');
  });
});
