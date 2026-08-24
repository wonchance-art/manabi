import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildZhPosWriteback, resolveZhTokenPos } from '../disambiguateZhPos.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * user_verified 보호 범위 계약 — **오너 확정 2026-08-24: "DB 무손상까지"**.
 *
 * zh 판별 캐시 조사(docs/research-zh-disambig-cache.md §4)가 남긴 미해결 질문의 답이다.
 * 두 갈래가 있었다: ⑴ DB 행을 덮지 않는다 ⑵ 화면 표시에서도 모델보다 절대 우선한다.
 * 오너는 ⑴로 확정했다. 그래서 이 파일은 **양쪽을 다 못 박는다** — 지켜야 할 것(쓰기 금지)과
 * 지키지 않기로 한 것(표시 우선 아님)을 함께 고정해야, 나중에 "표시도 우선이어야 하는 것
 * 아니냐"는 오독이 조용한 동작 변경으로 들어오지 않는다.
 */
describe('user_verified 보호 = DB 무손상 (오너 확정 2026-08-24)', () => {
  it('자가 치유 writeback 목록에서 user_verified 행이 빠진다', () => {
    const marks = [{ key: '0:学习', word: '学习' }, { key: '0:工作', word: '工作' }];
    const picks = new Map([
      ['0:学习', { pos: '동사', all: ['동사', '명사'] }],
      ['0:工作', { pos: '명사', all: ['명사', '동사'] }],
    ]);
    const cache = new Map([
      ['学习', { pos: '동사', source: 'user_verified' }], // 오너 확정 — 손대지 않는다
      ['工作', { pos: '명사', source: 'gemini' }],        // 자가 치유 대상
    ]);
    const out = buildZhPosWriteback(marks, picks, cache);
    const written = out.flatMap((row) => row.baseForms);
    expect(written).toContain('工作');
    expect(written).not.toContain('学习');
  });

  it('DB 쓰기 경로가 source=gemini 조건을 이중으로 건다 — 목록이 뚫려도 update가 막는다', () => {
    const route = read('src/app/api/analyze/route.js');
    // 라우트의 writeback update는 반드시 source='gemini'로 좁혀야 한다(최후 방어선).
    expect(route).toMatch(/buildZhPosWriteback[\s\S]{0,600}?\.eq\('source',\s*'gemini'\)/);
  });

  it('영어 뜻 백필도 user_verified를 neq로 제외한다(같은 계약의 en 쪽)', () => {
    expect(read('src/lib/server/fetchMeanings.js')).toContain("'user_verified'");
  });
});

describe('보호 범위 밖 — 화면 표시는 문맥 판별이 우선한다(의도적)', () => {
  it('문맥 pick이 있으면 캐시 POS보다 앞선다 — 표시 우선은 계약이 아니다', () => {
    const resolved = resolveZhTokenPos({
      pick: { pos: '명사', all: ['명사', '동사'] },
      cachedPos: '동사',   // user_verified 행이어도 표시는 pick을 따른다
      tokenPos: '동사',
      tokenPosAll: null,
    });
    expect(resolved.pos).toBe('명사');
    expect(resolved.posAll).toBe('명사·동사');
  });

  it('pick이 없으면 캐시 POS로 되돌아간다 — 판별 실패가 표시를 망가뜨리지 않는다', () => {
    const resolved = resolveZhTokenPos({ pick: null, cachedPos: '동사', tokenPos: null, tokenPosAll: null });
    expect(resolved.pos).toBe('동사');
  });
});
