// CONV-CHAT-001 — 못 한 줄 자동 채우기: 순수 규칙 + 화면 계약(「다시 분석」 버튼 없음).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyFillResult, fillConversationLines, missingConversationLines } from '../turnModel';
import { CONVERSATION_FILL_DELAYS } from '../../../components/conversation/ConversationThread';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const json = () => ({
  sequence: ['id_0_0_1', 'br_0_1', 'failed_1_1', 'br_1_1', 'br_2_1', 'failed_3_1'],
  dictionary: { id_0_0_1: { text: 'A' }, failed_1_1: { text: 'xy', failed: true }, failed_3_1: { text: 'zz', failed: true } },
  failed_indices: [1, 3], status: 'partial', metadata: { conversation: { turnCount: 3 } },
});
const result = (line) => ({ sequence: [...line].map((_, i) => `s${i}`), dictionary: Object.fromEntries([...line].map((c, i) => [`s${i}`, { text: c }])) });

describe('못 한 줄 채우기', () => {
  it('실패 토큰이 남은 줄을 오름차순으로 찾는다', () => {
    expect(missingConversationLines(json())).toEqual([1, 3]);
    expect(missingConversationLines({})).toEqual([]);
  });
  it('같은 자리에 끼우고 다른 토큰·메타는 그대로 둔다. 덮지 못한 결과는 받지 않는다', () => {
    const out = fillConversationLines(json(), { lineNos: [1, 3], lines: ['xy', 'zz'], results: [result('xy'), result('z')], ts: 9, language: 'English' });
    expect(out.json.sequence).toEqual(['id_0_0_1', 'br_0_1', 'id_1_0_9', 'id_1_1_9', 'br_1_1', 'br_2_1', 'failed_3_1']);
    expect(out.json.failed_indices).toEqual([3]);
    expect(out.json.metadata).toEqual(json().metadata);
    expect(Object.keys(out.filled)).toEqual(['1']);
  });
  it('화면 캐시에 같은 규칙으로 합친다 — 이미 바뀐 자리면 null(다시 불러오기)', () => {
    const material = { id: 1, processed_json: json() };
    const out = fillConversationLines(json(), { lineNos: [1], lines: ['xy'], results: [result('xy')], ts: 9, language: 'English' });
    const merged = applyFillResult(material, out);
    expect(merged.processed_json.sequence).toEqual(out.json.sequence);
    expect(applyFillResult(merged, out)).toBeNull();
  });
});

describe('화면 계약', () => {
  it('사용자가 누르는 「다시 분석」 대신 간격을 둔 자동 채우기', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    expect(thread).not.toContain('다시 분석');
    expect(thread).toContain("action: 'analyze'");
    expect(CONVERSATION_FILL_DELAYS[0]).toBe(0);
    expect(CONVERSATION_FILL_DELAYS.length).toBeGreaterThan(2);
    expect(read('views/ViewerPage.jsx')).toContain('onFilled={user?.id === material?.owner_id ? handleConversationFill : null}');
  });
});
