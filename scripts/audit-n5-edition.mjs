#!/usr/bin/env node
// Read-only inventory of the packaged edition. Counts are not a JLPT completeness
// or translation-quality score. Learning-page lessons must not be treated as empty.
import fs from 'node:fs';
import crypto from 'node:crypto';

const root=new URL('../src/content/textbookEditions/',import.meta.url);
const index=JSON.parse(fs.readFileSync(new URL('index.json',root),'utf8'));
const edition=process.argv[2]||index.current;
if(!/^[a-f0-9]{24}$/.test(edition))throw Error('invalid current edition');
const bytes=fs.readFileSync(new URL(`${edition}/bundle.json`,root));
const bundle=JSON.parse(bytes),book=bundle.manuscript;
const issues=[],pageIds=new Set(bundle.pages.map(page=>page.id));
const references=new Set([...pageIds,...Object.keys(bundle.sourceIndex)]);
const nodes=[];
function walk(value,path,visit){
  if(Array.isArray(value))return value.forEach((item,i)=>walk(item,`${path}[${i}]`,visit));
  if(!value||typeof value!=='object')return;
  visit(value,path);Object.entries(value).forEach(([key,item])=>walk(item,`${path}.${key}`,visit));
}
const nonempty=value=>typeof value==='string'&&!!value.trim();
const issue=(kind,path,detail)=>issues.push({kind,path,detail});
walk(book,'manuscript',(node,path)=>{
  const localLesson=path.match(/^manuscript\.lessons\[(\d+)\]/);
  const target=localLesson&&/^study\d+$/.test(node.target)
    ?`u${String(book.lessons[Number(localLesson[1])].number).padStart(2,'0')}-${node.target}`:node.target;
  if(typeof target==='string'&&!references.has(target))issue('missing-target',path,target);
  if(nonempty(node.ja)&&Object.hasOwn(node,'ko')&&!nonempty(node.ko))issue('empty-paired-translation',path,node.ja);
});
const lessonNumbers=book.lessons.map(lesson=>lesson.number);
if(JSON.stringify(lessonNumbers)!==JSON.stringify(Array.from({length:42},(_,i)=>i+1)))issue('lesson-sequence','lessons',lessonNumbers);
if(pageIds.size!==bundle.pages.length)issue('duplicate-page-id','pages',bundle.pages.length-pageIds.size);
for(const lesson of book.lessons){
  const questions=[];
  walk(lesson,`lessons[${lesson.number}]`,(node,path)=>{
    if(!nonempty(node.prompt))return;
    questions.push({node,path});
    if(!nonempty(node.answer))issue('missing-answer',path,node.id||node.prompt);
    if(!nonempty(node.why))issue('missing-rationale',path,node.id||node.prompt);
    if(node.options?.length&&!node.options.includes(node.answer))issue('option-answer-review',path,{answer:node.answer,options:node.options});
  });
  const structured=!!lesson.learning_pages?.length;
  if(!structured)for(const group of ['listen','reading']){
    if(!nonempty(lesson[`${group}_question`])||!nonempty(lesson[`${group}_answer`])||!nonempty(lesson[`${group}_why`]))issue('missing-core-check',`lessons[${lesson.number}]`,group);
  }
  if(!structured&&(!nonempty(lesson.writing_prompt)||!nonempty(lesson.writing_sample?.ja)||!nonempty(lesson.writing_sample?.ko)||!nonempty(lesson.writing_check)))issue('missing-writing-scaffold',`lessons[${lesson.number}]`,'prompt/sample/check');
  const prerequisites=[];
  for(const match of (lesson.prerequisite||'').matchAll(/(\d{1,2})(?:[–—~-](\d{1,2}))?과/g)){
    const from=Number(match[1]),to=Number(match[2]||match[1]);
    for(let n=from;n<=to;n++)prerequisites.push(n);
  }
  for(const n of prerequisites)if(n>=lesson.number||!lessonNumbers.includes(n))issue('forward-prerequisite',`lessons[${lesson.number}]`,n);
  const prefix=`u${String(lesson.number).padStart(2,'0')}-`;
  const pages=bundle.pages.filter(page=>page.id.startsWith(prefix));
  nodes.push({number:lesson.number,title:lesson.title,format:structured?'learning-pages':'standard',
    pages:pages.length,pageIds:pages.map(page=>page.id),duration:lesson.duration,
    prerequisites:[...new Set(prerequisites)],questions:questions.length,
    coreReadingCharacters:structured?null:[...lesson.reading.replace(/\s/g,'')].length,
    patterns:[...(lesson.patterns||[]),...(lesson.extra_patterns||[])].map(item=>item.formula),
    learningPageTitles:(lesson.learning_pages||[]).map(item=>item.title),
    additionalPracticePages:(lesson.practice_pages||[]).length,reviewPages:(lesson.review_pages||[]).length,
    explicitAudioDisabled:lesson.audioEnabled===false});
}
const formats=Object.fromEntries(['standard','learning-pages'].map(format=>[format,nodes.filter(row=>row.format===format).length]));
const report={edition,bundleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  scope:'Packaged manuscript structure only; not live publication, rendered layout, full semantic review, JLPT completeness or listening verification.',
  summary:{lessons:nodes.length,formats,pages:bundle.pages.length,sourceAnchors:references.size,
    lexicon:book.lexicon.length,grammarIndex:book.grammarIndex.length,kanjiIndex:book.kanjiIndex.length,
    promptAnswerRationaleObjects:nodes.reduce((sum,row)=>sum+row.questions,0),
    coreListeningReadingChecks:nodes.filter(row=>row.format==='standard').length*2,
    coreWritingScaffolds:nodes.filter(row=>row.format==='standard').length,
    preservedAudioFiles:Object.keys(bundle.assets).filter(key=>key.startsWith('audio/')).length,
    explicitAudioDisabledLessons:nodes.filter(row=>row.explicitAudioDisabled).map(row=>row.number)},
  issues,lessons:nodes};
console.log(JSON.stringify(report,null,2));
if(issues.length)process.exitCode=1;
