// Keep the accepted manuscript fixed; release the web medium first.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('src/content/textbookEditions');
const {current}=JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8'));
const dir=path.join(root,current),bundlePath=path.join(dir,'bundle.json');
const b=JSON.parse(fs.readFileSync(bundlePath,'utf8'));
if(b.artifactManifest.media?.pdf===false){console.log('Web-only release already prepared.');process.exit(0)}
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
html=html.replace(/<a\b[^>]*class="pdf-link"[^>]*>[\s\S]*?<\/a>/g,'')
 .replace(/<button\b[^>]*data-mode="pdf"[^>]*>[\s\S]*?<\/button>/g,'')
 .replace(/<iframe\b[^>]*id="edition-pdf"[^>]*>[\s\S]*?<\/iframe>/g,'')
 .replace('일본어 N5 · 1.0 검토판','일본어 N5 · 웹 교재')
 .replace('같은 원고의 웹과 PDF','장면·표현·연습·복습')
 .replace('통합 검토판 · 음성 제외','내 속도로 공부하는 일본어');
if(/data-mode="pdf"|href="[^"]*\.pdf/.test(html))throw Error('PDF entry remains in the web-only release');
fs.writeFileSync(path.join(dir,'index.html'),html);
const js=fs.readFileSync(path.join(dir,'app.js'),'utf8').replace("function setMode(mode){", "function setMode(mode){if(mode==='pdf')mode='web';");
fs.writeFileSync(path.join(dir,'app.js'),js);
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const file of ['index.html','app.js']){const data=fs.readFileSync(path.join(dir,file));b.assets[file]={...b.assets[file],sha256:sha(data),bytes:data.length}}
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
b.artifactManifest.media={web:true,pdf:false,audio:'existing-only'};
b.artifactManifest.bundleHash=sha(JSON.stringify(canonical(b.assets)));
fs.writeFileSync(bundlePath,JSON.stringify(b));
console.log(JSON.stringify({edition:current,media:b.artifactManifest.media,bundleHash:b.artifactManifest.bundleHash}));
