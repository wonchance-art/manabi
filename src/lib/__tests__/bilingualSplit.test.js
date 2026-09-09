import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  KO_LINE_THRESHOLD, BILINGUAL_HINT_RATIO, hangulRatio, isMeaningLine, splitBilingual, looksBilingual,
  summarizeSplit, lookupTranslation, bookMeaningPanelText, planRefine,
} from '../bilingualSplit.js';
import { splitLinesIntoChapters, sentenceListStats } from '../bookSplit.js';
import { analyzeText } from '../analyzeText.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/**
 * 계약: v2-AB R0 교재 정제 (#1077 설계 5603827169 §7 R0, 오너 「착수해」 2026-09-09).
 * ① 정제 뒤 raw_text에 한글 비율 60% 이상 줄이 0
 * ② translations 키가 전부 raw_text 줄과 정확 일치(고아 0); 미배정은 개수로 드러난다
 * ③ translations에 있는 문장의 드래그 번역은 Gemini 호출 0; 없는 문장은 현행 그대로
 * ④ 정제는 원어 줄을 재분석하지 않는다(analyzeCount === 0, 리맵만); 재분석 뒤에도 translations 보존
 * ⑤ 과당 줄 수가 원어 줄 기준
 */

// 오너 교재 모양 — 일본어 문장 / 한국어 뜻 교대 줄
const JA = ['私は学生です。', 'これはペンです。', '明日は雨が降ります。', '駅はどこですか。'];
const KO = ['나는 학생입니다.', '이것은 펜입니다.', '내일은 비가 옵니다.', '역은 어디입니까?'];
const ALT = JA.flatMap((j, i) => [j, KO[i]]).join('\n');

describe('한글 줄 판정', () => {
  it('문턱은 60%·배너 문턱은 40% — 상수가 곧 계약', () => {
    expect(KO_LINE_THRESHOLD).toBe(0.6);
    expect(BILINGUAL_HINT_RATIO).toBe(0.4);
  });

  it('한글 비율은 글자만 센다 — 숫자·구두점·공백은 분모에서 뺀다', () => {
    expect(hangulRatio('나는 학생입니다.')).toBe(1);
    expect(hangulRatio('私は学生です。')).toBe(0);
    expect(hangulRatio('12. 나는!')).toBe(1);
    expect(hangulRatio('')).toBe(0);
    expect(hangulRatio('123 ...')).toBe(0);
  });

  it('원어 안에 한글이 섞여도 60% 미만이면 원어 줄이다(억지 판정 금지)', () => {
    expect(isMeaningLine('私は韓国語で한국')).toBe(false);   // 2/8
    expect(isMeaningLine('キムチ')).toBe(false);
    expect(isMeaningLine('한국어 뜻 (설명)')).toBe(true);
    expect(isMeaningLine('   ')).toBe(false);
  });
});

describe('splitBilingual — 짝짓기', () => {
  it('교대 줄을 원어만 남기고 뜻은 문장 키로 붙인다', () => {
    const r = splitBilingual(ALT);
    expect(r.sourceLines).toEqual(JA);
    expect(r.sourceText).toBe(JA.join('\n'));
    expect(r.translations).toEqual(Object.fromEntries(JA.map((j, i) => [j, KO[i]])));
    expect(r.stats).toEqual({ source: 4, meaning: 4, paired: 4, unassigned: 0, duplicates: 0 });
  });

  it('짝이 없는 한국어 줄은 미배정으로 드러난다 — 조용히 버리지 않는다', () => {
    const text = ['장 제목', JA[0], KO[0], '둘째 뜻', '', JA[1]].join('\n');
    const r = splitBilingual(text);
    expect(r.unassigned).toEqual([
      { line: '장 제목', index: 0, reason: 'no-source' },
      { line: '둘째 뜻', index: 3, reason: 'second-meaning' },
    ]);
    expect(r.translations).toEqual({ [JA[0]]: KO[0] });
    expect(r.sourceText).toBe(`${JA[0]}\n\n${JA[1]}`);
  });

  it('빈 줄이 끼면 짝이 끊긴다(문단 경계 존중) — 뒤 문단의 첫 한글 줄은 미배정', () => {
    const r = splitBilingual([JA[0], '', KO[0]].join('\n'));
    expect(r.unassigned[0]).toMatchObject({ line: KO[0], reason: 'no-source' });
  });

  it('같은 원어 문장이 두 번 나오면 첫 뜻만 쓰고 duplicates로 센다', () => {
    const r = splitBilingual([JA[0], KO[0], JA[0], '다른 뜻'].join('\n'));
    expect(r.translations[JA[0]]).toBe(KO[0]);
    expect(r.stats.duplicates).toBe(1);
  });

  it('배너 판정 — 짝 비율 40% 이상·2쌍 이상', () => {
    expect(looksBilingual(ALT)).toBe(true);
    expect(looksBilingual(JA.join('\n'))).toBe(false);
    expect(looksBilingual([JA[0], KO[0], ...JA.slice(1)].join('\n'))).toBe(false); // 1쌍 — 2쌍 미만
    const eight = Array.from({ length: 8 }, (_, i) => `文${i}。`);
    expect(looksBilingual([...eight.slice(0, 6), eight[6], '뜻 하나', eight[7], '뜻 둘'].join('\n'))).toBe(false); // 2/8 = 25%
  });

  it('확인 문구는 원어·뜻·미배정 개수', () => {
    expect(summarizeSplit({ source: 16, paired: 15, unassigned: 1 })).toBe('원어 16줄 · 뜻 15줄 · 미배정 1줄');
    expect(summarizeSplit({ source: 16, paired: 16, unassigned: 0 })).toBe('원어 16줄 · 뜻 16줄');
  });
});

describe('① 정제 뒤 raw_text에 한글 줄 0 · ② translations 고아 0', () => {
  it('정제 결과의 모든 줄이 원어이고, 모든 뜻 키가 raw_text 줄이다', () => {
    const messy = ['장 제목', ...ALT.split('\n'), '', '주석 한 줄', JA[0], KO[0]].join('\n');
    const r = splitBilingual(messy);
    for (const line of r.sourceText.split('\n').filter(Boolean)) expect(isMeaningLine(line)).toBe(false);
    const lines = new Set(r.sourceText.split('\n').map((l) => l.trim()));
    for (const key of Object.keys(r.translations)) expect(lines.has(key)).toBe(true);
    expect(r.stats.unassigned).toBe(2);
  });
});

describe('③ 교재 뜻은 Gemini 전에 — 정확 일치만', () => {
  const tx = { [JA[0]]: KO[0], [JA[1]]: KO[1] };

  it('정확 일치(앞뒤 공백 무시)만 교재 뜻, 부분·유사는 null', () => {
    expect(lookupTranslation(tx, ` ${JA[0]} `)).toBe(KO[0]);
    expect(lookupTranslation(tx, JA[0].slice(0, 4))).toBeNull();
    expect(lookupTranslation(tx, '駅')).toBeNull();
    expect(lookupTranslation(null, JA[0])).toBeNull();
    expect(lookupTranslation(tx, '')).toBeNull();
  });

  it('여러 줄 지정은 전부 있을 때만 잇고, 하나라도 없으면 null(현행 Gemini 경로)', () => {
    expect(lookupTranslation(tx, `${JA[0]}\n${JA[1]}`)).toBe(`${KO[0]}\n${KO[1]}`);
    expect(lookupTranslation(tx, `${JA[0]}\n${JA[2]}`)).toBeNull();
  });

  it('패널 본문은 Gemini 응답과 같은 **번역** 섹션 모양 + 교재 출처 한 줄', () => {
    const t = bookMeaningPanelText(KO[0]);
    expect(t.startsWith('**번역**\n' + KO[0])).toBe(true);
    expect(t).toContain('📘 교재');
  });

  it('뷰어 배선 — runSelectionAnalysis가 캐시·Gemini보다 먼저 translations를 본다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const fn = sliceBetween(viewer, 'const runSelectionAnalysis = async (sel) => {', 'const inlineReviewMutation = useInlineReview(');
    const lookup = fn.indexOf('lookupTranslation(');
    const cache = fn.indexOf("viewerCacheKey('viewer_tx'");
    const gemini = fn.indexOf('callGemini(buildContextPrompt(');
    expect(lookup).toBeGreaterThan(-1);
    expect(lookup).toBeLessThan(cache);
    expect(cache).toBeLessThan(gemini);
    // 적중하면 번역 요청을 만들지 않는다 — cached 분기와 같은 문을 탄다
    expect(fn).toMatch(/const bookMeaning = lookupTranslation\([\s\S]{0,400}?const cached = bookMeaning \? bookMeaningPanelText\(bookMeaning\)/);
    expect(fn).toContain('cached ? Promise.resolve() : callGemini(');
    expect(viewer).toContain("import { lookupTranslation, bookMeaningPanelText } from '../lib/bilingualSplit';");
  });
});

describe('④ 정제는 리맵만 — 재분석 0, 재분석 뒤 translations 보존', () => {
  const json = {
    sequence: ['id_0_0_9', 'br_0_9', 'id_1_0_9', 'br_1_9', 'id_2_0_9', 'br_2_9', 'id_3_0_9'],
    dictionary: {
      id_0_0_9: { text: JA[0], pos: '명사' }, br_0_9: { text: '\n', pos: '개행' },
      id_1_0_9: { text: KO[0], pos: '미상' }, br_1_9: { text: '\n', pos: '개행' },
      id_2_0_9: { text: JA[1], pos: '명사' }, br_2_9: { text: '\n', pos: '개행' },
      id_3_0_9: { text: KO[1], pos: '미상' },
    },
    failed_indices: [],
    status: 'completed',
    metadata: { language: 'Japanese', book: { key: 'bk_1', title: '교재', order: 3 } },
  };
  const material = { raw_text: [JA[0], KO[0], JA[1], KO[1]].join('\n'), processed_json: json };

  it('원어 토큰은 새 줄번호로 살고 한글 토큰만 사라진다 · analyzeCount 0 · book 메타 보존', () => {
    const plan = planRefine(material);
    expect(plan.ok).toBe(true);
    expect(plan.noop).toBe(false);
    expect(plan.analyzeCount).toBe(0);
    expect(plan.newText).toBe(`${JA[0]}\n${JA[1]}`);
    // 리맵은 sourceEdit(buildEditPlan)과 같은 규칙 — 남은 줄의 개행 토큰은 새 줄번호로 따라온다
    expect(plan.remapped.sequence).toEqual(['id_0_0_9', 'br_0_9', 'id_1_0_9', 'br_1_9']);
    expect(plan.remapped.dictionary.id_1_0_9).toBeDefined();
    expect(Object.values(plan.remapped.dictionary).some((t) => t.text === KO[0] || t.text === KO[1])).toBe(false);
    expect(plan.remapped.dictionary.id_1_0_9).toEqual({ text: JA[1], pos: '명사' });
    expect(plan.remapped.metadata.book).toEqual(json.metadata.book);
    expect(plan.remapped.metadata.translations).toEqual({ [JA[0]]: KO[0], [JA[1]]: KO[1] });
    expect(plan.stats).toMatchObject({ source: 2, paired: 2, unassigned: 0 });
  });

  it('이미 있던 translations 위에 병합한다 — 정제를 두 번 돌려도 잃지 않는다', () => {
    const once = planRefine(material);
    const twice = planRefine({ raw_text: once.newText, processed_json: once.remapped });
    expect(twice.noop).toBe(true);
    expect(twice.translations).toEqual(once.translations);
  });

  it('뜻 줄이 없으면 noop — 원어만 있는 과는 손대지 않는다', () => {
    const plan = planRefine({ raw_text: JA.join('\n'), processed_json: { sequence: [], dictionary: {}, metadata: {} } });
    expect(plan.noop).toBe(true);
    expect(plan.newText).toBe(JA.join('\n'));
  });

  it('미분석(pending) 과도 계획이 선다 — 빈 분석은 빈 채로, 뜻은 metadata로', () => {
    const plan = planRefine({ raw_text: ALT, processed_json: { sequence: [], dictionary: {}, status: 'pending', metadata: { language: 'Japanese' } } });
    expect(plan.ok).toBe(true);
    expect(plan.remapped.sequence).toEqual([]);
    expect(plan.remapped.status).toBe('pending');
    expect(Object.keys(plan.remapped.metadata.translations)).toHaveLength(4);
  });

  it('재분석 파이프라인이 metadata를 그대로 넘긴다 — translations는 재분석 뒤에도 남는다', async () => {
    // analyzeText는 호출측 metadata를 그대로 싣는다(analyzeHybrid: metadata || existingJson.metadata).
    // 하이브리드 경로는 fetch를 부르므로, 빈 줄만 있는 본문으로 서버 호출 없이 조립만 시킨다.
    const meta = { language: 'Japanese', translations: { [JA[0]]: KO[0] }, book: { key: 'bk_1', order: 1 } };
    const out = await analyzeText('\n', null, { metadata: meta });
    expect(out.metadata.translations).toEqual(meta.translations);
    expect(out.metadata.book).toEqual(meta.book);
    // 뷰어 재분석 러너도 기존 metadata를 펼쳐 싣는다(reanalysisPreservation)
    const runner = read('src/lib/reanalysisPreservation.js');
    expect(runner).toContain('const metadata = { ...original?.metadata, viewerRevision: attempt');
  });
});

describe('⑤ 과당 줄 수는 원어 줄 기준', () => {
  it('교대 줄 32줄·과당 16 → 1과(원어 16줄) + 뜻 16개', () => {
    const src = Array.from({ length: 16 }, (_, i) => `文${i}です。`);
    const alt = src.flatMap((s, i) => [s, `뜻 ${i}`]).join('\n');
    const chapters = splitLinesIntoChapters(alt, { linesPerChapter: 16 });
    expect(chapters).toHaveLength(1);
    expect(chapters[0].text.split('\n')).toEqual(src);
    expect(Object.keys(chapters[0].translations)).toHaveLength(16);
    expect(chapters[0].translations['文3です。']).toBe('뜻 3');
  });

  it('원어만 있는 목록은 반환형이 그대로다({title, text}) — 기존 소비처 무영향', () => {
    const src = Array.from({ length: 20 }, (_, i) => `文${i}です。`).join('\n');
    const chapters = splitLinesIntoChapters(src, { linesPerChapter: 16 });
    expect(chapters).toHaveLength(2);
    expect(Object.keys(chapters[0]).sort()).toEqual(['text', 'title']);
  });

  it('통계가 원어 줄 수를 따로 낸다 — 반입 화면의 과 수 계산 근거', () => {
    const s = sentenceListStats(ALT);
    expect(s.lines).toBe(8);
    expect(s.sourceLines).toBe(4);
    expect(s.paired).toBe(4);
  });

  it('반입 화면 배선 — 과 수는 sourceLines로 세고, 배너·미배정을 보여 주며, 등록이 translations를 싣는다', () => {
    const section = read('src/components/MaterialAddSentenceSection.jsx');
    expect(section).toContain('Math.ceil(stats.sourceLines / per)');
    expect(section).toContain('looksBilingual(text)');
    expect(section).toContain('미배정');
    const page = read('src/views/MaterialAddPage.jsx');
    const register = sliceBetween(page, 'async function handleBookRegister()', '\n  }\n');
    expect(register).toContain('translations: ch.translations');
  });
});
