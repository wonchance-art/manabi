// 조판 실측: 각 글자 요소의 상자(mm)와 「金鳥居」 글자 상자 vs 金鳥居 막대 간격. 사용: node measure.cjs cover.html [폭px=390]
const path=require('path');const {createRequire}=require('module');const req=createRequire('/home/user/manabi/package.json');const {chromium}=req('playwright');
(async()=>{const [f,w='390']=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w+32,height:900}});
await p.goto('file://'+path.resolve(f));await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const c=document.querySelector('.cover').getBoundingClientRect();const mm=c.width/210;
const box=(r)=>({x0:+((r.left-c.left)/mm).toFixed(2),y0:+((r.top-c.top)/mm).toFixed(2),x1:+((r.right-c.left)/mm).toFixed(2),y1:+((r.bottom-c.top)/mm).toFixed(2)});
const out={};for(const s of ['.mast','.no','.ttl','.sub','.credit','.plate rect','.plate path:nth-of-type(2)']){const e=document.querySelector('.cover '+s);out[s]=box(e.getBoundingClientRect());}
// 金鳥居 글자 상자
const sub=document.querySelector('.cover .sub');const t=sub.firstChild;const i=t.textContent.indexOf('金鳥居');const rg=document.createRange();rg.setStart(t,i);rg.setEnd(t,i+3);out['金鳥居']=box(rg.getBoundingClientRect());
// 부제 열별
const rects=[...(()=>{const g=document.createRange();g.selectNodeContents(sub);return g.getClientRects();})()].map(box);out['sub-rects']=rects;
// 막대 꼭짓점(실제 변환)
const rect=document.querySelector('.cover .plate rect');const m=rect.getCTM();const svg=rect.ownerSVGElement;const sc=svg.getScreenCTM();
const pts=[[-9,-1.2],[9,-1.2],[9,1.2],[-9,1.2]].map(([x,y])=>{const q=new DOMPoint(x,y).matrixTransform(rect.getScreenCTM());return [+((q.x-c.left)/mm).toFixed(2),+((q.y-c.top)/mm).toFixed(2)];});out.barCorners=pts;
out.fonts=[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight).filter((v,i,a)=>a.indexOf(v)===i);
return out;});console.log(JSON.stringify(r,null,0).replace(/\],"/g,'],\n"').replace(/\},"/g,'},\n"'));await b.close();})();
