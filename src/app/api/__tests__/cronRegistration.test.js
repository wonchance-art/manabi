import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

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
const PENDING = {
  'send-forecast':
    'Vercel Hobby는 cron 2건이 상한인데 fetch-suggestions·backfill-ipa가 이미 차지했다. ' +
    '오너 결정 대기: ⑴ Pro 전환 ⑵ backfill-ipa 슬롯 양보 ⑶ fetch-suggestions에 합병.',
};

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

  it('cron 2건 상한 — Hobby 요금제 결합점(늘리려면 요금제부터)', () => {
    // Vercel Hobby는 cron job 2개가 상한이다. 3번째를 추가하면 배포가 거부된다.
    // 요금제를 올려 상한이 바뀌면 이 숫자와 PENDING을 함께 고친다 — 그게 이 핀의 목적이다.
    expect((vercel.crons || []).length).toBeLessThanOrEqual(2);
  });
});
