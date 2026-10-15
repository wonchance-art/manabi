const path=require('path');const {createRequire}=require('module');const req=createRequire('/home/user/manabi/package.json');const {chromium}=req('playwright');
(async()=>{const [f,o,x,y,w,h]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:1300},deviceScaleFactor:3});await p.goto('file://'+path.resolve(f));await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const c=document.querySelector('.cover').getBoundingClientRect();return {l:c.left,t:c.top,mm:c.width/210}});
await p.screenshot({path:o,clip:{x:r.l+ +x*r.mm,y:r.t+ +y*r.mm,width:+w*r.mm,height:+h*r.mm}});await b.close();})();
