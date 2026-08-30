import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { buildVersionView, kstBuildLabel, relativeKo, shouldShowVersionBadge } from '../versionBadge.js';
import { shortenCacheName } from '../swCache.js';

/**
 * 계약: v2-J 버전 배지 R1 (#1077 설계, 오너 발안·확정 2026-08-27 "?v=1 포함").
 * 설계 §5의 6계약을 그대로 심는다:
 * ① 커밋 메시지 미노출(SHA·브랜치·시각만) ② 관리자도 ?v=1도 debug_version도 아니면
 * DOM 렌더 0 ③ /api/version은 no-store ④ 로컬·미배포 dev 폴백 ⑤ GNB 폭 불변
 * ⑥ 폴링 금지(마운트 1회 + 수동 새로고침).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(cronRegistration·easierText 선례). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('② 노출 게이트 — 셋 중 하나가 아니면 렌더 0', () => {
  it('관리자·?v=1·debug_version이면 켜진다', () => {
    expect(shouldShowVersionBadge({ isAdmin: true })).toBe(true);
    expect(shouldShowVersionBadge({ search: '?v=1' })).toBe(true);
    expect(shouldShowVersionBadge({ search: '?foo=bar&v=1' })).toBe(true);
    expect(shouldShowVersionBadge({ debugFlag: '1' })).toBe(true);
  });

  it('일반 사용자는 어떤 조합에서도 꺼진다 — 존재 자체를 모른다', () => {
    expect(shouldShowVersionBadge({})).toBe(false);
    expect(shouldShowVersionBadge({ isAdmin: false, search: '', debugFlag: null })).toBe(false);
    expect(shouldShowVersionBadge({ search: '?other=1' })).toBe(false);
    expect(shouldShowVersionBadge({ search: '?v=0' })).toBe(false);
    expect(shouldShowVersionBadge({ search: '?v=' })).toBe(false);
  });

  it('컴포넌트가 게이트 미통과 시 null을 반환한다(DOM 0 — 숨김 CSS 아님)', () => {
    const badge = read('src/components/VersionBadge.jsx');
    expect(badge).toContain('if (!show) return null;');
    expect(badge).toContain('shouldShowVersionBadge({ isAdmin, search: window.location.search, debugFlag })');
  });
});

describe('④ dev 폴백 — 로컬·미배포에서 깨지지 않는다', () => {
  it('빌드 SHA가 없으면 local 상태 — 경고하지 않는다', () => {
    expect(buildVersionView({}).status).toBe('local');
    expect(buildVersionView({ buildSha: 'dev', serverSha: 'b41d0e8' }).status).toBe('local');
    expect(buildVersionView({}).sha).toBe('dev');
    expect(buildVersionView({}).ref).toBe('local');
  });

  it('next.config가 Vercel 자동 주입 env를 dev/local로 폴백한다', () => {
    const cfg = read('next.config.mjs');
    expect(cfg).toContain("NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev'");
    expect(cfg).toContain("NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF || 'local'");
  });
});

describe('Q1·Q2 — 배지는 표시기가 아니라 비교기다', () => {
  it('번들 SHA ≠ 서버 SHA면 stale(옛 번들을 보고 있다)', () => {
    expect(buildVersionView({ buildSha: 'a3f9c21', serverSha: 'b41d0e8' }).status).toBe('stale');
  });

  it('일치하거나 서버 응답 전이면 ok — 성급한 경고 금지', () => {
    expect(buildVersionView({ buildSha: 'a3f9c21', serverSha: 'a3f9c21' }).status).toBe('ok');
    expect(buildVersionView({ buildSha: 'a3f9c21', serverSha: null }).status).toBe('ok');
    // 서버가 dev(로컬 서버)면 비교 불가 — 경고하지 않는다
    expect(buildVersionView({ buildSha: 'a3f9c21', serverSha: 'dev' }).status).toBe('ok');
  });
});

describe('시각 표기 — KST 고정(규약)', () => {
  it('빌드 시각은 KST(UTC+9)로 적는다 — Z 표기 금지', () => {
    expect(kstBuildLabel('2026-08-27T05:02:00Z')).toBe('2026-08-27 14:02');
    expect(kstBuildLabel('2026-08-27T20:30:00Z')).toBe('2026-08-28 05:30'); // 날짜 넘김
    expect(kstBuildLabel('')).toBeNull();
    expect(kstBuildLabel('nonsense')).toBeNull();
  });

  it('상대 표기 — 분·시간·일, 시계 어긋남은 미래로 보이지 않게 접는다', () => {
    const now = Date.parse('2026-08-27T12:00:00Z');
    expect(relativeKo('2026-08-27T11:59:30Z', now)).toBe('방금');
    expect(relativeKo('2026-08-27T11:30:00Z', now)).toBe('30분 전');
    expect(relativeKo('2026-08-27T10:00:00Z', now)).toBe('2시간 전');
    expect(relativeKo('2026-08-25T12:00:00Z', now)).toBe('2일 전');
    expect(relativeKo('2026-08-27T12:30:00Z', now)).toBe('방금');
  });
});

describe('① 커밋 메시지 미노출 · ③ no-store · ⑥ 폴링 금지', () => {
  // 설명 주석이 계약을 무력화·오탐하지 않도록 코드만 대조한다(L 자기함정 클래스).
  const route = codeOf(read('src/app/api/version/route.js'));
  const badge = read('src/components/VersionBadge.jsx');

  it('① 라우트·배지가 싣는 것은 SHA·브랜치·시각뿐 — 커밋 메시지 계열 env 무접촉', () => {
    for (const leaked of ['COMMIT_MESSAGE', 'COMMIT_AUTHOR', 'VERCEL_GIT_COMMIT_MESSAGE']) {
      expect(route).not.toContain(leaked);
      expect(badge).not.toContain(leaked);
    }
  });

  it('③ /api/version은 no-store + 요청 시점 env(빌드 인라인 금지)', () => {
    expect(route).toContain("'cache-control': 'no-store, max-age=0'");
    expect(route).toContain("export const dynamic = 'force-dynamic'");
    // 요청 시점 값이어야 Q2 비교가 성립 — NEXT_PUBLIC_(빌드 인라인) 사용 금지
    expect(route).toContain('process.env.VERCEL_GIT_COMMIT_SHA');
    expect(route).not.toContain('NEXT_PUBLIC_BUILD_SHA');
  });

  it('⑥ 조회는 마운트 1회 — 타이머·폴링 부활 금지', () => {
    expect(badge).not.toMatch(/setInterval|setTimeout\([^)]*fetch|refetchInterval/);
    const effect = sliceBetween(badge, "fetch('/api/version'", 'if (!show) return null;');
    expect(effect).toContain('}, [show]);'); // show 전환 때만 — 폴링 아님
    expect(badge).toContain("fetch('/api/version', { cache: 'no-store' })");
  });
});

describe('⑤ GNB 레이아웃 불변 + 배선', () => {
  it('SHA 칸이 고정 폭이고 좁은 화면에서는 접힌다', () => {
    const css = read('src/index.css');
    const sha = sliceBetween(css, '.version-badge__sha {', '}');
    expect(sha).toContain('min-width: 7ch');
    expect(css).toMatch(/@media \(max-width: 1179px\) \{\s*\.version-badge__sha \{ display: none; \}/);
  });

  it('GNB에 배선돼 있다', () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).toContain("import VersionBadge from './VersionBadge'");
    expect(layout).toContain('<VersionBadge />');
  });
});

/* ── v2-J R2: SW 캐시 진단 + 자가 수리 ── */
describe('R2 캐시 비우기 — 층 분리가 생명', () => {
  const sw = codeOf(read('src/lib/swCache.js'));
  const badge = read('src/components/VersionBadge.jsx');

  it('학습 데이터(IndexedDB)는 절대 건드리지 않는다 — v2-N 오프라인 캐시 보호', () => {
    // CacheStorage = 앱 껍데기, IndexedDB = 학습 데이터. 이 경계가 무너지면
    // "캐시 비웠더니 지하철에서 단어장이 사라졌다"가 된다.
    for (const forbidden of ['indexedDB', 'deleteDatabase', 'localStorage.clear', 'offlineCache']) {
      expect(sw, `swCache가 ${forbidden}를 만지면 안 된다`).not.toContain(forbidden);
    }
    expect(codeOf(badge)).not.toContain('deleteDatabase');
  });

  it('앱 껍데기 캐시 + SW 등록만 정리한다 — 등록을 남기면 옛 워커가 다시 채운다', () => {
    expect(sw).toContain('caches.keys()');
    expect(sw).toContain('caches.delete(k)');
    expect(sw).toContain('getRegistrations');
    expect(sw).toContain('unregister()');
  });

  it('실패는 조용히 — 진단 도구가 화면을 깨뜨리지 않는다', () => {
    expect(sw).toContain("if (typeof caches === 'undefined') return [];");
    expect(sw).toMatch(/catch \{[\s\S]*?return \[\];/);
  });

  it('캐시명은 줄여 보여준다(콘텐츠 해시가 길다)', () => {
    expect(shortenCacheName('anatomy-studio-vebbf66b965be201d')).toBe('anatomy-studio-vebbf…');
    expect(shortenCacheName('short')).toBe('short');
    expect(shortenCacheName('')).toBe('');
  });

  it('배지 패널에 SW캐시 행·비우기 버튼·안전 문구가 있다', () => {
    expect(badge).toContain('<dt>SW캐시</dt>');
    expect(badge).toContain('캐시 비우고 새로고침');
    expect(badge).toContain('학습 데이터는 지우지 않아요');
  });

  it('캐시명 조회는 패널을 펼 때만 — 배지만 떠 있을 때 CacheStorage 무접촉', () => {
    expect(badge).toContain('if (!open || cacheNames !== null) return undefined;');
  });
});
