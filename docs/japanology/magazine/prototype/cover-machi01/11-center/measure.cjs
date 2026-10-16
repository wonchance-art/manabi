// 좌우 여백 대칭 실측: 표지별 글자 줄 상자(Range rects)와 요소별 잉크(10px/mm 렌더)의 왼쪽·오른쪽 여백(mm).
// 사용: node measure.cjs covers/ippon-T1.html [...] → JSON
const path=require('path');const {createRequire}=require('module');const req=createRequire('/home/user/manabi/package.json');const {chromium}=req('playwright');const sharp=req('sharp');
(async()=>{const b=await chromium.launch();const out={};
for(const f of process.argv.slice(2)){const p=await b.newPage({viewport:{width:2132,height:3100}});await p.addStyleTag({content:""}).catch(()=>{});await p.goto('file://'+path.resolve(f));await p.addStyleTag({content:'.wrap{max-width:none!important}'});await p.waitForTimeout(3500);
 const rects=await p.evaluate(()=>{const c=document.querySelector('.cover').getBoundingClientRect();const mm=c.width/210;const res=[];
  for(const el of document.querySelectorAll('.cover > p, .cover > h1')){const kids=[...el.children].filter(k=>getComputedStyle(k).display==='block');
   for(const ln of (kids.length?kids:[el])){const g=document.createRange();g.selectNodeContents(ln);const r=g.getBoundingClientRect();
    res.push({el:el.className.replace('c ',''),t:ln.textContent.trim().slice(0,12),L:+((r.left-c.left)/mm).toFixed(2),R:+((c.right-r.right)/mm).toFixed(2),diff:+(((r.left-c.left)-(c.right-r.right))/mm).toFixed(2)});}}
  return res;});
 const bg=await p.evaluate(()=>getComputedStyle(document.querySelector('.cover')).getPropertyValue('--cover-bg').trim());
 const bgc=bg.replace('#','').match(/../g).map(h=>parseInt(h,16));
 await p.addStyleTag({content:'.cover .plate{visibility:hidden!important}'});
 const ink={};
 for(const sel of ['.mast','.kick','.ttl','.l2','.l3','.story','.credit']){
  const has=await p.evaluate((s)=>!!document.querySelector('.cover '+s),sel);if(!has)continue;
  await p.evaluate((s)=>document.querySelectorAll('.cover > *').forEach(n=>n.style.visibility=n.matches(s)?'':'hidden'),sel);
  const buf=await p.locator('.cover').screenshot();const {data,info}=await sharp(buf).raw().toBuffer({resolveWithObject:true});const k=info.width/210;let x0=1e9,x1=-1;
  for(let y=3;y<info.height-3;y++)for(let x=3;x<info.width-3;x++){const i=(y*info.width+x)*info.channels;if(Math.hypot(data[i]-bgc[0],data[i+1]-bgc[1],data[i+2]-bgc[2])>60){if(x<x0)x0=x;if(x>x1)x1=x;}}
  ink[sel]={x0,x1,w:info.width,L:+(x0/k).toFixed(2),R:+(210-(x1+1)/k).toFixed(2),diff:+(x0/k-(210-(x1+1)/k)).toFixed(2)};}
 out[path.basename(f)]={lines:rects,ink};await p.close();}
console.log(JSON.stringify(out,null,1));await b.close();})();
