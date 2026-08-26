import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** 주석을 걷어낸 코드 — 설명에 쓴 예시 문구가 계약에 잡히지 않게(반대로 필터를 주석
 *  처리해 놓고 통과하는 것도 막는다). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * cron 라우트 ↔ vercel.json 등록 계약.
 *
 * 배경(2026-08-25 실측): `/api/cron/send-forecast`는 라우트가 완성돼 있는데 vercel.json의
 * crons에 없어서 **한 번도 실행된 적이 없다**. 코드는 green, 테스트도 green, 배포도 성공 —
 * 그런데 기능은 없다. 라우트 파일과 등록 파일이 서로를 모르기 때문에 눈으로는 안 잡힌다
 * (#1136 '조회와 렌더가 300줄 떨어져 있어 안 잡힌다'와 같은 종류의 침묵).
 *
 * 그래서 여기서 못 박는다: cron 라우트는 **등록되거나, 왜 아직 등록 못 하는지 이유와 함께
 * 아래 목록에 있거나** 둘 중 하나다. 조용히 죽어 있는 세 번째 상태를 없앤다.
 */

// 아직 등록하지 못한 cron 라우트 — 반드시 이유를 적는다. 등록되는 순간 여기서 지운다.
// (2026-08-26 현재 비어 있다 — send-forecast가 등록되며 마지막 항목이 빠졌다.)
const PENDING = {};

const vercel = JSON.parse(read('vercel.json'));
const registered = new Set((vercel.crons || []).map((c) => c.path));
const routes = fs
  .readdirSync(path.join(root, 'src/app/api/cron'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

describe('cron 라우트 등록 계약', () => {
  it('cron 디렉터리가 비어 있지 않다 — 계약이 헛돌지 않게', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes)('/api/cron/%s — 등록됐거나 PENDING에 이유가 있다', (name) => {
    if (registered.has(`/api/cron/${name}`)) return;
    expect(
      PENDING[name],
      `cron 라우트 /api/cron/${name}가 vercel.json에 없다. 등록하거나, 못 하는 이유를 ` +
        'cronRegistration.test.js의 PENDING에 적어라 — 조용히 죽은 라우트를 남기지 않는다.',
    ).toBeTruthy();
  });

  it('PENDING 목록에 유령이 없다 — 등록됐거나 사라진 라우트는 지운다', () => {
    for (const name of Object.keys(PENDING)) {
      expect(routes, `PENDING의 ${name} 라우트가 존재하지 않는다`).toContain(name);
      expect(
        registered.has(`/api/cron/${name}`),
        `${name}는 이미 등록됐다 — PENDING에서 지워라`,
      ).toBe(false);
    }
  });

  it('등록된 cron은 전부 실제 라우트를 가리킨다', () => {
    for (const p of registered) {
      const name = p.replace('/api/cron/', '');
      expect(routes, `vercel.json이 없는 라우트 ${p}를 가리킨다`).toContain(name);
      expect(fs.existsSync(path.join(root, `src/app/api/cron/${name}/route.js`))).toBe(true);
    }
  });

  it('모든 cron이 하루 1회 이하 주기다 — Hobby 요금제의 실제 제약', () => {
    // 오해 정정(2026-08-26): Hobby의 제약은 "cron 2건"이 아니라 **주기**다. 개수는 모든
    // 플랜에서 100개이고, 하루 2회 이상 도는 스케줄은 **배포 단계에서 거부된다**.
    // 분·시가 둘 다 단일 숫자면 하루 최대 1회다(일·월·요일 필드는 빈도를 줄이기만 한다).
    for (const c of vercel.crons || []) {
      const [minute, hour] = String(c.schedule).trim().split(/\s+/);
      expect(minute, `${c.path}: 분 필드가 단일 값이어야 한다 (${c.schedule})`).toMatch(/^\d+$/);
      expect(hour, `${c.path}: 시 필드가 단일 값이어야 한다 (${c.schedule})`).toMatch(/^\d+$/);
    }
  });

  it('예보 푸시는 하루 1회 스케줄과 시각 무필터가 짝이다', () => {
    // 하루 1회인데 preferred_hour로 거르면 그 시각을 가진 소수만 받고 나머지는 조용히 빠진다.
    // Pro로 올려 매시로 바꾸는 날 **둘을 함께** 바꾸게 묶어 둔다.
    const route = codeOf(read('src/app/api/cron/send-forecast/route.js'));
    const cron = (vercel.crons || []).find((c) => c.path === '/api/cron/send-forecast');
    if (!cron) return;                       // 아직 미등록이면 위 PENDING 계약이 맡는다
    const [minute, hour] = String(cron.schedule).trim().split(/\s+/);
    const daily = /^\d+$/.test(minute) && /^\d+$/.test(hour);
    if (daily) {
      expect(route, '하루 1회 크론인데 preferred_hour로 거르면 대부분이 빠진다')
        .not.toMatch(/\.eq\(\s*'preferred_hour'/);
      expect(route, '중복 방지가 hasSentToday 하나뿐이므로 반드시 호출해야 한다')
        .toContain('hasSentToday(');
    } else {
      expect(route).toMatch(/\.eq\(\s*'preferred_hour'/);
    }
  });
});
