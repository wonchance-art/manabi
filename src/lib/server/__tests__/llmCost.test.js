// LLM-COST-001 계약 — 운영 텔레메트리로 비용 추정. 단가는 llm.js 한 곳(측정 표와 같은 값), 로그 스크립트는 `[llm]` 줄의
// 허용 키와 시각만 읽는다(그 밖의 필드 · 개인정보 0), 날짜는 KST.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BENCH_MODELS, GROQ_MODEL, LLM_LOG_KEYS, MODEL_PRICES, TIERS, ANTHROPIC_TIERS, ANTHROPIC_QUALITY, estimateCostUsd, llmCostSummary } from '../llm.js';
import { aggregate, entriesFromText, kstDay, llmRecordFrom, parseLogEntry, renderReport } from '../../../../scripts/eval/llm-cost-from-logs.mjs';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const line = (rec, ts = '2026-10-17T03:00:00.000Z') => `${ts} info [llm] ${JSON.stringify(rec)}`;
const rec = (o) => ({ route: 'explain', tier: 'light', model: 'claude-haiku-5-5', provider: 'anthropic', fallbackDepth: 0, ms: 900, in: 1_000_000, out: 100_000, thinking: 0, ok: true, status: 200, ...o });

describe('단가표 — 한 곳 · 운영 모델 전부', () => {
  it('MODEL_PRICES는 측정 표(BENCH_MODELS)의 단가 그대로, 운영 체인의 모든 모델이 있다', () => {
    for (const s of Object.values(BENCH_MODELS)) expect(MODEL_PRICES[s.model]).toEqual({ provider: s.provider, price: s.price });
    const operational = [TIERS.light.primary, TIERS.standard.primary, ...TIERS.standard.fallbacks, GROQ_MODEL,
      ANTHROPIC_TIERS.light.primary, ANTHROPIC_TIERS.standard.primary, ANTHROPIC_QUALITY.primary, ...ANTHROPIC_QUALITY.fallbacks];
    for (const m of operational) expect(MODEL_PRICES[m]).toBeDefined();
  });

  it('estimateCostUsd — 입력 단가 × in + 출력 단가 × (out + thinking), 모르는 모델은 null', () => {
    const [pin, pout] = MODEL_PRICES['claude-sonnet-5-5'].price;
    expect(estimateCostUsd('claude-sonnet-5-5', { in: 1_000_000, out: 200_000, thinking: 300_000 })).toBe(Number((pin + 0.5 * pout).toFixed(6)));
    expect(estimateCostUsd('claude-haiku-5-5', { in: 0, out: 0 })).toBe(0);
    expect(estimateCostUsd('mystery-model', { in: 10 })).toBeNull();
  });

  it('llmCostSummary — 인스턴스 창의 티어 · 모델 버킷을 모델별로 합치고 비용 · 제공자를 붙인다', () => {
    const snap = { since: 's', tiers: {
      light: { 'claude-haiku-5-5': { calls: 3, ok: 3, in: 1_000_000, out: 0, thinking: 0, ms: 1, fallbackUsed: 0 } },
      standard: { 'claude-haiku-5-5': { calls: 1, ok: 1, in: 1_000_000, out: 1_000_000, thinking: 0 }, 'claude-sonnet-5-5': { calls: 2, ok: 2, in: 1_000_000, out: 0, thinking: 0 }, none: { calls: 1, ok: 0, in: 0, out: 0, thinking: 0 } },
    } };
    const s = llmCostSummary(snap);
    const haiku = s.byModel.find((r) => r.model === 'claude-haiku-5-5');
    expect(haiku).toMatchObject({ provider: 'anthropic', calls: 4, in: 2_000_000, out: 1_000_000, costUsd: estimateCostUsd('claude-haiku-5-5', { in: 2_000_000, out: 1_000_000 }) });
    expect(s.byModel[0].model).toBe('claude-sonnet-5-5'); // 비싼 순
    expect(s.totalUsd).toBe(Number((haiku.costUsd + estimateCostUsd('claude-sonnet-5-5', { in: 1_000_000 })).toFixed(6)));
    expect(s.unpriced).toEqual([]); // 토큰 0인 'none'(키 없음 등 실패)은 단가 없음으로 치지 않는다
    expect(llmCostSummary({ since: 's', tiers: { light: { 'x-model': { calls: 1, in: 5 } } } }).unpriced).toEqual(['x-model']);
  });
});

describe('로그 스크립트 — 허용 키 · 시각만, KST 날짜', () => {
  it('평문 줄 — [llm] JSON의 허용 키(11개)만 남기고, 줄 앞 ISO 시각을 KST 날짜로', () => {
    const hit = parseLogEntry(line(rec({ extra: 'x' }), '2026-10-17T14:59:59Z'));
    expect(Object.keys(hit.rec)).toEqual([...LLM_LOG_KEYS]);
    expect(hit.rec).not.toHaveProperty('extra');
    expect(hit.day).toBe('2026-10-17');
    expect(parseLogEntry(line(rec(), '2026-10-17T15:00:00Z')).day).toBe('2026-10-18'); // KST 자정
    vi.stubEnv('TZ', 'America/Los_Angeles'); // 실행 기기 시간대가 달라도 같은 날짜
    expect(kstDay('2026-10-17T15:00:00')).toBe('2026-10-18'); // 시간대 없는 시각은 UTC로
    expect(kstDay('2026-10-17 14:59:59')).toBe('2026-10-17');
    expect(kstDay(Date.UTC(2026, 9, 17, 15))).toBe('2026-10-18');
    expect(kstDay(Math.floor(Date.UTC(2026, 9, 17, 15) / 1000))).toBe('2026-10-18'); // 초 단위
  });

  it('JSON 줄 · JSON 배열 · CSV 칸 — 메시지와 시각 말고는 읽지 않는다(개인정보 · 요청 필드가 결과에 없다)', () => {
    const r = rec({ user: 'someone@example.com' });
    const jsonLine = JSON.stringify({ timestamp: '2026-10-17T01:00:00Z', ip: '203.0.113.9', path: '/api/explain?q=비밀', message: `[llm] ${JSON.stringify(r)}` });
    const csv = `"2026-10-17T02:00:00Z","/api/explain","[llm] ${JSON.stringify(r).replace(/"/g, '""')}"`;
    const arr = JSON.stringify([{ time: '2026-10-17T04:00:00Z', message: `[llm] ${JSON.stringify(r)}`, requestId: 'req-1' }]);
    const entries = [...entriesFromText(`${jsonLine}\n${csv}\nnoise line\n2026-10-17T05:00:00Z [gemini] 402`), ...entriesFromText(arr)];
    const result = aggregate(entries);
    expect(result.lines).toBe(3);
    const out = JSON.stringify(result) + renderReport(result);
    for (const secret of ['someone@example.com', '203.0.113.9', '비밀', 'req-1', '/api/explain?']) expect(out).not.toContain(secret);
  });

  it('[llm] 아닌 줄 · 깨진 JSON · 텔레메트리 모양이 아닌 객체는 세지 않는다', () => {
    expect(parseLogEntry('2026-10-17 [llm-bench] {"model":"x","ok":true}')).toBeNull();
    expect(parseLogEntry('[llm] {"model":')).toBeNull();
    expect(parseLogEntry('[llm] {"route":"x"}')).toBeNull();
    expect(llmRecordFrom('no tag')).toBeNull();
  });

  it('aggregate — 모델별 · 일별 · route별 합, 비용은 단가표, 모르는 모델은 비용에서 빠지고 따로 남는다, 월 추정 = 일평균 × 30', () => {
    const lines = [
      line(rec({ model: 'claude-sonnet-5-5', route: 'conversation-turn', tier: 'standard' }), '2026-10-16T03:00:00Z'),
      line(rec({}), '2026-10-16T04:00:00Z'),
      line(rec({ ok: false, in: 0, out: 0, status: 529 }), '2026-10-17T03:00:00Z'),
      line(rec({ model: 'mystery', provider: 'x' }), '2026-10-17T05:00:00Z'),
    ];
    const r = aggregate(entriesFromText(lines.join('\n')));
    const sonnet = estimateCostUsd('claude-sonnet-5-5', { in: 1_000_000, out: 100_000 });
    const haiku = estimateCostUsd('claude-haiku-5-5', { in: 1_000_000, out: 100_000 });
    expect(r.byModel.find((m) => m.model === 'claude-haiku-5-5')).toMatchObject({ calls: 2, ok: 1, in: 1_000_000, costUsd: haiku });
    expect(r.totalUsd).toBe(Number((sonnet + haiku).toFixed(6)));
    expect(r.unpriced).toEqual(['mystery']);
    expect(r.byDay.map((d) => [d.day, d.calls])).toEqual([['2026-10-16', 2], ['2026-10-17', 2]]);
    expect(r.projectedMonthlyUsd).toBe(Number((((sonnet + haiku) / 2) * 30).toFixed(6)));
    expect(r.byRoute.find((x) => x.route === 'conversation-turn')).toMatchObject({ model: 'claude-sonnet-5-5', costUsd: sonnet });
    expect(renderReport(r)).toContain('| 2026-10-16 | 2 |');
  });

  it('CLI — 파일을 읽어 표를 찍고, --json은 같은 집계를 JSON으로(네트워크 0)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cost-'));
    const file = path.join(dir, 'logs.txt');
    fs.writeFileSync(file, `${line(rec())}\n`);
    const md = execFileSync(process.execPath, ['scripts/eval/llm-cost-from-logs.mjs', file], { encoding: 'utf8' });
    expect(md).toContain('## 모델별');
    expect(md).toContain('claude-haiku-5-5');
    const json = JSON.parse(execFileSync(process.execPath, ['scripts/eval/llm-cost-from-logs.mjs', file, '--json'], { encoding: 'utf8' }));
    expect(json).toMatchObject({ lines: 1, days: 1 });
    fs.rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});
