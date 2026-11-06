import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// 발매 점검 #3(오케스트레이션 경유 착수 2026-11-06 KST) — 처음 온 사람이 처음 만나는 필수 창.
// 예전엔 대화상자 표시가 없어 Tab을 15번 넘게 눌러 가려진 배경 링크를 지나야 닉네임 칸에 닿았고, 닉네임 라벨이 칸과 이어지지 않았으며,
// 언어 · 수준 토글은 눌림 상태를 읽어 주지 않았다(실제 빌드 키보드 탐침). 화면 모양은 그대로다.
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { display_name: '' }, fetchProfile: vi.fn() }) }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../authDisplayName', () => ({ syncAuthDisplayName: vi.fn() }));

import OnboardingModal from '../../components/OnboardingModal';

const html = renderToStaticMarkup(<OnboardingModal />);
const src = fs.readFileSync(path.join(process.cwd(), 'src/components/OnboardingModal.jsx'), 'utf8');

describe('온보딩 창 — 대화상자 · 라벨 · 눌림 상태', () => {
  it('대화상자(role=dialog · aria-modal)이고 제목 · 설명으로 이름이 붙는다', () => {
    expect(html).toMatch(/class="onboarding-modal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="onboarding-title"[^>]*aria-describedby="onboarding-sub"/);
    expect(html).toContain('id="onboarding-title"');
    expect(html).toContain('id="onboarding-sub"');
  });
  it('「닉네임」 라벨이 입력칸과 이어진다', () => {
    expect(html).toContain('<label class="form-label" for="onboarding-name">닉네임</label>');
    expect(html).toMatch(/<input id="onboarding-name"/);
  });
  it('학습 언어 · 수준 토글은 묶음 이름과 눌림 상태(aria-pressed)를 읽어 준다', () => {
    expect(html).toContain('role="group" aria-labelledby="onboarding-lang-label"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>일본어</);
    for (const lang of ['영어', '프랑스어', '중국어']) expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${lang}<`));
    expect(html).toContain('role="group" aria-labelledby="onboarding-level-jp"');
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>N3 중급</);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>N5 기초</);
  });
  it('열리면 닉네임 칸으로 포커스, Tab은 창 안에서 돈다(배경으로 새지 않는다)', () => {
    expect(src).toContain("modalRef.current?.querySelector('input')?.focus({ preventScroll: true })");
    expect(src).toMatch(/if \(event\.key !== 'Tab' \|\| !modalRef\.current\) return;/);
    expect(src).toContain("window.addEventListener('keydown', onKey, true)");
    expect(src).toContain("window.removeEventListener('keydown', onKey, true)");
  });
  it('저장 오류 문장은 바로 읽힌다(role=alert)', () => {
    expect(src).toContain('{error && <p role="alert"');
  });
});
