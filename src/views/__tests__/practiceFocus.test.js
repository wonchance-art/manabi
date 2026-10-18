// 연습 화면(/quick · /writing · /conversation/new) 초점 · 이름 점검 후속(2026-10-17 KST, 손님 + 합성 로그인 390 · 1440).
// 화면은 바꾸지 않는다 — 누른 단추가 사라지거나 잠겨 body로 떨어지던 초점을 다음 자리로 잇고, 이름 없는 입력에 이름을 준다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('QUICK-FOCUS-001 — 빠른 분석 탭 사전은 대화상자처럼 초점을 다룬다', () => {
  const quick = read('src/views/QuickPage.jsx');
  const effect = sliceBetween(quick, 'const popupOpen = !!wordDetail;', '}, [popupOpen]);');

  it('열리면 닫기로, Esc로 닫고, Tab은 팝업 안에서 돌고, 닫히면 연 단어로(다른 곳에 초점이 없을 때만)', () => {
    expect(effect).toContain("popupRef.current?.querySelector('.pdf-detail-popup__close')?.focus({ preventScroll: true });");
    expect(effect).toContain("if (e.key === 'Escape') { e.preventDefault(); setWordDetail(null); return; }");
    expect(effect).toContain('else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }');
    expect(effect).toContain("if (opener?.isConnected && (!active || active === document.body)) opener.focus({ preventScroll: true });");
    expect(effect).toContain("document.removeEventListener('keydown', onKey);");
  });

  it('연 단어를 기억한다 — 클릭 · Enter/Space 둘 다', () => {
    const token = sliceBetween(quick, '<div key={i} className="word-token" role="button" tabIndex={0}', '{rubySegments ? (');
    expect(token).toContain('onClick={(e) => { openerRef.current = e.currentTarget; openWordDetail(token, line); }}');
    expect(token).toContain('openerRef.current = e.currentTarget, openWordDetail(token, line)');
  });

  it('팝업은 이름 있는 modal 대화상자 · 닫기 단추에 이름 · 표제어에 언어 표식', () => {
    expect(quick).toContain('<div className="pdf-detail-popup" ref={popupRef} role="dialog" aria-modal="true" aria-labelledby={popupWordId}>');
    expect(quick).toContain('<div className="pdf-detail-popup__word" id={popupWordId} lang={htmlLang(language)}>');
    expect(quick).toContain('<button type="button" className="pdf-detail-popup__close" aria-label="닫기" onClick={() => setWordDetail(null)}>✕</button>');
  });

  it('분석이 끝나면 결과 제목으로(잠긴 「분석」에서 body로 떨어지던 자리)', () => {
    const done = sliceBetween(quick, 'const resultHeadRef = useRef(null);', '}, [resultLines]);');
    expect(done).toContain("if (resultLines) focusIfFree(resultHeadRef.current, resultHeadRef.current?.closest('.page-container'));");
    expect(quick).toContain('<h2 ref={resultHeadRef} tabIndex={-1} className="sr-only">분석 결과</h2>');
  });

  it('언어 선택에 이름 · 오류는 알림 · 분석 진행/끝은 상시 알림 영역(단추 글자와 다른 문구)', () => {
    expect(quick).toContain('aria-label="분석 언어"');
    expect(quick).toContain('<span role="alert">{error}</span>');
    const status = sliceBetween(quick, '<span className="sr-only" role="status">', '</span>');
    expect(status).toContain("analyzing ? '텍스트를 분석하는 중이에요'");
    expect(status).toContain('`분석을 마쳤어요 — ${resultLines.length}줄`');
    expect(status).not.toContain("'분석 중…'");
  });
});

describe('WRITING-FOCUS-001 — 작문 첨삭 전후 초점', () => {
  const writing = read('src/views/WritingStudioPage.jsx');
  const effect = sliceBetween(writing, 'const hadResult = useRef(false);', '}, [result]);');

  it('결과가 오면 결과 제목으로, 다시 쓰러 돌아오면 작문 칸으로 — 처음 그림에서는 옮기지 않는다', () => {
    expect(effect).toContain('if (result) { hadResult.current = true; focusIfFree(resultHeadRef.current, scope); return; }');
    expect(effect).toContain('if (!hadResult.current) return;');
    expect(effect).toContain('focusIfFree(textareaRef.current, scope);');
    expect(writing).toContain('<h2 ref={resultHeadRef} tabIndex={-1} className="sr-only">첨삭 결과 — {result.score}점</h2>');
  });

  it('작문 칸에 이름 · 오류는 알림 · 첨삭 대기는 상시 알림 영역', () => {
    const area = sliceBetween(writing, '<textarea', '/>');
    expect(area).toContain('ref={textareaRef}');
    expect(area).toContain('aria-label={`${LANGS.find(l => l.key === language)?.label} 작문`}');
    expect(writing).toContain("<span className=\"sr-only\" role=\"status\">{loading ? '첨삭을 받는 중이에요' : ''}</span>");
    expect(writing).toContain("{error && <p role=\"alert\" style={{ color: 'var(--danger)'");
  });
});

describe('CONV-FOCUS-001 — 방을 열다 실패한 뒤 다시 누를 자리(방 목록판)', () => {
  const conv = read('src/views/NewConversationPage.jsx');
  it('오류가 나고 잠김이 풀리면 누른 줄(내 주제면 그 칸)로 — 다른 곳의 초점은 그대로', () => {
    const effect = sliceBetween(conv, 'const failedTopic = useRef(\'\');', '}, [error, opening]);');
    expect(effect).toContain('if (!error || opening || !failedTopic.current) return;');
    expect(effect).toContain(".find((b) => b.dataset.topic === failedTopic.current)");
    expect(effect).toContain("|| list?.querySelector('.conv-rooms__own input');");
    expect(effect).toContain('focusIfFree(row, list);');
    expect(conv).toContain("setOpening(chosen); setError(''); failedTopic.current = chosen;");
    expect(conv).toContain('data-topic={room.topic} disabled={!!opening}');
  });
});
