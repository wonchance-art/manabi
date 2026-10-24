import { describe, expect, it } from 'vitest';
import { failureMessage, friendlyToastMessage } from '../errorMessage';

// OFFLINE-SWEEP-001 P5 — 실패 토스트는 두 문장까지(화면 문구 표준 §3). 실패 문장 + 정해 둔 두 문장 안내가 붙어 세 문장이 됐다
// (390 실측: 「단어를 추가하지 못했어요. 인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대개 해결돼요.」).
const sentences = (text) => text.split(/(?<=[.?!])\s+/).filter(Boolean).length;
const CASES = [
  ['연결 끊김', new TypeError('Failed to fetch'), '인터넷 연결을 확인해 주세요.'],
  ['연결 끊김(대화 표지)', Object.assign(new Error('offline'), { status: 0 }), '인터넷 연결을 확인해 주세요.'],
  ['AI 붐빔', new Error('The model is overloaded (503)'), 'AI 서비스가 붐비니 잠시 후 다시 시도해 주세요.'],
  ['요청 많음', new Error('429 Too Many Requests'), '요청이 많으니 1~2분 기다린 뒤 다시 시도해 주세요.'],
  ['응답 읽기', new Error('Unexpected token < in JSON'), '다시 시도하면 대개 해결돼요.'],
  ['로그인 만료', new Error('JWT expired'), '로그인이 만료됐으니 다시 로그인해 주세요.'],
  ['관련 항목', new Error('violates foreign key constraint'), '관련 항목을 먼저 확인해 주세요.'],
  ['권한', new Error('new row violates row-level security policy'), '본인의 항목만 수정·삭제할 수 있어요.'],
  ['파일 큼', new Error('Payload too large (413)'), '파일을 50MB 이하로 줄여 주세요.'],
  ['저장소', new Error('Bucket not found'), '저장소 설정 문제라 관리자에게 문의해 주세요.'],
  ['서비스 설정', Object.assign(new Error('HTTP 402'), { status: 402 }), '서비스 설정 문제라 관리자에게 문의해 주세요.'],
  ['관리자 전용(한 문장 그대로)', new Error('403 forbidden'), '이 작업은 관리자만 할 수 있어요.'],
  ['중복(한 문장 그대로)', new Error('duplicate key value'), '이미 저장된 항목이에요.'],
  ['모르는 오류', new Error('boom'), '잠시 후 다시 시도해 주세요.'],
];

describe('failureMessage — 실패 문장 + 원인 한 문장', () => {
  it.each(CASES)('%s', (_name, err, cause) => {
    const text = failureMessage('단어를 추가하지 못했어요.', err);
    expect(text).toBe(`단어를 추가하지 못했어요. ${cause}`);
    expect(sentences(text)).toBeLessThanOrEqual(2);
  });
  it('토스트 · 오류 상자 단독 문구(friendlyToastMessage)는 그대로 두 문장', () => {
    expect(friendlyToastMessage(new TypeError('Failed to fetch'))).toBe('인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대개 해결돼요.');
  });
});
