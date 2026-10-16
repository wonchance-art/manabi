// 프로필 공개 범위(PROFILES-PRIVACY-001, 오너 승인 2026-10-17 KST) — 남의 행은 public_profiles view(id · display_name · avatar_url, 운영 20261016165910)로만.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
  return /\.(m?js|jsx)$/u.test(name) ? [full] : [];
});
const files = walk(path.join(ROOT, 'src')).map((file) => [path.relative(ROOT, file), readFileSync(file, 'utf8')]);

describe('profiles 개인정보 — 남의 행은 public_profiles(id · display_name · avatar_url)로만', () => {
  it('클라이언트 embed는 profiles가 아니라 public_profiles를 쓴다(관리자 화면만 예외)', () => {
    const offenders = files.filter(([rel, src]) => rel !== 'src/views/AdminPage.jsx' && /:profiles\(/u.test(src)).map(([rel]) => rel);
    expect(offenders).toEqual([]);
    expect(files.find(([rel]) => rel === 'src/lib/useMaterialComments.js')[1]).toContain('author:public_profiles(display_name)');
  });

  it('public_profiles embed는 세 열 밖을 고르지 않는다', () => {
    for (const [rel, src] of files) {
      for (const [, cols] of src.matchAll(/public_profiles\(([^)]*)\)/gu)) {
        expect(cols.split(',').map((c) => c.trim()).every((c) => ['id', 'display_name', 'avatar_url'].includes(c)), rel).toBe(true);
      }
    }
  });

  it('클라이언트는 xp · 연속 기록 · 역할을 profiles에 직접 쓰지 않는다(보안 정의자 경로만)', () => {
    const writes = files.flatMap(([rel, src]) => [...src.matchAll(/from\('profiles'\)\s*\.(?:update|upsert)\(([\s\S]{0,400}?)\)/gu)].map((m) => [rel, m[1]]));
    for (const [rel, body] of writes) {
      if (rel === 'src/views/AdminPage.jsx') continue; // 역할 변경은 서버 경로로 옮길 때 이 예외를 지운다
      expect(body, rel).not.toMatch(/\b(xp|streak_count|streak_freeze_count|last_streak_date|role)\b/u);
    }
  });
});
