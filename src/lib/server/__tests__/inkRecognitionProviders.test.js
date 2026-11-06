import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import {
  INK_RECOGNITION_PROVIDERS, INK_RECOGNITION_PROVIDER_LABEL, INK_RECOGNITION_CONSENT, INK_RECOGNITION_CONSENT_MESSAGE,
} from '../../noteRecognition.js';

// INK-CONSENT-001(2026-11-06 KST) — 필기 인식 동의 안내가 「Google Gemini로 인식해요」였는데, 서버는 Claude 키가 있으면
// Anthropic Claude에 먼저 보내고 실패해야 Gemini로 넘어갔다. 안내 · 동의 값은 INK_RECOGNITION_PROVIDERS 한 목록에서 나오고,
// 이 테스트는 그 목록을 **실제 서버 경로가 바깥으로 보내는 요청 순서**와 대조한다(llm.js 표를 다시 적지 않는다).
// 처리자를 바꾸거나 순서를 뒤집거나 Groq 폴백을 켜면 여기서 깨진다 — 그때 안내 문구와 개인정보 처리방침을 함께 고친다.

const read = (f) => fs.readFileSync(f, 'utf8');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const providerOf = (url) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) return 'anthropic';
  if (u.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (u.includes('api.groq.com')) return 'groq';
  return `other:${u}`;
};
const NAMES = { anthropic: 'Anthropic Claude', gemini: 'Google Gemini' };

beforeEach(() => {
  // 세 키가 모두 있는 최악의 경우 — 어느 처리자로 갈 수 있는지 전부 드러난다.
  vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-test-key');
  vi.stubEnv('ANTHROPIC_BASE_URL', '');
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
  vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function providersContacted(route) {
  const hits = [];
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    hits.push(providerOf(url));
    return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'down' } }), { status: 500, headers: { 'content-type': 'application/json' } });
  }));
  vi.resetModules();
  const { recognizeSelectedInk } = await import('../selectedInkRecognition.js');
  await expect(recognizeSelectedInk(PNG, 'Japanese', undefined, route)).rejects.toMatchObject({ status: 503 });
  return hits.filter((p, i) => p !== hits[i - 1]);
}

describe('필기 인식 — 안내한 처리자 = 실제로 보내는 곳(INK-CONSENT-001)', () => {
  it.each(['note-recognize', 'class-ink-recognize'])('%s: 실패가 이어져도 안내한 순서로만 보내고 다른 곳(Groq 등)엔 보내지 않는다', async (route) => {
    expect(await providersContacted(route)).toEqual([...INK_RECOGNITION_PROVIDERS]);
  });

  it('안내 문구가 처리자를 같은 순서로 이름 댄다', () => {
    const positions = INK_RECOGNITION_PROVIDERS.map((p) => INK_RECOGNITION_PROVIDER_LABEL.indexOf(NAMES[p]));
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(INK_RECOGNITION_CONSENT).toBe(`selected-ink-to-${INK_RECOGNITION_PROVIDERS.join('-then-')}`);
  });

  it('두 동의 화면이 같은 안내와 동의 값을 쓰고, 처리자 이름을 따로 적지 않는다', () => {
    for (const file of ['src/components/notes/NoteRecognition.jsx', 'src/components/classroom/BoardInkRecognition.jsx']) {
      const src = read(file);
      expect(src, file).toContain('<strong>{INK_RECOGNITION_PROVIDER_LABEL}</strong>');
      expect(src, file).toContain('consent:INK_RECOGNITION_CONSENT');
      expect(src, file).not.toMatch(/Gemini|Anthropic|Claude|selected-ink-to-/);
    }
  });

  it('두 API가 지금 동의 값만 받는다(옛 화면의 「Gemini만」 동의로 Claude에 보내지 않는다)', () => {
    for (const file of ['src/app/api/notes/[id]/recognize/route.js', 'src/app/api/classroom/recognize/route.js']) {
      const src = read(file);
      expect(src, file).toContain('body.consent!==INK_RECOGNITION_CONSENT)fail(400,INK_RECOGNITION_CONSENT_MESSAGE)');
      expect(src, file).not.toContain("'selected-ink-to-");
    }
    expect(INK_RECOGNITION_CONSENT_MESSAGE).not.toMatch(/Gemini|Claude/);
  });
});
