// 잉크 실측(10px/mm): 요소별 잉크 경계(mm)·잉크/주홍 면적 비율. 사용: node ink.cjs cover.html
const path=require('path');const {createRequire}=require('module');const req=createRequire('/home/user/manabi/package.json');const {chromium}=req('playwright');const sharp=req('sharp');
(async()=>{const [f]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:2132,height:3100}});
await p.goto('file://'+path.resolve(f));await p.waitForTimeout(3000);
const shot=async()=>{const buf=await p.locator('.cover').screenshot();return sharp(buf).raw().toBuffer({resolveWithObject:true});};
const dark=(r,g,bb)=>r<140&&g<140&&bb<160; const red=(r,g,bb)=>r>150&&g<130&&bb<110;
const scan=({data,info},test)=>{const k=info.width/210,ch=info.channels;let x0=1e9,y0=1e9,x1=-1,y1=-1,n=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*ch;if(test(data[i],data[i+1],data[i+2])){n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
 return {box:x1<0?null:[x0/k,y0/k,(x1+1)/k,(y1+1)/k].map(v=>+v.toFixed(2)),frac:n/(info.width*info.height)};};
const out={};
const all=await shot();
// 잉크 면적: 바탕(#eef0f4)과 RGB 거리 60 초과
{const {data,info}=all;let n=0,r=0;const ch=info.channels;for(let i=0;i<data.length;i+=ch){const d=Math.hypot(data[i]-0xee,data[i+1]-0xf0,data[i+2]-0xf4);if(d>60)n++;if(red(data[i],data[i+1],data[i+2]))r++;}
 out['잉크 면적%']=+(100*n/(info.width*info.height)).toFixed(2);out['주홍 면적%']=+(100*r/(info.width*info.height)).toFixed(2);}
const sels=['.mast','.no','.ttl','.sub','.credit','.k0','.k1','.k2','.k3'];
for(const e of sels){await p.evaluate((sel)=>{document.querySelectorAll('.cover *').forEach(n=>{if(n.closest('.cover')&&!(n.closest('svg')&&!n.matches('svg')))n.style.visibility=(n.matches(sel)||n.closest(sel))?'visible':'hidden'})},e);out[e]=(await scan(await shot(),dark)).box;}
console.log(JSON.stringify(out,null,0).replace(/,"/g,',\n"'));await b.close();})();
