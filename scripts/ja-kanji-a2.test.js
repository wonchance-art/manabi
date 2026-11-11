// 공개 N5 표기 전환(A-2) 고정표 · 생성기 계약(JA-KANJI-A-001 · 2026-11-11 KST).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenizeJaLine } from '../src/lib/server/tokenizeJa';
import { dataSql, furiganaFor, kanjiText, loadSpec, stems } from './ja-kanji-a2.mjs';

const spec = loadSpec();
const migration = readFileSync(new URL('../supabase/migrations/20261111010000_ja_n5_kanji_a2.sql', import.meta.url), 'utf8');

describe('ja-kanji-a2 생성기', () => {
  it('어간 — 공통 끝(오쿠리가나)을 뗀다 · 활용형은 한자 어간 + 원래 가나 꼬리', () => {
    expect(stems('食べる', 'たべる')).toEqual(['食', 'た']);
    expect(stems('忙しい', 'いそがしい')).toEqual(['忙', 'いそが']);
    expect(kanjiText(spec, 'たべ', '食べる', '동사')).toBe('食べ');
    expect(kanjiText(spec, 'たかく', '高い', '형용사')).toBe('高く');
    expect(kanjiText(spec, 'いそがしかっ', '忙しい', '형용사')).toBe('忙しかっ');
    expect(kanjiText(spec, 'あさごはん', '朝御飯', '명사')).toBe('朝ご飯');
    expect(kanjiText(spec, 'のみ', '飲む', '동사')).toBe('飲み');
    expect(kanjiText(spec, 'あるい', '歩く', '동사')).toBe('歩い');
    expect(kanjiText(spec, 'ある', 'ある', '동사')).toBeNull(); // 가나 유지 낱말은 write에 없다
  });

  it('후리가나 — 명사류 = 원래 가나 · 동사 · 형용사 = 기본형 읽기(운영 관례) · 日本 = にほん', () => {
    expect(furiganaFor(spec, 'にほん', '日本', '명사')).toBe('にほん');
    expect(furiganaFor(spec, 'たべ', '食べる', '동사')).toBe('たべる');
  });

  it('마이그레이션 데이터 칸이 고정표에서 지금 만든 값과 같다(고정표를 고치면 node scripts/ja-kanji-a2.mjs로 다시 쓴다)', () => {
    const block = migration.split('-- jka-data:begin\n')[1].split('\n-- jka-data:end')[0];
    expect(block).toBe(dataSql(spec));
  });

  it('고정표 불변식 — 보정 조각을 이으면 옛 문자열 · 가나 유지와 자연 표기가 겹치지 않음 · 기대 개수 합', () => {
    for (const f of spec.fixes) expect(f.pieces.map((p) => p.kana).join(''), `${f.id} ${f.keys}`).toBe(f.old);
    for (const k of spec.a2.keepKanaA2) expect(spec.a2.write[k], k).toBeUndefined();
    expect(spec.expected.totals).toEqual({ ruleHits: 251, converted: 175, fixKeys: 86 });
    expect(spec.fixes.reduce((n, f) => n + f.keys.length, 0)).toBe(86);
    expect(spec.a2.convertIds).toHaveLength(14);
    expect(spec.a2.kanaPhaseIds).toHaveLength(11);
  });
});

describe('표제어 이어짐 — 앞 과 가나 토큰 base_form = 뒤 과 한자 토큰 base_form', () => {
  // 한자 본문은 운영 분석기가 분석한다. 고정표가 가나 토큰에 준 표제어가 분석기가 한자 표기에서 내는 표제어와 같아야
  // 저장 단어 · 아는 말(bases 대조)이 앞 과 가나 ↔ 뒤 과 한자로 이어진다. 합성어 분할(별도 과제)만 예외로 적는다.
  const COMPOUND_SPLIT = new Set(['誕生日', '朝御飯', '昼御飯']);
  it('자연 표기 134어 — 분석기가 한자 표기를 한 토큰 · 같은 표제어로 낸다(합성어 3어 예외)', async () => {
    const bad = [];
    for (const [base, [text]] of Object.entries(spec.a2.write)) {
      if (COMPOUND_SPLIT.has(base)) continue;
      const toks = (await tokenizeJaLine(text)).filter((t) => t.pos !== '기호');
      if (toks.length !== 1 || toks[0].base_form !== base) bad.push(`${base}: ${toks.map((t) => `${t.text}[${t.base_form}]`).join(' ')}`);
    }
    expect(bad).toEqual([]);
  }, 60_000);
  it('합성어 예외는 실제로 나뉜다(고쳐지면 예외에서 뺀다)', async () => {
    for (const base of COMPOUND_SPLIT) {
      const toks = (await tokenizeJaLine(spec.a2.write[base][0])).filter((t) => t.pos !== '기호');
      expect(toks.length, base).toBeGreaterThan(1);
    }
  });
});
