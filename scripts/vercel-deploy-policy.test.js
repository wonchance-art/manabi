import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// 배포 정책 — 무료 플랜 일일 배포 한도(최근 24시간 100건) 보호.
// 2026-10-16 KST 오너 「ㄱㄱ」: claude/* Git 배포는 열되 빌드는 [preview] 커밋만 — 그런데 빌드를 건너뛴 배포도 한도에 든다.
// 2026-11-07 KST 오너 「ㄱㄱ」(ⓑ안): 하루 기록 146건으로 한도 소진(건너뛴 프리뷰 97 · 운영 49, 세션 지정 브랜치 두 개가 프리뷰의 63%) →
// claude/**는 Git 배포 기록 자체를 만들지 않고, 프리뷰가 필요하면 claude/preview/<주제> 브랜치로 보낸다. codex 계열은 그대로 닫아 둔다.
const ROOT = path.resolve(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const enabled = vercel.git.deploymentEnabled;
const ignore = (ref, message) => spawnSync('bash', [path.join(ROOT, 'scripts/vercel-ignore.sh')], {
  env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref, VERCEL_GIT_COMMIT_MESSAGE: message },
}).status;

// Vercel 규칙(docs/project-configuration/git-configuration): 키는 minimatch 문법, 적지 않은 브랜치는 true,
// 여러 규칙에 걸리면 **하나라도 true면** 배포한다. 여기 쓰는 패턴(`*` = 한 칸, `**` = 여러 칸)만 옮긴다.
const toRegExp = (glob) => new RegExp(`^${glob.split('/').map((part) => (part === '**' ? '.*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))).join('/').replace(/\/\.\*$/, '(/.*)?')}$`);
const deploys = (branch) => {
  const hits = Object.entries(enabled).filter(([glob]) => toRegExp(glob).test(branch));
  return hits.length === 0 || hits.some(([, on]) => on === true);
};

describe('Vercel 배포 정책', () => {
  it('패턴 해석이 Vercel 문서 예시와 같다(하나라도 true면 배포 · 안 걸리면 배포)', () => {
    expect(toRegExp('claude/**').test('claude/preview/x')).toBe(true);
    expect(toRegExp('claude/**').test('claude/x')).toBe(true);
    expect(toRegExp('codex/*').test('codex/a/b')).toBe(false);
  });

  it('main은 Git 배포 · 빌드 둘 다 한다', () => {
    expect(deploys('main')).toBe(true);
    expect(ignore('main', 'fix: anything')).toBe(1);
  });

  it('claude/** 작업 · 세션 지정 · wip 브랜치는 배포 기록을 만들지 않는다 — 건너뛴 배포도 일일 한도에 든다', () => {
    for (const branch of ['claude/studies-rest', 'claude/practical-carson-umi0t8', 'claude/wip/topic', 'claude/a/b']) {
      expect(deploys(branch), branch).toBe(false);
    }
    expect(enabled['claude/wip/**']).toBe(false);
  });

  it('프리뷰는 claude/preview/<주제> 브랜치로만 — Git 배포를 열고 커밋마다 빌드한다', () => {
    expect(enabled['claude/preview/**']).toBe(true);
    expect(deploys('claude/preview/mockup-x')).toBe(true);
    expect(ignore('claude/preview/mockup-x', 'feat: 화면')).toBe(1);
  });

  it('codex 계열은 닫아 둔다 · ignoreCommand는 그대로', () => {
    expect(deploys('codex/x')).toBe(false);
    expect(deploys('codex2/x')).toBe(false);
    expect(vercel.ignoreCommand).toBe('bash scripts/vercel-ignore.sh');
  });

  it('그 밖의 브랜치는 [preview] 커밋일 때만 빌드한다(exit 1 = 빌드, 0 = 건너뜀)', () => {
    expect(ignore('feature/x', 'feat: 화면 [preview]')).toBe(1);
    expect(ignore('feature/x', 'feat: 화면')).toBe(0);
  });

  it('서버 함수는 DB(Supabase ap-northeast-1)와 같은 도쿄(hnd1)에서 돈다 — 오너 「도쿄 ㄱㄱ」 2026-10-16', () => {
    // 기본 iad1(미국 동부)에서는 DB 조회마다 태평양 왕복이었다(PERF-TAB-001 실측).
    expect(vercel.regions).toEqual(['hnd1']);
  });
});
