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

describe('② 공용 확인 창 — 기본 버튼은 중립, 문구는 표준(copy-standard §2)', () => {
  it('버튼 문구 기본값이 없다 — 「확인」·빨간 「삭제」로 떨어지지 않는다', () => {
    const html = renderToStaticMarkup(<ConfirmModal open title="계속할까요?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).not.toContain('>확인</button>');
    expect(html).not.toContain('삭제');
    expect(html).toContain('btn btn--primary');
    expect(html).not.toContain('btn--danger');
    // 둘째 문장(message)은 있을 때만 그린다
    expect(html).not.toContain('confirm-modal__msg');
  });

  it('잠근 확인 버튼은 disabled로 그린다(조용한 무반응 대신)', () => {
    const html = renderToStaticMarkup(<ConfirmModal open title="휴지통으로 옮길까요?" message="확인하고 있어요…" confirmLabel="휴지통으로" confirmDisabled onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toMatch(/<button class="btn btn--primary btn--sm" disabled="">휴지통으로<\/button>/);
    expect(html).toContain('aria-labelledby="confirm-title"');
    expect(html).toContain('<p class="confirm-modal__msg">확인하고 있어요…</p>');
  });

  it('어느 호출부도 「확인」/「예」를 동작 버튼으로 쓰지 않는다', () => {
    for (const file of SOURCES) {
      for (const block of confirmBlocks(read(file))) expect(block, file).not.toMatch(/confirmLabel=["{`']+(확인|예)["}`']/);
    }
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
    // 휴지통 이동 = 질문 제목 + 「휴지통으로」(「이동」·「삭제」 아님)
    const materialsSrc = read('src/views/MaterialsPage.jsx');
    const materials = confirmBlocks(materialsSrc).join('\n');
    expect(materialsSrc).toContain('title: `"${m.title}" 자료를 휴지통으로 옮길까요?`,');
    expect(materialsSrc).toContain("message: '학습 기록은 남아 있어요.',");
    expect(materials).toContain('title={confirmAction?.title}');
    expect(materials).toContain('confirmLabel="휴지통으로"');
    const pdf = confirmBlocks(read('src/views/MaterialAddPdfSection.jsx'))[0];
    expect(pdf).toContain('title={`"${pdf?.title}" PDF를 휴지통으로 옮길까요?`}');
    expect(pdf).toContain('confirmLabel="휴지통으로"');
    // 실제 서재 경로(/materials → LibraryPage → LibraryShelf, M09 실측 6145801780)도 같은 표준.
    const shelf = read('src/components/library/LibraryShelf.jsx');
    const shelfTrash = sliceBetween(shelf, "{dialog==='trash'&&", '</LibraryDialog>');
    expect(shelfTrash).toContain('`"${menu.display_title||menu.title}" 자료를 휴지통으로 옮길까요?`');
    expect(shelfTrash).toContain('`선택한 ${subject.length}개 자료를 휴지통으로 옮길까요?`');
    expect(shelfTrash).toContain('<p>학습 기록은 남아 있어요.</p>');
    expect(shelfTrash).toContain('>휴지통으로</button>');
    expect(shelfTrash).not.toMatch(/>이동<\/button>|title="휴지통으로 이동"|남습니다/);
    for (const block of [materials, pdf]) {
      expect(block).not.toContain('confirmLabel="이동"');
      expect(block).not.toContain('confirmLabel="삭제"');
    }
  });

  it('영구 삭제 확인(관리자·단어)은 질문 제목 + 「삭제」(danger) + 되돌릴 수 없음 한 문장', () => {
    const admin = read('src/views/AdminPage.jsx');
    for (const title of ['「${m.title}」 자료를 삭제할까요?', '「${s.name}」 소스를 삭제할까요?', '「${o.lang} · ${o.slug}」 수정본을 삭제할까요?']) expect(admin).toContain(`confirmDelete(\`${title}\`,`);
    expect(admin).toContain("message: '삭제하면 되돌릴 수 없어요.',");
    expect(admin).not.toContain('하시겠습니까');
    expect(admin).not.toContain('을(를)');
    expect(confirmBlocks(admin)[0]).toMatch(/title=\{confirmAction\?\.title\}[\s\S]*confirmLabel="삭제"[\s\S]*variant="danger"/);
    const list = read('src/views/VocabList.jsx');
    expect(list).toContain('title: `선택한 ${selectedIds.size}개 단어를 삭제할까요?`,');
    expect(list).toContain('title: `"${v.word_text}" 단어를 삭제할까요?`,');
    expect(list.match(/message: '삭제하면 되돌릴 수 없어요\.',/g)).toHaveLength(2);
    const vocabPageBlocks = confirmBlocks(read('src/views/VocabPage.jsx'));
    expect(vocabPageBlocks).toHaveLength(1);
    expect(vocabPageBlocks[0]).toMatch(/title=\{confirmAction\?\.title\}[\s\S]*confirmLabel="삭제"[\s\S]*variant="danger"/);
  });
});

describe('③ 이해도 퀴즈·읽기 완료 창', () => {
  const noop = () => {};
  it('퀴즈 창은 dialog 역할·이름과 닫기 버튼을 가진다(로딩·진행·완료 모두)', () => {
    for (const [state, name] of [[{ status: 'loading' }, '이해도 확인 중…'],
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
    expect(block).toContain('title={`「${draftLabel(clearing)}」 초안을 비울까요?`}');
    expect(block).toContain('message="지운 초안은 되돌릴 수 없어요."');
    expect(block).toContain('confirmLabel="비우기"');
    expect(block).toContain('variant="danger"');
    expect(block).toContain('clearDraft(row)');
  });

  it('PDF 휴지통: 연결 확인 전·실패 시 이유를 쓰고(해요체) 「휴지통으로」를 잠근다', () => {
    const block = confirmBlocks(read('src/views/MaterialAddPdfSection.jsx'))[0];
    expect(block).toContain('confirmDisabled={relatedCount === null || relatedError}');
    expect(block).toContain("'연결된 자료를 확인하지 못했어요. 닫은 뒤 다시 시도해 주세요.'");
    expect(block).toContain("'연결된 자료를 확인하고 있어요…'");
    expect(block).toContain("'원본과 학습 기록은 남아 있어요.'");
    expect(block).not.toMatch(/습니다|입니다/);
  });

  it('이 PR이 더한 확인 창 문구는 표준을 따른다 — 질문 제목·해요체·「…」·「해 주세요」', () => {
    const touched = ['src/views/MaterialsPage.jsx', 'src/views/MaterialAddPdfSection.jsx', 'src/views/AdminPage.jsx', 'src/views/VocabList.jsx',
      'src/components/classroom/ClassroomReader.jsx', 'src/lib/useDiscardGuard.js'];
    for (const file of touched) {
      const src = read(file);
      for (const block of confirmBlocks(src)) {
        const literal = block.match(/\btitle=(?:"([^"]+)"|\{`([^`]+)`\})/);
        if (literal) expect(literal[1] || literal[2], `${file}: 확인창 제목은 질문`).toMatch(/\?$/);
      }
      // 확인 창 문구(여는 태그·setConfirmAction 객체·confirmDelete 호출·DISCARD_CONFIRM)만 본다 — 파일의 다른 기존 문구는 이 PR 범위 밖.
      const objects = [...src.matchAll(/setConfirmAction\(\{[\s\S]*?onConfirm|DISCARD_CONFIRM = Object\.freeze\(\{[\s\S]*?\}\)/g)].map(m => m[0]);
      for (const object of objects) {
        for (const [, title] of object.matchAll(/\btitle: [`'"]([^`'"]+)[`'"],/g)) expect(title, `${file}: 확인창 제목은 질문`).toMatch(/\?$/);
      }
      for (const [, title] of src.matchAll(/confirmDelete\(`([^`]+)`,/g)) expect(title, `${file}: 확인창 제목은 질문`).toMatch(/\?$/);
      const copy = [...confirmBlocks(src), ...objects].join('\n').replace(/\{\.\.\./g, '{'); // JSX 펼침 문법 제외
      expect(copy, file).not.toMatch(/해주세요|하시겠습니까|습니다|입니다|로딩 중|\.\.\.|을\(를\)|「확인」/);
    }
    expect(read('src/lib/useDiscardGuard.js')).toContain("title: '저장하지 않은 변경을 버릴까요?',");
    expect(read('src/lib/useDiscardGuard.js')).toContain("confirmLabel: '버리기',");
    expect(read('src/lib/useDiscardGuard.js')).toContain("cancelLabel: '계속 수정',");
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('vt("지금 분석 결과를 새 결과로 바꿔요. 직접 고친 뜻·단어 경계는 같은 자리에 남은 것만 이어져요.")');
    expect(viewer).not.toContain('새 결과로 바꿉니다');
  });
});

describe('⑤ 상태와 맞는 문구', () => {
  it('복습 준비 실패는 「저장 실패 … 이 단어는」이라고 말하지 않는다', () => {
    expect(REVIEW_PREP_FAILED).not.toContain('저장 실패');
    expect(REVIEW_PREP_FAILED).not.toContain('이 단어');
    const page = read('src/views/VocabPage.jsx');
    // 끊김 기다림(F9 learning_admission_offline)은 실패가 아니라 이 알림에서 뺀다 — 세션 안 끊김 카드가 말한다(offlineReviewScreen).
    expect(sliceBetween(page, "{admission.error && !isAdmissionOfflineError(admission.error) && tab !== 'review'", '</div>}')).toContain('{REVIEW_PREP_FAILED}');
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
    expect(loading).toContain('글과 문항 불러오는 중…');
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
      expect(admin).toContain(`<Spinner message="${what} 목록 불러오는 중…" />`);
    }
    expect(admin).not.toContain('로딩 중...');
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
