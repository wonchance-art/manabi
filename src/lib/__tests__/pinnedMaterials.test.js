import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pickEvictions, MAX_MATERIALS, MAX_PINNED, TTL_MS } from '../offlineCache';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: v2-N R3 — 선택 다운로드(받아두기). 오너 "ㄱㄱ".
 *
 * 착수 실측이 정한 것 셋:
 *  ① 자동 캐시는 **뷰어에서 열 때만** 걸리고 상한 3의 LRU다 — 4번째를 열면 첫 자료가
 *    조용히 밀려난다. 그래서 "비행기 타기 전에 이거 챙겨가자"가 성립하지 않았다.
 *  ② 자료실 목록 조회에는 뷰어가 읽는 `raw_text`·`source_pdf_id`·`page_start`·
 *    `page_end`·`status`가 **없다**. 목록 행을 그대로 캐시하면 오프라인 뷰어에 빈 칸이
 *    생긴다 ⇒ 받아두기는 `select('*')` 1회가 필요하다.
 *  ③ 받아둔 자료를 뷰어에서 열면 자동 캐시가 같은 키를 덮어쓴다 ⇒ 핀 보존이 필요하다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const NOW = Date.parse('2026-08-31T00:00:00Z');
const day = 24 * 60 * 60 * 1000;
const ent = (id, daysAgo, pinned = false) =>
  ({ id, savedAt: NOW - daysAgo * day, ...(pinned ? { pinned: true } : {}) });

describe('N R3 — 받아둔 자료는 자동 축출에서 빠진다', () => {
  it('TTL이 지나도 받아둔 자료는 안 버린다 — 여행 8일째에 사라지면 받아둔 의미가 없다', () => {
    const old = ent('p1', 30, true);
    const oldAuto = ent('a1', 30);
    // 픽스처가 실제로 TTL을 넘겨야 이 검사가 성립한다.
    expect(NOW - old.savedAt).toBeGreaterThan(TTL_MS);
    const dropped = pickEvictions([old, oldAuto], { now: NOW, max: MAX_MATERIALS });
    expect(dropped, '자동분은 만료로 버린다').toContain('a1');
    expect(dropped, '받아둔 것은 만료가 없다').not.toContain('p1');
  });

  it('받아둔 자료가 자동 상한을 먹지 않는다 — 먹으면 3개 받아두는 순간 R1이 죽는다', () => {
    // 핀 3 + 자동 3 = 6개. 자동 상한이 3이므로 핀이 상한을 함께 쓰면 자동분이 전멸한다.
    const list = [
      ent('p1', 1, true), ent('p2', 2, true), ent('p3', 3, true),
      ent('a1', 1), ent('a2', 2), ent('a3', 3),
    ];
    const dropped = pickEvictions(list, { now: NOW, max: MAX_MATERIALS });
    expect(dropped, '자동 3개가 상한 안이라 하나도 안 버려야 한다').toEqual([]);
  });

  it('자동분의 LRU는 그대로다 — R1 동작을 바꾸지 않았다', () => {
    const list = [ent('a1', 1), ent('a2', 2), ent('a3', 3), ent('a4', 4)];
    expect(pickEvictions(list, { now: NOW, max: MAX_MATERIALS })).toEqual(['a4']);
  });

  it('받아두기에도 개수 상한은 있다 — 무제한이면 기기 용량을 사용자가 모르게 먹는다', () => {
    const many = Array.from({ length: MAX_PINNED + 2 }, (_, i) => ent(`p${i}`, i, true));
    // 픽스처가 상한을 실제로 넘겨야 성립한다(A 축에서 공허한 하한 검사에 두 번 물렸다).
    expect(many.length).toBeGreaterThan(MAX_PINNED);
    const dropped = pickEvictions(many, { now: NOW, max: MAX_MATERIALS });
    expect(dropped, '오래된 것부터 둘').toEqual([`p${MAX_PINNED + 1}`, `p${MAX_PINNED}`]);
  });

  it('두 상한은 별개다 — 자동 3, 받아두기 10', () => {
    expect(MAX_MATERIALS).toBe(3);
    expect(MAX_PINNED).toBe(10);
  });
});

describe('N R3 — 핀이 조용히 풀리지 않는다', () => {
  const cache = () => read('src/lib/offlineCache.js');

  it('뷰어 자동 캐시가 핀을 덮어쓰지 않는다 — 받아둔 자료를 열었다고 풀리면 안 된다', () => {
    // put()은 레코드를 통째로 교체한다. 이전 pinned를 안 읽으면 사용자가 챙긴 자료가
    // '열었다'는 이유만으로 자동 축출 대상이 된다.
    expect(cache()).toContain("const prev = await getRaw(STORE_MATERIALS, material.id);");
    expect(cache()).toContain("...(prev?.pinned ? { pinned: true } : {})");
  });

  it('받아둔 자료는 TTL 조회에도 걸리지 않는다 — 저장은 살아 있는데 안 열리면 같은 실패다', () => {
    expect(cache()).toContain('if (raw?.pinned) return raw.material || null;');
  });

  it('해제는 본문을 지우지 않는다 — 다시 자동 축출 대상이 될 뿐이다', () => {
    expect(cache()).toContain('await put(STORE_MATERIALS, { id, material: prev.material }, MAX_MATERIALS);');
  });
});

describe('N R3 — 배선', () => {
  const page = () => read('src/views/MaterialsPage.jsx');

  it('목록 행이 아니라 전체 행을 담는다 — 목록엔 뷰어가 읽는 5개 필드가 없다', () => {
    // 실측: 목록은 select('id, title, created_at, visibility, owner_id, processed_json'),
    // 뷰어는 raw_text·source_pdf_id·page_start·page_end·status도 읽는다.
    expect(page()).toContain(".from('reading_materials').select('*').eq('id', id).maybeSingle()");
    expect(page()).toContain('await cache.pinMaterial(data)');
  });

  it('카드 클릭을 가로챈다 — 받아두려다 자료가 열리면 그건 다른 동작이다', () => {
    expect(page()).toContain('onClick={(e) => { e.stopPropagation(); togglePin(m.id); }}');
  });

  it('배지 무리가 감긴다 — 버튼이 들어오며 320·360px에서 실제로 넘쳤다', () => {
    // 렌더 실측(최악 조합: 복습+같이읽기+시리즈 태그 + 점수·완독 배지 + 받아두기):
    // 버튼을 넣기 전 320/360px 넘침 0 → 넣은 뒤 문서 폭 386px로 넘침. 원인이 이 버튼임을
    // 버튼만 뺀 대조군으로 확인했다. wrap을 빼면 그 넘침이 그대로 돌아온다.
    expect(page()).toContain("flexWrap: 'wrap', justifyContent: 'flex-end'");
  });

  it('받아둔 게 없으면 「받아둔 것만」 칩 자체가 없다 — 늘 0인 칩은 고장으로 읽힌다', () => {
    expect(page()).toContain('{pinnedIds.size > 0 && (');
  });

  it('필터가 겹쳐 걸린다 — 「안 읽은 것만」과 배타가 아니다', () => {
    // 요구는 "핀 필터가 **안 읽은 것만의 결과**를 입력으로 받는다"이지 변수 이름이
    // 아니다. 이 라운드에서 F R3 계약 둘이 정확히 그 실수로 깨졌다 — 같은 병을
    // 새 계약에 옮겨 심지 않는다.
    const src = page();
    // 정렬 → 안읽음 → 핀 순으로 좁혀진다: 핀 필터의 입력이 sorted가 아니어야 한다.
    const pinFilter = sliceBetween(src, 'pinnedOnly ?', ';');
    expect(pinFilter).toContain('pinnedIds.has(m.id)');
    expect(pinFilter, '핀 필터가 정렬 원본을 받으면 두 칩이 배타가 된다')
      .not.toContain('sorted.filter');
  });

  it('기기 상태라 서버 쿼리 캐시에 얹지 않는다 — 기기마다 다른 게 정상이다', () => {
    expect(page(), '받아두기는 동기화 대상이 아니다').not.toMatch(/queryKey:\s*\[\s*'pinned/);
  });

  it('색은 토큰으로만 — 규약 §1', () => {
    // 앵커 슬라이스는 sliceBetween 정본만 — raw slice(…indexOf(는 contractHygiene이
    // 잡는다(이 라운드에서 내가 직접 물렸다).
    const block = sliceBetween(read('src/index.css'), '.mat-pin {', '.badge--coming-soon {');
    expect(block).toContain('var(--');
    expect(block, '색 리터럴 금지').not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });
});
