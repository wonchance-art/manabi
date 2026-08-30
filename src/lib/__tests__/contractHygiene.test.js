import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 메타 계약: 계약 위생 (v2-L, #1077 — 오너 확정 2026-08-30 1순위).
 * raw `slice(…indexOf(…))` 조합은 앵커 소실 시 빈 문자열 검사로 전락해 부정 단언이
 * 전량 자동 통과한다(공허 통과 — M2 돌연변이로 실측: `const handleTokenClick` 개명에도
 * 초록). 앵커 슬라이스는 반드시 helpers/sliceBetween(앵커 부재 throw)을 쓴다.
 * 이 파일 자체는 스캔에서 제외한다 — 금지 패턴을 정규식 리터럴로 싣기 때문.
 */

const ROOTS = ['src', 'scripts'];
const TEST_FILE = /\.test\.[jt]sx?$/;
// slice( 인자에 indexOf(/lastIndexOf( 호출이 낀 조합 — 닫는 괄호 전까지 훑는다.
// [^)]는 개행도 포함 — 줄을 나눠 써도 잡힌다(파일 전체 매칭).
const RAW_COMBO = /\.slice\([^)]*ndexOf\(/g;

function walkTestFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkTestFiles(p, out);
    else if (TEST_FILE.test(name)) out.push(p);
  }
  return out;
}

describe('계약 위생 — 공허 통과 구조 차단', () => {
  it('테스트 소스에 raw slice(…indexOf(…) 조합이 0이다 — 앵커 슬라이스는 sliceBetween만', () => {
    const files = ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => walkTestFiles(r, []));
    expect(files.length).toBeGreaterThan(100); // 스캐너 자체가 비면(경로 붕괴) 여기서 잡힌다
    const violations = [];
    for (const f of files) {
      if (f.endsWith('contractHygiene.test.js')) continue;
      const content = fs.readFileSync(f, 'utf8');
      for (const m of content.matchAll(RAW_COMBO)) {
        const line = content.slice(0, m.index).split('\n').length;
        violations.push(`${f}:${line} — ${m[0].replace(/\s+/g, ' ')}`);
      }
    }
    expect(violations, 'raw slice(…indexOf(…) 금지 — helpers/sliceBetween을 쓰라(앵커 소실 시 throw)').toEqual([]);
  });

  it('sliceBetween은 앵커가 없으면 즉시 throw — 공허 통과 대신 실패', () => {
    expect(() => sliceBetween('abc def', '없는앵커')).toThrow('앵커 없음(시작)');
    expect(() => sliceBetween('abc def', 'abc', '없는끝')).toThrow('앵커 없음(끝)');
  });

  it('sliceBetween 정상 경로 — 시작 포함·끝 미포함, 끝 생략 시 문자열 끝까지', () => {
    expect(sliceBetween('aa START mid END zz', 'START', 'END')).toBe('START mid ');
    expect(sliceBetween('aa START tail', 'START')).toBe('START tail');
    // 끝 앵커 탐색은 시작 이후부터 — 시작 앞에 있는 같은 문자열에 속지 않는다
    expect(sliceBetween('END aa START mid END zz', 'START', 'END')).toBe('START mid ');
  });
});
