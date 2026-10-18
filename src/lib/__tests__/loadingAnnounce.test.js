// 대기 알림 규칙(LOADING-ANNOUNCE-001 — 오너 승인 2026-10-17 KST, docs/ui-conventions.md §3):
// ① 칸 안 짧은 대기(~1s: 사전 뜻 · 비슷한 말 · 연결 목록 …)는 role=status 없이 aria-busy만 — 칸마다 읽으면 한 화면에서 대기 글이 겹쳐 읽힌다.
// ② 화면 전체 대기(라우트 골격 · 계정 확인)는 「…불러오는 중…」 한 번 알림을 그대로 둔다(LOADING-SKELETON-001).
// ③ 사용자가 시작한 긴 작업(>3s: 분석 · 일괄 분석 · AI 생성)은 늘 있는 상태 영역에 「〔동작〕하고 있어요…」 한 번, 그다음 끝 상태.
//    진행 숫자는 약 10%마다만 바꾼다(announcedProgress).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { announcedProgress } from '../announceProgress';
import { sliceBetween } from './helpers/sliceBetween';
import { announces, busy, deferredBusy, hiddenCopy, loadingElements, pageLevel, sourceFiles, srOnly } from './helpers/loadingRegions';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const REGION_TAGS = new Set(['p', 'div', 'section', 'span', 'small', 'li']);

// ③ 상시 낭독 영역(sr-only role=status)에 대기 글을 싣는 자리 — 파일별 개수. 늘리려면 여기와 아래 ③ 계약에 함께 적는다.
const LONG_TASK_REGIONS = {
  'src/components/admin/BulkAnalysisPanel.jsx': 1,
  'src/components/LiteraturePublishPanel.jsx': 1,
  'src/views/ViewerPage.jsx': 2, // 자세한 설명(AI) · 분석/복구 배너
  'src/views/StudySessionPage.jsx': 1, // /study 첨삭(AI) — LOADING-ANNOUNCE-002
  'src/components/notes/NoteRecognition.jsx': 1, // 노트 필기 인식(AI)
  'src/components/classroom/BoardInkRecognition.jsx': 1, // 설명판 필기 인식(AI)
};
// ③ 버튼 글자만 바뀌던 긴 작업(LOADING-ANNOUNCE-002) — 같은 글이 버튼 밖 상시 영역(sr-only role=status)에도 있어야 한다.
// 짧은 상태어 버튼(「저장 중…」 「여는 중…」)은 문구 표준대로 버튼 안에만 둔다 — 여기엔 긴 작업만 적는다.
const LONG_TASK_BUTTONS = {
  'src/components/notes/NoteRecognition.jsx': '선택한 필기를 읽는 중…',
  'src/components/classroom/BoardInkRecognition.jsx': '선택한 필기를 읽는 중…',
};
// 대기 글처럼 보이지만 대기 영역이 아닌 줄(이유와 함께). 줄 번호가 아니라 글로 잡는다.
const NOT_LOADING = {
  'src/components/books/BookEditor.jsx': '편집 저장소를 불러오고 있어요. 연결 설정이 끝나야 초안을 저장할 수 있어요.', // 연결 안내 + 다시 시도(멈춘 상태)
};

const inventory = sourceFiles(ROOT).flatMap((file) => loadingElements(fs.readFileSync(file, 'utf8')).map((el) => ({ ...el, file: rel(file) })));
const where = (el) => `${el.file}:${el.line} <${el.tag}> ${el.inner.slice(0, 60)}`;

describe('대기 알림 규칙 — 정적 전수(src 전체)', () => {
  it('목록이 비지 않는다 — 판정기가 실제 대기 줄을 잡는다', () => {
    expect(inventory.length).toBeGreaterThanOrEqual(60);
    expect(inventory.some((el) => el.file === 'src/views/ViewerPage.jsx' && el.phrase === '불러오는 중')).toBe(true);
  });

  it('① 칸 안 대기는 알리지 않는다 — 알림은 화면 전체 대기(②) · 대기 뒤 결과를 싣는 영역의 aria-busy={…} · ③ 상시 영역만', () => {
    const offenders = inventory.filter((el) => {
      const own = announces(el.attrs), parent = !own && announces(el.parentAttrs);
      if (!own && !parent) return false;
      const attrs = own ? el.attrs : el.parentAttrs;
      if (pageLevel(attrs)) return false; // ②
      if (deferredBusy(attrs)) return false; // 대기 → 결과 영역: 대기 동안만 busy
      if (own && srOnly(attrs) && LONG_TASK_REGIONS[el.file]) return false; // ③
      return true;
    }).map(where);
    expect(offenders).toEqual([]);
  });

  it('① 알리지 않는 칸 안 대기에는 aria-busy가 있다(보이는 사본 · 화면 전체 대기 · 대기 아닌 안내 제외)', () => {
    const offenders = inventory.filter((el) => REGION_TAGS.has(el.tag)
      && !announces(el.attrs) && !announces(el.parentAttrs)
      && !hiddenCopy(el.attrs) && !pageLevel(el.attrs)
      && !busy(el.attrs) && !busy(el.parentAttrs)
      && !(NOT_LOADING[el.file] && el.inner.includes(NOT_LOADING[el.file]))).map(where);
    expect(offenders).toEqual([]);
  });

  it('③ 상시 낭독 영역에 대기 글을 싣는 자리는 목록과 같다(새 자리는 목록 · 계약에 함께 적는다)', () => {
    const counts = {};
    for (const el of inventory) if (srOnly(el.attrs) && announces(el.attrs)) counts[el.file] = (counts[el.file] || 0) + 1;
    // 글이 변수(분석 배너 analyzingLine) · 짧은 꼴(「 준비 중」)이면 판정기에 안 잡힌다 — 그 자리는 아래 ③ 계약이 글로 고정한다.
    const over = Object.entries(counts).filter(([file, n]) => n > (LONG_TASK_REGIONS[file] || 0));
    expect(over).toEqual([]);
    expect(counts['src/components/admin/BulkAnalysisPanel.jsx']).toBe(1);
  });

  it('② 화면 전체 대기는 알림 하나를 그대로 둔다(계정 확인 · 공개 읽을거리로 이동 · 대화 · 노트 · 수정할 자료)', () => {
    const kept = inventory.filter((el) => pageLevel(el.attrs) && announces(el.attrs)).map((el) => el.file).sort();
    expect(kept).toEqual([
      'src/components/materials/MaterialComposer.jsx', 'src/components/materials/MaterialEditor.jsx', 'src/components/notes/StudyNotePage.jsx',
      'src/components/web/LibraryPage.jsx', 'src/views/MaterialAddPage.jsx', 'src/views/VocabPage.jsx',
    ]);
    // 대화 첫 화면(방 목록)은 로그인 확인 중에도 머리 · 방 줄을 그린다(CONV-SHELL-001 → CONV-CHAT-001) — 알림 하나는 골격 영역이 맡는다.
    const conv = read('src/views/NewConversationPage.jsx');
    expect(conv.match(/<SkeletonRegion [^>]*\bannounce\b/g)).toHaveLength(1);
    expect(conv).toContain('<SkeletonRegion as="ul" className="conv-rooms__list" label="대화" announce>');
  });
});

describe('③ 긴 작업 — 늘 있는 영역 · 약 10%마다', () => {
  it('announcedProgress: 10% 칸 아래로 내리고 끝은 그대로 — 37편이면 알림이 11번 이하', () => {
    expect(announcedProgress(0, 37)).toBe(0);
    expect(announcedProgress(3, 37)).toBe(0);
    expect(announcedProgress(4, 37)).toBe(4);
    expect(announcedProgress(36, 37)).toBe(36);
    expect(announcedProgress(37, 37)).toBe(37);
    expect(new Set(Array.from({ length: 38 }, (_, done) => announcedProgress(done, 37))).size).toBeLessThanOrEqual(11);
    expect(Array.from({ length: 6 }, (_, done) => announcedProgress(done, 5))).toEqual([0, 1, 2, 3, 4, 5]); // 10개 이하면 매번
    expect(announcedProgress(2, 0)).toBe(2);
  });

  it('일괄 분석(BulkAnalysisPanel): 영역은 조건 밖, 낭독은 announcedProgress, 보이는 줄은 숨긴다', () => {
    const src = read('src/components/admin/BulkAnalysisPanel.jsx');
    expect(src).toContain('<span className="sr-only" role="status">{running ? `${announcedProgress(running.done, running.total)}/${running.total}편 분석하고 있어요…` : \'\'}</span>');
    expect(src).toContain('<span className="bulk-analysis__progress" aria-hidden="true">{running ? `${running.done}/${running.total}편 분석하고 있어요…` : \'\'}</span>');
    expect(src).not.toContain('aria-live');
  });

  it('작품 일괄 게시·분석(LiteraturePublishPanel): 영역은 batch 조건 밖, 「멈춤」은 숨긴 줄 밖', () => {
    const src = read('src/components/LiteraturePublishPanel.jsx');
    const region = '<span className="sr-only" role="status">{batch ? `일괄 진행 ${batch.index + 1}/${batch.titles.length} · 「${batch.titles[batch.index]}」${running ? ` 분석 ${announcedProgress(running.done, running.total)}/${running.total}` : \' 준비 중\'} · 이 화면을 닫지 마세요` : \'\'}</span>';
    expect(src).toContain(`${region}\n        {batch ? (`);
    expect(src).toMatch(/<span className="literature-batch__progress" aria-hidden="true">\s*일괄 진행 \{batch\.index \+ 1\}[\s\S]*?<\/span>\{' '\}\s*<Button size="sm" variant="ghost" onClick=\{\(\) => abortRef\.current\?\.abort\(\)\}>멈춤<\/Button>/);
  });

  it('뷰어: 자세한 설명(AI)과 분석 · 복구 배너는 늘 있는 영역 하나씩, 복구 숫자는 announcedProgress', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain('<span className="sr-only" role="status">{wordDetail?.loading ? vt("상세 설명 만드는 중…") : \'\'}</span>\n        {wordDetail?.loading ? <p className="reader-card-learn__pending" aria-hidden="true">{vt("상세 설명 만드는 중…")}</p>');
    expect(src).toContain('<span className="sr-only" role="status">{isAnalyzing && !needsRecovery ? vt(analyzingLine) : recoveryShown ? recoveryLine(announcedProgress(reanalyze.recovery?.completed, reanalyze.recovery?.total)) : \'\'}</span>\n        {isAnalyzing && !needsRecovery && (');
    expect(src).toContain('<span className="analyzing-banner__line" aria-hidden="true">{vt(analyzingLine)}</span>');
    expect(src).toContain('<span className="analyzing-banner__line" aria-hidden="true">{recoveryLine(reanalyze.recovery?.completed)}</span>');
    expect(src).not.toMatch(/<span role="status" aria-live="polite">\{reanalyze\.committing/);
  });
});

describe('③ 사용자 화면의 긴 작업 — /study 첨삭 · 필기 인식(LOADING-ANNOUNCE-002)', () => {
  it('버튼 글자만 바뀌던 긴 작업은 같은 글을 버튼 밖 상시 영역에도 싣는다', () => {
    for (const [file, text] of Object.entries(LONG_TASK_BUTTONS)) {
      const src = read(file);
      expect(src, file).toMatch(new RegExp(`<button[^>]*>\\{busy\\?'${text}'`));
      const regions = loadingElements(src).filter((el) => srOnly(el.attrs) && announces(el.attrs) && el.inner.includes(`'${text}'`));
      expect(regions.map((el) => el.inner), file).toEqual([`{busy?'${text}':''}`]);
    }
  });
  it('영역은 조건 밖 — 노트는 footer 첫 자식, 설명판은 footer 안 버튼 앞', () => {
    expect(read('src/components/notes/NoteRecognition.jsx')).toContain("<footer><span className=\"sr-only\" role=\"status\">{busy?'선택한 필기를 읽는 중…':''}</span><button className=\"manabi-button\"");
    expect(read('src/components/classroom/BoardInkRecognition.jsx')).toMatch(/<footer>\{error&&<p role="alert">\{error\}<\/p>\}\{message&&<p role="status">\{message\}<\/p>\}\s*\{\/\*[^*]*\*\/\}\s*<span className="sr-only" role="status">\{busy\?'선택한 필기를 읽는 중…':''\}<\/span>\s*\{!rows\?<button/);
  });
  it('/study 첨삭: 영역은 grading 조건 밖, 끝 상태(받지 못함)도 같은 영역 · 보이는 줄은 숨긴 사본', () => {
    const src = read('src/views/StudySessionPage.jsx');
    const region = "<span className=\"sr-only\" role=\"status\">{phase === 'feedback' && produceState?.status === 'grading' ? '첨삭 확인 중…' : phase === 'feedback' && produceState?.status === 'error' ? '첨삭을 받지 못했어요 — 다음에 다시 해 봐요' : ''}</span>";
    expect(src).toContain(`${region}\n          {phase === 'feedback' && produceState?.status === 'grading' && (`);
    expect(src).toContain('<p className="study-produce__pending" aria-hidden="true"');
    expect(src).toMatch(/<p className="study-produce__error" aria-hidden="true"[^>]*>\s*첨삭을 받지 못했어요 — 다음에 다시 해 봐요\s*<\/p>/);
  });
});

describe('문서 — 규칙이 §3에 한 줄로', () => {
  it('ui-conventions.md §3이 세 갈래와 계약 파일을 가리킨다', () => {
    const doc = read('docs/ui-conventions.md');
    const section = sliceBetween(doc, '## 3. 접근성', '## 4. 테마');
    expect(section).toContain('LOADING-ANNOUNCE-001');
    expect(section).toContain('aria-busy');
    expect(section).toContain('loadingAnnounce.test.js');
  });
});
