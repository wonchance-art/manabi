import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { loadRefVocabIndex, loadZhRefShard } from '../refVocabIndex';
import { ZH_REF_CACHE, ZH_REF_SHARDS, ZH_REF_VERSION, fetchZhRefShard, zhRefShardEntries, zhRefShardOf, zhRefShardUrl } from '../zhRefShards';
import { GET, dynamic, dynamicParams, generateStaticParams } from '../../app/api/zh-ref/[shard]/route.js';

// 중국어 참고 사전 조각(ZH-REFVOCAB-SHARD-001, 2026-11-08 KST) — 뷰어가 자료를 열자마자 사전 전체(JS 청크 39개 · 폰 1.8MB · PC 4.2MB 전송)를
// 받던 것을, 낱말 · 한자 창이 그 글자의 조각 하나만 받게 바꿨다. 조각이 카드 · 한자 창에 필요한 항목을 빠짐없이 담는지, 정적으로 굽는지,
// 뷰어가 고르기 전에 받지 않는지를 고정한다.
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('조각 규칙 — 카드 · 한자 창이 쓰는 항목을 빠짐없이', () => {
  it('조각 번호 = 첫 글자 코드포인트 % 256 · 빈 값은 -1 · 주소는 배포 판을 단다', () => {
    expect(ZH_REF_SHARDS).toBe(256);
    expect(zhRefShardOf('你好')).toBe('你'.codePointAt(0) % 256);
    expect(zhRefShardOf('')).toBe(-1);
    expect(zhRefShardUrl(7, 'abc1234')).toBe('/api/zh-ref/7?v=abc1234');
  });

  it('실제 사전: 모든 단어는 자기 첫 글자 조각에 있고(카드), 글자 조각은 그 글자를 가진 단어 전부를 담는다(한자 창) · 항목은 전체 색인과 같다', async () => {
    const index = await loadRefVocabIndex('Chinese');
    expect(index.size).toBeGreaterThan(10000);
    const shards = Array.from({ length: ZH_REF_SHARDS }, (_, n) => zhRefShardEntries(index, n));
    for (const [word, entry] of index) {
      expect(shards[zhRefShardOf(word)][word], word).toBe(entry);
      for (const ch of new Set(word)) expect(shards[zhRefShardOf(ch)][word], `${word} · ${ch}`).toBe(entry);
    }
    // 조각이 커지면 낱말 첫 선택이 늦어진다(1.6Mbps에서 7KB ≈ 0.04s) — 가장 큰 조각을 묶는다(지금 약 27KB).
    const sizes = shards.map((s) => zlib.brotliCompressSync(Buffer.from(JSON.stringify(s))).length);
    expect(Math.max(...sizes)).toBeLessThan(40 * 1024);
  }, 60_000);
});

describe('정적 경로 /api/zh-ref/<n>', () => {
  it('빌드 때 256개를 굽는다(force-static · 그 밖 번호는 없음)', () => {
    expect(dynamic).toBe('force-static');
    expect(dynamicParams).toBe(false);
    const params = generateStaticParams();
    expect(params).toHaveLength(256);
    expect(params[0]).toEqual({ shard: '0' });
    expect(params[255]).toEqual({ shard: '255' });
  });

  it('응답 = { version, shard, entries } · 캐시 머리 · 받기 함수가 그대로 Map으로 읽는다 · 모르는 번호는 404', async () => {
    const shard = zhRefShardOf('你好');
    const res = await GET(new Request('https://x/api/zh-ref/1'), { params: Promise.resolve({ shard: String(shard) }) });
    expect(res.headers.get('cache-control')).toBe(ZH_REF_CACHE);
    const body = await res.clone().json();
    expect(body.version).toBe(ZH_REF_VERSION);
    expect(body.entries['你好'].level).toBe('H1');
    const map = await fetchZhRefShard(shard, { fetchImpl: async () => res });
    expect(map.get('你好').word.pinyin).toBe('nǐhǎo');
    expect((await GET(new Request('https://x'), { params: Promise.resolve({ shard: '256' }) })).status).toBe(404);
    await expect(fetchZhRefShard(shard, { fetchImpl: async () => Response.json({ version: 0 }) })).rejects.toThrow();
  }, 60_000);
});

describe('뷰어 배선 — 고르기 전에는 받지 않는다', () => {
  it('ViewerPage는 전체 색인 훅을 부르지 않는다 · 한자 창 색인은 창이 열린 글자로만', () => {
    const page = read('src/views/ViewerPage.jsx');
    expect(page).not.toMatch(/useRefVocabIndex\(/);
    expect(page).not.toMatch(/loadRefVocabIndex\(/);
    expect(page).toContain('useZhRefPopoverIndex(hanjaPopoverMode && inspectChar ? inspectChar.ch : null)');
    const hooks = read('src/lib/refVocabIndex.js');
    expect(hooks).toMatch(/const key = language === 'Chinese' && word \? word : null;/); // 빈 낱말이면 받지 않는다
  });

  it('조각을 못 받으면 전체 색인으로 물러난다(끊김 · 옛 배포)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    try {
      const map = await loadZhRefShard('学院');
      expect(map.get('学院')).toBe((await loadRefVocabIndex('Chinese')).get('学院'));
    } finally { fetchSpy.mockRestore(); }
  }, 60_000);
});
