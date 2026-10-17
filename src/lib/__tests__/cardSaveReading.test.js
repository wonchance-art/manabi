import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 카드 저장 행의 읽기(EN-SAVE-IPA-001, 2026-10-17 KST). 영어 활용형(visits → visit)에 사전 행 읽기가 없으면 저장 행의
// furigana가 비어 복습 카드에서도 발음이 사라졌다. 분석기는 영어 토큰 furigana에 **기본형 IPA**를 둔다(rests → /rest/,
// 운영 표본) — 영어만 그 IPA로 채운다. 일본어 토큰 독음은 표면 읽기일 수 있어(食べ + たべ) 기본형 읽기로 쓰면 틀린다 — 그대로.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { cardSaveReading, buildVocabRow } = await import('../vocabIO');

describe('cardSaveReading — 영어 기본형만 토큰 IPA로 메운다', () => {
  const visits = { text: 'visits', base_form: 'visit', furigana: '/ˈvɪz.ɪt/' };
  it('영어 · 기본형 · 사전 읽기 없음 → 토큰 IPA(저장값 그대로)', () => {
    expect(cardSaveReading({ language: 'English', headIsBase: true, headReading: null, token: visits })).toBe('/ˈvɪz.ɪt/');
    expect(cardSaveReading({ language: 'English', headIsBase: true, headReading: null, token: { text: 'ran', base_form: 'run', reading: '/rʌn/' } })).toBe('/rʌn/');
  });
  it('사전 읽기가 있으면 언제나 사전 읽기가 먼저', () => {
    expect(cardSaveReading({ language: 'English', headIsBase: true, headReading: '/ˈvɪzɪt/', token: visits })).toBe('/ˈvɪzɪt/');
    expect(cardSaveReading({ language: 'Japanese', headIsBase: true, headReading: 'たべる', token: { furigana: 'たべ' } })).toBe('たべる');
  });
  it('다른 언어의 기본형 · 사전 읽기 없음은 지금처럼 비운다(일본어 표면 읽기 · 중국어 이합사 조각 병음을 기본형에 쓰지 않는다)', () => {
    expect(cardSaveReading({ language: 'Japanese', headIsBase: true, headReading: null, token: { text: '食べ', base_form: '食べる', furigana: 'たべ' } })).toBeNull();
    expect(cardSaveReading({ language: 'Chinese', headIsBase: true, headReading: null, token: { text: '道', sep_link: '道歉', furigana: 'dào' } })).toBeNull();
    expect(cardSaveReading({ language: 'French', headIsBase: true, headReading: null, token: { furigana: '/x/' } })).toBeNull();
  });
  it('영어에 토큰 IPA도 없으면 비운다', () => {
    expect(cardSaveReading({ language: 'English', headIsBase: true, headReading: null, token: { text: 'went', base_form: 'go', furigana: null } })).toBeNull();
  });
  it('표제어 = 표면이면 지금처럼 토큰 독음(furigana → reading), 언어 무관', () => {
    expect(cardSaveReading({ language: 'English', headIsBase: false, headReading: '/x/', token: { furigana: '/ˈlaɪ.brer.i/' } })).toBe('/ˈlaɪ.brer.i/');
    expect(cardSaveReading({ language: 'Japanese', headIsBase: false, headReading: null, token: { furigana: '', reading: 'きょう' } })).toBe('きょう');
  });
  it('저장 행: 영어 활용형의 furigana 칸에 IPA가 들어간다', () => {
    const row = buildVocabRow({ userId: 'u', surface: 'visits', base: 'visit', meaning: '방문하다', pos: '동사', language: 'English',
      reading: cardSaveReading({ language: 'English', headIsBase: true, headReading: null, token: visits }) });
    expect(row.base_form).toBe('visit');
    expect(row.furigana).toBe('/ˈvɪz.ɪt/');
  });
  it('배선: 카드 등급 저장이 이 함수 하나로 읽기를 정한다', () => {
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('reading: cardSaveReading({ language: materialLang, headIsBase, headReading, token: selectedToken }),');
    expect(viewer).not.toContain('reading: headIsBase ? headReading : selectedToken.furigana || selectedToken.reading');
  });
});
