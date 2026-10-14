import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ZH_HSK_2026_LEVEL from '../data/zhHsk2026Level.json';
import ZH_HSK_2021_LEVEL from '../data/zhHskLevel.json';
import { loadZhHskLevels, zhHskLevelLabel, zhHskLevelOf, zhHskProfile } from '../zhHskLevel.js';
import {
  HSK2026_OUTPUT, HSK2026_SOURCE, buildZhHsk2026Levels, serializeZhHsk2026Levels,
} from '../../../scripts/build-zh-hsk2026.mjs';

// 계약: HSK 2026 단어 급수 표 (ZH-LEVEL-2026-001 ① — 오너 결정 2026-10-13 KST: 화면 급수 기준은 HSK 2026).
// 원천 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행) 词汇大纲 11,000항목
// = docs/design/hsk2026/words.json. 동형어 번호를 떼고 같은 표기는 가장 낮은 급수, 괄호 급수는 앞 급수.

const SOURCE = JSON.parse(fs.readFileSync(HSK2026_SOURCE, 'utf8'));
const entries = Object.entries(ZH_HSK_2026_LEVEL);

describe('zhHsk2026Level.json — 원천과의 대응', () => {
  it('원천 11,000항목 → 같은 표기 합침 뒤 10,896단어', () => {
    expect(SOURCE.length).toBe(11000);
    expect(entries.length).toBe(10896);
    expect(new Set(SOURCE.map((e) => e.headword ?? e.word)).size).toBe(entries.length);
  });

  it('급수별 개수 고정 — 1급 300 · 2급 197 · 3급 491 · 4급 990 · 5급 1,579 · 6급 1,777 · 7–9급 5,562', () => {
    const counts = {};
    for (const [, l] of entries) counts[l] = (counts[l] || 0) + 1;
    expect(counts).toEqual({ 1: 300, 2: 197, 3: 491, 4: 990, 5: 1579, 6: 1777, 7: 5562 });
  });

  it('신선도 — 생성기를 원천에 다시 돌린 바이트와 같다(손편집·원천 갱신 누락을 잡는다)', () => {
    const rebuilt = serializeZhHsk2026Levels(buildZhHsk2026Levels(SOURCE));
    expect(fs.readFileSync(HSK2026_OUTPUT, 'utf8') === rebuilt).toBe(true);
  });

  it('형식 전수 — 키는 한자(동형어 번호 없음), 값은 1~7 정수, 코드포인트 오름차순', () => {
    const bad = entries.filter(([k, v]) => !/^[一-鿿]+$/.test(k) || !Number.isInteger(v) || v < 1 || v > 7);
    expect(bad.map(([k]) => k)).toEqual([]);
    const keys = entries.map(([k]) => k);
    expect(keys).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it('합침 규칙 스팟 — 동형어 번호·괄호 급수·같은 표기 다른 소리', () => {
    expect(SOURCE.find((e) => e.word === '本1')).toBeTruthy();
    expect(ZH_HSK_2026_LEVEL['本']).toBe(1); // 本1(1급) · 本2 → 本
    expect(ZH_HSK_2026_LEVEL['本1']).toBeUndefined();
    expect(SOURCE.find((e) => e.word === '半').level_raw).toBe('1（4）');
    expect(ZH_HSK_2026_LEVEL['半']).toBe(1); // 괄호 급수는 앞 급수
    const huan = SOURCE.filter((e) => e.word === '还').map((e) => e.level);
    expect(huan.length).toBeGreaterThan(1);
    expect(ZH_HSK_2026_LEVEL['还']).toBe(Math.min(...huan.map(Number)));
  });

  it('2021 표와 다른 급수 스팟 — 같은 단어도 표마다 급수가 다르다(学院 1 → 4, 走 1 → 2)', () => {
    expect(ZH_HSK_2021_LEVEL['学院']).toBe(1);
    expect(ZH_HSK_2026_LEVEL['学院']).toBe(4);
    expect(ZH_HSK_2021_LEVEL['走']).toBe(1);
    expect(ZH_HSK_2026_LEVEL['走']).toBe(2);
    expect(ZH_HSK_2026_LEVEL['吃饭']).toBeUndefined(); // 2026에서 빠진 투명 합성어
    expect(ZH_HSK_2026_LEVEL['你好']).toBe(1);         // 2026에 새로 든 말
  });
});

describe('zhHskLevelOf · zhHskLevelLabel — 화면 급수 조회 하나', () => {
  it('조회 — 2026 표 급수, 표 밖·표 없음·프로토타입 키는 null', () => {
    expect(zhHskLevelOf('学院', ZH_HSK_2026_LEVEL)).toBe(4);
    expect(zhHskLevelOf('癌', ZH_HSK_2026_LEVEL)).toBe(7);
    expect(zhHskLevelOf('吃饭', ZH_HSK_2026_LEVEL)).toBeNull();
    expect(zhHskLevelOf('学院', null)).toBeNull();
    expect(zhHskLevelOf('', ZH_HSK_2026_LEVEL)).toBeNull();
    expect(zhHskLevelOf('constructor', ZH_HSK_2026_LEVEL)).toBeNull();
  });

  it('라벨 — 1~6은 「HSK n」, 7은 「HSK 7–9」, 그 외 표시 없음', () => {
    expect(zhHskLevelLabel(1)).toBe('HSK 1');
    expect(zhHskLevelLabel(6)).toBe('HSK 6');
    expect(zhHskLevelLabel(7)).toBe('HSK 7–9');
    for (const v of [null, undefined, 0, 8, 'H1', 2.5]) expect(zhHskLevelLabel(v)).toBeNull();
  });

  it('지연 로드 — 같은 표를 1회 받아 캐시한다', async () => {
    const a = await loadZhHskLevels();
    const b = await loadZhHskLevels();
    expect(a).toBe(b);
    expect(a['学院']).toBe(4);
  });

  it('프로필 — 표가 아직 없으면 전부 미등재', () => {
    const p = zhHskProfile([{ key: '爱', text: '爱', base_form: '爱' }], {}, null);
    expect(p.tagged).toBe(0);
    expect(p.untagged).toBe(1);
  });
});

describe('src/lib/data/README.md 출처 줄', () => {
  it('zhHsk2026Level.json 줄이 원천·생성기를 적는다', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'src/lib/data/README.md'), 'utf8');
    const line = readme.split('\n').find((l) => l.includes('`zhHsk2026Level.json`'));
    expect(line).toContain('HSK 考试大纲');
    expect(line).toContain('scripts/build-zh-hsk2026.mjs');
  });
});
