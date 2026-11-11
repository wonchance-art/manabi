import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { kanaSpellingReading, toHiragana } from '../jaKanaSpelling.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 가나로 쓴 낱말의 카드 칩(JA-KANJI-A-MOCK-001 ③-b, 오너 「권장대로」 2026-11-11 KST).
 * 읽기 일치 = 「한자 표기」 + 표제어 읽기, 활용형 = 「기본형」 그대로, 한자로 쓴 토큰 카드는 변화 없음.
 * 목업: https://claude.ai/artifact/8LJQkLiDFZyozWn5ACSXjY
 */
describe('kanaSpellingReading — 가나 표면이 한자 기본형의 읽기일 때만', () => {
  it('명사 — がっこう · 学校, こうえん · 公園는 그 가나가 읽기다', () => {
    expect(kanaSpellingReading('がっこう', '学校')).toBe('がっこう');
    expect(kanaSpellingReading('こうえん', '公園')).toBe('こうえん');
    expect(kanaSpellingReading('しんかんせん', '新幹線')).toBe('しんかんせん');
  });
  it('사전 읽기가 있으면 그것과 같아야 한다(가타카나 · 히라가나는 같은 읽기로 본다)', () => {
    expect(kanaSpellingReading('がっこう', '学校', 'がっこう')).toBe('がっこう');
    expect(kanaSpellingReading('ガッコウ', '学校', 'がっこう')).toBe('ガッコウ');
    expect(kanaSpellingReading('がっこ', '学校', 'がっこう')).toBeNull();
  });
  it('활용형은 아니다 — 사전 읽기와 다르거나 기본형 끝 가나(送り仮名)가 표면 끝과 다르다', () => {
    expect(kanaSpellingReading('あるい', '歩く', 'あるく')).toBeNull();
    expect(kanaSpellingReading('あるい', '歩く')).toBeNull();
    expect(kanaSpellingReading('たべ', '食べる')).toBeNull();
    expect(kanaSpellingReading('はたらき', '働く')).toBeNull();
    // 사전형 그대로 가나로 쓴 동사는 같은 낱말이다
    expect(kanaSpellingReading('あるく', '歩く')).toBe('あるく');
  });
  it('한자로 쓴 토큰 · 한자 없는 기본형 · 같은 표기는 해당하지 않는다', () => {
    expect(kanaSpellingReading('学校', '学校')).toBeNull();
    expect(kanaSpellingReading('行き', '行く')).toBeNull();
    expect(kanaSpellingReading('いき', 'いく')).toBeNull();
    expect(kanaSpellingReading('こく', 'こい')).toBeNull();
    expect(kanaSpellingReading('', '学校')).toBeNull();
    expect(kanaSpellingReading('がっこう', '')).toBeNull();
  });
  it('toHiragana — 가타카나만 바꾸고 장음은 둔다', () => {
    expect(toHiragana('コーヒー')).toBe('こーひー');
    expect(toHiragana('がっこう')).toBe('がっこう');
  });
});

describe('카드 배선 — 같은 칩 자리 · 같은 모양, 새 문구는 「한자 표기」 하나', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
  const meta = sliceBetween(page, '<div className="word-detail-card__meta">', '</div>');
  it('가나 한자 표기면 「한자 표기」, 아니면 지금처럼 사전 읽기가 없을 때만 「기본형」 — 둘 다 같은 칩 클래스', () => {
    expect(meta).toContain('{jaKanaSpelling\n');
    expect(meta).toContain('<span className="word-detail-card__base">한자 표기</span>');
    expect(meta).toContain('{headFallback && <span className="word-detail-card__base">기본형</span>}');
  });
  it('표제어 읽기에 그 가나를 쓰고, 그때는 「기본형」 폴백이 아니다 · 일본어만', () => {
    expect(page).toContain("const jaKanaSpelling = materialLang === 'Japanese' && headIsBase");
    expect(page).toContain('(editDictEntry?.reading || guestHeadReading || jaKanaSpelling || null)');
    expect(page).toContain('&& !editDictEntry?.reading && !jaKanaSpelling;');
  });
  it('로그인은 사전 조회가 끝난 뒤에만 판정한다(깜빡임 없음)', () => {
    expect(page).toContain('(user ? (dictFetched || dictError) : !authLoading)');
  });
  it('「한자 표기」는 중국어 화면 언어 글자도 있다', () => {
    expect(fs.readFileSync(path.join(process.cwd(), 'src/lib/viewerMessages.js'), 'utf8')).toContain("['한자 표기','汉字写法','漢字寫法']");
  });
});
