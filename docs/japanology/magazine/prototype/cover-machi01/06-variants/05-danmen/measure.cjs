// 글자 상자와 잉크를 mm로 잰다. 사용: node measure.cjs cover.html
const path=require('path');const {createRequire}=require('module');const req=createRequire('/home/user/manabi/package.json');const {chromium}=req('playwright');const sharp=req('sharp');
(async()=>{const [f]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:2132,height:3000}});
await p.goto('file://'+path.resolve(f));await p.waitForTimeout(2500);
const boxes=await p.evaluate(()=>{const c=document.querySelector('.cover').getBoundingClientRect();const mm=c.width/210;const o={};
for(const s of ['.ttl','.sub','.credit','.no']){const el=document.querySelector(s);const r=document.createRange();r.selectNodeContents(el);const rs=[...r.getClientRects()];
 o[s]=rs.reduce((a,x)=>[Math.min(a[0],(x.left-c.left)/mm),Math.min(a[1],(x.top-c.top)/mm),Math.max(a[2],(x.right-c.left)/mm),Math.max(a[3],(x.bottom-c.top)/mm)],[1e9,1e9,-1e9,-1e9]).map(v=>+v.toFixed(2));}
return o;});
const out={boxes,ink:{}};
const shot=async()=>{const buf=await p.locator('.cover').screenshot();return sharp(buf).raw().toBuffer({resolveWithObject:true});};
const bounds=({data,info})=>{const k=info.width/210;let x0=1e9,y0=1e9,x1=-1,y1=-1;const ch=info.channels;for(let y=0;y<info.height-4;y++)for(let x=0;x<info.width-4;x++){const i=(y*info.width+x)*ch;const bg=[data[0],data[1],data[2]];if(Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2])>90){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}return x1<0?null:[x0/k,y0/k,(x1+1)/k,(y1+1)/k].map(v=>+v.toFixed(2));};
for(const s of ['.ttl','.sub','.credit','.no']){await p.evaluate((sel)=>document.querySelectorAll('.cover > *').forEach(n=>n.style.visibility=n.matches(sel)?'visible':'hidden'),s);out.ink[s]=bounds(await shot());}
console.log(JSON.stringify(out));await b.close();})();
