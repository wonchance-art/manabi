import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// GRANTS-EXPLICIT-001 — Supabase는 2026-10-30부터 public 새 테이블에 자동 권한을 주지 않는다(supabase/discussions/45329).
// 마이그레이션이 만드는 테이블은 권한을 마이그레이션에 적어 둔다 — 자동 권한에 기대면 새 DB(스테이징 · 브랜치 · 로컬)에서 42501로 막힌다.
const DIR = path.join(process.cwd(), 'supabase/migrations');
const BOUNDARY = '20261029060000';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const code = sql => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
const created = sql => [...code(sql).matchAll(/create table (?:if not exists )?(?:public\.)?"?(\w+)"?\s*\(/g)].map(m => m[1]);
// 「GRANT … ON [TABLE] a, public.b TO authenticated|service_role」(로그인 · 서버가 쓰는 권한) 또는
// 「REVOKE ALL ON … FROM anon, authenticated」(일부러 닫은 표 — world_sessions)만 명시로 센다. anon 회수만 있는 것은 명시가 아니다
// (review_events가 그랬다 — anon 회수 · TRUNCATE 회수만 있고 authenticated 권한은 자동 권한뿐).
const names = list => list.split(',').map(name => name.trim().replace(/^public\./, '').replaceAll('"', ''));
function granted(sql) {
  const out = new Set(), text = code(sql);
  for (const m of text.matchAll(/\bgrant\b[^;]*?\bon\s+(?:table\s+)?([\w."\s,]+?)\s+to\s+([^;]+);/g)) {
    if (/\b(?:authenticated|service_role)\b/.test(m[2])) names(m[1]).forEach(name => out.add(name));
  }
  for (const m of text.matchAll(/\brevoke\s+all\b[^;]*?\bon\s+(?:table\s+)?([\w."\s,]+?)\s+from\s+([^;]+);/g)) {
    if (/\banon\b/.test(m[2]) && /\bauthenticated\b/.test(m[2])) names(m[1]).forEach(name => out.add(name));
  }
  return out;
}

describe('GRANTS-EXPLICIT-001 — 마이그레이션 테이블의 Data API 권한 명시', () => {
  it('마이그레이션이 만드는 public 테이블은 모두 어딘가의 마이그레이션에 GRANT · REVOKE가 있다(자동 권한에 기대지 않는다)', () => {
    const all = new Set(files.flatMap(f => [...granted(read(f))]));
    const missing = [...new Set(files.flatMap(f => created(read(f))))].filter(t => !all.has(t)).sort();
    expect(missing).toEqual([]);
  });

  it(`${BOUNDARY} 이후 새 테이블은 만드는 그 파일에 권한을 함께 적는다`, () => {
    const late = files.filter(f => f.slice(0, 14) > BOUNDARY)
      .flatMap(f => created(read(f)).filter(t => !granted(read(f)).has(t)).map(t => `${f}: ${t}`));
    expect(late).toEqual([]);
  });

  it('복습 테이블 둘(요청 범위)은 정책과 같은 명령만 — 오답 이벤트는 append-only라 SELECT · INSERT뿐', () => {
    const sql = code(read(`${BOUNDARY}_explicit_data_api_grants.sql`));
    expect(sql).toContain('grant select, insert, update, delete on public.grammar_review to authenticated;');
    expect(sql).toContain('grant select, insert on public.review_events to authenticated;');
    expect(sql).not.toMatch(/on [^;]*review_events[^;]* to anon/);
  });

  it('새 DB 검증(PGlite, 자동 권한 없음)이 CI에서 돈다', () => {
    expect(fs.readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('node supabase/tests/explicit-data-api-grants.mjs');
  });

  it('음성 대조 — GRANT가 빠진 새 테이블은 위 판정이 잡는다', () => {
    const sql = 'create table public.new_thing(id int);\nalter table public.new_thing enable row level security;';
    expect(created(sql)).toEqual(['new_thing']);
    expect(granted(sql).has('new_thing')).toBe(false);
    expect(granted(`${sql}\ngrant select on table public.new_thing, public.other to authenticated;`).has('new_thing')).toBe(true);
    expect(granted(`${sql}\nrevoke all on public.new_thing from anon;\ngrant select on public.new_thing to anon;`).has('new_thing')).toBe(false);
    expect(granted(`${sql}\nrevoke all on table public.new_thing from anon, authenticated;`).has('new_thing')).toBe(true);
  });
});
