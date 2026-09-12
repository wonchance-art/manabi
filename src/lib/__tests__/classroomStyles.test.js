import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
const css=readFileSync('src/components/classroom/classroom.css','utf8');
const global=readFileSync('src/index.css','utf8');
it('classroom colors and borders resolve to declared tokens or explicit fallbacks',()=>{
 const declared=new Set([...(`${css}\n${global}`).matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
 const required=[...css.matchAll(/var\((--[\w-]+)\)/g)].map(m=>m[1]);
 expect([...new Set(required.filter(v=>!declared.has(v)))]).toEqual([]);
});
