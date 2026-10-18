import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

/**
 * 계약 VIEWER-LAZY-PANELS-001 — 뷰어의 조건부 패널은 dynamic import로 열 때만 받는다.
 * 배경: /viewer/[id] page 청크가 478KB(raw)·첫 로드 666KB였고, 그 안에 설정·받아쓰기·읽기 확인·한자 창·대화·
 * 원문 보기·수업 기능처럼 조건이 맞을 때만 그리는 부품이 정적 import로 실려 있었다(빌드 실측 2026-10-16 KST).
 * 방식은 lazyPanel(src/lib/lazyPanel.js)이다 — next/dynamic(Suspense)은 첫 열림을 약 300ms 늦췄다(실측, lazyPanel.js 머리말).
 * ChineseSerif(그리는 것 없는 글꼴 적재기)만 기존 next/dynamic 선례 그대로다.
 *   ⑴ 목록의 부품은 정적 import 0, `lazyPanel(() => import('<경로>')…)` 1개(ChineseSerif는 dynamic).
 *   ⑵ 렌더 조건은 그대로다 — 조건이 거짓이면 부품을 그리지 않으므로 청크도 받지 않는다.
 *   ⑶ 수업 기능의 문은 부품 스스로 null/fallback을 내는 필요조건만 본다(정밀 판정은 부품 안 — 규칙 중복 0).
 *   ⑷ 본문·단어창·시트·훅(TextbookAnnotations·ViewerBottomSheet·TeachingWord의 useWordAppearance)은 정적 그대로.
 *   ⑸ ViewerPage의 dynamic()·lazyPanel()은 전부 이 목록에 있다 — 새로 지연할 부품은 여기 조건과 함께 올린다.
 *   ⑹ lazyPanel은 Suspense 없이 그린다 — 받은 뒤 평범한 상태 갱신, 미리 받았으면 첫 렌더부터 동기.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');

// [이름, 모듈 경로, 렌더 조건(소스에 그대로 있어야 하는 문자열)]
const LAZY_PANELS = [
  ['ChineseSerif', '../components/viewer/ChineseSerif', "{materialLang==='Chinese'&&fontFamily==='serif'&&<ChineseSerif"],
  ['ViewerSettings', '../components/viewer/ViewerSettings', '{settingsOpen&&<ViewerSettings '],
  ['ViewerHanjaPopover', '../components/viewer/ViewerHanjaPopover', '{inspectChar && hanjaPopoverMode && <div className="hanja-pop-layer">'],
  ['ReadingTest', '../components/ReadingTest', '{isDone && showReadingTest && ('],
  ['DictationPicker', '../components/DictationPicker', '{dictationPickerOpen && ('],
  ['DictationPanel', '../components/DictationPanel', '{dictationSentence && ('],
  ['ConversationThread', '../components/conversation/ConversationThread', 'if (conversation) {'],
  ['OriginalMaterialReader', '@/components/materials/OriginalMaterialReader', 'if (shouldReadComposerOriginal(material, originalParams)) {'],
  ['ClassroomReaderPanel', '../components/classroom/ClassroomReader', 'if (props.context && props.user?.id) return <ClassroomReaderPanel {...props} />;'],
  ['ClassSourceFocus', '../components/classroom/ClassSourceFocus', "{(originalParams.has('sourceEntry')||originalParams.has('sourceQuote'))&&<ClassSourceFocus "],
  ['ClassCopyNotice', '../components/classroom/ClassCopyNotice', "{user&&originalParams.get('returnTo')?.startsWith('/class/')&&<ClassCopyNotice "],
];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const declOf = (name, mod) => (name === 'ChineseSerif'
  ? `const ${name} = dynamic(() => import('${mod}'), {ssr:false`
  : `const ${name} = lazyPanel(() => import('${mod}')`);

describe('⑴⑵ 조건부 패널 = dynamic import, 조건은 그대로', () => {
  it.each(LAZY_PANELS)('%s — 정적 import 0 · 지연 선언 1 · 렌더 조건 유지', (name, mod, condition) => {
    expect(viewer).not.toMatch(new RegExp(`^import [^;]*from '${escape(mod)}';`, 'm'));
    expect(viewer.split(`(() => import('${mod}')`).length - 1).toBe(1);
    expect(viewer).toContain(declOf(name, mod));
    expect(viewer).toContain(condition);
  });

  it('창·패널은 받는 동안 null(빈 자리 0), 화면을 통째로 바꾸는 둘은 직전과 같은 「불러오는 중」, 수업은 일반 시트', () => {
    for (const [name, mod] of LAZY_PANELS) {
      const decl = sliceBetween(viewer, declOf(name, mod), '\n');
      if (['ConversationThread', 'OriginalMaterialReader', 'ClassroomReaderPanel'].includes(name)) expect(decl, name).toContain('{fallback:');
      else expect(decl, name).not.toMatch(/fallback|loading/);
    }
    // 원문 보기 = 자료를 받는 동안의 화면과 같은 마크업(전환 깜빡임 0).
    expect(viewer).toContain('if (isLoading) return <div className="page-container"><Spinner message="자료 불러오는 중…" /></div>;');
    expect(sliceBetween(viewer, 'const OriginalMaterialReader = lazyPanel(', '\n')).toContain('{fallback:<div className="page-container"><Spinner message="자료 불러오는 중…" /></div>}');
    expect(sliceBetween(viewer, 'const ClassroomReaderPanel = lazyPanel(', '\n')).toContain('{fallback:props=>props.fallback()}');
  });

  it('한자 창 부품은 중국어 일반 모드에서 유휴 시간에 미리 받는다(첫 글자 탭에 내려받기 대기 0)', () => {
    expect(viewer).toMatch(/if \(!hanjaPopoverMode\) return undefined;\s*return onIdle\(\(\) => \{ ViewerHanjaPopover\.preload\(\)/);
  });

  it('⑹ lazyPanel — Suspense·React.lazy 없이, 받은 모듈은 동기로 그리고, 실패는 경계로', () => {
    const lazy = read('src/lib/lazyPanel.js');
    const code = lazy.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/Suspense|\blazy\(|next\/dynamic/);
    expect(code).toContain("import { createElement, useEffect, useState } from 'react';");
    expect(lazy).toContain('const [, setLoaded] = useState(!!Component);');
    expect(lazy).toContain("if (!Component) return typeof fallback === 'function' ? fallback(props) : fallback;");
    expect(lazy).toContain('if (error) throw error;');
  });
});

describe('⑶ 수업 기능의 문 — 필요조건만, 판정은 부품 안', () => {
  it('ClassroomReader: 수업 맥락·로그인이 없으면 부품도 fallback()만 낸다 → 문이 바로 fallback을 그린다', () => {
    const reader = read('src/components/classroom/ClassroomReader.jsx');
    expect(reader).toContain('enabled:!!user?.id&&!!context');
    expect(reader).toContain("if(!allowed)return typeof fallback==='function'?fallback():fallback;");
    expect(read('src/lib/classWorkspace.js')).toContain("if (!user?.id || !root?.id || root.owner_id !== user.id || !team?.root) return false;");
    const gate = sliceBetween(viewer, 'function ClassroomReader(props) {', '\n}');
    expect(gate).toContain("return typeof props.fallback === 'function' ? props.fallback() : props.fallback;");
    // render-prop 구조(TextbookAnnotations → ClassroomReader → fallback 시트)는 그대로다.
    expect(viewer).toContain('{(annotationContent,annotationOpen,closeWordCard)=><ClassroomReader toolbarTarget={classToolbarTarget}');
    expect(viewer).toContain('fallback={boardActions=>');
    expect(viewer).toContain('/> : boardActions ? null : sentenceMoveBar} />}');
  });
  it('ClassSourceFocus: sourceEntry·sourceQuote가 둘 다 없으면 부품이 null → 그때는 그리지 않는다', () => {
    const focus = read('src/components/classroom/ClassSourceFocus.jsx');
    expect(focus).toContain("const legacyQuote = params.get('sourceQuote'), legacyToken = params.get('sourceToken');");
    expect(focus).toContain("const hasRecord = params.has('sourceEntry');");
    expect(focus).toContain("if (!key && !legacyQuote) { setState(hasRecord ? { message: '수업 기록에서 표현을 다시 열어 주세요.' } : null); return; }");
    expect(read('src/lib/classHistoryNavigation.js')).toContain("entry = params.get('sourceEntry');");
  });
  it('ClassCopyNotice: 로그인·수업 복귀 주소(/class/…)가 없으면 부품이 null → 그때는 그리지 않는다', () => {
    const notice = read('src/components/classroom/ClassCopyNotice.jsx');
    expect(notice).toContain("const match=/^\\/class\\/([a-z0-9][a-z0-9-]{0,15})(?:\\?|$)/.exec(returnTo||'');");
    expect(notice).toContain('if(!user||!team||!sourceId)return null;');
  });
});

describe('⑷⑸ 본문은 정적 · 지연 목록 밖 0', () => {
  it('본문·시트·훅 모듈은 정적 import 그대로', () => {
    for (const line of [
      "import TextbookAnnotations from '../components/classroom/TextbookAnnotations';",
      "import TeachingWord,{WordDisplayControls,useWordAppearance} from '../components/classroom/TeachingWord';",
      "import ViewerBottomSheet from '../components/ViewerBottomSheet';",
      "import ViewerModal from '../components/viewer/ViewerModal';",
    ]) expect(viewer).toContain(line);
  });
  it('ViewerPage의 dynamic()·lazyPanel()은 전부 목록에 있다', () => {
    const declared = [...viewer.matchAll(/(?:dynamic|lazyPanel)\(\(\) => import\('([^']+)'\)/g)].map((m) => m[1]).sort();
    expect(declared).toEqual(LAZY_PANELS.map(([, mod]) => mod).sort());
  });
});
