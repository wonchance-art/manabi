import React from 'react';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import ConfirmModal from '../../components/ConfirmModal';
import ViewerQuizModal from '../../views/ViewerQuizModal';
import { REVIEW_PREP_FAILED } from '../../views/VocabReview';
import { REMINDER_BADGE, REMINDER_ICON, REMINDER_URL, showLocalReminder } from '../localReminder';

// WALL-STATES-001(설계 세션 상태 문구 점검) ②~⑥·⑧ — 확인 창·닫기·상태 문구·알림의 배선 계약.
// 계약 = 배선 보증(ui-conventions §5). 행동은 wallStatesBehavior.test.jsx가 훅을 직접 돌려 본다.
const read = file => readFileSync(file, 'utf8');
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path);
    return /\.(js|jsx)$/.test(name) ? [path] : [];
  });
}
const SOURCES = walk('src');
/** 파일 안의 `<ConfirmModal … />` 여는 태그 전부. */
function confirmBlocks(src) {
  const blocks = [];
  for (let at = src.indexOf('<ConfirmModal'); at >= 0; at = src.indexOf('<ConfirmModal', at + 1)) {
    blocks.push(sliceBetween(src.slice(at), '<ConfirmModal', '/>'));
  }
  return blocks;
}

describe('② 공용 확인 창 — 기본 버튼은 중립', () => {
  it('기본값은 「확인」(primary) — 빨간 「삭제」가 아니다', () => {
    const html = renderToStaticMarkup(<ConfirmModal open message="계속할까요?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('>확인</button>');
    expect(html).toContain('btn btn--primary');
    expect(html).not.toContain('삭제');
    expect(html).not.toContain('btn--danger');
  });

  it('잠근 확인 버튼은 disabled로 그린다(조용한 무반응 대신)', () => {
    const html = renderToStaticMarkup(<ConfirmModal open title="휴지통으로 이동" message="확인하는 중" confirmLabel="이동" confirmDisabled onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toMatch(/<button class="btn btn--primary btn--sm" disabled="">이동<\/button>/);
    expect(html).toContain('aria-labelledby="confirm-title"');
  });

  it('모든 호출부가 버튼 문구와 제목을 직접 정한다 — 기본값에 기대어 뜻이 바뀌지 않게', () => {
    const callers = SOURCES.filter(file => !file.endsWith('ConfirmModal.jsx') && read(file).includes('<ConfirmModal'));
    expect(callers.length).toBeGreaterThanOrEqual(8);
    for (const file of callers) {
      for (const block of confirmBlocks(read(file))) {
        const spread = block.includes('{...');
        expect(spread || /\bconfirmLabel=/.test(block), `${file}: confirmLabel 없음\n${block}`).toBe(true);
        expect(spread || /\btitle=/.test(block), `${file}: 제목 없는 확인 창\n${block}`).toBe(true);
        expect(spread || /\bvariant=/.test(block), `${file}: variant 없음\n${block}`).toBe(true);
      }
    }
  });

  it('휴지통 이동(되돌릴 수 있음)은 빨간 danger로 묻지 않는다', () => {
    for (const file of SOURCES) {
      for (const block of confirmBlocks(read(file))) {
        if (block.includes('휴지통')) expect(block, file).not.toContain('variant="danger"');
      }
    }
    const materials = confirmBlocks(read('src/views/MaterialsPage.jsx')).join('\n');
    expect(materials).toContain('title="휴지통으로 이동"');
    expect(materials).toContain('confirmLabel="이동"');
  });

  it('영구 삭제 확인(관리자·단어)은 제목을 갖고 「삭제」(danger)를 명시한다', () => {
    const admin = read('src/views/AdminPage.jsx');
    for (const title of ['자료 삭제', '소스 삭제', '수정본 삭제']) expect(admin).toContain(`confirmDelete('${title}',`);
    expect(confirmBlocks(admin)[0]).toMatch(/title=\{confirmAction\?\.title\}[\s\S]*confirmLabel="삭제"[\s\S]*variant="danger"/);
    const list = read('src/views/VocabList.jsx');
    expect(list.match(/title: '단어 삭제'/g)).toHaveLength(2);
    const vocabPageBlocks = confirmBlocks(read('src/views/VocabPage.jsx'));
    expect(vocabPageBlocks).toHaveLength(1);
    expect(vocabPageBlocks[0]).toMatch(/title=\{confirmAction\?\.title\}[\s\S]*confirmLabel="삭제"[\s\S]*variant="danger"/);
  });
});

describe('③ 이해도 퀴즈·읽기 완료 창', () => {
  const noop = () => {};
  it('퀴즈 창은 dialog 역할·이름과 닫기 버튼을 가진다(로딩·진행·완료 모두)', () => {
    for (const [state, name] of [[{ status: 'loading' }, '이해도 확인 중...'],
      [{ status: 'active', currentQ: 0, selected: null, questions: [{ question: 'q', options: ['a', 'b'], answer: 0 }] }, '이해도 퀴즈'],
      [{ status: 'done', score: 1, total: 1 }, '퀴즈 완료']]) {
      const html = renderToStaticMarkup(<ViewerQuizModal quizState={state} closeQuiz={noop} setCompletionModal={noop} />);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain(`aria-label="${name}"`);
      expect(html).toContain('aria-label="퀴즈 닫기"');
    }
  });

  it('읽기 완료 창도 dialog이고, 다음 추천 언어는 자료 언어 이름으로 쓴다(프랑스어·중국어를 「일본어」로 쓰지 않음)', () => {
    const labels = { French: '프랑스어', Chinese: '중국어', English: '영어', Japanese: '일본어' };
    for (const [language, label] of Object.entries(labels)) {
      const html = renderToStaticMarkup(<ViewerQuizModal quizState={null} completionModal={{ streak: 1, dueCount: 0 }} setCompletionModal={noop}
        material={{ title: '자료' }} nextMaterial={{ id: 'n1', title: '다음 자료', language }} />);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-labelledby="completion-modal-title"');
      expect(html).toContain(`<span class="completion-next-card__flag">${label}</span>`);
    }
    expect(read('src/views/ViewerQuizModal.jsx')).toContain("import { langNameKo } from '../lib/constants'");
  });

  it('ViewerPage가 closeQuiz를 퀴즈 창에 넘긴다', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('finishQuiz={finishQuiz} closeQuiz={closeQuiz}');
  });

  it('닫기 버튼은 단독 아이콘 버튼이라 44×44', () => {
    const css = sliceBetween(read('src/index.css'), '.completion-modal__close {', '}');
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });
});

describe('④ 확인 없이 지우거나 버리는 동작', () => {
  it('단어 편집: 취소·배경 클릭·Esc가 모두 버리기 확인을 거친다', () => {
    const list = read('src/views/VocabList.jsx');
    expect(list).toContain('<div className="modal-overlay" onClick={requestEditClose}>');
    expect(list).toContain('<Button variant="ghost" onClick={requestEditClose} style={{ flex: 1 }}>취소</Button>');
    const esc = sliceBetween(list, "if (event.key === 'Escape') {", 'return;');
    expect(esc).toContain('requestEditClose()');
    expect(esc).not.toContain('setEditing(null)');
    // 직접 닫기는 저장 성공과 확인 후 버리기(onClose)만
    expect(list.match(/setEditing\(null\)/g)).toHaveLength(2);
    expect(list).toContain('{...discardEdit.confirmProps}');
  });

  it('원문 수정: 취소·Esc·배경 클릭이 버리기 확인을 거치고, 확인 창은 dialog 안에 그린다', () => {
    const modal = read('src/views/SourceEditModal.jsx');
    expect(modal).toContain('onClose={()=>{if(!saving)discard.requestClose();}}');
    expect(modal).toContain('onClick={discard.requestClose} disabled={saving}>취소</button>');
    expect(modal).toContain('dirty: open && draft !== baseline.text');
    expect(sliceBetween(modal, '<ViewerModal', '</ViewerModal>')).toContain('<ConfirmModal {...discard.confirmProps} />');
    // Esc 연타로 크롬이 창을 직접 닫아도(cancel 불가) 마운트된 창은 다시 띄운다 — 실렌더는 viewer-dialog-guards.e2e.mjs.
    expect(read('src/components/viewer/ViewerModal.jsx')).toContain('onClose={e=>{const dialog=e.currentTarget;if(dialog.isConnected&&!dialog.open)dialog.showModal();}}');
  });

  it('자료 관리 > 전체 분석은 확인 화면을 먼저 연다(분석 전·실패 배너는 바로 시작)', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const menu = sliceBetween(viewer, "{reanalyzePanel === 'menu' && (", "{reanalyzePanel === 'confirm-full' && (");
    expect(menu).toContain('onClick={requestFullReanalyze}');
    expect(menu).not.toContain('startFullReanalyze');
    const confirm = sliceBetween(viewer, "{reanalyzePanel === 'confirm-full' && (", "{reanalyzePanel === 'pick' && (");
    expect(confirm).toContain('onClick={startFullReanalyze}');
    expect(confirm).toContain('vt("전체 분석을 다시 할까요?")');
    expect(confirm).toContain("onClick={() => setReanalyzePanel('menu')}");
  });

  it('수업 초안 비우기는 확인 뒤에만 지운다', () => {
    const reader = read('src/components/classroom/ClassroomReader.jsx');
    expect(reader).not.toMatch(/onClick=\{\(\)=>clearDraft\(/);
    expect(reader.match(/onClick=\{\(\)=>setClearing\(/g)).toHaveLength(2);
    const block = confirmBlocks(reader).join('\n');
    expect(block).toContain('title="초안 비우기"');
    expect(block).toContain('variant="danger"');
    expect(block).toContain('clearDraft(row)');
  });

  it('PDF 휴지통: 연결 확인 전·실패 시 이유를 쓰고 「이동」을 잠근다', () => {
    const block = confirmBlocks(read('src/views/MaterialAddPdfSection.jsx'))[0];
    expect(block).toContain('confirmDisabled={relatedCount === null || relatedError}');
    expect(block).toContain('연결된 자료를 확인하지 못했습니다. 닫은 뒤 다시 시도해 주세요.');
    expect(block).toContain('연결된 자료를 확인하는 중입니다…');
  });
});

describe('⑤ 상태와 맞는 문구', () => {
  it('복습 준비 실패는 「저장 실패 … 이 단어는」이라고 말하지 않는다', () => {
    expect(REVIEW_PREP_FAILED).not.toContain('저장 실패');
    expect(REVIEW_PREP_FAILED).not.toContain('이 단어');
    const page = read('src/views/VocabPage.jsx');
    expect(sliceBetween(page, "{admission.error && tab !== 'review'", '</div>}')).toContain('{REVIEW_PREP_FAILED}');
    expect(read('src/views/VocabReview.jsx')).toContain("{admissionError ? REVIEW_PREP_FAILED : '복습 준비 중…'}");
  });

  it('복습 일정 오류(role=alert)에 로딩 문구를 쓰지 않는다', () => {
    const line = sliceBetween(read('src/views/VocabPage.jsx'), "{fsrsReview.status === 'error' &&", '</p>}');
    expect(line).toContain('복습 일정을 불러오지 못했어요.');
    expect(line).not.toContain('확인하고 있어요');
  });

  it('읽기 트랙: 로딩에는 다시 시도 버튼이 없고, 응답 후 상세가 없을 때만 실패 문구와 버튼', () => {
    const src = read('src/views/ReadingTrackPage.jsx');
    const loading = sliceBetween(src, '{activePending ? (', ') : !deniedGuest ? (');
    expect(loading).toContain('글과 문항을 불러오는 중이에요…');
    expect(loading).not.toContain('다시 시도');
    const failed = sliceBetween(src, ') : !deniedGuest ? (', ') : (');
    expect(failed).toContain('글과 문항을 불러오지 못했어요.');
    expect(failed).toContain('다시 시도');
  });

  it('그룹·관리자 목록 불러오기 실패는 빈 상태와 구분한다', () => {
    const groups = read('src/views/GroupsPage.jsx');
    expect(groups.indexOf('groupsError && !groups ?')).toBeGreaterThan(0);
    expect(groups.indexOf('groupsError && !groups ?')).toBeLessThan(groups.indexOf(') : !groups?.length ? ('));
    expect(groups).toContain('그룹 목록을 불러오지 못했어요.');
    expect(groups).toContain('const readFailed = readsError && !read?.material && !picking;');
    expect(groups).toContain('{snapshotsError && parts.length === 0 ? (');
    const admin = read('src/views/AdminPage.jsx');
    for (const [error, what] of [['usersError', '유저'], ['materialsError', '자료'], ['sourcesError', '소스'], ['overridesError', '수정본'], ['reportsError', '신고']]) {
      expect(admin).toContain(`${error} ? <AdminLoadError what="${what}"`);
    }
  });
});

describe('⑥ 알림 권한은 사용자가 고른 뒤에만', () => {
  it('Notification.requestPermission은 푸시 구독(push.js)과 내 정보의 시각 버튼에서만 부른다', () => {
    const callers = SOURCES.filter(file => read(file).includes('requestPermission(')).sort();
    expect(callers).toEqual(['src/lib/push.js', 'src/views/MyPage.jsx']);
    expect(read('src/views/VocabPage.jsx')).not.toContain('requestPermission');
  });
});

describe('⑧ 로컬 복습 알림', () => {
  it('Layout은 new Notification을 직접 부르지 않고, 없는 /favicon.ico를 쓰지 않는다', () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).not.toContain('new Notification(');
    expect(layout).not.toContain('/favicon.ico');
    expect(layout).toContain("showLocalReminder('복습할 시간이에요'");
  });

  it('아이콘·배지 파일이 public에 실제로 있다', () => {
    for (const path of [REMINDER_ICON, REMINDER_BADGE]) expect(existsSync(join('public', path)), path).toBe(true);
  });

  const granted = Object.assign(vi.fn(), { permission: 'granted' });
  it('서비스 워커 등록이 있으면 registration.showNotification으로 띄운다(안드로이드 크롬 경로)', async () => {
    const showNotification = vi.fn(async () => {});
    const Notification = Object.assign(vi.fn(), { permission: 'granted' });
    const env = { Notification, navigator: { serviceWorker: { getRegistration: async () => ({ showNotification }) } } };
    expect(await showLocalReminder('제목', { body: '본문', tag: 't' }, env)).toBe(true);
    expect(showNotification).toHaveBeenCalledWith('제목', { body: '본문', tag: 't', icon: '/icon-192.png', badge: '/badge-96.png', data: { url: REMINDER_URL } });
    expect(Notification).not.toHaveBeenCalled();
  });

  it('등록이 없거나 showNotification이 실패하면 new Notification으로 내려간다', async () => {
    for (const getRegistration of [async () => undefined, async () => ({ showNotification: async () => { throw new TypeError('no'); } })]) {
      const Notification = Object.assign(vi.fn(), { permission: 'granted' });
      expect(await showLocalReminder('제목', {}, { Notification, navigator: { serviceWorker: { getRegistration } } })).toBe(true);
      expect(Notification).toHaveBeenCalledTimes(1);
      expect(Notification.mock.calls[0][1].icon).toBe('/icon-192.png');
    }
    expect(await showLocalReminder('제목', {}, { Notification: granted, navigator: {} })).toBe(true);
  });

  it('권한이 없거나 두 길이 모두 실패하면 false(호출부는 오늘 보냄으로 기록하지 않는다)', async () => {
    const denied = Object.assign(vi.fn(), { permission: 'default' });
    expect(await showLocalReminder('제목', {}, { Notification: denied, navigator: {} })).toBe(false);
    expect(denied).not.toHaveBeenCalled();
    expect(await showLocalReminder('제목', {}, { navigator: {} })).toBe(false);
    const throwing = Object.assign(vi.fn(() => { throw new TypeError('Illegal constructor'); }), { permission: 'granted' });
    expect(await showLocalReminder('제목', {}, { Notification: throwing, navigator: { serviceWorker: { getRegistration: async () => undefined } } })).toBe(false);
    expect(read('src/components/Layout.jsx')).toMatch(/\.then\(\(shown\) => \{\s*if \(shown\)/);
  });
});
