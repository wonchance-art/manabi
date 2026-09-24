import assert from 'node:assert/strict';

// Actual ViewerPage mutation + disposable PostgreSQL. HTTP/Auth are synthetic;
// this proves client save boundaries, not hosted RLS or provider accuracy.
export async function verifyPersonalReaderMeaning({page,context,saveScreen,waitFor,check,db,uid,base,activate,writes,cors}) {
  const materialId=12,tokenId='id_0_6_design',replacement='도서 열람 시설';
  const word=()=>page.locator(`[data-tid="${tokenId}"] .surface[role="button"]`);
  const inspector=page.locator('.viewer-inspector'),summary=inspector.locator('.reader-meaning>summary');
  const meaning=inspector.locator('.word-detail-card__meaning');
  const save=inspector.getByRole('button',{name:'이 자료에만 저장',exact:true});
  const dictionary={reading:'tú shū guǎn',meanings:[{meaning:'도서관',pos:'명사'},{meaning:replacement,pos:'명사'}]};
  const snapshot=async()=>({
    materials:(await db.query('select * from reading_materials order by id')).rows,
    vocabulary:(await db.query('select * from user_vocabulary order by id')).rows,
  });
  await db.query('insert into user_vocabulary(user_id,word_text,meaning,furigana,language,source_material_id,interval,ease_factor,repetitions,next_review_at) values($1,$2,$3,$4,$5,10,9,2.5,3,$6)',[uid,'图书馆','내가 저장한 도서관','tú shū guǎn','Chinese','2030-01-02T00:00:00Z']);
  const before=await snapshot(),writeStart=writes.length,requests=[],patches=[],apiWrites=[];
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.origin===new URL(base).origin&&url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method()))apiWrites.push(url.pathname);
  });
  let rejectSave=true,loseCommittedResponse=false;
  await context.route('**/rest/v1/morpheme_dictionary*',route=>route.request().method()==='GET'?route.fulfill({headers:cors,json:route.request().headers().accept?.includes('vnd.pgrst.object')?dictionary:[dictionary]}):route.fallback());
  await context.route('**/api/explain',route=>{
    requests.push(route.request().postDataJSON());
    return route.fulfill({json:{explanation:'검수용 문맥 후보입니다.',candidate:{meaning:replacement}}});
  });
  await context.route('**/rest/v1/reading_materials*',route=>{
    assert.notEqual(route.request().method(),'PATCH','correction must not replace the whole analysis');return route.fallback();
  });
  await context.route('**/rest/v1/rpc/viewer_correct_token',async route=>{
    const body=route.request().postDataJSON();patches.push(body);
    assert.equal(body.p_id,String(materialId));
    assert.deepEqual(Object.keys(body).sort(),['p_before','p_corrections','p_expected_raw','p_id','p_token']);
    if(rejectSave)return route.fulfill({headers:cors,json:null});
    const result=await db.query('select viewer_correct_token($1,$2,$3,$4,$5) data',[body.p_id,body.p_token,body.p_before,body.p_corrections,body.p_expected_raw]);
    if(loseCommittedResponse){loseCommittedResponse=false;return route.fulfill({headers:cors,json:null});}
    return route.fulfill({headers:cors,json:result.rows[0].data});
  });
  await page.setViewportSize({width:1280,height:900});
  await page.waitForTimeout(2600);await page.waitForLoadState('networkidle');
  await page.goto(base+`/viewer/${materialId}`);await word().waitFor();
  // The preceding focus test deliberately persists sentence-first selection.
  // Start this independent save story through the real settings controls.
  await page.getByRole('button',{name:'읽기 설정',exact:true})[activate]();
  const settings=page.getByRole('dialog',{name:'읽기 설정',exact:true});
  await settings.getByRole('tab',{name:'읽기 진행',exact:true})[activate]();
  await settings.getByRole('checkbox',{name:/문장 집중/}).uncheck();await page.keyboard.press('Escape');
  await word().focus();await page.keyboard.press('Enter');await meaning.waitFor();
  assert.equal((await meaning.innerText()).trim(),'도서관');
  await summary[activate]();await inspector.getByRole('button',{name:`${replacement} 사전 · 명사`,exact:true}).waitFor();
  assert.equal(requests.length,0,'opening the inspector and alternatives must not call AI');
  await inspector.getByRole('button',{name:'이 문장의 뜻 확인',exact:true})[activate]();
  const candidate=inspector.getByRole('button',{name:`${replacement} AI 문맥 후보`,exact:true});await candidate.waitFor();
  assert.equal(requests.length,1);assert.equal(requests[0].materialId,String(materialId));assert.equal(requests[0].tokenKey,tokenId);
  assert.equal(requests[0].token.meaningChoice,true);assert.match(requests[0].token.sentence,/图书馆/);
  await candidate[activate]();assert.equal(patches.length,0);assert.deepEqual(await snapshot(),before);
  assert.equal((await meaning.innerText()).trim(),'도서관');
  check('real reader opens alternatives without AI; a manual candidate request and selection do not save');
  await save[activate]();await inspector.getByRole('alert').filter({hasText:'저장 결과를 확인하지 못했어요.'}).waitFor();
  assert.equal(await candidate.getAttribute('aria-pressed'),'true');assert.equal(await save.isEnabled(),true);
  assert.deepEqual(await snapshot(),before);assert.equal(patches.length,1);
  check('a no-row save remains a failure with the chosen meaning available for retry');
  rejectSave=false;await save.focus();await page.keyboard.press('Enter');
  await waitFor(async()=>(await meaning.innerText()).trim()===replacement);
  await waitFor(()=>summary.evaluate(el=>el===document.activeElement));
  const expected=structuredClone(before);
  expected.materials.find(row=>row.id===materialId).processed_json.dictionary[tokenId].meaning=replacement;
  assert.deepEqual(await snapshot(),expected,'only this material token changes; other occurrences, raw text, reading, metadata and personal vocabulary/SRS remain intact');
  assert.equal(patches.length,2);
  const assertWrites=()=>{
    const positionWrites=writes.slice(writeStart).filter(row=>row.table==='reading_progress');
    for(const {body} of positionWrites){
      assert.deepEqual(Object.keys(body).sort(),['last_token_idx','material_id','user_id']);
      assert.equal(body.user_id,uid);assert.equal(String(body.material_id),String(materialId));
    }
    for(const {body} of writes.slice(writeStart).filter(row=>row.table==='library_reading_activity')){
      assert.deepEqual(body,{owner_id:uid,target_kind:'material',target_id:String(materialId),context:{materialId:String(materialId),mode:'text'}});
    }
    const changes=writes.slice(writeStart).filter(row=>!['reading_progress','library_reading_activity'].includes(row.table));
    assert.deepEqual(changes.map(row=>row.table),['token_corrections'],'no shared dictionary or personal vocabulary writes');
    assert.equal(changes[0].body.token_id,tokenId);assert.equal(String(changes[0].body.material_id),String(materialId));
    assert.deepEqual(changes[0].body.after_value,{meaning:replacement});
  };assertWrites();
  await saveScreen('reader-meaning-saved');
  check('material-only save changes exactly one token, preserves personal meaning/SRS and restores keyboard focus');
  await page.waitForTimeout(2600);await page.waitForLoadState('networkidle');await page.reload();await word().waitFor();
  await word().focus();await page.keyboard.press('Enter');await meaning.waitFor();
  await waitFor(async()=>(await meaning.innerText()).trim()===replacement);
  await summary[activate]();await inspector.getByRole('button',{name:'도서관 사전 · 명사',exact:true}).waitFor();
  assert.equal(requests.length,1,'reload and reopening must not query AI again');
  assert.equal(patches.length,2);assert.deepEqual(await snapshot(),expected);
  assertWrites();
  assert.deepEqual(apiWrites,['/api/explain'],'no dictionary promotion or other API mutation');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await waitFor(()=>word().evaluate(el=>el===document.activeElement));
  check('reloading preserves the saved meaning and dictionary alternatives; Escape returns to the source expression');

  // A second real page edits through the manual panel. Both pages read the same
  // disposable material before either save; only the server resolves the race.
  const other=await context.newPage();
  const otherErrors=[];
  other.on('pageerror',error=>otherErrors.push(error.message));
  other.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('WebSocket connection'))otherErrors.push(message.text());});
  try {
    const otherId=before.materials.find(row=>row.id===materialId).processed_json.sequence.find(id=>id!==tokenId&&before.materials.find(row=>row.id===materialId).processed_json.dictionary[id]?.meaning);
    await other.goto(base+`/viewer/${materialId}`);
    const otherWord=id=>other.locator(`[data-tid="${id}"] .surface[role="button"]`);
    await otherWord(otherId).waitFor();
    await word().focus();await page.keyboard.press('Enter');await summary[activate]();
    const originalChoice=inspector.getByRole('button',{name:'도서관 사전 · 명사',exact:true});await originalChoice[activate]();
    const edit=async(id,value)=>{
      await otherWord(id).focus();await other.keyboard.press('Enter');
      await other.getByRole('button',{name:'뜻·발음 수정',exact:true})[activate]();
      await other.locator('.token-edit input[type="text"],.token-edit input:not([type])').first().fill(value);
      await other.locator('.token-edit').getByRole('button',{name:'저장',exact:true})[activate]();
      await other.locator('.token-edit').waitFor({state:'hidden'});
    };
    await edit(otherId,'다른 창의 교정');
    await save[activate]();await waitFor(async()=>(await meaning.innerText()).trim()==='도서관');
    let current=(await snapshot()).materials.find(row=>row.id===materialId);
    assert.equal(current.processed_json.dictionary[otherId].meaning,'다른 창의 교정');
    check('two reader pages preserve corrections to different tokens through the real manual editor and meaning chooser');

    await summary[activate]();await inspector.getByRole('button',{name:`${replacement} 사전 · 명사`,exact:true})[activate]();
    await other.reload();await otherWord(tokenId).waitFor();
    await edit(tokenId,'공공 도서관');const concurrent=await snapshot();
    await save[activate]();await inspector.getByRole('alert').filter({hasText:'다른 곳에서 수정됐어요.'}).waitFor();
    assert.equal(await save.isDisabled(),true);
    assert.equal(await inspector.getByRole('button',{name:`${replacement} 사전 · 명사`,exact:true}).getAttribute('aria-pressed'),'true');
    assert.deepEqual(await snapshot(),concurrent);
    await page.setViewportSize({width:390,height:844});
    await inspector.getByRole('button',{name:'현재 내용 확인',exact:true}).scrollIntoViewIfNeeded();
    // The preceding successful save has a four-second toast. Wait for its real
    // dismissal so the conflict capture does not include that unrelated notice.
    await page.locator('.toast--success').waitFor({state:'hidden'});
    await saveScreen('reader-meaning-conflict');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await inspector.getByRole('button',{name:'현재 내용 확인',exact:true})[activate]();
    assert.deepEqual(await snapshot(),concurrent,'confirmation alone must not save');
    await waitFor(()=>save.evaluate(el=>el===document.activeElement));
    loseCommittedResponse=true;await page.keyboard.press('Enter');
    await inspector.getByRole('alert').filter({hasText:'저장 결과를 확인하지 못했어요.'}).waitFor();
    assert.equal(await inspector.getByRole('button',{name:`${replacement} 사전 · 명사`,exact:true}).getAttribute('aria-pressed'),'true');
    const committed=await snapshot();
    assert.equal(committed.materials.find(row=>row.id===materialId).processed_json.dictionary[tokenId].meaning,replacement);
    await save[activate]();await waitFor(async()=>(await meaning.innerText()).trim()===replacement);
    assert.deepEqual(await snapshot(),committed,'retrying a lost response must not overwrite anything else');
    current=(await snapshot()).materials.find(row=>row.id===materialId);
    assert.equal(current.processed_json.dictionary[tokenId].meaning,replacement);
    assert.equal(current.processed_json.dictionary[otherId].meaning,'다른 창의 교정');
    assert.deepEqual((await snapshot()).vocabulary,before.vocabulary);
    check('same-token conflict keeps the choice, confirms without saving, restores keyboard focus, and reconciles a lost response');

    // A conflict must preserve free-form edits too, not just dictionary choices.
    await other.reload();await otherWord(tokenId).waitFor();
    await otherWord(tokenId).focus();await other.keyboard.press('Enter');
    await other.getByRole('button',{name:'뜻·발음 수정',exact:true})[activate]();
    const manual=other.locator('.token-edit'),input=manual.locator('input:not([type]),input[type="text"]').first();
    await input.fill('읽고 공부하는 곳');
    await summary[activate]();await originalChoice[activate]();await save[activate]();
    await waitFor(async()=>(await meaning.innerText()).trim()==='도서관');const beforeManual=await snapshot();
    await manual.getByRole('button',{name:'저장',exact:true})[activate]();
    await manual.getByRole('alert').filter({hasText:'다른 곳에서 수정됐어요.'}).waitFor();
    assert.equal(await input.inputValue(),'읽고 공부하는 곳');
    assert.equal(await manual.getByRole('button',{name:'저장',exact:true}).isDisabled(),true);
    assert.deepEqual(await snapshot(),beforeManual);
    await manual.getByRole('button',{name:'현재 내용 확인',exact:true})[activate]();
    assert.deepEqual(await snapshot(),beforeManual);
    await waitFor(()=>manual.getByRole('button',{name:'저장',exact:true}).evaluate(el=>el===document.activeElement));
    await other.keyboard.press('Enter');await manual.waitFor({state:'hidden'});
    const final=structuredClone(beforeManual);
    final.materials.find(row=>row.id===materialId).processed_json.dictionary[tokenId].meaning='읽고 공부하는 곳';
    assert.deepEqual(await snapshot(),final);
    assert.deepEqual(otherErrors,[],'the second reader must have no runtime or console errors');
    check('manual correction also retains input on conflict and changes only its confirmed token');
  } finally {await other.close();}
}
