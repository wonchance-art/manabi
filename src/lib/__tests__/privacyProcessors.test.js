import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

/**
 * 개인정보 처리방침 §4 처리 위탁 · 국외 이전이 실제 코드의 외부 처리자와 맞는다(STATS-MAP-001 · 오너 「진행」 2026-11-02 KST).
 * 문서가 코드보다 뒤처진 채 반년을 버텼다(Anthropic · Vercel · 웹 푸시 누락, 운영에 없는 Groq 기재) — 갈리면 여기서 잡는다.
 */
const privacy = fs.readFileSync('src/app/privacy/page.jsx', 'utf8');
const llm = fs.readFileSync('src/lib/server/llm.js', 'utf8');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

describe('개인정보 처리방침 — 처리 위탁 · 국외 이전', () => {
  it('AI 처리자: 코드가 부르는 운영 모델 공급자가 모두 적혀 있다', () => {
    if (llm.includes("'claude-")) expect(privacy).toContain('Anthropic (Claude)');
    if (llm.includes('generativelanguage.googleapis.com') || llm.includes('gemini-')) expect(privacy).toContain('Google (Gemini)');
  });
  it('호스팅 · 데이터베이스 · 푸시 · 로그인이 적혀 있다', () => {
    for (const name of ['Supabase', 'Vercel', '브라우저 푸시 서비스', 'Google (로그인)']) expect(privacy).toContain(name);
  });
  it('서버 지역이 설정과 맞다 — Vercel hnd1 = 도쿄', () => {
    expect(vercel.regions).toEqual(['hnd1']);
    expect(privacy).toContain('<td style={td}>Vercel</td><td style={td}>일본(도쿄)</td>');
  });
  it('운영에서 쓰지 않는 처리자를 적지 않는다(Groq — 운영 키 없음, 벤치 전용)', () => {
    expect(privacy).not.toContain('Groq');
  });
  it('개인정보 없는 외부 조회는 무엇만 보내는지 밝힌다', () => {
    expect(privacy).toContain('비밀번호 해시의 앞 5자리만');
  });
});
