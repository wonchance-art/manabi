// WALL-STATES-001 ④ — 확인 없이 사라지던 작업(실렌더). 소스 계약(wallStatesContracts)이 배선을, 여기서는 실제 브라우저의
// 네이티브 <dialog>(top layer) 안에서 확인 창이 뜨고 조작되는지, 크롬의 close watcher(Esc 연타 시 cancel을 막지 못하게 함)
// 아래에서도 편집 창이 화면에서 사라진 채 상태만 남지 않는지를 본다. 합성 백엔드만(계정·운영 DB 없음).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixtures/material-editing-backend.mjs';

const owner = '00000000-0000-4000-8000-000000000172';
const ID = 94377;
const t = (text, furigana, meaning, pos = '명사') => ({ text, base_form: text, furigana, meaning, pos });
const LINE = [t('他', 'tā', '그', '대명사'), t('是', 'shì', '~이다', '동사'), t('我', 'wǒ', '나', '대명사'), t('的', 'de', '~의', '조사'), t('朋友', 'péng you', '친구'), t('。', '', '', '기호')];
const RAW = LINE.map(x => x.text).join('');

async function open({ width = 1280, prepare } = {}) {
  const f = await fixture({ width });
  const json = { status: 'completed', metadata: { language: 'Chinese' }, sequence: LINE.map((_, i) => `id_0_${i}`), dictionary: Object.fromEntries(LINE.map((x, i) => [`id_0_${i}`, x])) };
  f.rows.push({ id: ID, user_id: owner, owner_id: owner, title: '닫기 확인 검수', raw_text: RAW, source_type: 'text', created_at: new Date().toISOString(), processed_json: json });
  f.writes = [];
  f.page.on('request', req => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && /reading_materials|viewer_replace_analysis|\/api\/analyze/.test(req.url())) f.writes.push(req.url()); });
  await prepare?.(f);
  await f.page.goto(`/viewer/${ID}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await f.page.locator('[data-source-token="id_0_0"]').waitFor();
  return f;
}
const manage = async f => {
  await f.page.getByRole('button', { name: '학습', exact: true }).click();
  await f.page.getByRole('dialog', { name: '학습' }).getByRole('button', { name: /^자료 관리/ }).click();
};

test('원문 수정: 고친 뒤 Esc·취소는 「저장하지 않은 변경을 버릴까요?」를 묻고, Esc를 거듭 눌러도 편집 창이 화면에서 사라지지 않는다', { timeout: 240000 }, async () => {
  const f = await open();
  try {
    await manage(f);
    await f.page.getByRole('button', { name: /^원문 수정/ }).click();
    const editor = f.page.getByRole('dialog', { name: '원문 수정', exact: true });
    const box = editor.getByRole('textbox', { name: '원문 텍스트', exact: true });
    const ask = f.page.getByRole('dialog', { name: '저장하지 않은 변경을 버릴까요?', exact: true });
    // 고치지 않았으면 취소가 바로 닫는다
    await editor.getByRole('button', { name: '취소', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });

    await manage(f);
    await f.page.getByRole('button', { name: /^원문 수정/ }).click();
    const draft = `${RAW}\n今天下雨。`;
    await box.fill(draft);
    await f.page.keyboard.press('Escape');
    await ask.waitFor();
    assert.equal(await ask.getByRole('button', { name: '버리기', exact: true }).count(), 1);
    assert.equal(await ask.getByRole('button', { name: '확인', exact: true }).count(), 0);
    // 확인 창은 편집 창(top layer) 위에서 실제로 눌린다 — 계속 수정
    await f.page.getByRole('button', { name: '계속 수정', exact: true }).click();
    await ask.waitFor({ state: 'hidden' });
    assert.equal(await box.inputValue(), draft);

    // Esc 연타 — 크롬은 세 번째쯤 cancel을 막지 못하게 하고 창을 직접 닫는다. 창은 다시 떠 있어야 하고 초안은 그대로.
    for (let i = 0; i < 4; i++) { await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(120); }
    assert.equal(await f.page.evaluate(() => [...document.querySelectorAll('dialog.reader-modal')].some(d => d.open && d.getAttribute('aria-label') === '원문 수정')), true, 'editor dialog stays open after repeated Esc');
    assert.equal(await box.inputValue(), draft);

    // 버리기만 닫는다
    if (!(await ask.isVisible())) await editor.getByRole('button', { name: '취소', exact: true }).click();
    await ask.waitFor();
    await f.page.getByRole('button', { name: '버리기', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    assert.deepEqual(f.writes, [], 'discarding writes nothing');
    assert.equal(f.rows.find(r => r.id === ID).raw_text, RAW);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test('자료 관리 > 전체 분석: 한 번 누르면 확인 화면만 — 취소는 메뉴로, 분석 요청 0', { timeout: 240000 }, async () => {
  const f = await open();
  try {
    await manage(f);
    const panel = f.page.getByRole('dialog', { name: '자료 관리' });
    await panel.getByRole('button', { name: /^전체 분석/ }).click();
    await panel.getByText('전체 분석을 다시 할까요?', { exact: true }).waitFor();
    await panel.getByText('지금 분석 결과를 새 결과로 바꿔요. 직접 고친 뜻·단어 경계는 같은 자리에 남은 것만 이어져요.', { exact: true }).waitFor();
    // 버튼은 실제 동작 이름 + 취소(문구 표준 §2)
    await panel.getByRole('button', { name: '전체 분석', exact: true }).waitFor();
    await panel.getByRole('button', { name: '취소', exact: true }).click();
    await panel.getByRole('button', { name: /^부분 분석/ }).waitFor();
    await f.page.waitForTimeout(300);
    assert.deepEqual(f.writes, [], 'no analysis request before confirming');
    assert.equal(f.analysisCalls, 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

// 로그인 복원은 스트리밍 경계가 다 붙은 뒤에 한다(whenDocumentParsed) — 기다리는 경계가 끝내 안 붙으면 문서 파싱 뒤 3초까지 늦다.
// 본문(조기 조회)은 그보다 먼저 그려져 소유자가 그 사이 「학습」을 연다. 예전에는 복원(손님 null → 계정)이 「계정이 바뀜」으로 읽혀
// 열린 창이 저절로 닫혔고, 소유자는 「자료 관리」를 끝내 못 봤다(viewer-boundary-edit 새로고침 뒤 간헐 실패의 원인 · 2026-10-26 KST).
// 여기서는 끝내 안 붙는 경계 하나(「$?」 표시)를 문서에 남겨 복원을 최악 폭(3초)으로 늦추고, 그 사이 연 창이 복원 뒤에도 남아
// 「자료 관리」가 나타나는지 본다.
test('로그인 복원이 늦어도 그 사이 연 「학습」 창은 닫히지 않고, 복원되면 소유자의 「자료 관리」가 같은 창에 나타난다', { timeout: 240000 }, async () => {
  const f = await open({ width: 390, prepare: f => f.context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(document.createComment('$?')); }, { once: true });
  }) });
  try {
    await f.page.getByRole('button', { name: '학습', exact: true }).click();
    const menu = f.page.getByRole('dialog', { name: '학습' });
    await menu.waitFor();
    // 전제: 아직 복원 전(계정 항목 「학습 노트」 · 소유자 항목 「자료 관리」가 없다) — 이게 아니면 이 검사는 아무것도 보지 않는다.
    assert.equal(await menu.getByRole('link', { name: /^학습 노트/ }).count(), 0, 'opened before the session restore');
    assert.equal(await menu.getByRole('button', { name: /^자료 관리/ }).count(), 0, 'owner item waits for the account');
    // 창이 닫히는 순간을 놓치지 않게 문서에서 직접 센다.
    await f.page.evaluate(() => {
      window.__menuClosed = false;
      const d = [...document.querySelectorAll('dialog.reader-modal')].find(e => e.getAttribute('aria-label') === '학습');
      new MutationObserver(() => { if (!d.isConnected || !d.open) window.__menuClosed = true; }).observe(document.body, { subtree: true, childList: true, attributes: true });
    });
    // 복원(계정 항목이 그려짐) 뒤 효과까지 돈 다음에도 창은 그대로 — 그 뒤 「자료 관리」로 들어간다.
    await menu.getByRole('link', { name: /^학습 노트/ }).waitFor({ timeout: 10000 });
    await menu.getByRole('button', { name: /^자료 관리/ }).waitFor({ timeout: 10000 });
    await f.page.waitForTimeout(300);
    assert.equal(await f.page.evaluate(() => window.__menuClosed), false, 'the session restore does not close the open menu');
    await menu.getByRole('button', { name: /^자료 관리/ }).click();
    await f.page.getByRole('dialog', { name: '자료 관리' }).getByRole('button', { name: /^전체 분석/ }).waitFor();
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
