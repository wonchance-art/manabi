import assert from 'node:assert/strict';

export function boardMenus(page,activate='click') {
  const hud=page.locator('.board-hud');
  const names={main:'수업·보관 메뉴',tools:'필기 도구 메뉴',entry:'표현 입력',book:'교재 메뉴',pages:'페이지 메뉴',selection:'선택한 요소 편집'};
  const open=async name=>{
    const trigger=hud.getByRole('button',{name:names[name],exact:true});
    if(await trigger.getAttribute('aria-expanded')!=='true')await trigger[activate]();
    await hud.locator(`#board-menu-${name}`).waitFor({state:'visible'});
  };
  const action=async(menu,label)=>{await open(menu);await hud.getByRole('button',{name:label,exact:true})[activate]();};
  const layout=async label=>{await open('book');await hud.getByRole('navigation',{name:'설명판 보기'}).getByRole('button',{name:label,exact:true})[activate]();};
  const close=async()=>{const popup=hud.locator('.board-popover:not([hidden])');if(await popup.count())await popup.getByRole('button',{name:'메뉴 닫기',exact:true})[activate]();};
  return {hud,open,action,layout,close};
}

// Uses the actual app and disposable fixtures; never writes a production lesson.
export async function verifyBoardMenus({page,board,activate,check,saveScreen}) {
  const menus=boardMenus(page,activate);
  const input=menus.hud.getByLabel('단어·표현',{exact:true});
  assert.equal(await page.locator('.viewer-layout').getAttribute('data-teaching-board'),'board','a new teaching workspace starts with the whole canvas');
  for(const [width,height]of [[1440,1000],[390,844],[354,767]]){
    await page.setViewportSize({width,height});
    const surface=board.locator('.teaching-board-surface');
    await page.waitForTimeout(300);
    const before=await surface.boundingBox();
    assert(before.y<=1&&before.height>=height-1&&before.width>=width-1,'no permanent header or footer consumes the canvas');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.equal(await menus.hud.getByRole('navigation',{name:'설명판 메뉴'}).getByRole('button').count(),6);
    await menus.open('entry');await input.fill('다음 설명 초안');
    const popup=menus.hud.locator('#board-menu-entry');const bounds=await popup.boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'entry popup fits within the teaching viewport');
    assert.deepEqual(await surface.boundingBox(),before,'opening input never shrinks or moves the paper');
    await page.keyboard.press('Escape');
    assert(await menus.hud.getByRole('button',{name:'표현 입력',exact:true}).evaluate(el=>el===document.activeElement));
    await menus.open('pages');await menus.close();
    await menus.open('entry');assert.equal(await input.inputValue(),'다음 설명 초안','closing and changing menus keeps the draft');
    await input.fill('');await menus.close();
    await saveScreen(`board-immersive-${width}`);
  }
  await page.setViewportSize({width:1440,height:1000});
  const main=menus.hud.getByRole('button',{name:'수업·보관 메뉴',exact:true});
  await main.focus();await main.press('ArrowRight');
  const tools=menus.hud.getByRole('button',{name:'필기 도구 메뉴',exact:true});
  assert(await tools.evaluate(el=>el===document.activeElement));
  await tools.press('Enter');await menus.hud.locator('#board-menu-tools').waitFor({state:'visible'});
  assert(await menus.hud.getByRole('button',{name:'실행 취소',exact:true}).isDisabled());
  assert(await menus.hud.getByRole('button',{name:'다시 실행',exact:true}).isDisabled());
  await page.keyboard.press('Escape');assert(await tools.evaluate(el=>el===document.activeElement));
  await menus.open('main');
  assert.equal(await menus.hud.getByRole('link',{name:'웹앱 홈',exact:true}).getAttribute('href'),'/home');
  await menus.hud.getByRole('button',{name:'수업 기록',exact:true})[activate]();
  await menus.hud.getByRole('region',{name:'오늘 수업 노트'}).waitFor({state:'visible'});
  assert(await board.locator('canvas.interactive').isVisible(),'class records open without closing the board');
  await menus.close();
  check('immersive menus preserve the full canvas, mobile fit, draft, keyboard focus and in-board class records');
}
