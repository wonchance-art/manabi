// FLOW-ADD-A(2026-11-16 KST, 오너 「권장대로 A부터 ㄱㄱ」) — 글 올리기 → 뷰어 흐름의 오류 수정 계약.
// A1(처음 분석 부분 결과 보존)은 reanalysisPreservation.test.js의 「first analysis keeps the lines it already analyzed」.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { studiesOwnText } from '../materialComposer';
import { sliceBetween } from './helpers/sliceBetween';

const read = (path) => fs.readFileSync(path, 'utf8');
const original = (over = {}) => ({ raw_text: '雨。', processed_json: { metadata: { composer: { version: 1, role: 'original' } } }, ...over });

describe('A3 — 옛 가져오기에서 화면을 떠나 멈춰도 중단 상태를 저장한다', () => {
  it('catch는 화면이 살아 있는지 보기 전에 interruptedImportJson을 저장한다', () => {
    const src = read('src/views/MaterialAddPage.jsx');
    const catchBlock = sliceBetween(src, '    } catch (err) {\n      // FLOW-ADD-A3', '    } finally {');
    const persist = catchBlock.indexOf('await persistImportAnalysis(supabase, record, interrupted)');
    const bail = catchBlock.indexOf('if (!aliveRef.current) return;');
    expect(persist).toBeGreaterThan(0);
    expect(bail).toBeGreaterThan(persist); // 옛 코드는 catch 첫 줄에서 빠져 「analyzing」으로 굳었다
  });
});

describe('A4 — 처음 분석 · 원본 학습 문구', () => {
  it('처음 분석 중에는 「기존 자료는 그대로」를 쓰지 않는다', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toMatch(/firstAnalysisRun \? '본문을 분석하고 있어요…' : '새 분석을 준비하고 있어요\. 기존 자료는 그대로 있어요\.'/);
    expect(read('src/lib/viewerMessages.js')).toContain("['본문을 분석하고 있어요…',");
  });
  it('studiesOwnText — 원본 행을 그대로 학습으로 연 경우만 참', () => {
    expect(studiesOwnText(original())).toBe(true);
    expect(studiesOwnText(original({ document_json: { version: 1, body: '雨。' } }))).toBe(true);
    expect(studiesOwnText(original({ document_json: { version: 1, body: '晴れ。' } }))).toBe(false); // 원본을 고친 뒤 — 안내가 맞다
    expect(studiesOwnText({ raw_text: '雨。', processed_json: { metadata: { composer: { version: 1, role: 'study' } } } })).toBe(false);
    expect(studiesOwnText({ raw_text: '雨。', processed_json: { metadata: { composer: { version: 1, role: 'original', passage: { from: 0 } } } } })).toBe(false);
    expect(studiesOwnText({ raw_text: '雨。', processed_json: { metadata: {} } })).toBe(false);
  });
  it('뷰어는 그 경우 「학습에 사용한 본문」 안내를 빼고 링크를 「원본 화면 ↗」으로', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain("studiesOwnText(material)?'원본 화면 ↗':'현재 글과 첨부 원본 ↗'");
    expect(src).toContain('{composerOf(material) && !studiesOwnText(material) && <p className="reader-metadata">');
  });
});

describe('A5 — 처음 분석 완료는 화면 알림 대신 낭독 영역으로', () => {
  it('useReanalyze는 처음 분석 성공에 toast를 띄우지 않고 doneNotice를 둔다(재분석은 그대로 toast)', () => {
    const src = read('src/lib/useReanalyze.js');
    expect(src).toContain('firstAnalysis: !material?.processed_json?.sequence?.length');
    expect(src).toMatch(/else if \(scope\?\.firstAnalysis\) setDoneNotice\('분석이 끝났어요'\);\s*else toast\?\.\('분석을 마쳤어요', 'success'\);/);
    expect(read('src/views/ViewerPage.jsx')).toContain("reanalyze.doneNotice ? vt(reanalyze.doneNotice) : ''");
  });
});
