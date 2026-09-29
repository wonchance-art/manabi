// Repeat only the student portion after a full teacher UI run. Synthetic DB snapshot only.
import fs from 'node:fs';
import {chromium,webkit} from 'playwright-core';
import {verifyClassRelease} from './classroom-release-checks.mjs';
const {PGlite}=await import(process.env.QA_PGLITE_MODULE||'@electric-sql/pglite');
if(!process.env.QA_CHECKPOINT)throw Error('QA_CHECKPOINT from the synthetic teacher run is required');
const db=new PGlite({loadDataDir:new Blob([fs.readFileSync(process.env.QA_CHECKPOINT)])});
const engine=process.env.QA_BROWSER||'chromium',out=process.env.QA_OUT||'/private/tmp/manabi-class-student-check';fs.mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}),headless:true});
const report={engine,checks:[],errors:[],screens:[]};
try{await verifyClassRelease({browser,db,uid:'00000000-0000-4000-8000-000000000077',day:'2026-09-10',base:process.env.QA_BASE||'http://127.0.0.1:3123',out,report,check:label=>{report.checks.push(label);console.log(label);}});if(report.errors.length)throw Error(report.errors.join('\n'));}
catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await db.close();}
