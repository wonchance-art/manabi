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

describe('카드 배선(ViewerPage)', () => {
  it('버튼형 — 자동 조회가 아니라 [이 문장에서는?] 탭이 유일한 트리거', () => {
    expect(viewer).toContain("import { fetchCtxExplain } from '../lib/ctxExplain'");
    expect(viewer).toContain('이 문장에서는?');
    expect(viewer).toContain('runCtxExplain(selectedToken, ctxSentence)');
    // 카드 열림 이펙트에서 fetchCtxExplain을 자동 호출하지 않는다
    expect(viewer).not.toMatch(/useEffect\([\s\S]{0,400}fetchCtxExplain/);
  });

  it('본문 탭 토큰만 — id(id_<rawIdx>_…)에서 원문 줄을 되찾고, zh부터 노출', () => {
    expect(viewer).toMatch(/id\|failed/); // ctxSentenceOf의 rawIdx 유도 정규식
    expect(viewer).toContain("materialLang === 'Chinese' && (() => {");
    expect(viewer).toContain('const ctxSentence = ctxSentenceOf(selectedToken)');
  });

  it('늦은 응답 가드(시퀀스) + 토큰 전환 시 상태 리셋', () => {
    expect(viewer).toContain('ctxExplainSeq.current += 1; setCtxExplain(null);');
    expect(viewer).toContain('const seq = ++ctxExplainSeq.current;');
    expect(viewer).toMatch(/ctxExplainSeq\.current === seq/);
  });
});

describe('서버 배선(/api/explain token 분기)', () => {
  it('기존 오답 해설 분기 불변 + token 분기 신설(같은 인증·레이트리밋 위)', () => {
    expect(route).toContain("['cloze', 'vocab', 'comprehension']"); // 기존 계약 유지
    expect(route).toContain('if (body?.token) {');
    expect(route).toContain('buildTokenExplainPrompt');
  });

  it('판정성 출력이라 temperature 0으로 호출한다(판별기 관례)', () => {
    expect(route).toContain("callGemini('gemini-3.5-flash-lite', promptText, apiKey, 0)");
    expect(route).toContain('callGroq(promptText, 0)');
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
