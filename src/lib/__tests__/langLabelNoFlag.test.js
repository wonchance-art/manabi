import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { LANG_NAME_KO } from '../constants.js';
import { REF_LANGS } from '../../content/refLangs.js';
import { REF_GRAMMAR_MANIFEST } from '../../content/refGrammarManifest.js';
import { CALLOUT_KINDS } from '../../views/refShared.jsx';

/**
 * 계약: 언어 표시는 글자다 — 국기 이모지 0 (LANG-LABEL-001 · 오너 결정 D-X6, 2026-10-12 KST).
 * 국기는 언어와 같지 않다(영어 = 🇬🇧? 🇺🇸?), 중국어를 繁體로 쓰는 학습자에게 🇨🇳은 민감할 수 있다.
 * 언어 이름은 정본 LANG_NAME_KO에서 나온다(새 이름 사전 0).
 * 스캔 대상: src/의 화면 코드 · 콘텐츠 · 스타일 · 문서(테스트 파일 제외 — 이 파일은 예시로 국기를 싣는다).
 */

const ROOT = 'src';
const SCAN_EXT = /\.(?:[cm]?js|jsx|ts|tsx|css|json|md)$/;
const TEST_FILE = /\.test\.[jt]sx?$/;
// 지역 표시 문자(Regional Indicator, U+1F1E6–U+1F1FF) — 둘이 짝을 이루면 국기로 그려진다.
// 하나만 있어도 국기 조각이므로 잡는다.
const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]+/gu;
// 예외 허용 목록 — { 'src/경로': '사유' }. 지금은 0이다. 추가하려면 오너 결정 근거를 사유에 적는다.
const ALLOWLIST = {};

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (SCAN_EXT.test(name) && !TEST_FILE.test(name)) out.push(p);
  }
  return out;
}

function findFlags(content) {
  const hits = [];
  for (const m of content.matchAll(REGIONAL_INDICATOR)) {
    hits.push({ line: content.slice(0, m.index).split('\n').length, text: m[0] });
  }
  return hits;
}

describe('언어 표시는 글자 — 국기 이모지 0 (LANG-LABEL-001)', () => {
  it('탐지기 자체가 국기를 잡는다 — 공허 통과 방지', () => {
    expect(findFlags('🇯🇵 일본어').map(h => h.text)).toEqual(['🇯🇵']);
    expect(findFlags('a\n🇬🇧 ↔ 🇫🇷').map(h => h.line)).toEqual([2, 2]);
    expect(findFlags('일본어 · 중국어 · 🚨 · 🈶 · 💡')).toEqual([]);
  });

  it('src/ 화면 코드 · 콘텐츠에 국기 이모지가 0개다(허용 목록 밖)', () => {
    const files = walk(ROOT, []);
    expect(files.length).toBeGreaterThan(500); // 스캐너 경로가 무너지면 여기서 잡힌다
    const violations = [];
    for (const f of files) {
      const rel = f.split(path.sep).join('/');
      if (Object.hasOwn(ALLOWLIST, rel)) continue;
      for (const hit of findFlags(fs.readFileSync(f, 'utf8'))) violations.push(`${rel}:${hit.line} ${hit.text}`);
    }
    expect(violations, '국기 대신 언어 이름 글자(LANG_NAME_KO)를 쓴다 — D-X6').toEqual([]);
  });

  it('허용 목록은 비어 있다 — 예외가 생기면 이 단언과 함께 사유를 고친다', () => {
    expect(ALLOWLIST).toEqual({});
  });

  it('레퍼런스 언어 데이터에 flag 필드가 없고 이름은 정본 LANG_NAME_KO다', () => {
    for (const [lang, ref] of Object.entries(REF_LANGS)) {
      expect(ref, lang).not.toHaveProperty('flag');
      expect(ref.name, lang).toBe(LANG_NAME_KO[lang]);
    }
    for (const [lang, manifest] of Object.entries(REF_GRAMMAR_MANIFEST.languages)) {
      expect(manifest, lang).not.toHaveProperty('flag');
      expect(manifest.name, lang).toBe(LANG_NAME_KO[lang]);
    }
  });

  it('비교 상자는 이름 글자로만 구분한다 — 「한국어와 비교」 · 「영어와 비교」', () => {
    expect(CALLOUT_KINDS.vsKo.label).toBe('한국어와 비교');
    expect(CALLOUT_KINDS.vsEn.label).toBe('영어와 비교');
    expect(Object.values(CALLOUT_KINDS).some(k => 'icon' in k)).toBe(false);
  });

  it('문법 복습은 국기 대신 langName 글자를 싣고 보인다(로그인 · 게스트 API 공통)', () => {
    const drills = fs.readFileSync('src/app/api/review/drills/route.js', 'utf8');
    const item = sliceBetween(drills, 'items.push({', 'quiz,');
    expect(item).toContain('langName: ref.name');
    expect(item).not.toMatch(/\bflag\b/);

    const page = fs.readFileSync('src/app/(app)/review/grammar/page.jsx', 'utf8');
    expect(page).not.toMatch(/\bflag\b/);

    const session = fs.readFileSync('src/views/GrammarReviewSession.jsx', 'utf8');
    const upcoming = sliceBetween(session, 'function UpcomingList', 'export default');
    expect(upcoming).toContain('{u.langName}');
    expect(session).not.toMatch(/\.flag\b/);
  });
});
