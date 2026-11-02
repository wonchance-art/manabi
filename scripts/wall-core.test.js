// 화면 벽 캡처 순수 부품(scripts/wall-core.mjs) · 장면 등록부(docs/design/scenes.json) 계약.
// 등록부가 실제 경로와 어긋나는 것(새 화면 · 지운 화면)은 실패로 막지 않는다 — 화면 벽 「빈칸」 보기가 보여 주고 설계 세션이 고친다
// (docs/design은 설계 세션 소유라, 다른 세션의 화면 추가가 이 폴더 수정을 강제하면 안 된다). 여기서는 등록부의 모양만 고정한다.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  coverage, discoverRoutes, expandScenes, judgeShot, loadRegistry, mergeVerdicts, missingValueLines, routeFromPageFile, validateRegistry,
} from './wall-core.mjs';

const root = join(import.meta.dirname, '..');
const registry = loadRegistry(join(root, 'docs', 'design', 'scenes.json'));

describe('경로 찾기', () => {
  it('라우트 묶음 (…)은 주소에서 빠진다', () => {
    expect(routeFromPageFile('(app)/viewer/[id]/page.jsx')).toBe('/viewer/[id]');
    expect(routeFromPageFile('(app)/home/(guest)/page.jsx')).toBe('/home');
    expect(routeFromPageFile('page.jsx')).toBe('/');
  });
  it('src/app의 page 파일만 센다(테스트 폴더 제외)', () => {
    const routes = discoverRoutes(join(root, 'src', 'app'));
    expect(routes).toContain('/');
    expect(routes).toContain('/viewer/[id]');
    expect(routes).toContain('/review/grammar');
    expect(routes.some(route => route.includes('__tests__'))).toBe(false);
  });
});

describe('장면 등록부', () => {
  it('모양 검사를 통과한다', () => {
    expect(validateRegistry(registry)).toEqual([]);
  });
  it('장면 id는 경로 × 사람으로 펼쳐지고 겹치지 않는다', () => {
    const scenes = expandScenes(registry);
    expect(scenes.length).toBeGreaterThan(0);
    expect(new Set(scenes.map(s => s.id)).size).toBe(scenes.length);
    for (const s of scenes) expect(s.id).toMatch(/^[a-z0-9-]+\.(guest|empty|filled)$/);
  });
  it('모양이 틀린 항목을 잡는다', () => {
    const bad = { lanes: ['배움'], personas: { guest: {} }, routes: [
      { route: '/a', scenes: [{ id: 'a', title: 'A', path: '/a', lane: '없는 줄', personas: ['guest'] }] },
      { route: '/a', exclude: '' },
      { route: '/b', via: '/c' },
      { route: '/d', scenes: [{ id: 'D', title: 'D', path: 'd', lane: '배움', personas: ['admin'] }] },
    ] };
    const errors = validateRegistry(bad);
    expect(errors.join('\n')).toMatch(/모르는 줄/);
    expect(errors.join('\n')).toMatch(/두 번/);
    expect(errors.join('\n')).toMatch(/via \/c에 장면이 없다/);
    expect(errors.join('\n')).toMatch(/id는 소문자/);
    expect(errors.join('\n')).toMatch(/모르는 사람 admin/);
  });
  it('빈칸 표는 등록 안 된 경로와 낡은 항목을 따로 보인다', () => {
    const reg = { lanes: ['x'], personas: { guest: {} }, routes: [
      { route: '/a', scenes: [{ id: 'a', title: 'A', path: '/a', lane: 'x', personas: ['guest'] }] },
      { route: '/gone', exclude: '사유' },
    ] };
    const { rows, stale } = coverage(reg, ['/a', '/new']);
    expect(rows).toEqual([
      { route: '/a', status: 'scene', personas: ['guest'], note: null, scenes: ['a'] },
      { route: '/new', status: 'unregistered', personas: [], note: null },
    ]);
    expect(stale).toEqual(['/gone']);
  });
});

describe('§3 객관 검사 판정', () => {
  const clean = { fontKR: true, overflowX: false, rawError: null, missing: [], axe: [], smallTargets: [], brokenImages: [], dataGap: null };
  it('위반이 없으면 ok', () => {
    expect(judgeShot(clean).verdict).toBe('ok');
  });
  it('원본 글꼴 실패 · 캡처 실패는 판정하지 않는다', () => {
    expect(judgeShot({ ...clean, fontKR: false }).verdict).toBe('skip');
    expect(judgeShot({ error: 'timeout' }).verdict).toBe('skip');
  });
  it('규약 위반은 수정 요청 — 데이터 부족보다 앞선다', () => {
    const judged = judgeShot({ ...clean, overflowX: true, scrollWidth: 420, innerWidth: 390, dataGap: '불러오지 못했어요',
      axe: [{ id: 'color-contrast', n: 2, samples: [{ summary: '「01」 #a57682/#fffefb 3.77:1 (23px)' }] }] });
    expect(judged.verdict).toBe('fix');
    expect(judged.reasons.map(r => r.t).join('\n')).toMatch(/가로 넘침 — 문서 너비 420px > 창 390px/);
    expect(judged.reasons.map(r => r.t).join('\n')).toMatch(/대비 AA 2곳/);
  });
  it('위반 없이 데이터 부족 문구만 보이면 data', () => {
    expect(judgeShot({ ...clean, dataGap: '불러오지 못했어요' }).verdict).toBe('data');
  });
  it('값 누락 노출은 낱말 경계로 잰다', () => {
    expect(missingValueLines('합계 NaN개\n괜찮은 줄\n이름: undefined')).toEqual(['합계 NaN개', '이름: undefined']);
    expect(missingValueLines('Annulled · nullify · undefinedness')).toEqual([]);
    expect(missingValueLines('{{name}}님 안녕하세요')).toEqual(['{{name}}님 안녕하세요']);
  });
  it('두 화면 크기 판정은 나쁜 쪽이 이기고, 같은 사유는 한 줄로 묶는다', () => {
    const fix = judgeShot({ ...clean, overflowX: true, scrollWidth: 400, innerWidth: 390 });
    const merged = mergeVerdicts({ mobile: fix, desktop: judgeShot(clean) });
    expect(merged.verdict).toBe('fix');
    expect(merged.reasons).toEqual([{ k: 'rule', t: fix.reasons[0].t, at: ['390'] }]);
    const both = mergeVerdicts({ mobile: judgeShot(clean), desktop: judgeShot(clean) });
    expect(both.verdict).toBe('ok');
    expect(both.reasons[0].at).toEqual(['390', '1280']);
  });
});
