import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { bcp47ForLanguage, voicePrefixForLanguage } from '../speechLang.js';

// 계약: 언어→Web Speech 태그 단일 소스 — 매핑이 컴포넌트마다 흩어져 중국어·불어
// 자료가 영어 보이스로 낭독되던 실결함(전수 조사 발견)의 재발 방지.

describe('speechLang — 매핑 정본', () => {
  it('네 자료 언어 전부 자기 보이스 태그를 받는다(중국어 누락이 원래 결함)', () => {
    expect(bcp47ForLanguage('Japanese')).toBe('ja-JP');
    expect(bcp47ForLanguage('Chinese')).toBe('zh-CN');
    expect(bcp47ForLanguage('French')).toBe('fr-FR');
    expect(bcp47ForLanguage('English')).toBe('en-US');
  });

  it('축약 코드도 받고, 미지 언어는 기존 폴백(en-US) 유지', () => {
    expect(bcp47ForLanguage('zh')).toBe('zh-CN');
    expect(bcp47ForLanguage('ja')).toBe('ja-JP');
    expect(bcp47ForLanguage('Korean')).toBe('en-US');
    expect(bcp47ForLanguage(undefined)).toBe('en-US');
  });

  it('보이스 접두는 태그의 언어부', () => {
    expect(voicePrefixForLanguage('Chinese')).toBe('zh');
    expect(voicePrefixForLanguage('Japanese')).toBe('ja');
  });
});

describe('배선 계약 — 소비처가 정본을 쓴다(인라인 삼항 부활 금지)', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

  it('ListenControls: 낭독 utterance가 정본 태그를 쓴다', () => {
    const src = read('src/components/ListenControls.jsx');
    expect(src).toContain("import { bcp47ForLanguage } from '../lib/speechLang'");
    expect(src).toContain('utter.lang = bcp47ForLanguage(languageRef.current)');
    expect(src).not.toMatch(/'Japanese' \? 'ja-JP' : 'en-US'/);
  });

  it('useTTS: 폴백 utterance·보이스 선택·저장 키 전부 정본을 쓴다', () => {
    const src = read('src/lib/useTTS.js');
    expect(src).toContain("import { bcp47ForLanguage, voicePrefixForLanguage } from './speechLang'");
    expect(src).toContain('utter.lang = bcp47ForLanguage(language)');
    expect(src).toContain('loadStoredVoice(voicePrefixForLanguage(');
    expect(src).not.toMatch(/lang === 'Japanese' \|\| lang === 'ja' \? 'ja-JP'/);
  });
});
