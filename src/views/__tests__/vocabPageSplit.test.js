import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { stripSourceLangInMeaning as fromClean } from '../../lib/meaningClean';
import { stripSourceLangInMeaning as fromSession } from '../../lib/studySession';

// /vocab 첫 화면(복습방)에 없는 둘러보기 탭 · 상세 카드를 지연 로드한다(2026-10-17 KST 번들 조사).
const page = fs.readFileSync('src/views/VocabPage.jsx', 'utf8');

describe('/vocab 페이지 청크 나누기', () => {
  it('둘러보기 목록 · 상세 카드는 next/dynamic으로만 받는다', () => {
    expect(page).not.toMatch(/^import VocabList from/m);
    expect(page).not.toMatch(/^import VocabDetailCard from/m);
    expect(page).toContain('dynamic(loadVocabList');
    expect(page).toContain('dynamic(loadVocabDetailCard');
    expect(page).toContain("<Spinner message=\"담은 표현 불러오는 중…\" />");
  });
  it('오프라인 첫 화면 목록을 위해 유휴 시간에 미리 받는다 — 빠지면 오프라인 목록이 조용히 깨진다', () => {
    const warm = sliceBetween(page, 'const warm = () => {', '};');
    expect(warm).toContain('loadVocabList()');
    expect(warm).toContain('loadVocabDetailCard()');
  });
  it('단어 행을 누르거나 포커스하면 상세 카드를 미리 받는다 — 유휴 미리 받기 전 첫 클릭이 무반응이 되지 않게', () => {
    const row = sliceBetween(page, 'className="review-sec__row"', 'aria-label=');
    expect(row).toContain('onPointerDown={loadVocabDetailCard}');
    expect(row).toContain('onFocus={loadVocabDetailCard}');
  });
  it('뜻 정리는 작은 모듈에서 — studySession을 싣지 않는다(다시 내보내기로 같은 함수)', () => {
    expect(page).toContain("import { choiceLabels, choiceMeaning } from '../lib/meaningClean';"); // 보기 규칙(STUDY-CHOICE-LEAK-001)
    expect(page).not.toContain("from '../lib/studySession'");
    expect(fs.readFileSync('src/lib/meaningClean.js', 'utf8')).not.toMatch(/^import /m);
    expect(fromSession).toBe(fromClean);
    expect(fromClean('일하다 (働く)')).toBe('일하다');
    expect(fromClean('달리다 (과거형)')).toBe('달리다 (과거형)');
  });
});
