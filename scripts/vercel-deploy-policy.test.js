import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// 배포 정책(오너 「ㄱㄱ」 2026-10-16 KST — 자동 배포 권장안): claude/* 브랜치는 Git 배포를 열되, 빌드는
// 커밋 메시지에 [preview]가 있을 때만(무료 플랜 일일 배포 한도 보호). codex 계열은 그대로 닫아 둔다.
const ROOT = path.resolve(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const ignore = (ref, message) => spawnSync('bash', [path.join(ROOT, 'scripts/vercel-ignore.sh')], {
  env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref, VERCEL_GIT_COMMIT_MESSAGE: message },
}).status;

describe('Vercel 배포 정책', () => {
  it('claude/*는 Git 배포를 막지 않고, codex 계열은 막아 둔다', () => {
    const enabled = vercel.git.deploymentEnabled;
    expect(enabled['claude/*']).not.toBe(false);
    expect(enabled['codex/*']).toBe(false);
    expect(enabled['codex2/*']).toBe(false);
  });
  it('에이전트 실험 브랜치(claude/wip/**)는 Git 배포를 만들지 않는다 — 건너뛴 배포도 일일 100회 한도에 든다(2026-10-17 KST 한도 소진 실측, 오너 「권장대로 진행」)', () => {
    const enabled = vercel.git.deploymentEnabled;
    expect(enabled['claude/wip/**']).toBe(false);
    // PR 브랜치(claude/<세션>)는 그대로 열려 있다 — wip 규칙이 claude/* 전체를 덮지 않는다.
    expect(Object.entries(enabled).filter(([k, v]) => v === false && /^claude\/(\*|\*\*)$/.test(k))).toEqual([]);
    expect(vercel.ignoreCommand).toBe('bash scripts/vercel-ignore.sh');
  });
  it('서버 함수는 DB(Supabase ap-northeast-1)와 같은 도쿄(hnd1)에서 돈다 — 오너 「도쿄 ㄱㄱ」 2026-10-16', () => {
    // 기본 iad1(미국 동부)에서는 DB 조회마다 태평양 왕복이었다(PERF-TAB-001 실측).
    expect(vercel.regions).toEqual(['hnd1']);
  });
  it('빌드는 main이거나 [preview] 커밋일 때만(exit 1 = 빌드, 0 = 건너뜀)', () => {
    expect(ignore('main', 'fix: anything')).toBe(1);
    expect(ignore('claude/x', 'feat: 화면 [preview]')).toBe(1);
    expect(ignore('claude/x', 'feat: 화면')).toBe(0);
  });
});
