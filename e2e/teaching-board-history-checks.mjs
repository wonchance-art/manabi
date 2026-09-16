import assert from 'node:assert/strict';

export async function verifyBoardHistory({page,day,cloud,check,waitFor,saveScreen,menus,document}) {
 const history=menus.hud.locator('#board-menu-history'),rows=history.locator('[data-source-day]'),select=history.getByLabel('설명판 기간');
 const open=async()=>{await menus.open('main');await menus.hud.getByRole('button',{name:'지난 설명판',exact:true}).click();};
 const today=new Date(`${day}T00:00:00Z`),fixtures=Array.from({length:365},(_,i)=>({id:`history-${i}`,day:new Date(+today-i*86400000).toISOString().slice(0,10),manifest:{pages:[{}]}}));
 cloud.state.historyRows=fixtures;
 await cloud.save(fixtures[75].day,document);
 await open();await history.getByRole('button',{name:'새로고침',exact:true}).click();await waitFor(async()=>await rows.count()===30);
 const initialURL=page.url();assert(await rows.locator(`[data-source-day="${day}"]`).count()===0||await history.locator(`[data-source-day="${day}"]`).isDisabled());
 cloud.state.listFail=true;await history.getByRole('button',{name:'이전 수업 더 보기',exact:true}).click();await history.getByText('이전 수업을 더 불러오지 못했어요. 지금 목록은 그대로예요.',{exact:true}).waitFor();assert.equal(await rows.count(),30);
 await history.getByRole('button',{name:'이전 수업 다시 불러오기',exact:true}).click();await waitFor(async()=>await rows.count()===60);
 await history.getByRole('button',{name:'이전 수업 더 보기',exact:true}).click();await waitFor(async()=>await rows.count()===90);
 const target=history.locator(`[data-source-day="${fixtures[75].day}"]`);await target.scrollIntoViewIfNeeded();await target.focus();const scroll=await history.locator('.board-history-scroll').evaluate(e=>e.scrollTop);
 await page.keyboard.press('Enter');await history.getByRole('heading',{name:`${fixtures[75].day} 설명판`,exact:true}).waitFor();assert.equal(page.url(),initialURL);
 await history.getByRole('button',{name:'← 날짜 목록',exact:true}).click();await waitFor(()=>target.evaluate(e=>e===document.activeElement));assert(Math.abs(await history.locator('.board-history-scroll').evaluate(e=>e.scrollTop)-scroll)<3);
 await menus.close();await open();assert.equal(await rows.count(),90);assert(Math.abs(await history.locator('.board-history-scroll').evaluate(e=>e.scrollTop)-scroll)<3);
 check('history retries additional pages without loss, previews in place, and restores range/pages/scroll/focus after back and reopening');
 for(let n=90;n<365;n+=30){await history.getByRole('button',{name:'이전 수업 더 보기',exact:true}).click();await waitFor(async()=>await rows.count()===Math.min(365,n+30));}
 assert.equal(await history.getByRole('button',{name:'이전 수업 더 보기',exact:true}).count(),0);assert.equal(new Set(await rows.evaluateAll(es=>es.map(e=>e.dataset.sourceDay))).size,365);
 check('history exposes all 365 saved dates exactly once, beyond the old 100-date limit');
 await select.selectOption('custom');const requests=cloud.state.listRequests;
 await history.getByLabel('시작일',{exact:true}).fill('2026-08-31');await page.waitForTimeout(100);assert.equal(cloud.state.listRequests,requests);
 await history.getByLabel('종료일',{exact:true}).fill('2026-08-01');await history.getByRole('button',{name:'적용',exact:true}).click();await history.getByText('종료일은 시작일보다 빠를 수 없어요.',{exact:true}).waitFor();assert.equal(cloud.state.listRequests,requests);
 await history.getByLabel('시작일',{exact:true}).fill('2026-08-01');await history.getByLabel('종료일',{exact:true}).fill('2026-08-31');await history.getByRole('button',{name:'적용',exact:true}).click();await waitFor(async()=>await rows.count()===30);
 assert((await rows.evaluateAll(es=>es.map(e=>e.dataset.sourceDay))).every(d=>d.startsWith('2026-08')));
 await history.getByRole('button',{name:'이전 수업 더 보기',exact:true}).click();await waitFor(async()=>await rows.count()===31);
 check('custom dates apply together, validate before querying and include both range endpoints');
 for(const [width,height] of [[390,844],[768,1024],[1024,768],[1440,1000]]){await page.setViewportSize({width,height});await saveScreen(`history-${width}`);assert(await history.evaluate(e=>e.scrollWidth<=e.clientWidth+1));const close=await history.getByRole('button',{name:'메뉴 닫기',exact:true}).boundingBox();assert(close.y>=0&&close.y+close.height<=height);}
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.documentElement.style.zoom='2';});await saveScreen('history-large-type');assert(await history.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.evaluate(()=>{document.documentElement.style.zoom='';});await page.setViewportSize({width:1440,height:1000});
 check('history/date controls and fixed close fit phone, portrait/landscape tablet, desktop and enlarged text');
 let release;const gate={entered:false,wait:new Promise(resolve=>{release=resolve;})};cloud.state.listGate=gate;
 await history.getByLabel('시작일',{exact:true}).fill('2026-06-01');await history.getByLabel('종료일',{exact:true}).fill('2026-06-30');await history.getByRole('button',{name:'적용',exact:true}).click();await waitFor(()=>gate.entered);
 await history.getByLabel('시작일',{exact:true}).fill('2026-07-01');await history.getByLabel('종료일',{exact:true}).fill('2026-07-31');await history.getByRole('button',{name:'적용',exact:true}).click();await waitFor(async()=>await rows.count()===30);release();await page.waitForTimeout(100);
 assert((await rows.evaluateAll(es=>es.map(e=>e.dataset.sourceDay))).every(d=>d.startsWith('2026-07')));
 check('a late cancelled date-range response cannot replace the current month');
 // Source previews are unmounted on close, including all generated Blob URLs.
 const date=fixtures[75].day;await select.selectOption('all');
 await page.evaluate(()=>{window.__historyBlobs=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const url=create(b);window.__historyBlobs.add(url);return url;};URL.revokeObjectURL=url=>{window.__historyBlobs.delete(url);revoke(url);};});
 await menus.close();await menus.hud.getByRole('button',{name:'저장 상태',exact:true}).click();const status=menus.hud.locator('#board-menu-status');await status.getByRole('button',{name:'지금 저장',exact:true}).click();await status.getByText('계정에 저장됨',{exact:true}).waitFor();await menus.close();await open();
 const latencies=[];
 const before=cloud.state.writes,beforeManifest=JSON.stringify((await cloud.row(day)).manifest);
 for(let i=0;i<20;i++){const started=performance.now();await history.locator(`[data-source-day="${date}"]`).click();await history.getByRole('heading',{name:`${date} 설명판`,exact:true}).waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));latencies.push(performance.now()-started);await history.locator('.board-reuse-preview img').first().waitFor();await menus.close();await waitFor(()=>page.evaluate(()=>window.__historyBlobs.size===0));await open();}
 assert.equal(cloud.state.writes,before);assert.equal(JSON.stringify((await cloud.row(day)).manifest),beforeManifest);assert.equal(page.url(),initialURL);
 latencies.sort((a,b)=>a-b);cloud.state.historyMetrics={samples:latencies.length,p95PanelMs:latencies[18],medianPanelMs:latencies[10],method:'Playwright click through next paint, includes driver overhead; synthetic data'};
 check('twenty source-preview open/close cycles release every thumbnail Blob without writing or changing the current lesson');
 cloud.state.historyRows=null;await history.getByRole('button',{name:'새로고침',exact:true}).click();await waitFor(async()=>await rows.count()<30);await menus.close();
}
