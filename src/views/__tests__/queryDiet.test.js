import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 쿼리 다이어트(구조 정리 B — 전수 조사) — 메타만 쓰는 조회가 processed_json
// 통짜(자료당 수백 KB)나 전 컬럼(*)을 끌지 않는다. jsonb 경로 선택은 책 챕터 쿼리 선례.
//
// 정정 기록(조사 결과): 자료실 목록(MaterialsPage)과 단어장 본체(fetchVocab)는
// 다이어트 대상이 **아니다** — 전자는 dictionary·sequence로 자료별 복습 due 배지를
// 계산하고, 후자는 단어장 화면이 etym·hanja까지 전 컬럼 소비자다. 아래 계약은
// 그 두 곳의 현행을 함께 고정해, 다음 다이어트가 같은 오판을 반복하지 않게 한다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('쿼리 다이어트 계약', () => {
  it('뷰어 다음 자료 추천 — 메타 경로 선택(통짜 금지), 소비처는 평탄 필드', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("select('id, title, status:processed_json->>status, language:processed_json->metadata->>language, level:processed_json->metadata->>level')");
    const modal = read('src/views/ViewerQuizModal.jsx');
    expect(modal).toContain("nextMaterial.language === 'English'");
    expect(modal).not.toContain('nextMaterial.processed_json');
  });

  it('홈 — 시리즈 진도 300행은 언어 경로만, 최근 진행 join은 제목만', () => {
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain("select('id, title, language:processed_json->metadata->>language')");
    expect(home).toContain("reading_materials(id, title)')");
    expect(home).not.toContain('reading_materials(id, title, processed_json)');
    expect(home).toContain('m.language ||');
  });

  it('프로필 통계 — 소비하는 컬럼만(전 컬럼 금지)', () => {
    const stats = read('src/views/ProfileStats.jsx');
    // 이 핀은 원래 select 문자열을 통째로 박아 뒀는데, 그 문자열이 복습 타일이 그리는
    // word_text·meaning을 빠뜨린 고장난 상태였다(2026-08-24 수리). 문자열을 박으면
    // 고장까지 계약이 된다 — 다이어트의 **의도**(전 컬럼·큰 컬럼 금지)만 고정하고,
    // 필요한 필드가 다 있는지는 profileStatsSelect.test.js가 렌더와 대조해 지킨다.
    expect(stats).not.toMatch(/user_vocabulary'\)[\s\S]{0,40}?\.select\('\*'\)/);
    expect(stats).not.toContain('source_sentence');
    expect(stats).toContain('next_review_at');
  });

  it('단어장 IO — 언어 백필은 언어별 배치 UPDATE, 출처 제목 청크는 병렬', () => {
    const io = read('src/lib/vocabIO.js');
    expect(io).toContain(".update({ language }).in('id', ids)");
    expect(io).not.toMatch(/needsUpdate\.map\(u =>\s*supabase/);
    expect(io).toContain('await Promise.all(chunks.map((slice) =>');
  });

  it('정정 고정 — 자료실 목록과 단어장 본체는 통짜 유지가 맞다(실사용 확인)', () => {
    // MaterialsPage: dictionary·sequence로 자료별 due 배지 계산(268행대) — 통짜 필요.
    //
    // ⚠ 여기도 select 문자열을 통째로 박아 뒀었다. 위 ProfileStats 주석이 이미 내린
    // 판단("문자열을 박으면 고장까지 계약이 된다")이 그대로 적용된다 — v2-P가 PDF
    // 묶음에 필요한 `source_pdf_id`·`page_start`·`page_end`를 **정당하게** 더하자
    // 이 핀이 걸렸다. 컬럼이 하나 느는 것은 다이어트 위반이 아니다. 그래서 다이어트의
    // **의도**만 고정한다: 전 컬럼(`*`) 금지 · 통짜 `processed_json` 유지 · 큰 컬럼을
    // 새로 끌어들이지 않기. 필요한 필드가 다 있는지는 렌더가 곧 증거다(빠지면 깨진다).
    const materials = read('src/views/MaterialsPage.jsx');
    // U R3부터 목록 컬럼은 상수 MATERIAL_LIST_COLS 하나로 모이고, select는 direction 유무만 분기한다.
    const sel = /const MATERIAL_LIST_COLS = '([^']*)'/.exec(materials)?.[1];
    expect(sel, '자료실 목록 컬럼 상수를 못 읽었다').toBeTruthy();
    expect(materials).toMatch(/from\('reading_materials'\)[\s\S]{0,200}\.select\(withDirection \? `\$\{MATERIAL_LIST_COLS\}, direction` : MATERIAL_LIST_COLS\)/);
    expect(sel, '전 컬럼은 금지').not.toBe('*');
    expect(sel, 'due 배지가 dictionary·sequence를 쓰므로 통짜가 맞다').toContain('processed_json');
    // 큰 컬럼을 새로 끌어들이지 않는다 — 목록이 쓰지 않는 본문성 컬럼 금지
    expect(sel).not.toMatch(/\braw_text\b|\bcontent\b|\bfull_text\b/);
    expect(materials).toContain('material.processed_json.dictionary');
    // fetchVocab: 단어장 화면이 전 컬럼 소비자(etym·hanja 포함) — select('*') 유지
    const io = read('src/lib/vocabIO.js');
    expect(io).toMatch(/from\('user_vocabulary'\)\s*\.select\('\*'\)/);
  });
});
