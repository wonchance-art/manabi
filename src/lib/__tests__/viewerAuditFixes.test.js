// 뷰어 기능 감사(2026-10-17 KST)에서 찾은 비시각 결함 — 같은 설정을 두 곳이 다른 말로 부르던 것, 열림 상태를 알리지 않던 토글.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { listenRateText } from '../../components/ListenControls.jsx';
import { TTS_RATES } from '../readingSheet.js';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const VIEWER = 'src/views/ViewerPage.jsx';

describe('듣기 막대의 속도 글자 = Aa 「재생 속도」 이름', () => {
  it('설정 이름이 있으면 그 이름, 없으면(뷰어 밖) 지금처럼 실제 값', () => {
    for (const rate of Object.values(TTS_RATES)) expect(listenRateText(rate.web, rate.label)).toBe(rate.label);
    expect(listenRateText(TTS_RATES.normal.web, TTS_RATES.normal.label)).not.toBe('0.85×');
    expect(listenRateText(1.25)).toBe('1.25×');
  });

  it('뷰어는 실제 속도(web)와 보이는 이름(label)을 함께 넘기고, 막대는 이름을 쓴다', () => {
    const tag = sliceBetween(read(VIEWER), '<ListenControls', '/>');
    expect(tag).toContain('playbackRate={TTS_RATES[ttsRate].web}');
    expect(tag).toContain('rateLabel={TTS_RATES[ttsRate].label}');
    const rate = sliceBetween(read('src/components/ListenControls.jsx'), '<span className="listen-controls__rate"', '</span>');
    expect(rate).toContain('{listenRateText(playbackRate, rateLabel)}');
    expect(rate).not.toContain('{playbackRate}×');
  });
});

describe('단어 카드 글자 칸(学 · 生)은 열림 상태를 알린다', () => {
  it('role=button 토글에 aria-expanded — 펼친 글자만 true', () => {
    const glyph = sliceBetween(read(VIEWER), 'const charSpan = (ch, key, reading, i) => isInspectableChar(ch) ? (', '>{ch}</span>');
    expect(glyph).toContain('role="button"');
    expect(glyph).toContain('aria-expanded={inspectChar?.key === key}');
    expect(glyph).toContain('onClick={() => toggleInspectChar(ch, key, reading)}');
  });
});
