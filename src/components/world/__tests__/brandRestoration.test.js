import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CITY_NODES as FUKUOKA } from '../cities/fukuoka';
import { CITY_NODES as TOKYO } from '../cities/tokyo';

/**
 * 계약: 브랜드 복원 R1 (#1077, IP 정책 v2 — 오너 확정 2026-08-31).
 *
 * 2026-07-24 IP 판정에서 A그룹 9건을 일반화하며 실명을 지우고 **없는 고유명 + 그 직역
 * 요미**를 넣었다. 그 요미가 틀렸다 — 広場를 こうじょう(工場)로, 商店街를 しょうてんが로
 * (い 누락), 大濠公園을 こ ぱーく라는 조어로. `refsLang: 'ja'` 노드의 학습 보조 표기라
 * **학습자에게 그대로 노출**됐다. 즉 이 라운드의 명분은 브랜드가 아니라 **학습 정확성**이다.
 *
 * 지킬 것은 카피 문구가 아니라 세 가지 **요구**다:
 *   ① 창작 고유명을 만들지 않는다(동어반복 = 일반화가 이름 자리에 설명을 복사한 흔적)
 *   ② 확인된 가짜 요미가 되살아나지 않는다
 *   ③ 파사드·챕터·id와 노드 이름이 같은 대상을 가리킨다
 * 스탬프 우주는 불변 — 바뀌는 것은 이름·설명뿐이다.
 */

const CITY_DIR = path.join(process.cwd(), 'src/components/world/cities');

// 조사·구두점·공백을 걷어낸 뒤 비교한다. '강변의 현대미술관 「강변 현대미술관」'처럼
// 조사 한 글자만 다른 동어반복을 잡기 위해서다.
const norm = (s) => s.replace(/[\s의·,()]/g, '');

describe('브랜드 복원 R1 — 창작 고유명 금지', () => {
  it('전 도시 desc: 「」 안 이름이 바로 앞 설명의 반복이 아니다', () => {
    // 「설명 「같은 설명」」은 일반화가 고유명 자리에 설명을 복사해 넣은 자국이다.
    // 이 스캔은 R1에서 고친 3건(QAGOMA·MCG·DDP)을 실제로 잡아냈고, R2 전수 스캔의
    // 상시 판이기도 하다 — 새 도시가 같은 자국을 남기면 여기서 걸린다.
    const files = fs.readdirSync(CITY_DIR).filter((f) => f.endsWith('.js') && !f.endsWith('.geo.js'));
    expect(files.length).toBeGreaterThan(10); // 스캐너가 비면(경로 붕괴) 여기서 잡힌다

    const violations = [];
    for (const file of files) {
      const src = fs.readFileSync(path.join(CITY_DIR, file), 'utf8');
      // 따옴표·개행을 제외해 한 문자열 리터럴 안에서만 앞 문맥을 본다.
      for (const m of src.matchAll(/([^'"`\n]{0,40})「([^」\n]{1,60})」/g)) {
        const inner = norm(m[2]);
        if (inner.length >= 4 && norm(m[1]).endsWith(inner)) {
          violations.push(`${file}: 「${m[2]}」`);
        }
      }
    }
    expect(violations, '고유명 자리에 설명이 복사됨(일반화 흔적) — 실재명을 쓰거나 이름 없이 서술하라').toEqual([]);
  });

  // ── R2 전수 스캔의 상시 판 (2026-08-31, 오너 "ㄱㄱ") ──
  it('전 도시: 순한글 이름에 외국어 읽기가 붙지 않는다 — 지어낸 요미의 서명', () => {
    // R1이 고친 가짜 요미 4건은 전부 이 꼴이었다:
    //   「호숫가 공원」(こ ぱーく) · 「에비스의 복합 광장」(えびす の ふくごう こうじょう)
    //   「나카노 서브컬처 상점가」(なかの さぶかるちゃー しょうてんが) · 「하카타 항 부두 광장」(…)
    // **한국어 구절에는 일본어 독음이 있을 수 없다** — 실명을 지우고 그 자리에 한국어
    // 설명을 넣은 뒤, 없는 이름을 직역해 요미를 지어냈을 때만 나오는 구조다.
    // 집 관례는 정반대 순서다: 「실명(한글 읽기)」(「Place de la Bourse」·「錦市場」(にしきいちば)).
    // 그래서 kana뿐 아니라 **모든 외국 문자**를 읽기 자리에서 본다 — zh·fr 도시까지 덮는다.
    //
    // R2 전수 스캔(도시 파일 32종) 실측 = **잔여 0건**. 일반화 피해는 R1 범위에 갇혀 있었다.
    // 오탐으로 확인하고 남겨 둔 3건(재확인 반복 방지):
    //   bordeaux 「물의 거울」 — 노드 실명 「Place de la Bourse」는 살아 있고 본문 속 부차 언급
    //   lyon 「정석 한 바퀴」 — 코드 주석의 동선 표현, 지명이 아님
    //   lyon 「트라불」 — 같은 파일이 이미 `트라불(traboule)`로 실명을 준다
    // 셋 다 읽기 괄호가 없어 이 계약에는 걸리지 않는다.
    const files = fs.readdirSync(CITY_DIR).filter((f) => f.endsWith('.js') && !f.endsWith('.geo.js'));
    expect(files.length).toBeGreaterThan(10);

    const HANGUL = /[가-힣]/;
    const FOREIGN = /[ぁ-んァ-ヴ一-鿿A-Za-zÀ-ÿ]/;
    const violations = [];
    for (const file of files) {
      const src = fs.readFileSync(path.join(CITY_DIR, file), 'utf8');
      for (const m of src.matchAll(/「([^」\n]{1,60})」\s*\(([^)\n]{1,80})\)/g)) {
        const [, name, reading] = m;
        if (HANGUL.test(name) && !FOREIGN.test(name) && FOREIGN.test(reading)) {
          violations.push(`${file}: 「${name}」(${reading})`);
        }
      }
    }
    expect(violations, '한국어 이름에 외국어 요미 — 실명을 지우고 요미를 지어낸 자국이다').toEqual([]);
  });

  it('확인된 가짜 요미가 되살아나지 않는다', () => {
    const sources = ['fukuoka.js', 'tokyo.js']
      .map((f) => fs.readFileSync(path.join(CITY_DIR, f), 'utf8'))
      .join('\n');

    // 広場는 ひろば다 — こうじょう는 工場. 두 노드가 같은 오류를 공유했다.
    expect(sources, '広場를 こうじょう로 읽는 표기 부활').not.toMatch(/ふとう こうじょう|ふくごう こうじょう/);
    // 商店街는 しょうてんがい — い 누락.
    expect(sources, 'しょうてんが(い 누락) 부활').not.toMatch(/しょうてんが[^い]/);
    // 실재하지 않는 조어.
    expect(sources, '조어 요미 こ ぱーく 부활').not.toContain('こ ぱーく');
  });
});

describe('브랜드 복원 R1 — 복원 값과 불변 조건', () => {
  const byId = (nodes, id) => nodes.find((n) => n.id === id);

  it('후쿠오카 4건이 실명으로 돌아왔다', () => {
    expect(byId(FUKUOKA, 'bayside-place')?.name).toBe('ベイサイドプレイス博多');
    expect(byId(FUKUOKA, 'nakasu')?.name).toBe('ドン・キホーテ');
    expect(byId(FUKUOKA, 'fukuoka-ippudo')?.name).toBe('一風堂');
    expect(byId(FUKUOKA, 'ohori-park')?.name).toBe('大濠公園');
  });

  it('도쿄 2건이 실명으로 돌아왔다', () => {
    expect(byId(TOKYO, 'ebisu-garden-place')?.name).toBe('恵比寿ガーデンプレイス');
    expect(byId(TOKYO, 'nakano-broadway')?.name).toBe('中野ブロードウェイ');
  });

  it('요미는 표준 독음이다 — 출처 대조로 확정한 값', () => {
    // 大濠公園=おおほりこうえん(리포 내부 역 id `ohori-koen`·지구 라벨과도 일치),
    // 一風堂=いっぷうどう(노드 id `fukuoka-ippudo`와 일치). 둘 다 외부 사전 대조 완료.
    expect(byId(FUKUOKA, 'ohori-park')?.desc).toContain('おおほりこうえん');
    expect(byId(FUKUOKA, 'fukuoka-ippudo')?.desc).toContain('いっぷうどう');
    expect(byId(TOKYO, 'nakano-broadway')?.desc).toContain('なかのブロードウェイ');
  });

  it('스탬프 우주·라우팅 불변 — 이름만 바뀐다', () => {
    // 설계 계약 4: 이름 변경이 앨범 분모나 도어 라우팅을 건드리면 안 된다.
    for (const id of ['bayside-place', 'nakasu', 'fukuoka-ippudo', 'ohori-park']) {
      const node = byId(FUKUOKA, id);
      expect(node?.noStamp, `${id}: noStamp 유지`).toBe(true);
      expect(Array.isArray(node?.tile), `${id}: tile 유지`).toBe(true);
    }
    for (const id of ['ebisu-garden-place', 'nakano-broadway']) {
      const node = byId(TOKYO, id);
      expect(node?.noStamp, `${id}: noStamp 유지`).toBe(true);
      expect(Array.isArray(node?.tile), `${id}: tile 유지`).toBe(true);
    }
  });
});
