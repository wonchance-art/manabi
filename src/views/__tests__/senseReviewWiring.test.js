import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { senseReviewItems, senseReviewDismissKey, senseReviewOptions, keepSenseCorrection, needsMeaningCheck } from '../../lib/viewerSenseReview.js';
import { applyTokenCorrections, senseCorrectionFor } from '../../lib/tokenEditOptions.js';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const list = read('src/components/viewer/ViewerSenseReview.jsx');
const css = read('src/components/viewer/reader-controls.css');
const card = sliceBetween(viewer, 'const renderWordDetailCard = (classAction=null,classMeaning=null) => !selectedToken || !isSheetOpen ? null : (', 'const renderRightPanelContent =');

/**
 * 뷰어 v2 AD-R4 PR③ — 「뜻 확인 필요 N개」 줄 · 목록(그 자리에서 고치기) · 카드 ⓘ · 교정 시 표식 삭제
 * (설계서 docs/manabi-viewer-v2-ad-r4.md §6·§7·§9.1 「화면」·§10 PR③).
 * 재료는 분석 토큰의 내부 표식 meaningCheck('ctx'|'doubt')뿐 — 서버 상수 ZH_SENSE_REVIEW가 꺼진 지금은 표식이 없어 화면 변화 0.
 * 쓰기는 AE-R1 PR③ 사전 뜻 교정 경로(correctTokenMutation · senseCorrectionFor) 하나 — 새 쓰기 경로·단어장·FSRS·사전 쓰기 0.
 * 「AI」 표시 0(오너 결정 2026-10-07 23:45 KST).
 */
describe('뜻 확인 필요 — 순수 규칙 (viewerSenseReview)', () => {
  const json = {
    metadata: { language: 'Chinese', viewerRevision: 'rev-1', viewerCorrections: { id_1_0: ['meaning'] } },
    sequence: ['id_0_0', 'id_0_1', 'id_0_2', 'br_0', 'id_1_0', 'id_1_1', 'id_1_2'],
    dictionary: {
      id_0_0: { text: '我', meaning: '나' },
      id_0_1: { text: '打', meaning: '(전화를) 걸다', meaningCheck: 'doubt' },
      id_0_2: { text: '吃醋', meaning: '질투하다', meaningCheck: 'ctx' },
      br_0: { text: '\n', pos: '개행', meaningCheck: 'ctx' },
      id_1_0: { text: '花', meaning: '쓰다', meaningCheck: 'doubt' }, // 교정한 토큰 — 빠진다
      id_1_1: { text: '还', meaning: '아직', meaningCheck: 'ai' }, // 모르는 값 — 무시
      id_1_2: { text: '走', meaning: '걷다', meaningCheck: 'doubt', failed: true },
    },
  };

  it('중국어만, 문장(분석) 순서, 알려진 표식만 · 개행·실패·교정 토큰 제외', () => {
    expect(senseReviewItems(json, 'Chinese').map((i) => i.id)).toEqual(['id_0_1', 'id_0_2']);
    expect(senseReviewItems(json, 'Chinese')[0].token).toMatchObject({ id: 'id_0_1', text: '打' });
    for (const lang of ['Korean', 'Japanese', 'English']) expect(senseReviewItems(json, lang)).toEqual([]);
    expect(senseReviewItems(null, 'Chinese')).toEqual([]);
    expect(needsMeaningCheck({ meaningCheck: 'ctx' })).toBe(true);
    expect(needsMeaningCheck({ meaningCheck: '' })).toBe(false);
    expect(needsMeaningCheck(null)).toBe(false);
  });

  it('표식이 없으면 N = 0(서버 상수 꺼짐 = 운영 화면 변화 0)', () => {
    const clean = structuredClone(json);
    for (const token of Object.values(clean.dictionary)) delete token.meaningCheck;
    expect(senseReviewItems(clean, 'Chinese')).toEqual([]);
  });

  it('닫기 기억 키 = 그 자료의 그 viewerRevision(§12.2) — 재분석하면 바뀐다', () => {
    expect(senseReviewDismissKey(42, json)).toBe('viewer_sense_review_dismissed:42:rev-1');
    expect(senseReviewDismissKey(42, { metadata: {} })).toBe('viewer_sense_review_dismissed:42:0');
  });

  it('후보 = 사전 행 뜻(카드 사전 뜻 목록과 같은 정규화·칠함) — 지금 뜻이 후보면 ◉, 후보 밖 문맥 뜻이면 ◉ 없음', () => {
    const dict = { meanings: [{ meaning: '때리다, 치다', pos: '동사' }, { meaning: '(전화를) 걸다', pos: '동사' }, { meaning: '(운동을) 하다', pos: '동사' }], pos: '동사' };
    expect(senseReviewOptions(dict, json.dictionary.id_0_1)).toEqual([
      { meaning: '때리다, 치다', pos: '동사', current: false },
      { meaning: '(전화를) 걸다', pos: '동사', current: true },
      { meaning: '(운동을) 하다', pos: '동사', current: false },
    ]);
    const vinegar = { meanings: [{ meaning: '식초를 먹다', pos: '동사' }] };
    expect(senseReviewOptions(vinegar, json.dictionary.id_0_2)).toEqual([{ meaning: '식초를 먹다', pos: '동사', current: false }]);
    expect(senseReviewOptions(null, json.dictionary.id_0_2)).toEqual([]);
  });

  it('[이대로 둘게요] = 지금 뜻 그대로 확정 교정, 빈 뜻이면 null(쓰기 0)', () => {
    expect(keepSenseCorrection(json.dictionary.id_0_2)).toEqual({ meaning: '질투하다' });
    expect(keepSenseCorrection({ text: '了', meaning: '  ' })).toBeNull();
  });

  it('교정 적용은 뜻을 고치면(같은 뜻 확정 포함) 표식을 지우고, 발음만 고치면 남긴다 — 나머지 칸은 그대로', () => {
    const token = json.dictionary.id_0_1;
    const dict = { meanings: [{ meaning: '때리다, 치다', pos: '동사' }, { meaning: '(전화를) 걸다', pos: '동사' }] };
    const picked = applyTokenCorrections(token, senseCorrectionFor(token, dict, '때리다, 치다'));
    expect(picked).toEqual({ text: '打', meaning: '때리다, 치다', pos: '동사' });
    expect(applyTokenCorrections(token, keepSenseCorrection(token))).toEqual({ text: '打', meaning: '(전화를) 걸다' });
    expect(applyTokenCorrections(token, { furigana: 'dǎ' })).toEqual({ ...token, furigana: 'dǎ' });
    expect(token.meaningCheck).toBe('doubt'); // 원본 불변
  });
});

describe('뜻 확인 필요 — 배선 (ViewerPage)', () => {
  it('줄은 소유자(사전 뜻 교정과 같은 권한) · 중국어 · 분석 끝 · N>0 · 닫지 않았을 때만 — 수업 모드·구간 학습 제외', () => {
    expect(viewer).toMatch(/const senseReviewAllowed = canEditToken && legacyTokenEditingAllowed && learningStorageSupported && !classStudyActive\s+&& materialLang === 'Chinese' && isDone && !passageOf\(material\);/);
    expect(viewer).toContain('const senseReviewShown = senseReviewAllowed && senseReviewList.length > 0 && senseReviewDismissed !== senseReviewKey;');
    expect(viewer).toContain('const senseReviewList = useMemo(() => senseReviewItems(material?.processed_json, materialLang), [material?.processed_json, materialLang]);');
    const line = sliceBetween(viewer, '{senseReviewShown && (', '\n        )}');
    expect(line).toContain("vt('뜻 확인 필요 {count}개', {count: senseReviewList.length})");
    expect(line).toContain('onClick={openSenseReview}');
    expect(line).toContain('onClick={dismissSenseReview}');
    // 자리 = 통계 줄(viewer-badges) 아래
    expect(viewer.indexOf('{senseReviewShown && (')).toBeGreaterThan(viewer.indexOf('<div className="viewer-badges">'));
  });

  it('닫기는 그 viewerRevision 동안 localStorage(개인 편의 — 읽기·쓰기 모두 try/catch)', () => {
    const dismiss = sliceBetween(viewer, 'const dismissSenseReview = () => {', '\n  };');
    expect(dismiss).toMatch(/try \{ localStorage\.setItem\(senseReviewKey, '1'\); \} catch/);
    expect(viewer).toMatch(/try \{ stored = localStorage\.getItem\(senseReviewKey\)/);
  });

  it('[보기] → 시트 [문장] 탭 자리에 목록(새 화면 아님) · 시트를 닫거나 새 문장 번역이 오면 목록을 닫는다', () => {
    const open = sliceBetween(viewer, 'const openSenseReview = () => {', '\n  };');
    expect(open).toContain('setSentenceTabSignal(s => s + 1);');
    // AD-R3 PR③: 재분석 알림 [보기]의 「적용하지 못한 단어 경계」 목록도 같은 자리를 쓴다(뜻 확인 목록이 먼저).
    expect(viewer).toContain('leftContent={senseReviewContent || boundaryPendingContent || leftPanelContent}');
    expect(viewer).toContain('leftActive={leftPanelLoading || !!leftPanelResult || !!senseReviewContent || !!boundaryPendingContent}');
    expect(sliceBetween(viewer, 'const closeWordCard = () => {', '\n  };')).toContain('setSenseReviewIds(null);');
    expect(sliceBetween(viewer, 'const runSelectedSentence = async (sel, explanationOnly = false) => {', 'try {')).toContain('setSenseReviewIds(null);');
    expect(sliceBetween(viewer, 'const openSentenceTranslation = () => {', '\n  };')).toContain('senseReviewOpen) return;');
  });

  it('목록 교정 = 기존 correctTokenMutation 1회(quiet) · senseCorrectionFor — 전역 승격·단어장·FSRS·사전 쓰기 0', () => {
    const choose = sliceBetween(viewer, 'const chooseReviewSense = (row, meaning) => {', '\n  };');
    const keep = sliceBetween(viewer, 'const keepReviewSense = (row) => {', '\n  };');
    expect(choose).toContain('senseCorrectionFor(row.token, row.dictEntry, meaning)');
    expect(choose).toContain('correctTokenMutation.mutate({ tokenId: row.id, corrections, quiet: true });');
    expect(keep).toContain('keepSenseCorrection(row.token)');
    expect(keep).toContain('correctTokenMutation.mutate({ tokenId: row.id, corrections, quiet: true });');
    for (const banned of ['promoteCorrection', 'dict-correct', 'user_vocabulary', 'addToVocab', 'saveInlineVocabulary', 'knownState', 'morpheme_dictionary', 'review_events']) {
      expect(choose).not.toContain(banned);
      expect(keep).not.toContain(banned);
      expect(list).not.toContain(banned);
    }
    expect(list).not.toMatch(/supabase|fetch\(/);
  });

  it('교정이 표식을 지운다 — 저장 직전과 카드 갱신 모두 applyTokenCorrections(같은 PATCH, 새 쓰기 경로 0)', () => {
    const mutation = sliceBetween(viewer, 'const correctTokenMutation = useMutation({', '\n  });');
    expect(mutation).toContain('[tokenId]: applyTokenCorrections(beforeToken, corrections),');
    expect(mutation).toContain('setSelectedToken(prev => prev?.id === tokenId ? applyTokenCorrections(prev, corrections) : prev);');
    expect(mutation).not.toContain('{ ...beforeToken, ...corrections }');
    // 잇단 교정이 다시 받기 전 낡은 자료로 덮어쓰지 않게 저장한 값을 캐시에 바로 둔다
    expect(mutation).toContain("queryClient.setQueryData(['material', id], (prev) => (prev ? { ...prev, processed_json: updatedJson } : prev));");
  });

  it('후보는 카드와 같은 사전 행 캐시를 구독만 — 비어 있는 키는 기존 일괄 조회(prefetchTokenDict)로', () => {
    expect(viewer).toContain('prefetchTokenDict({ supabase, queryClient, language: materialLang, keys: senseReviewDictKeys })');
    expect(viewer).toContain('queryKey: tokenDictQueryKey(materialLang, key), enabled: false');
  });

  it('카드 ⓘ — meaningCheck일 때만 뜻 줄 아래 「문맥과 다를 수 있어요」, 수업 모드 숨김 · 중국어만', () => {
    expect(card).toContain("{!classStudyActive && materialLang === 'Chinese' && needsMeaningCheck(selectedToken) && <p className=\"reader-card-meaning-check\">");
    expect(card).toContain("vt('문맥과 다를 수 있어요')");
    expect(card.indexOf('reader-card-meaning-check')).toBeGreaterThan(card.indexOf('word-detail-card__meaningrow'));
    expect(card.indexOf('reader-card-meaning-check')).toBeLessThan(card.indexOf('className="reader-card-senses"'));
  });

  it('「AI」 표시 0 — 줄·목록·카드 ⓘ 어디에도 없다', () => {
    const line = sliceBetween(viewer, '{senseReviewShown && (', '\n        )}');
    const tip = sliceBetween(card, 'reader-card-meaning-check', '</p>');
    // 주석(설계 근거 문장)은 빼고 그려지는 코드만 본다
    const code = (text) => text.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const text of [line, tip, list]) expect(code(text)).not.toMatch(/\bAI\b|인공지능/);
    for (const locale of VIEWER_MESSAGE_LOCALES) {
      for (const key of ['뜻 확인 필요 {count}개', '뜻 확인 필요 · {count}개', '문맥과 다를 수 있어요', '이대로 둘게요', '지금: {meaning}', '확인했어요', '보기', '뜻 확인 필요 알림 닫기']) {
        expect(VIEWER_MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
        expect(VIEWER_MESSAGES[locale][key]).not.toMatch(/\bAI\b|人工智能/);
      }
    }
  });
});

describe('뜻 확인 필요 — 목록 (ViewerSenseReview)', () => {
  it('줄마다 문장(그 단어 칠) · 지금 뜻 · 사전 뜻 후보(누름 버튼, aria-pressed) · [이대로 둘게요] / 고친 줄은 「확인했어요」', () => {
    expect(list).toContain("vt('뜻 확인 필요 · {count}개', { count: remaining })");
    expect(list).toContain('<mark>{sentence.term}</mark>');
    expect(list).toContain("vt('지금: {meaning}'");
    expect(list).toContain('aria-pressed={option.current}');
    expect(list).toContain('onClick={() => onChoose(row, option.meaning)}');
    expect(list).toContain("vt('이대로 둘게요')");
    expect(list).toContain("vt('확인했어요')");
    // 화살표 키만으로 저장되는 네이티브 라디오를 쓰지 않는다
    expect(list).not.toContain('type="radio"');
    // 목록을 열면 머리로 포커스 — 시트의 첫 포커스도 같은 곳(data-sheet-focus)
    expect(list).toContain('data-sheet-focus');
    expect(read('src/components/ViewerBottomSheet.jsx')).toContain('[data-panel="${tab}"] [data-sheet-focus]');
  });

  it('누름 영역 44px · 토큰 색만', () => {
    for (const sel of ['.viewer-sense-review__option', '.viewer-sense-review__keep', '.viewer-sense-review-line__open', '.viewer-sense-review-line__close']) {
      expect(css).toMatch(new RegExp(`${sel.replace(/[.]/g, '\\.')}[^{]*\\{[^}]*min-height:44px`));
    }
    const block = sliceBetween(css, '/* AD-R4 PR③', '/* /AD-R4 PR③ */');
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
