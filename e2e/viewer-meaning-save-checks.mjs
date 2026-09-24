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
  let rejectSave=true;
  await context.route('**/rest/v1/morpheme_dictionary*',route=>route.request().method()==='GET'?route.fulfill({headers:cors,json:route.request().headers().accept?.includes('vnd.pgrst.object')?dictionary:[dictionary]}):route.fallback());
  await context.route('**/api/explain',route=>{
    requests.push(route.request().postDataJSON());
    return route.fulfill({json:{explanation:'검수용 문맥 후보입니다.',candidate:{meaning:replacement}}});
  });
  await context.route('**/rest/v1/reading_materials*',async route=>{
    const req=route.request();if(req.method()!=='PATCH')return route.fallback();
    const url=new URL(req.url()),body=req.postDataJSON();patches.push({body,id:url.searchParams.get('id'),owner:url.searchParams.get('owner_id')});
    assert.equal(url.searchParams.get('id'),`eq.${materialId}`);
    assert.equal(url.searchParams.get('owner_id'),`eq.${uid}`);
    assert.deepEqual(Object.keys(body),['processed_json']);
    // Supabase can return success with no affected row. The app must reject it
    // instead of reporting a save; the next explicit retry writes under RLS.
    if(rejectSave)return route.fulfill({headers:cors,json:null});
    const result=await db.query('update reading_materials set processed_json=$1 where id=$2 and owner_id=$3 returning id',[body.processed_json,materialId,uid]);
    return route.fulfill({headers:cors,json:result.rows[0]||null});
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
  await save[activate]();await inspector.getByRole('alert').filter({hasText:'저장하지 못했어요.'}).waitFor();
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
}
