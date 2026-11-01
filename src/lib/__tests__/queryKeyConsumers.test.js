import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HOME_DATA_KEY } from '../homeQueryKey.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 학습 무효화가 부르는 react-query 키는 실제로 어느 화면이 쓰는 키다 (STATS-MAP-001, 2026-11-01 KST).
 *
 * ── 왜 생겼나
 *
 * 배움(홈) 키를 'home-v2' → 'home-v3'으로 올릴 때 채점 · 아는 표시 · 제외 · 읽던 위치 무효화 넷이 옛 이름에 남았다.
 * react-query는 없는 키를 무효화해도 조용하다 — 복습 · 아는 표시 뒤 홈의 「N개 대기」 · 오늘 목표가 최대 60초(staleTime)
 * 낡아 보였고 어떤 테스트도 잡지 못했다. 프로필 저장 뒤 무효화는 아예 ['home']이었다.
 *
 * ── 무엇을 재는가
 *
 * 학습 무효화 목록(채점 · 아는 표시 · 제외)과 홈을 무효화하는 곳의 키가 전부 「정의된 키」(useQuery 등의 queryKey 리터럴,
 * 또는 그 파일의 const key)에 있는가. 홈 키는 정본 상수 HOME_DATA_KEY 하나로만 쓴다.
 */

const ROOT = process.cwd();
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const INVALIDATE = /(invalidateQueries|refetchQueries|cancelQueries|removeQueries|resetQueries|setQueryData|getQueryData|getQueryState|setQueriesData)/;

function sourceFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === '__mock__' ? [] : sourceFiles(rel);
    return /\.(js|jsx)$/.test(entry.name) ? [rel] : [];
  });
}

/** 화면이 실제로 쓰는 키 앞머리 — 무효화 줄이 아닌 queryKey 리터럴과 `const key = ['…'` + 홈 상수. */
function definedKeys() {
  const keys = new Set([HOME_DATA_KEY]);
  for (const file of sourceFiles('src')) {
    for (const line of read(file).split('\n')) {
      if (INVALIDATE.test(line)) continue;
      for (const m of line.matchAll(/(?:queryKey:\s*|const key = )\[\s*'([\w-]+)'/g)) keys.add(m[1]);
    }
  }
  return keys;
}

const quoted = block => [...block.matchAll(/'([\w-]+)'/g)].map(m => m[1]);
const LISTS = {
  'src/lib/useVocabData.js': ['return Promise.all([', '.map(prefix'],
  'src/lib/useKnownWords.js': ['const KNOWN_CONSUMERS = [', '];'],
  'src/lib/useVocabularyExclusions.js': ['for (const prefix of [', '])'],
};

describe('학습 무효화 키 — 정의된 키만', () => {
  const defined = definedKeys();

  it('정의된 키를 실제로 읽어낸다 — 스캐너가 죽으면 아래 단언이 공허해진다', () => {
    for (const key of ['vocab', 'profile-stats', 'weekly-report', 'known-words', 'confused-events']) expect(defined.has(key), key).toBe(true);
    expect(defined.size).toBeGreaterThan(40);
  });

  it.each(Object.entries(LISTS))('%s 무효화 목록이 정의된 키와 홈 상수를 쓴다', (file, [from, to]) => {
    const block = sliceBetween(read(file), from, to);
    expect(block, `${file}: 홈은 HOME_DATA_KEY로`).toContain('HOME_DATA_KEY');
    const stale = quoted(block).filter(key => !defined.has(key));
    expect(stale, `${file}: 어느 화면도 쓰지 않는 키를 무효화한다`).toEqual([]);
  });

  it('홈 키는 상수 하나 — 화면 · 읽던 위치 · 프로필 저장이 같은 이름을 쓴다', () => {
    expect(read('src/views/HomePage.jsx')).toMatch(/queryKey: \[HOME_DATA_KEY, user\?\.id\]/);
    expect(read('src/lib/useScrollRestore.js')).toContain('queryKey: [HOME_DATA_KEY, owner]');
    expect(read('src/views/MyPage.jsx')).toContain('queryKey: [HOME_DATA_KEY, user.id]');
    const literal = sourceFiles('src').filter(file => file !== path.join('src/lib/homeQueryKey.js'))
      .filter(file => /\[\s*'home(-v\d+)?'\s*,/.test(read(file)));
    expect(literal, '홈 키를 글자로 다시 쓰지 않는다').toEqual([]);
  });
});
