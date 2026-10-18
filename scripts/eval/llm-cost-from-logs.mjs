#!/usr/bin/env node
// LLM-COST-001 — Vercel 런타임 로그에서 내려받은 `[llm]` 줄로 모델별 토큰 · 추정 비용 · 일별(KST) 표를 만든다. 호출 0 · 네트워크 0.
//
// 왜: Claude 전환(LLM-CLAUDE-001) 뒤 월 비용(오너 Max 20x — 월 API 크레딧 200달러, 이월 없음)을 운영 텔레메트리로 본다.
//     운영 로그 접근은 오너 몫이라 이 스크립트는 오너가 내려받은 파일만 읽는다(에이전트가 운영 로그를 직접 읽지 않는다).
// 읽는 것: 각 줄의 `[llm] {…}` JSON에서 LLM_LOG_KEYS(route · tier · model · provider · fallbackDepth · ms · in · out · thinking · ok · status)만,
//          그리고 로그 레코드의 시각(timestamp · time · date 또는 줄 앞의 ISO 시각) 하나. 그 밖의 필드(요청 경로 · IP · 사용자 에이전트 ·
//          메시지의 나머지 등)는 읽지도 출력하지도 않는다. `[llm]` 줄 자체에는 프롬프트 · 사용자 식별자가 없다(llm.js 텔레메트리 계약).
// 입력 형식: 한 줄에 하나 — 평문(`2026-10-17T03:00:00Z … [llm] {…}`), JSON 줄({timestamp, message: "[llm] {…}"}), JSON 배열 파일,
//          CSV 칸 안의 `[llm] {""…""}`(따옴표 두 겹).
// 단가: src/lib/server/llm.js MODEL_PRICES(측정 표와 같은 값) — 추정이며 청구액이 아니다.
// 사용(Node 24, 리포 루트): node scripts/eval/llm-cost-from-logs.mjs <로그 파일…> [--json]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LLM_LOG_KEYS, MODEL_PRICES, PRICE_AS_OF, estimateCostUsd } from '../../src/lib/server/llm.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const TIME_FIELDS = ['timestamp', 'time', 'date', 'datetime', '@timestamp'];
const MESSAGE_FIELDS = ['message', 'msg', 'text', 'log'];
const ISO_RE = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;

/** 시각(ISO 문자열 · 밀리초 · 초) → KST 날짜 'YYYY-MM-DD'. 못 읽으면 null. */
export function kstDay(value) {
  if (value == null || value === '') return null;
  const str = String(value).trim().replace(' ', 'T');
  // 시간대 없는 ISO 시각은 UTC로 본다(실행 기기의 시간대에 따라 날짜가 갈리지 않게).
  const zoned = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(str) ? `${str}Z` : str;
  let ms = typeof value === 'number' ? value : /^\d+$/.test(str) ? Number(str) : Date.parse(zoned);
  if (!Number.isFinite(ms)) return null;
  if (ms < 1e12) ms *= 1000; // 초 단위
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `[llm] ` 뒤의 첫 JSON 객체 — 중괄호 짝으로 자른다. 허용 키만 남긴다. */
export function llmRecordFrom(message) {
  const text = String(message ?? '');
  const at = text.indexOf('[llm] ');
  if (at < 0) return null;
  const rest = text.slice(at + 6);
  const start = rest.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < rest.length; i++) {
    if (rest[i] === '{') depth++;
    else if (rest[i] === '}' && --depth === 0) { end = i; break; }
  }
  if (end < 0) return null;
  const raw = rest.slice(start, end + 1);
  let obj = null;
  for (const candidate of [raw, raw.replace(/""/g, '"'), raw.replace(/\\"/g, '"')]) {
    try { obj = JSON.parse(candidate); break; } catch { /* 다음 꼴 */ }
  }
  if (!obj || typeof obj !== 'object' || !('model' in obj) || !('ok' in obj)) return null;
  const rec = {};
  for (const key of LLM_LOG_KEYS) rec[key] = obj[key] ?? null;
  return rec;
}

/** 로그 한 줄(또는 JSON 레코드 하나) → { day, rec } | null. 레코드에서는 시각과 메시지만 본다. */
export function parseLogEntry(entry) {
  if (entry && typeof entry === 'object') {
    const message = MESSAGE_FIELDS.map((k) => entry[k]).find((v) => typeof v === 'string' && v.includes('[llm] '));
    const rec = llmRecordFrom(message);
    if (!rec) return null;
    const time = TIME_FIELDS.map((k) => entry[k]).find((v) => v != null && v !== '');
    return { day: kstDay(time) ?? kstDay(ISO_RE.exec(message)?.[0]), rec };
  }
  const line = String(entry ?? '');
  if (!line.includes('[llm] ')) return null;
  const trimmed = line.trim();
  if (trimmed.startsWith('{')) {
    try { return parseLogEntry(JSON.parse(trimmed)); } catch { /* 평문으로 */ }
  }
  const rec = llmRecordFrom(line);
  if (!rec) return null;
  return { day: kstDay(ISO_RE.exec(line.slice(0, line.indexOf('[llm] ')))?.[0]), rec };
}

/** 파일 내용 → 항목 목록. JSON 배열 파일은 레코드별, 그 밖은 줄별. */
export function entriesFromText(text) {
  const t = String(text ?? '').trim();
  if (t.startsWith('[') && !t.startsWith('[llm]')) {
    try { const arr = JSON.parse(t); if (Array.isArray(arr)) return arr; } catch { /* 줄 단위 */ }
  }
  return t.split(/\r?\n/);
}

const round = (x) => Number(x.toFixed(6));

/** 항목들 → 모델별 · 일별 · route별 합과 추정 비용. 단가를 모르는 모델의 비용은 null(합계에서 빠지고 unpriced에 남는다). */
export function aggregate(entries) {
  const models = new Map();
  const days = new Map();
  const routes = new Map();
  let lines = 0;
  for (const entry of entries) {
    const hit = parseLogEntry(entry);
    if (!hit) continue;
    lines++;
    const { rec } = hit;
    const day = hit.day ?? '날짜 없음';
    const model = rec.model ?? 'none';
    const usage = { in: Number(rec.in) || 0, out: Number(rec.out) || 0, thinking: Number(rec.thinking) || 0 };
    const cost = estimateCostUsd(model, usage);
    const bump = (map, key, init) => {
      const row = map.get(key) || { ...init, calls: 0, ok: 0, in: 0, out: 0, thinking: 0, costUsd: 0, unpricedCalls: 0 };
      row.calls++;
      if (rec.ok === true) row.ok++;
      row.in += usage.in; row.out += usage.out; row.thinking += usage.thinking;
      if (cost == null) { if (usage.in || usage.out || usage.thinking) row.unpricedCalls++; } else row.costUsd = round(row.costUsd + cost);
      map.set(key, row);
    };
    bump(models, model, { model, provider: rec.provider ?? MODEL_PRICES[model]?.provider ?? null });
    bump(days, day, { day });
    bump(routes, `${rec.route ?? '(none)'}\u0000${model}`, { route: rec.route ?? null, model });
  }
  const byModel = [...models.values()].sort((a, b) => b.costUsd - a.costUsd);
  const byDay = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  const byRoute = [...routes.values()].sort((a, b) => b.costUsd - a.costUsd);
  const totalUsd = round(byModel.reduce((a, r) => a + r.costUsd, 0));
  const dated = byDay.filter((d) => d.day !== '날짜 없음');
  // 월 추정 = 날짜가 있는 날의 일평균 × 30. 첫날 · 마지막 날이 하루 전체가 아니면 과소 · 과대 — 며칠 이상 모아 볼 것.
  const projectedMonthlyUsd = dated.length ? round((dated.reduce((a, d) => a + d.costUsd, 0) / dated.length) * 30) : null;
  return {
    priceAsOf: PRICE_AS_OF, lines, totalUsd, days: dated.length, projectedMonthlyUsd,
    unpriced: byModel.filter((r) => r.unpricedCalls).map((r) => r.model),
    byModel, byDay, byRoute,
  };
}

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const usd = (n) => (n == null ? '—' : `$${Number(n).toFixed(4)}`);
function table(headers, rows) {
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** 사람이 읽는 보고(마크다운 표). */
export function renderReport(result) {
  return [
    `# LLM 추정 비용 — [llm] 로그 ${fmt(result.lines)}줄 · 단가 기준 ${result.priceAsOf}`,
    `합계 ${usd(result.totalUsd)} · 날짜 ${result.days}일 · 월 추정(일평균 × 30) ${usd(result.projectedMonthlyUsd)}`,
    result.unpriced.length ? `단가표에 없는 모델(비용에서 빠짐): ${result.unpriced.join(', ')}` : '',
    '', '## 모델별',
    table(['모델', '제공자', '호출', '성공', '입력', '출력', '추론', '추정 비용'],
      result.byModel.map((r) => [r.model, r.provider ?? '—', fmt(r.calls), fmt(r.ok), fmt(r.in), fmt(r.out), fmt(r.thinking), usd(r.costUsd)])),
    '', '## 일별(KST)',
    table(['날짜', '호출', '성공', '입력', '출력 + 추론', '추정 비용'],
      result.byDay.map((r) => [r.day, fmt(r.calls), fmt(r.ok), fmt(r.in), fmt(r.out + r.thinking), usd(r.costUsd)])),
    '', '## route · 모델별',
    table(['route', '모델', '호출', '입력', '출력 + 추론', '추정 비용'],
      result.byRoute.map((r) => [r.route ?? '—', r.model, fmt(r.calls), fmt(r.in), fmt(r.out + r.thinking), usd(r.costUsd)])),
  ].filter((x) => x !== null).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('사용: node scripts/eval/llm-cost-from-logs.mjs <로그 파일…> [--json]');
    process.exit(2);
  }
  const entries = files.flatMap((f) => entriesFromText(readFileSync(f, 'utf8')));
  const result = aggregate(entries);
  console.log(args.includes('--json') ? JSON.stringify(result, null, 1) : renderReport(result));
}
