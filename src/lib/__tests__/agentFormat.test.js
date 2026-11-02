import { describe, expect, it } from 'vitest';
import { agentFormatSpec, agentPrompt, parseAgentText } from '../agentFormat.js';

const sample = `# 제목: 주말 약속 (N4)
@level: N4
@target: 約束, 予定、映画
---
A: 週末、何か予定ある？
B: 映画を見る約束があるんだ。一緒に行かない？
A: いいね！
---
@notes: 約束 = 약속 · 予定 = 예정`;

describe('에이전트 출력 형식 계약(AGENT-LINK-001 0단계 · 설계 §3)', () => {
  it('형식대로면 제목 · 수준 · 목표 단어 · 화자 줄 · 뜻 줄을 읽는다', () => {
    const r = parseAgentText(sample);
    expect(r.recognized).toBe(true);
    expect(r.title).toBe('주말 약속 (N4)');
    expect(r.level).toBe('N4');
    expect(r.targets).toEqual(['約束', '予定', '映画']);
    expect(r.kind).toBe('conversation');
    expect(r.lines[1]).toEqual({ speaker: 'B', text: '映画を見る約束があるんだ。一緒に行かない？' });
    expect(r.body.split('\n')).toHaveLength(3); // 화자 이름을 뗀 본문 — 분석 · 저장에 그대로
    expect(r.notes).toBe('約束 = 약속 · 予定 = 예정');
  });

  it('글(화자 없음)은 text · 형식이 아니면 일반 글로 받는다(실패 아님)', () => {
    const story = parseAgentText('# 제목: 駅で\n---\n朝、駅で友だちに会いました。\n一緒に電車に乗りました。');
    expect(story.recognized).toBe(true);
    expect(story.kind).toBe('text');
    const plain = parseAgentText('今日は雨です。\n傘を持っていきます。');
    expect(plain.recognized).toBe(false);
    expect(plain.body).toBe('今日は雨です。\n傘を持っていきます。');
  });

  it('URL · 시각은 화자가 아니다', () => {
    const r = parseAgentText('https://example.com 를 봤어요\n10:30 に会いましょう');
    expect(r.lines.every(l => l.speaker === null)).toBe(true);
    expect(r.kind).toBe('text');
  });
});

describe('프롬프트 묶음(설계 §5) — 세 프롬프트가 같은 형식 꼬리', () => {
  const words = ['約束', '予定', '映画'];
  it('단어 · 수준 · 언어를 채우고 형식 계약을 붙인다', () => {
    for (const kind of ['story', 'partner', 'recap']) {
      const p = agentPrompt(kind, { words, level: 'N4', language: 'Japanese' });
      expect(p.endsWith(agentFormatSpec())).toBe(true);
    }
    expect(agentPrompt('story', { words, level: 'N4' })).toContain('N4 수준 일본어 짧은 글');
    expect(agentPrompt('partner', { words })).toContain('단어: 約束, 予定, 映画');
  });
  it('말투 규약 — 죄책감 · 「밀림」 · 「실패」를 쓰지 않는다', () => {
    for (const kind of ['story', 'partner', 'recap']) {
      const p = agentPrompt(kind, { words });
      for (const banned of ['실패', '밀렸', '밀림', '게으']) expect(p).not.toContain(banned);
    }
  });
  it('형식 꼬리로 돌아온 결과는 다시 읽힌다(계약 왕복)', () => {
    const spec = agentFormatSpec();
    expect(spec).toContain('# 제목:');
    expect(spec).toContain('@target:');
    expect(spec.match(/^---$/gm)).toHaveLength(2);
  });
});
