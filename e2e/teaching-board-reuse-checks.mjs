import assert from 'node:assert/strict';

export async function verifyBoardReuse({page,base,day,cloud,check,waitFor,saveScreen,menus,readBoards,document}) {
 const hud=menus.hud,history=hud.locator('#board-menu-history'),board=page.getByRole('region',{name:'선생님 설명판'}),pastDay='2026-09-07';
 const past=structuredClone(document);past.pages=[past.pages[0],{id:'another-past-page',elements:[],camera:{scrollX:0,scrollY:0,zoom:{value:1}}}];past.activePage=past.pages[0].id;
 const savedSource=await cloud.save(pastDay,past),sourceManifest=JSON.stringify(savedSource.manifest);
 const sourceFiles=savedSource.manifest.pages.map(p=>[p.hash,[...cloud.files.entries()].find(([key])=>key.endsWith(p.hash+'.json'))[1]]);
 const open=async()=>{await menus.open('main');await hud.getByRole('button',{name:'지난 설명판',exact:true}).click();await history.getByRole('button',{name:`${pastDay} 페이지 가져오기`,exact:true}).click();};
 const targetBefore=(await readBoards()).find(r=>r.id===r.scope&&r.document.accountBoard).document;
 const records=await hud.getByRole('button',{name:/오늘 표현 \d+개/}).getAttribute('aria-label');
 await open();await history.getByLabel('1번 페이지 가져오기',{exact:true}).waitFor();
 await waitFor(()=>history.locator('.board-reuse-preview img').count());
 assert(page.url().includes(`day=${day}`));
 await history.getByLabel('1번 페이지 가져오기',{exact:true}).focus();await page.keyboard.press('Space');
 for(const [width,height]of [[1024,768],[390,844]]){await page.setViewportSize({width,height});await saveScreen('reuse-picker-'+width);assert(await history.evaluate(el=>el.scrollWidth<=el.clientWidth+1));const box=await history.getByRole('button',{name:'현재 수업에 1개 복사',exact:true}).boundingBox();assert(box.y>=0&&box.y+box.height<=height,'copy action visible');}
 await page.setViewportSize({width:1440,height:1000});await history.getByRole('button',{name:'현재 수업에 1개 복사',exact:true}).click();
 await board.locator('canvas').first().waitFor();await waitFor(async()=>(await readBoards()).some(r=>r.id===r.scope&&r.document.pages.some(p=>p.reusedFrom?.day===pastDay)));
 const copied=(await readBoards()).find(r=>r.id===r.scope&&r.document.pages.some(p=>p.reusedFrom?.day===pastDay)).document;
 assert.equal(copied.pages.length,targetBefore.pages.length+1);// Excalidraw normalizes an absent bound-element list to [] when restoring.
 const scene=pages=>pages.map(p=>p.elements.map(el=>({...el,boundElements:el.boundElements||[]})));
 assert.deepEqual(scene(copied.pages.slice(0,-1)),scene(targetBefore.pages));
 const elements=copied.pages.at(-1).elements;assert(elements.length);assert(elements.every(el=>!past.pages[0].elements.some(p=>p.id===el.id)));
 assert.equal(await hud.getByRole('button',{name:/오늘 표현 \d+개/}).getAttribute('aria-label'),records);
 await saveScreen('reuse-copied-page');
 check('past page thumbnails, keyboard selection and copy work in-place without changing current ink or publishing student expressions');
 await hud.getByRole('button',{name:'저장 상태',exact:true}).click();await hud.locator('#board-menu-status').getByRole('button',{name:'지금 저장',exact:true}).click();await hud.locator('#board-menu-status').getByText('계정에 저장됨',{exact:true}).waitFor();
 assert.equal(JSON.stringify((await cloud.row(pastDay)).manifest),sourceManifest);for(const [hash,text]of sourceFiles)assert([...cloud.files.entries()].some(([key,value])=>key.endsWith(hash+'.json')&&value===text));
 await page.reload();await board.locator('canvas').first().waitFor();await open();await history.getByLabel('1번 페이지 가져오기',{exact:true}).waitFor();assert(await history.getByLabel('1번 페이지 가져오기',{exact:true}).isDisabled());await history.getByText('가져옴',{exact:true}).waitFor();
 await history.getByRole('button',{name:'← 날짜 목록',exact:true}).click();await waitFor(()=>history.getByRole('button',{name:`${pastDay} 페이지 가져오기`,exact:true}).evaluate(el=>el===document.activeElement));
 check('copy provenance survives account save/reload, prevents duplicates and preserves source page bytes; back restores keyboard focus');
 // Read failure and late responses cannot insert content or lose current pages.
 cloud.state.offline=true;await history.getByRole('button',{name:`${pastDay} 페이지 가져오기`,exact:true}).click();await history.getByRole('alert').waitFor();assert.equal((await readBoards()).find(r=>r.id===r.scope&&r.document.accountBoard).document.pages.length,copied.pages.length);
 cloud.state.offline=false;await history.getByRole('button',{name:'다시 불러오기',exact:true}).click();await history.getByText('가져옴',{exact:true}).waitFor();await menus.close();
 let release;const gate={entered:false,wait:new Promise(resolve=>{release=resolve;})};cloud.state.readGate=gate;
 await open();await waitFor(()=>gate.entered);await menus.close();release();await page.waitForTimeout(100);assert.equal((await readBoards()).find(r=>r.id===r.scope&&r.document.accountBoard).document.pages.length,copied.pages.length);
 check('source download failure retries safely and closing during a slow response cannot copy pages');
 const capacityDay='2026-09-06',full={version:1,activePage:'full-0',pages:Array.from({length:20},(_,i)=>({id:`full-${i}`,elements:[],camera:{scrollX:0,scrollY:0,zoom:{value:1}}}))};await cloud.save(capacityDay,full);
 await page.goto(base+`/viewer/10?class=fixture-class&day=${capacityDay}&board=1`);await board.locator('canvas').first().waitFor();await open();await history.getByLabel('1번 페이지 가져오기',{exact:true}).check();await history.getByText('현재 수업의 20개 페이지가 모두 찼어요. 다른 수업 날짜에서 가져와 주세요.',{exact:true}).waitFor();assert(await history.getByRole('button',{name:'현재 수업에 1개 복사',exact:true}).isDisabled());assert.equal((await cloud.row(capacityDay)).manifest.pages.length,20);
 check('full destination boards refuse insertion without replacing a page');
 await menus.close();await page.goto(base+`/viewer/10?class=fixture-class&day=${day}&board=1`);await board.locator('canvas').first().waitFor();
}
