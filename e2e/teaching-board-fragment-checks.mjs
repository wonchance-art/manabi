import assert from 'node:assert/strict';

export async function verifyBoardFragments({page,base,day,cloud,check,waitFor,saveScreen,menus,readBoards,document}) {
  const sourceDay='2026-09-05',hud=menus.hud,board=page.getByRole('region',{name:'선생님 설명판'}),history=hud.locator('#board-menu-history');
  const past=structuredClone(document),sourcePage=past.pages[0];past.pages=[sourcePage];past.activePage=sourcePage.id;
  const hidden=sourcePage.elements.find(el=>el.customData?.manabiExpression?.text==='学习');
  hidden.customData.manabiExpression.showReading=false;
  for(const el of sourcePage.elements)if(el.groupIds?.includes(hidden.groupIds[0])&&el.customData?.manabiField==='reading')el.opacity=0;
  const saved=await cloud.save(sourceDay,past),manifest=JSON.stringify(saved.manifest);
  const sourceFiles=saved.manifest.pages.map(p=>[p.hash,[...cloud.files.entries()].find(([key])=>key.endsWith(p.hash+'.json'))[1]]);
  const current=async()=>(await readBoards()).find(row=>row.id===row.scope&&row.document.accountBoard).document;
  const scene=async()=>{const d=await current();return d.pages.find(p=>p.id===d.activePage).elements.filter(el=>!el.isDeleted);};
  const copied=async()=>(await scene()).filter(el=>el.customData?.manabiReuse?.boardId===saved.id);
  const dialog=page.getByRole('dialog',{name:'가져올 부분 고르기'});
  const open=async()=>{await menus.open('main');await hud.getByRole('button',{name:'지난 설명판',exact:true}).click();await history.getByRole('button',{name:`${sourceDay} 페이지 가져오기`,exact:true}).click();await history.getByRole('button',{name:'1번 페이지 부분 고르기',exact:true}).click();await dialog.waitFor();await dialog.locator('svg image').waitFor();};
  const choose=async()=>{await dialog.getByRole('button',{name:'목록으로 선택',exact:true}).click();const list=dialog.getByRole('complementary',{name:'가져올 요소 목록'});await list.getByRole('checkbox',{name:'표현 · 学习 배우다, 공부하다',exact:true}).check();await list.getByRole('checkbox',{name:'표현 · 复习 복습하다',exact:true}).check();const ink=list.locator('label').filter({hasText:/^필기 \d+$/}).first();if(await ink.count())await ink.getByRole('checkbox').check();await dialog.getByRole('button',{name:'목록으로 선택',exact:true}).click();};
  const before=await scene(),records=await hud.getByRole('button',{name:/오늘 표현 \d+개/}).getAttribute('aria-label');
  await open();
  const surface=await dialog.locator('svg[aria-label="지난 설명판 선택 영역"]').boundingBox();
  await page.mouse.move(surface.x+2,surface.y+2);await page.mouse.down();await page.mouse.move(surface.x+surface.width-2,surface.y+surface.height-2,{steps:10});await page.mouse.up();
  await dialog.getByText('표현 5개 · 필기 포함',{exact:true}).waitFor();await dialog.getByRole('button',{name:'선택 해제',exact:true}).click();
  check('rectangle selection selects complete expressions and complete ink strokes');
  await choose();
  for(const [width,height]of [[1024,768],[390,844]]){
    await page.setViewportSize({width,height});await saveScreen(`fragment-picker-${width}`);
    assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));const action=await dialog.getByRole('button',{name:'현재 판에 놓기',exact:true}).boundingBox();assert(action.y>=0&&action.y+action.height<=height);
  }
  await page.setViewportSize({width:1440,height:1000});await dialog.getByRole('button',{name:'현재 판에 놓기',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await waitFor(async()=>(await copied()).filter(el=>el.customData?.manabiExpression).length===2);
  const added=await copied();assert(added.some(el=>el.type==='freedraw'));assert(added.some(el=>el.customData?.manabiField==='reading'&&el.opacity===0));
  const normalize=el=>({...el,boundElements:el.boundElements||[]});assert.deepEqual((await scene()).filter(el=>before.some(old=>old.id===el.id)).map(normalize),before.map(normalize));
  assert.equal(await hud.getByRole('button',{name:/오늘 표현 \d+개/}).getAttribute('aria-label'),records);
  await saveScreen('fragment-placed');check('partial selection preserves hidden expression fields, ink, source and destination while leaving student records unchanged');
  await menus.open('tools');await hud.locator('#board-menu-tools').getByRole('button',{name:'실행 취소',exact:true}).click();await waitFor(async()=>(await copied()).length===0);
  await menus.open('tools');await hud.locator('#board-menu-tools').getByRole('button',{name:'다시 실행',exact:true}).click();await waitFor(async()=>(await copied()).length===added.length);
  check('current-page import is a single undo/redo action');
  await hud.getByRole('button',{name:'저장 상태',exact:true}).click();await hud.locator('#board-menu-status').getByRole('button',{name:'지금 저장',exact:true}).click();await hud.locator('#board-menu-status').getByText('계정에 저장됨',{exact:true}).waitFor();
  await page.reload();await board.locator('canvas').first().waitFor();await open();await choose();await dialog.getByRole('button',{name:'현재 판에 놓기',exact:true}).click();await dialog.getByText('이미 가져온 내용이에요.',{exact:true}).waitFor();assert.equal((await copied()).length,added.length);
  await dialog.getByRole('button',{name:'가져온 내용 보기',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(JSON.stringify((await cloud.row(sourceDay)).manifest),manifest);for(const [hash,text]of sourceFiles)assert([...cloud.files.entries()].some(([key,value])=>key.endsWith(hash+'.json')&&value===text));
  check('saved provenance survives reload, offers the existing copy and preserves the source bytes');
  await open();await dialog.getByRole('button',{name:'목록으로 선택',exact:true}).click();const checkbox=dialog.getByRole('complementary').getByRole('checkbox',{name:'표현 · 练习 연습하다',exact:true});await checkbox.focus();await page.keyboard.press('Space');
  await dialog.getByRole('button',{name:'놓을 위치 선택',exact:true}).click();await dialog.getByRole('button',{name:'새 페이지에 놓기',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await waitFor(async()=>(await copied()).some(el=>el.customData?.manabiExpression?.text==='练习'));
  await menus.open('tools');await hud.locator('#board-menu-tools').getByRole('button',{name:'실행 취소',exact:true}).click();await waitFor(async()=>(await scene()).length===0);
  await menus.open('tools');await hud.locator('#board-menu-tools').getByRole('button',{name:'다시 실행',exact:true}).click();await waitFor(async()=>(await copied()).some(el=>el.customData?.manabiExpression?.text==='练习'));
  check('keyboard selection and new-page placement retain one-step undo/redo');
  await open();await choose();const count=(await current()).pages.length;await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await history.getByRole('button',{name:'1번 페이지 부분 고르기',exact:true}).evaluate(el=>el===document.activeElement));assert.equal((await current()).pages.length,count);
  check('cancelling partial selection returns focus without changing the board');
  await open();await choose();
  const originalCount=(await scene()).length;
  const changed=structuredClone(past);changed.pages[0].elements.find(el=>el.type==='freedraw').points.push([90,90]);
  await cloud.save(sourceDay,changed);
  await dialog.getByRole('button',{name:'현재 판에 놓기',exact:true}).click();await dialog.getByText('지난 판이 변경됐어요. 최신 판을 불러와 다시 골라 주세요.',{exact:true}).waitFor();assert.equal((await scene()).length,originalCount);
  await dialog.getByRole('button',{name:'최신 판 다시 불러오기',exact:true}).click();await dialog.getByText('표현을 누르거나 드래그해 필요한 부분을 고르세요.',{exact:true}).waitFor();
  await choose();
  let release;const gate={entered:false,wait:new Promise(resolve=>{release=resolve;})};cloud.state.readGate=gate;
  await dialog.getByRole('button',{name:'현재 판에 놓기',exact:true}).click();await waitFor(()=>gate.entered);await dialog.getByRole('button',{name:'부분 선택 닫기',exact:true}).click();release();await page.waitForTimeout(400);assert.equal((await scene()).length,originalCount);
  check('source changes require reselection and closing a pending copy prevents late insertion');
  await menus.close();
  // Continue the existing fixture on its original destination and retain its own checks.
  assert(page.url().startsWith(base)&&page.url().includes(`day=${day}`));
}
