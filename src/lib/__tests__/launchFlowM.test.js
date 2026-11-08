// 발매 점검 출시 흐름 M3~M6(오너 「권장대로」 2026-11-08 KST, 목업 KRH9aYGuqayHXMTJGpe9zN 2판). M3 칸 숨김은 classicsShelf · loadingSkeleton 계약.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { seriesCardTitle, seriesLabelKo } from '../seriesMeta';
import { nextReviewShortLabel } from '../viewerNextReview';
import { nextReviewAtOf } from '../../components/learn/LearnTiles';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('M4 오늘의 소식 카드 — 표지 72px 띠 · 「바로 읽기」 한 번', () => {
  it('카드 표지 높이 72px(색 · 「manabi / 언어」 · 사진 그대로), 배지는 걷고 단추만', () => {
    expect(read('src/components/web/web-shell.css')).toContain('.suggestion-card .suggestion-artwork{aspect-ratio:auto;height:72px}');
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).not.toContain('suggestion-card__ready');
    expect(page).toContain('바로 읽기</button>');
    expect(read('src/index.css')).not.toContain('.suggestion-card__ready');
  });
});

describe('M5 시리즈 제목 — 코드 걷기 · 표지에 시리즈 이름', () => {
  it('시리즈 형식은 본문만, 아니면 그대로(데이터 제목은 바꾸지 않는다)', () => {
    expect(seriesCardTitle('[A1 grammar #5] Family & Relationships')).toBe('Family & Relationships');
    expect(seriesCardTitle('[N5 문법 #3] これ・それ・あれ (사물 지시)')).toBe('これ・それ・あれ (사물 지시)');
    expect(seriesCardTitle('[H1 생활 #2] 今天几号？ (날짜 · 요일 · 시간)')).toBe('今天几号？ (날짜 · 요일 · 시간)');
    expect(seriesCardTitle('[N5] 学校の一日')).toBe('[N5] 学校の一日');
    expect(seriesCardTitle('내가 쓴 글')).toBe('내가 쓴 글');
    expect(seriesCardTitle(null)).toBe('');
  });
  it('시리즈 이름은 한국어 화면 말로(grammar → 문법 · phrases → 표현), 나머지는 그대로', () => {
    expect(seriesLabelKo('grammar')).toBe('문법');
    expect(seriesLabelKo('phrases')).toBe('표현');
    expect(seriesLabelKo('카나')).toBe('카나');
    expect(seriesLabelKo('')).toBe('');
  });
  it('카드 제목 · 위치 표지가 같은 정본(parseTitle)을 쓴다', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).toContain('{seriesCardTitle(m.title)}');
    expect(page).toContain('{seriesLabelKo(titleMeta.series)} {seriesPosition}');
  });
});

describe('M6 배움 단어 복습 칸 — 0개면 다음 시각 · 「담은 표현 보기」', () => {
  const at = Date.parse('2026-11-08T03:00:00Z'); // KST 12:00
  it('같은 학습일은 분 · 시간, 다음 학습일은 「내일」, 그 뒤는 날짜, 지났으면 null', () => {
    expect(nextReviewShortLabel(new Date(at + 10 * 60000).toISOString(), { at })).toBe('10분 뒤');
    expect(nextReviewShortLabel(new Date(at + 30 * 1000).toISOString(), { at })).toBe('1분 뒤');
    expect(nextReviewShortLabel(new Date(at + 3 * 3600000).toISOString(), { at })).toBe('3시간 뒤');
    expect(nextReviewShortLabel(new Date(at + 24 * 3600000).toISOString(), { at })).toBe('내일');
    expect(nextReviewShortLabel(new Date(at + 3 * 24 * 3600000).toISOString(), { at })).toBe('11월 11일');
    expect(nextReviewShortLabel(new Date(at - 60000).toISOString(), { at })).toBeNull();
    expect(nextReviewShortLabel(null, { at })).toBeNull();
  });
  it('칩 언어 안의 가장 이른 다음 시각(지난 것 · 다른 언어는 빼고)', () => {
    const p = (lang, iso) => ({ vocabulary: { language: lang }, review: { nextQuestionAt: iso } });
    const rows = [p('Chinese', new Date(at + 20 * 60000).toISOString()), p('Chinese', new Date(at + 5 * 60000).toISOString()),
      p('Chinese', new Date(at - 60000).toISOString()), p('Japanese', new Date(at + 60000).toISOString())];
    expect(nextReviewAtOf(rows, 'Chinese', at)).toBe(new Date(at + 5 * 60000).toISOString());
    expect(nextReviewAtOf([], 'Chinese', at)).toBeNull();
  });
  it('칸: 대기가 있으면 「N개 대기 · 복습하기」 그대로, 0개 · 담은 표현 있음이면 「다음 복습 …」 · 「담은 표현 보기」', () => {
    const tiles = read('src/components/learn/LearnTiles.jsx');
    expect(tiles).toContain("const cta = !word ? '읽으러 가기' : waiting ? '복습하기' : '담은 표현 보기';");
    expect(tiles).toContain('const next = nextLabel ? `다음 복습 ${nextLabel}` : null;');
    expect(tiles).toContain('{(waiting || next) && <span className="learn-review__due">{waiting || next}</span>}');
  });
});
