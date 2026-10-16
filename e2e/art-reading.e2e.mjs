// 「그림 한 장 읽기」 기사형 읽기(ART-READ-001, 2026-10-15 KST 오너 「권장대로 ㄱㄱ」) — 실제 뷰어·발견 화면, 합성 자료만. 운영 DB 없음.
// ① 발견 목록에서 고르면 바로 그 장 뷰어 ② 미술 장은 저장된 보기가 「쪽 넘김」이어도 스크롤 ③ 그림·제목·바이라인은 본문 위,
// 소장처·찾아볼 것·출처는 본문 뒤 ④ Aa에 「보기」 선택 대신 안내 한 줄 ⑤ 가로 넘침 0.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const shots=process.env.ART_SCREENSHOTS;
const catalog=name=>JSON.parse(readFileSync(new URL(`../src/content/art/${name}.json`,import.meta.url),'utf8'));
const curation=catalog('curations').find(c=>c.id==='ukiyoe-landscape-hokusai-hiroshige');
const work=catalog('works').find(w=>w.id===curation.works[0]);
const description=work.descriptions.find(d=>d.language==='ja');
const lines=description.text.split('\n');
const sequence=[],dictionary={};
lines.forEach((text,line)=>{
 const id=`id_${line}_0`;sequence.push(id);dictionary[id]={text,base_form:text,furigana:'',meaning:'검수용',pos:'명사'};
 if(line<lines.length-1){const br=`br_${line}`;sequence.push(br);dictionary[br]={text:'\n',base_form:'',furigana:'',meaning:'',pos:'개행'};}
});
const material={id:94301,owner_id:owner,user_id:owner,visibility:'private',title:`${curation.title.native} — ${work.title.native}`,raw_text:description.text,
 created_at:new Date().toISOString(),processed_json:{status:'completed',sequence,dictionary,metadata:{language:'Japanese',level:curation.level,
  book:{key:`art-${curation.id}`,title:curation.title.native,order:1,total:curation.works.length},
  literature:{schemaVersion:1,provider:'art',curation:curation.id,work:work.id,textSha256:description.textSha256,credit:description.credit,license:description.license,sourceUrl:description.sourceUrl}}}};

async function open(width,path='/viewer/94301'){
 const f=await fixture({width});
 // 저장된 보기가 「쪽 넘김」(기본)이어도 미술 장은 스크롤이어야 한다.
 await f.context.addInitScript(()=>localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,common:{readerView:'paged'},languages:{Japanese:{autoSpeakOnClick:false}}})));
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 // 발견 목록의 작품→장 조회(provider 'art', 고른 열만) — 합성 백엔드는 jsonb 경로 필터를 모르므로 여기서 답한다. 나중에 붙인 route가 먼저 잡는다.
 await f.context.route(/\/rest\/v1\/reading_materials\?.*literature/,route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},
  body:JSON.stringify([{id:material.id,visibility:'private',literature:material.processed_json.metadata.literature}])}));
 f.rows.push(structuredClone(material));
 await f.page.goto(path,{waitUntil:'domcontentloaded',timeout:120000});
 return f;
}
const noOverflow=f=>f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);

for(const width of [390,1280]){
 test(`${width}px: 미술 장은 스크롤 — 그림·제목은 본문 위, 작품 이야기·출처는 본문 뒤, Aa에 「보기」 없음`,async()=>{
  const f=await open(width);try{
   const head=f.page.locator('.viewer-art-card--head');
   await head.locator('img').waitFor();
   await f.page.locator('[data-source-token="id_0_0"]').waitFor();
   assert.equal(await f.page.locator('[data-reader-pages]').getAttribute('data-reader-pages'),'scroll');
   assert.equal(await f.page.locator('[data-reader-pages="paged"]').count(),0);
   const order=await f.page.evaluate(()=>{
    const pos=(a,b)=>!!(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));
    const head=document.querySelector('.viewer-art-card--head'),facts=document.querySelector('.viewer-art-card--facts'),tokens=document.querySelectorAll('[data-source-token]');
    return {headBeforeBody:pos(head,tokens[0]),factsAfterBody:pos(tokens[tokens.length-1],facts),creditAfterFacts:pos(facts,document.querySelector('.viewer-art-credit'))};
   });
   assert.deepEqual(order,{headBeforeBody:true,factsAfterBody:true,creditAfterFacts:true});
   assert.equal(await head.locator('.viewer-art-card__facts').count(),0,'머리에 사실 목록이 남으면 안 된다');
   assert.ok(await f.page.locator('.viewer-art-card--facts').getByText('찾아볼 것',{exact:true}).isVisible());
   assert.ok(await noOverflow(f));
   if(shots)await f.page.screenshot({path:`${shots}/art-viewer-${width}.png`,fullPage:true});
   await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
   const dialog=f.page.getByRole('dialog',{name:'읽기 설정',exact:true});await dialog.waitFor();
   await dialog.getByText('그림 읽기는 스크롤로 읽어요',{exact:true}).waitFor();
   assert.equal(await dialog.getByText('쪽 넘김',{exact:true}).count(),0);
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 });
}

test('발견: 「그림 한 장 읽기」 카드를 누르면 서재를 거치지 않고 바로 그 장 뷰어, 공개 전 장은 「비공개 미리보기」',async()=>{
 const f=await open(390,'/discover');try{
  const card=f.page.locator('.art-reading__card').filter({hasText:work.title.native});
  await card.waitFor();
  assert.ok(await card.getByText('비공개 미리보기').isVisible());
  assert.equal(await f.page.locator('.art-reading__card').count(),1,'읽을 장이 없는 작품은 그리지 않는다');
  assert.ok(await noOverflow(f));
  if(shots)await f.page.screenshot({path:`${shots}/art-discover-390.png`,fullPage:true});
  await card.click();
  await f.page.waitForURL(/\/viewer\/94301$/);
  await f.page.locator('.viewer-art-card--head img').waitFor();
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('/art/<작품>: 읽을 장으로 바로 넘어간다',async()=>{
 const f=await open(1280,`/art/${work.id}`);try{
  await f.page.waitForURL(/\/viewer\/94301$/);
  await f.page.locator('.viewer-art-card--head img').waitFor();
 }finally{await f.context.close();}
});
