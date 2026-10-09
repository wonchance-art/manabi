import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 배선 계약: 문맥 설명 R1 (오너 승인 2026-08-30 "ㄱㄱ" — 버튼형+suspect).
// 즉답 카드는 그대로 두고, [이 문장에서는?] 버튼을 눌렀을 때만 문장 맥락 설명을
// 지연 로드한다(헛호출 0). suspect는 학습자 비노출 — token_corrections 적재만.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const route = read('src/app/api/explain/route.js');
const client = read('src/lib/ctxExplain.js');

// AE-R1 개정(VIEWER-V2-ROUNDS-001 §2.1 「없어지는 것: 단어 탭의 「이 문장에서는?」 버튼·「이 문장에서」 문구」,
// §3 「suspect 기록이 비는 것을 감수 — AD-R4가 대신할 때까지」, 설계서 §2.1·§7.1): 카드의 버튼·상태·호출을 걷는다.
// 서버 token 분기와 ctxExplain.js(클라이언트 캐시)는 AD-R4가 대체할 때까지 남긴다(아래 서버·클라이언트 계약 유지).
describe('카드 배선(ViewerPage)', () => {
  it('단어 탭에 「이 문장에서는?」 트리거가 없고 카드가 /api/explain token 분기를 부르지 않는다', () => {
    expect(viewer).not.toContain("from '../lib/ctxExplain'");
    expect(viewer).not.toContain('fetchCtxExplain');
    expect(viewer).not.toContain('이 문장에서는?');
    expect(viewer).not.toContain('runCtxExplain');
  });

  it('원문 줄 유도(id_<rawIdx>_…)는 문장 줄·번역·저장 문맥이 계속 쓴다', () => {
    expect(viewer).toMatch(/id\|failed/); // ctxSentenceOf의 rawIdx 유도 정규식
    expect(viewer).toContain('const ctxSentenceOf = (tok) => {');
  });

  it('카드 전용 문맥 설명 상태(ctxExplain·시퀀스)가 남지 않는다', () => {
    expect(viewer).not.toContain('ctxExplainSeq');
    expect(viewer).not.toContain('setCtxExplain');
  });
});

describe('서버 배선(/api/explain token 분기)', () => {
  it('기존 오답 해설 분기 불변 + token 분기 신설(같은 인증·레이트리밋 위)', () => {
    expect(route).toContain("['cloze', 'vocab', 'comprehension']"); // 기존 계약 유지
    expect(route).toContain('if (body?.token) {');
    expect(route).toContain('buildTokenExplainPrompt');
  });

  it('판정성 출력이라 temperature 0으로 호출한다(판별기 관례) — light 티어, 폴백은 llm.js', () => {
    expect(route).toContain("callLLM('light', promptText, { temperature: 0, route: 'explain' })");
    // AA R1: Groq 폴백·모델 문자열은 라우트에 없다 — llm.js 한 곳
    expect(route).not.toContain('callGroq(');
    expect(route).not.toMatch(/gemini-\d/);
  });

  it('suspect는 응답에 싣지 않고 token_corrections에 적재만(수확 루프·학습자 비노출)', () => {
    expect(route).toContain("from('token_corrections')");
    expect(route).toContain("source: 'ai_explain_suspect'");
    expect(route).toMatch(/return Response\.json\(\{ explanation: result\.explanation \}/);
    expect(route).not.toMatch(/Response\.json\(\{[^}]*suspect/);
  });

  it('적재는 사용자 JWT(RLS 본인 insert)로 — service role 미사용', () => {
    const branch = route.match(/if \(body\?\.token\) \{[\s\S]*?\n  \}/)?.[0] || '';
    expect(branch).toContain('Authorization: `Bearer ${token}`');
    expect(branch).not.toContain('SERVICE_ROLE');
  });
});

describe('클라이언트(ctxExplain.js)', () => {
  it('(언어, 문장, 단어) localStorage 캐시 — 재탭·재독 무호출', () => {
    expect(client).toContain('ctx_explain:');
    expect(client).toContain("fetch('/api/explain'");
  });
});
