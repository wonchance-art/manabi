import assert from 'node:assert/strict';

export function boardMenus(page,activate='click') {
  const hud=page.locator('.board-hud');
  const names={main:'전체 메뉴',tools:'필기 도구 메뉴',entry:'표현 입력',book:'교재 메뉴',pages:'페이지 메뉴',selection:'선택한 요소 편집'};
  const open=async name=>{
    if(await hud.locator(`#board-menu-${name}`).isVisible())return;
    if(name==='tools'){
      const active=hud.locator('.board-quick-tools button[aria-pressed="true"]');
      if(await active.count()&&await page.locator('.viewer-layout').getAttribute('data-teaching-board')!=='reader'){
        await active[activate]();await hud.locator('#board-menu-tools').waitFor({state:'visible'});return;
      }
    }
    if(name==='tools'||name==='pages')await open('main');
    const trigger=hud.getByRole('button',{name:names[name],exact:true});
    await trigger[activate]();
    await hud.locator(`#board-menu-${name}`).waitFor({state:'visible'});
  };
  const close=async()=>{const popup=hud.locator('.board-popover:not([hidden])');if(await popup.count())await popup.getByRole('button',{name:'메뉴 닫기',exact:true})[activate]();};
  const action=async(menu,label)=>{
    if(menu==='tools'&&['선택','펜','지우개'].includes(label)){
      const button=hud.locator('.board-quick-tools').getByRole('button',{name:label,exact:true});
      if(await button.getAttribute('aria-pressed')==='true')await close();else await button[activate]();
      return;
    }
    await open(menu);await hud.locator(`#board-menu-${menu}`).getByRole('button',{name:label,exact:true})[activate]();
  };
  const layout=async label=>{await open('book');await hud.getByRole('navigation',{name:'설명판 보기'}).getByRole('button',{name:label,exact:true})[activate]();};
  return {hud,open,action,layout,close};
}

// Uses the actual app and disposable fixtures; never writes a production lesson.
export async function verifyBoardMenus({page,board,activate,check,saveScreen}) {
  const menus=boardMenus(page,activate);
  const input=menus.hud.getByLabel('단어·표현',{exact:true});
  await board.getByLabel('설명판 시작 안내',{exact:true}).waitFor({state:'visible'});
  assert.equal(await page.locator('.viewer-layout').getAttribute('data-teaching-board'),'board','a new teaching workspace starts with the whole canvas');
  for(const [width,height]of [[1440,1000],[390,844],[354,767]]){
    await page.setViewportSize({width,height});
    const surface=board.locator('.teaching-board-surface');
    await page.waitForTimeout(300);
    const before=await surface.boundingBox();
    assert(before.y<=1&&before.height>=height-1&&before.width>=width-1,'no permanent header or footer consumes the canvas');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.equal(await menus.hud.getByRole('navigation',{name:'설명판 메뉴'}).getByRole('button').count(),6);
    for(const name of ['펜','지우개','선택']){
      const tool=menus.hud.locator('.board-quick-tools').getByRole('button',{name,exact:true});
      await tool[activate]();
      assert.equal(await tool.getAttribute('aria-pressed'),'true','one click selects the requested drawing tool');
      assert.equal(await menus.hud.locator('.board-popover:not([hidden])').count(),0,'changing tools never opens another menu');
      assert.deepEqual(await surface.boundingBox(),before,'switching tools never changes paper geometry');
    }
    await menus.open('entry');await input.fill('다음 설명 초안');
    const popup=menus.hud.locator('#board-menu-entry');const bounds=await popup.boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'entry popup fits within the teaching viewport');
    assert.deepEqual(await surface.boundingBox(),before,'opening input never shrinks or moves the paper');
    await saveScreen(`board-entry-${width}`);
    await page.keyboard.press('Escape');
    assert(await menus.hud.getByRole('button',{name:'표현 입력',exact:true}).evaluate(el=>el===document.activeElement));
    await menus.open('pages');await menus.close();
    assert(await menus.hud.getByRole('button',{name:'전체 메뉴',exact:true}).evaluate(el=>el===document.activeElement),'nested menus return to their visible opener');
    await menus.open('entry');assert.equal(await input.inputValue(),'다음 설명 초안','closing and changing menus keeps the draft');
    await input.fill('');await menus.close();
    await saveScreen(`board-immersive-${width}`);
  }
  await page.setViewportSize({width:1440,height:1000});
  const main=menus.hud.getByRole('button',{name:'전체 메뉴',exact:true});
  await main.focus();await main.press('ArrowRight');
  const tools=menus.hud.locator('.board-quick-tools').getByRole('button',{name:'선택',exact:true});
  assert(await tools.evaluate(el=>el===document.activeElement));
  await tools.press('Enter');await menus.hud.locator('#board-menu-tools').waitFor({state:'visible'});
  assert(await menus.hud.getByRole('button',{name:'실행 취소',exact:true}).isDisabled());
  assert(await menus.hud.getByRole('button',{name:'다시 실행',exact:true}).isDisabled());
  await saveScreen('board-tools');
  await page.keyboard.press('Escape');assert(await tools.evaluate(el=>el===document.activeElement));
  await menus.open('main');
  assert.equal(await menus.hud.getByRole('link',{name:'웹앱 홈',exact:true}).getAttribute('href'),'/home');
  await menus.hud.getByRole('button',{name:'수업 기록',exact:true})[activate]();
  await menus.hud.getByRole('region',{name:'오늘 수업 노트'}).waitFor({state:'visible'});
  assert(await board.locator('canvas.interactive').isVisible(),'class records open without closing the board');
  await menus.close();
  check('one-click pen, eraser and selection retain paper geometry at desktop and phone widths');
  check('immersive menus preserve the full canvas, mobile fit, draft, keyboard focus and in-board class records');
}
