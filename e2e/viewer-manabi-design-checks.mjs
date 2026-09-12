import assert from 'node:assert/strict';

// Runs inside teaching-board.e2e's disposable database and intercepted browser.
// The same real inspector serves personal reading and the classroom canvas.
export async function verifyReaderDesign({page,board,scene,head,saveScreen,waitFor,check,db,uid,base,day,activate}) {
  const inspector=page.locator('.viewer-inspector');
  const token=()=>page.locator('[data-tid="id_0_word"]');
  const input=board.getByRole('textbox',{name:'단어·표현',exact:true});
  await input.fill('설명하다 떠오른 표현');
  await token()[activate]();await inspector.locator('.word-detail-card').waitFor();
  assert.equal(await page.locator('.word-detail-card').count(),1,'one existing word card, no hidden duplicate');
  assert.equal((await inspector.locator('.word-fit__char').allTextContents()).join(''),'图书馆');assert.match(await inspector.innerText(),/뜻 1/);
  await inspector.getByRole('button',{name:'발음 듣기',exact:true}).waitFor();
  await inspector.getByText(/새 단어 저장/).waitFor();
  await saveScreen('classroom-word-inspector');
  const layout=await page.locator('.viewer-layout').boundingBox(),card=await inspector.boundingBox(),canvas=await board.boundingBox();
  assert(card.x>=canvas.x+canvas.width-1,'desktop dictionary stays in the textbook column');
  assert(card.x+card.width<=layout.x+layout.width+1);
  const original=JSON.stringify(await head());
  await inspector.getByRole('button',{name:'크게 보기',exact:true})[activate]();
  const presentation=page.getByRole('dialog',{name:'학생에게 보여주는 설명',exact:true});await presentation.waitFor();
  await page.keyboard.press('Escape');await presentation.waitFor({state:'detached'});
  assert.equal(JSON.stringify(await head()),original,'preview does not insert into or move the board');
  await inspector.getByRole('button',{name:'판에 놓기',exact:true})[activate]();
  await waitFor(async()=> (await scene()).length===4);
  assert.equal(await input.inputValue(),'설명하다 떠오른 표현','placing the textbook word preserves a separate draft');
  const placed=(await scene()).find(el=>el.customData?.manabiExpression).customData.manabiExpression;
  assert.equal(placed.source.materialId,'10');assert.equal(placed.text,'图书馆');
  const notes=await db.query("select processed_json#>'{metadata,classEntries}' as entries from reading_materials where processed_json#>>'{metadata,team,day}'=$1",[day]);
  assert.equal(notes.rows[0].entries.length,3,'placing a card must not publish a class expression');
  check('classroom uses one full word card; preview and place preserve draft, source and class records');

  await input.fill('');await page.getByRole('navigation',{name:'설명판 보기'}).getByRole('button',{name:'교재',exact:true})[activate]();
  await token()[activate]();await inspector.locator('.word-detail-card').waitFor();
  await inspector.getByRole('button',{name:'보조 패널 닫기',exact:true})[activate]();
  await page.getByRole('navigation',{name:'설명판 보기'}).getByRole('button',{name:'함께',exact:true})[activate]();
  await page.setViewportSize({width:390,height:844});
  await token().scrollIntoViewIfNeeded();await token()[activate]();await inspector.locator('.word-detail-card').waitFor();
  await page.waitForTimeout(400);
  const selected=await token().boundingBox(),popup=await inspector.boundingBox(),toolbar=await page.locator('.viewer-topbar').boundingBox();
  assert(selected.y>=toolbar.y+toolbar.height-1,'selected source clears the sticky reader toolbar');
  assert(selected.y+selected.height<=popup.y+1,'selected source clears the word card');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await saveScreen('classroom-word-phone');
  await inspector.getByRole('button',{name:'보조 패널 닫기',exact:true})[activate]();
  await board.locator('canvas.interactive').waitFor({state:'visible'});
  assert.equal((await scene()).find(el=>el.customData?.manabiExpression).customData.manabiExpression.text,'图书馆');
  check('reader-only and mobile layouts keep word lookup, source visibility and the existing board');

  const entries=[['周末','zhōu mò','주말'],['，','',''],['我','wǒ','나'],['和','hé','~와'],['朋友','péng you','친구'],['去','qù','가다'],['图书馆','tú shū guǎn','도서관'],['。','',''],['我们','wǒ men','우리'],['一起','yì qǐ','함께'],['学习','xué xí','공부하다'],['中文','zhōng wén','중국어'],['。','','']];
  const json={sequence:[],dictionary:{},status:'completed',metadata:{language:'Chinese',level:'HSK 3'}};
  for(let line=0;line<8;line++){
    entries.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}_design`;json.sequence.push(id);json.dictionary[id]={text,furigana,meaning,base:text,pos:meaning?'표현':'기호'};});
    const id=`br_${line}_end_design`;json.sequence.push(id);json.dictionary[id]={text:'\n',pos:'개행'};
  }
  await db.query('insert into reading_materials(id,owner_id,title,raw_text,visibility,processed_json) values(12,$1,$2,$3,$4,$5)',[uid,'주말의 작은 도서관 — 함께 읽으며 넓어지는 세계',Array(8).fill(entries.map(e=>e[0]).join('')).join('\n'),'private',json]);
  const word=()=>page.locator('[data-tid="id_0_6_design"]');
  for(const [width,height,name]of [[1440,1000,'desktop'],[846,900,'tablet'],[390,844,'phone']]){
    await page.setViewportSize({width,height});await page.goto(base+'/viewer/12');await word().waitFor();await page.evaluate(()=>document.fonts.ready);
    await saveScreen(`reader-${name}`);
    await word()[activate]();await inspector.locator('.word-detail-card').waitFor();
    // Let the source-reveal animation frames settle before capturing fixed chrome.
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.word-detail-card').count(),1);
    await inspector.getByText(/새 단어 저장/).waitFor();
    await waitFor(async()=>inspector.locator('.reader-card-actions').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const bounds=await inspector.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);
    const colors=await page.locator('.viewer-layout').evaluate(el=>{const s=getComputedStyle(el);return {ink:s.getPropertyValue('--ink').trim(),reader:s.getPropertyValue('--reader-ink').trim()};});
    assert.equal(colors.reader,colors.ink,'reader inherits main-page ink');
    await saveScreen(`reader-${name}-word`);
    await page.keyboard.press('Escape');
  }
  check('personal desktop/tablet/phone layouts retain the complete word card and main-page color system');
  await page.getByRole('button',{name:'읽기 설정',exact:true})[activate]();
  await page.getByRole('dialog',{name:'읽기 설정',exact:true}).waitFor();
  await saveScreen('reader-settings-phone');
  await page.keyboard.press('Escape');await word().waitFor();
  check('Aa opens and closes with existing settings and mobile focus handling');
}
