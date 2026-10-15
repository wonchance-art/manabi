// 잉크 실측: 표지를 10px/mm로 렌더해 요소별 실제 잉크 경계(mm)를 잰다. 사용: node ink.cjs cover.html
const path=require('path');const {createRequire}=require('module');const req=createRequire('/home/user/manabi/package.json');const {chromium}=req('playwright');const sharp=req('sharp');
(async()=>{const [f]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:2132,height:3000}});
await p.goto('file://'+path.resolve(f));await p.waitForTimeout(2500);
const els=['.mast','.no','.ttl','.sub','.credit'];const out={};
const shot=async()=>{const buf=await p.locator('.cover').screenshot();const {data,info}=await sharp(buf).raw().toBuffer({resolveWithObject:true});return {data,info};};
const bounds=({data,info},test,reg)=>{const k=info.width/210;let x0=1e9,y0=1e9,x1=-1,y1=-1;const ch=info.channels;
 const [rx0,ry0,rx1,ry1]=reg.map(v=>Math.round(v*k));for(let y=Math.max(0,ry0);y<Math.min(info.height,ry1);y++)for(let x=Math.max(0,rx0);x<Math.min(info.width,rx1);x++){const i=(y*info.width+x)*ch;if(test(data[i],data[i+1],data[i+2])){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
 return x1<0?null:[+(x0/k).toFixed(2),+(y0/k).toFixed(2),+((x1+1)/k).toFixed(2),+((y1+1)/k).toFixed(2)];};
const dark=(r,g,bb)=>r<140&&g<140&&bb<160; const red=(r,g,bb)=>r>150&&g<130&&bb<110;
await p.addStyleTag({content:'.cover .plate{visibility:hidden}'});
for(const e of els){await p.evaluate((sel)=>{document.querySelectorAll('.cover > *').forEach(n=>n.style.visibility=n.matches(sel)?'':'hidden')},e);const s=await shot();out[e]=bounds(s,dark,[0,0,210,297]);}
// 金鳥居 글자 잉크(부제만 보이게, 막대 높이 근처 오른쪽 열)
await p.evaluate(()=>document.querySelectorAll('.cover > *').forEach(n=>n.style.visibility=n.matches('.sub')?'':'hidden'));
{const s=await shot();out['sub 오른열 y185-212']=bounds(s,dark,[105,185,120,212]);}
await p.evaluate(()=>{document.querySelectorAll('.cover > *').forEach(n=>n.style.visibility=n.matches('.plate')?'':'hidden');document.querySelector('.cover .plate').style.visibility='visible'});
{const s=await shot();out['red 막대 부근']=bounds(s,red,[110,190,140,210]);out['red 선 위끝']=bounds(s,red,[100,100,150,125]);out['dark 도리이(판면만)']=bounds(s,dark,[110,185,140,215]);out['dark 능선']=bounds(s,dark,[0,0,210,120]);}
console.log(JSON.stringify(out,null,0).replace(/\],"/g,'],\n"'));await b.close();})();
