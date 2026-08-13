import { describe, expect, it } from 'vitest';
import { computeHeadingLevels } from '../headingHeuristics.js';

// 계약(#988): EPUB 전형 배열(문단 사이 빈 줄·문단 안 연속)에서 문단 첫 줄의 대사·짧은 줄이
// h2로 오탐돼 본문 글자 크기가 줄마다 널뛰었다 — 인용부 시작/닫는 따옴표 끝은 본문이다.

describe('뷰어 헤딩 휴리스틱', () => {
  it('중국어 대사(따옴표 시작·끝)는 문단 첫 줄이어도 본문', () => {
    const lines = [
      '第三章 山中来客',
      '',
      '“你要去哪里？”',
      '他放下茶杯，沉默了很久，然后望向窗外渐渐暗下来的天色，轻声说道。',
      '',
      '“回山里去。”',
      '老人说完便起身，屋子里只剩下炉火噼啪作响的声音，谁也没有再开口。',
    ];
    const levels = computeHeadingLevels(lines);
    expect(levels[0]).toBe(1);        // 첫 줄 제목 유지
    expect(levels[2]).toBe(0);        // 대사 오탐 금지
    expect(levels[5]).toBe(0);
  });

  it('일본어 「」 대사·콜론 끝 줄도 본문', () => {
    const lines = [
      'タイトル',
      '',
      '「どこへ行くの」',
      'そう言いながら彼はゆっくりと立ち上がり、窓の外の暗くなっていく空を見つめた。',
      '',
      '彼は言った：',
      'それはとても長い話になるので、今夜のうちに全部を話すことはできない。',
    ];
    const levels = computeHeadingLevels(lines);
    expect(levels[2]).toBe(0);
    expect(levels[5]).toBe(0);        // 콜론 끝 — 이어짐 부호
  });

  it('명시적 마크다운·휴리스틱 제목은 유지', () => {
    const lines = [
      '# 大きな見出し',
      '',
      '概要',
      'この章では前の章で紹介した内容を踏まえて、さらに詳しい説明を続けていく。',
    ];
    const levels = computeHeadingLevels(lines);
    expect(levels[0]).toBe(1);        // 마크다운
    expect(levels[2]).toBe(2);        // 무인용 명사구 소제목(앞 빈 줄·뒤 긴 줄) 유지
  });
});
