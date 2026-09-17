import {createServer} from 'vite';
import {launchQaBrowser,traceQa,finishQa,paintQa} from './qa-runtime.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.env.QA_OUT||'/private/tmp/manabi-meaning-choices',engine=process.env.QA_BROWSER||'chromium';fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),plugins:[{name:'isolated-session',enforce:'pre',resolveId(source,importer){if(source==='./supabase'&&importer?.endsWith('/viewerMeaningChoices.js'))return path.resolve('e2e/meaning-choices-auth.js');}}],server:{host:'127.0.0.1',port:0},oxc:{jsx:{runtime:'automatic'}},optimizeDeps:{include:['react','react-dom/client','react/jsx-dev-runtime','react/jsx-runtime']},logLevel:'error'});await server.listen();
const browser=await launchQaBrowser(engine),page=await browser.newPage(),requests=[],saves=[],errors=[],aborted=[],checks=[];
let delayed=null,failSave=true,status=200,payload={explanation:'请客가 손님을 대접한다는 단서입니다.',candidate:{meaning:'손님을 맞이하는 주인'}};
page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>{if(request.url().endsWith('/api/explain'))aborted.push(request.failure()?.errorText);});
await page.route('**/api/explain',async route=>{requests.push(route.request().postDataJSON());const body=payload,code=status;const finish=()=>route.fulfill({status:code,json:body}).catch(()=>{});if(delayed===true)delayed=finish;else await finish();});
await page.route('**/qa-save',async route=>{saves.push(route.request().postDataJSON());await route.fulfill({status:failSave?500:200,json:{ok:!failSave}});});
const waitFor=async f=>{for(let i=0;i<100;i++){if(await f())return;await page.waitForTimeout(30);}throw Error('condition timeout');};
const select=async patch=>{await page.evaluate(patch=>window.meaningQA.select(patch),patch);await paintQa(page);};
const summary=page.locator('.reader-meaning>summary'),save=page.getByRole('button',{name:'이 자료에만 저장',exact:true});
const lookup=()=>page.getByRole('button',{name:/^(이 문장의 뜻 확인|문맥 뜻 다시 확인)$/});
const check=label=>{checks.push(label);console.log(label);};
const report={engine,groups:[],checks,requests,saves,aborted,errors};await traceQa(page.context());
try{
 await page.goto(server.resolvedUrls.local[0]+'e2e/meaning-choices-fixture.html');await summary.click();assert.equal(requests.length,0);assert.equal(await save.isDisabled(),true);
 await page.getByRole('button',{name:'주인 사전 · 명사',exact:true}).click();assert.equal(await page.getByTestId('current-meaning').textContent(),'주최국');assert.equal(saves.length,0);
 await save.click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'주인 사전 · 명사',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await save.isEnabled(),true);
 check('opening and choosing are read-only; a failed save retains the selected candidate');
 failSave=false;await save.focus();await page.keyboard.press('Enter');await waitFor(async()=>await page.getByTestId('current-meaning').textContent()==='주인');await waitFor(()=>summary.evaluate(el=>el===document.activeElement));
 assert.deepEqual(saves.at(-1),{correction:{meaning:'주인',pos:'명사'},target:{tokenId:'id_1_2',expectedMeaning:'주최국'}});assert.equal(await page.locator('.reader-meaning').getAttribute('open'),null);
 check('saving changes only the selected material token and restores focus to the stable summary');
 await summary.click();delayed=true;await lookup().click();await waitFor(()=>typeof delayed==='function');await select({tokenId:'id_1_3'});await summary.click();await waitFor(()=>aborted.length===1);await delayed();delayed=null;await page.waitForTimeout(100);assert.equal(await page.getByText('손님을 맞이하는 주인',{exact:true}).count(),0);assert.equal(requests.length,1);
 check('changing token aborts pending context lookup and blocks late output');
 await lookup().focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'손님을 맞이하는 주인 AI 문맥 후보',exact:true}).waitFor();assert.equal(await lookup().evaluate(el=>el===document.activeElement),true);
 await page.evaluate(()=>window.meaningQA.invalidate());await page.waitForTimeout(100);assert.equal(requests.length,2);
 assert.equal(await page.getByTestId('current-meaning').textContent(),'주인');assert.equal(saves.length,2);
 check('AI lookup is explicit, keeps keyboard focus and never saves or reruns on invalidation');
 for(const patch of [{meaning:'다른 뜻'},{pos:'동사'},{userId:'another'},{sentence:'昨天我请客，我来当东道主。'}]){
  await select(patch);if(await page.locator('.reader-meaning').getAttribute('open')===null)await summary.click();assert.equal(await page.getByText('손님을 맞이하는 주인',{exact:true}).count(),0);assert.equal(requests.length,2);
 }
 check('meaning, POS, account and context changes cannot reuse the previous candidate');
 await select({meaning:'주최국',pos:'명사'});status=502;await lookup().click();await page.getByRole('alert').waitFor();status=200;payload={explanation:'추가 문맥이 필요합니다.',candidate:null};await lookup().click();await page.getByText('뜻을 하나로 고르기 어려워요. 문장과 사전의 뜻을 함께 확인해 주세요.',{exact:true}).waitFor();assert.equal(await save.isDisabled(),true);
 check('provider failure retries manually and an uncertain result offers no savable candidate');
 payload={explanation:'请客가 손님을 대접한다는 단서입니다.',candidate:{meaning:'손님을 맞이하는 주인'}};await lookup().click();await page.getByRole('button',{name:'손님을 맞이하는 주인 AI 문맥 후보',exact:true}).click();
 for(const width of [1180,390]){await page.setViewportSize({width,height:860});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+`/meaning-${width}.png`,fullPage:true});}
 await lookup().focus();await page.keyboard.press('Escape');assert.equal(await summary.evaluate(el=>el===document.activeElement),true);
 await select({canApply:false,userId:'reader',dictError:true});await summary.click();await page.getByRole('button',{name:'다시 불러오기'}).click();assert.equal(await save.count(),0);assert.equal(await page.locator('.reader-meaning__option').count(),0);
 await select({userId:null});await summary.click();const before=requests.length;await lookup().focus();await page.keyboard.press('Enter');assert.equal(requests.length,before);assert.equal(await lookup().getAttribute('aria-disabled'),'true');
 check('desktop/mobile fit, Escape, dictionary retry and read-only/signed-out states remain usable');
 assert.deepEqual(errors,[]);report.groups.push('reader.meaning');
}catch(error){report.failure=error.stack;report.visible=await page.locator('body').innerText();await page.screenshot({path:out+'/failure.png',fullPage:true});throw error;}finally{await finishQa({browser,server,context:page.context(),report,out});}
