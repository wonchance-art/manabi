import assert from 'node:assert/strict';

// Runs against the existing teacher SQL/auth fixture and the actual production bundle.
export async function runTabletScenario({page,context,base,out,day,db,check,waitFor,current,report,writes,activate,tabletState}) {
  const url=base+`/viewer/10?class=fixture-class&day=${day}`;
  const dock=page.getByRole('complementary',{name:'교재 안 수업 도구'});
  const input=dock.getByRole('textbox',{name:'단어·표현 찾기',exact:true});
  const records=target=>target.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('manabi-classroom-outbox');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries'),request=tx.objectStore('entries').getAll();request.onsuccess=()=>resolve(request.result);tx.oncomplete=()=>db.close();};}));
  const drafts=async()=> (await records(page)).filter(row=>row.category==='reader');
  const navigate=async href=>{await page.waitForTimeout(2600);await page.goto(href);await dock.waitFor();};
  const openDraft=async(text,target=page)=>{
    const area=target.getByRole('complementary',{name:'교재 안 수업 도구'});
    const details=area.locator('.class-reader-drafts');await details.waitFor();
    if(!await details.evaluate(el=>el.open))await details.locator('summary')[activate]();
    await area.getByRole('button',{name:text+' · 계속 작성',exact:true})[activate]();
  };
  await navigate(url);
  const original=await current();
  await input.fill('明天见');await waitFor(async()=> (await drafts()).some(row=>row.value.input==='明天见'));
  await navigate(url);await openDraft('明天见');assert.equal(await input.inputValue(),'明天见');
  assert.equal((await current()).raw_text,original.raw_text);check('unfinished search survives reopening without adding a class record');

  const before=tabletState.lookups;
  await input.dispatchEvent('compositionstart');await input.dispatchEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true});
  await input.dispatchEvent('compositionend');await input.evaluate(el=>el.form.requestSubmit());await page.waitForTimeout(250);
  assert.equal(tabletState.lookups,before);await input.dispatchEvent('keyup',{key:'Enter',keyCode:13,bubbles:true});
  await dock.getByRole('button',{name:'찾기',exact:true}).last()[activate]();await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).waitFor();
  await waitFor(async()=>await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).inputValue()==='안녕하세요');
  check('IME candidate confirmation never submits a dictionary lookup');
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('내일 만나요 — 직접 적은 뜻');
  await dock.getByRole('textbox',{name:'읽기',exact:true}).fill('míng tiān jiàn');
  await waitFor(async()=> (await drafts()).some(row=>row.value.meaning==='내일 만나요 — 직접 적은 뜻'&&row.value.reading==='míng tiān jiàn'));
  await navigate(base+`/viewer/11?class=fixture-class&day=${day}`);assert.equal(await dock.locator('.class-reader-drafts').count(),0);
  await navigate(base+`/viewer/10?class=fixture-class&day=2026-09-11`);assert.equal(await dock.locator('.class-reader-drafts').count(),0);
  await navigate(url);await openDraft('明天见');assert.equal(await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).inputValue(),'내일 만나요 — 직접 적은 뜻');
  check('meaning and reading drafts survive chapter changes and remain isolated by chapter and day');

  const other=await context.newPage();other.on('pageerror',e=>report.errors.push(e.message));await other.goto(url);await other.getByRole('complementary',{name:'교재 안 수업 도구'}).waitFor();await openDraft('明天见',other);
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('첫 번째 탭의 뜻');
  await other.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('두 번째 탭의 뜻');
  await waitFor(async()=>{const all=await drafts();return all.some(r=>r.value.meaning==='첫 번째 탭의 뜻')&&all.some(r=>r.value.meaning==='두 번째 탭의 뜻');});
  await other.close();check('two tabs keep independent writer drafts instead of overwriting one another');

  tabletState.dictionaryDelay=1200;
  await input.fill('新的表达');await dock.getByRole('button',{name:'찾기',exact:true}).last()[activate]();
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('먼저 입력한 뜻');await page.waitForTimeout(1450);
  assert.equal(await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).inputValue(),'먼저 입력한 뜻');tabletState.dictionaryDelay=0;
  check('late dictionary result never overwrites a meaning typed during lookup');

  for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:1000});
    await dock.locator('.class-reader-dock__body').evaluate(el=>el.scrollTop=el.scrollHeight);
    const footer=await dock.locator('.class-reader-footer').boundingBox(),panel=await dock.boundingBox();
    assert(footer&&panel&&footer.y>=panel.y&&footer.y+footer.height<=panel.y+panel.height+1);
    assert(await dock.getByRole('button',{name:'크게 보기',exact:true}).isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const shot=`tablet-dock-${width}.png`;await page.screenshot({path:out+'/'+shot});report.screens.push(shot);
  }
  check('primary actions stay in the panel while details scroll at four viewport widths');
  await page.setViewportSize({width:390,height:844});
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).focus();
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>360});visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForTimeout(200);
  const field=await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).boundingBox(),action=await dock.getByRole('button',{name:'오늘 표현에 추가',exact:true}).boundingBox();
  assert(field&&action&&field.y>=0&&field.y+field.height<=360&&action.y+action.height<=360,'field and primary action fit the simulated visible viewport');
  await page.screenshot({path:out+'/tablet-keyboard-390.png'});report.screens.push('tablet-keyboard-390.png');
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
  check('input and record action remain visible above a simulated software keyboard');

  const text='新的表达';
  await dock.getByRole('button',{name:'크게 보기',exact:true})[activate]();
  const dialog=page.getByRole('dialog',{name:'학생에게 보여주는 설명'});await dialog.waitFor();await dialog.getByText('먼저 입력한 뜻',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'교재로 돌아가기 ×',exact:true})[activate]();
  await dock.getByRole('button',{name:'오늘 표현에 추가',exact:true})[activate]();
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('저장 이후 계속 쓴 뜻');
  await waitFor(async()=> (await current()).raw_text.includes(text));
  assert.equal((await current()).raw_text.split('\n').filter(line=>line===text).length,1);
  await waitFor(async()=> (await drafts()).some(row=>row.value.meaning==='저장 이후 계속 쓴 뜻'));
  check('recording is explicit and later edits remain a separate unsubmitted draft');

  await navigate(url);await page.locator('[data-tid="id_0_word"]')[activate]();
  await dock.getByRole('button',{name:'수업용 뜻 수정',exact:true})[activate]();
  await dock.getByRole('textbox',{name:'수업용 뜻',exact:true}).fill('교재 단어에 남긴 수업용 뜻');
  await waitFor(async()=> (await drafts()).some(row=>row.value.selection?.source?.materialId==='10'));
  await navigate(url);await openDraft('图书馆');await dock.getByRole('button',{name:'오늘 표현에 추가',exact:true})[activate]();
  await waitFor(async()=>Object.values((await current()).processed_json.metadata.classMeanings||{}).some(entry=>entry.meaning==='교재 단어에 남긴 수업용 뜻'));
  check('restored textbook meaning retains verified source and records the edited gloss');
  const searchToggle=dock.getByRole('button',{name:'표현 찾기 열기',exact:true});
  if(await searchToggle.getAttribute('aria-expanded')!=='true')await searchToggle[activate]();
  await context.setOffline(true);await input.fill('离线说明');await dock.getByRole('button',{name:'찾기',exact:true}).last()[activate]();
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('오프라인 설명');
  await dock.getByRole('button',{name:'오늘 표현에 추가',exact:true})[activate]();
  assert.equal(await dialog.count(),0);
  await waitFor(async()=> (await records(page)).some(row=>row.text==='离线说明'&&row.kind!=='draft'));
  assert(!(await current()).raw_text.includes('离线说明'));check('offline record is durably queued without claiming a server write');
  await dock.getByRole('textbox',{name:'핵심 뜻',exact:true}).fill('전송 이후 이어 쓴 초안');
  await context.setOffline(false);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await waitFor(async()=> (await current()).raw_text.includes('离线说明'));
  assert.equal((await current()).raw_text.split('\n').filter(line=>line==='离线说明').length,1);
  await waitFor(async()=> (await drafts()).some(row=>row.value.meaning==='전송 이후 이어 쓴 초안'));
  check('online and visibility wake deliver once while keeping later draft edits');
  const source=(await db.query('select raw_text,processed_json from reading_materials where id=10')).rows[0];
  assert(source.raw_text.includes('图书馆'));assert.equal(source.processed_json.dictionary.id_0_word.meaning,'뜻 1');
  assert.equal(writes.filter(w=>w.table==='user_vocabulary').length,0);assert.deepEqual(report.errors,[]);
  check('textbook dictionary and personal vocabulary remain unchanged with no runtime errors');
}
