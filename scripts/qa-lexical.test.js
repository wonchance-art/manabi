import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lexicalCases, assessLexical, inspectLexical, lexicalRequestBundle, lexicalResponseReport } from './qa-lexical.mjs';
const gold=JSON.parse(fs.readFileSync(new URL('../e2e/fixtures/lexical-gold.json',import.meta.url)));
const base=JSON.parse(fs.readFileSync(new URL('../e2e/fixtures/lexical-senses.json',import.meta.url)));
const rows=lexicalCases(gold,base);
describe('source-backed editorial cases are not claimed as model accuracy',()=>{
  it('keeps context, regional readings and withheld decisions separate',()=>{
    expect(inspectLexical()).toMatchObject({cases:40,contextCases:32,ambiguityGuards:8,providerEvaluation:'not-run',hskPronunciationBenchmark:false});
    expect(()=>lexicalCases({...gold,cases:[gold.cases[0],gold.cases[0]]},base)).toThrow('duplicate');
    expect(()=>lexicalCases({...gold,cases:[{...gold.cases[0],source:'nonexistent'}]},base)).toThrow('missing_source');
    expect(()=>lexicalCases({...gold,cases:[{...gold.cases[0],context:''}]},base)).toThrow('missing_context');
  });
  it('does not bless unknown meanings, same-glyph false friends or absent answers',()=>{
    const word=rows.find(r=>r.id==='zh17'),correct={meaning:word.meaning,reading:word.reading,pos:word.pos};
    expect(assessLexical(word,null).status).toBe('not-run');
    expect(assessLexical(word,correct).status).toBe('matched-curated-sense');
    expect(assessLexical(word,{...correct,meaning:'편지'}).status).toBe('contradiction');
    expect(assessLexical(word,{...correct,japanese:'手紙'}).field).toBe('japanese');
    expect(assessLexical(word,{...correct,meaning:'휴지'}).reason).toBe('unlisted-paraphrase');
    expect(assessLexical(word,{...correct,reading:'shou zhi'}).status).toBe('needs-review');
    expect(assessLexical(word,correct).japanese).toBe('needs-bilingual-review');
  });
  it('requires withholding automatic choices for every ambiguous input',()=>{
    for(const row of rows.filter(r=>r.mode==='ambiguous')){
      expect(assessLexical(row,{abstain:true}).status).toBe('matched-abstention');
      expect(assessLexical(row,{abstain:true,selected:row.alternatives[0]}).status).toBe('unsafe-certainty');
      expect(assessLexical(row,{meaning:'아무 뜻',reading:'あ'}).status).toBe('unsafe-certainty');
    }
  });
  it('accepts only reviewed paraphrases and keeps regional readings for review',()=>{
    const word=rows.find(r=>r.id==='zh04');
    expect(assessLexical(word,{...word,meaning:'부당한 이익'}).status).toBe('matched-curated-sense');
    expect(assessLexical(word,{...word,meaning:'뜻밖에 얻는 이득'}).status).toBe('needs-review');
    const research=rows.find(r=>r.id==='zh01');
    expect(assessLexical(research,{...research,reading:'yán jiū'}).reason).toBe('reading-or-regional-variant');
    expect(()=>lexicalCases({...gold,cases:[{...gold.cases[0],acceptedMeanings:['상의를 하다']}]},base)).toThrow('invalid_accepted');
  });
  it('exports only prompts and invalidates observations after editorial changes',()=>{
    const bundle=lexicalRequestBundle(rows);
    expect(bundle.cases).toHaveLength(40);
    for(const row of bundle.cases) {
      expect(Object.keys(row).sort()).toEqual(['context','id','language','mode','text','unit']);
    }
    expect(bundle.cases.find(r=>r.id==='zh12').unit).toBe('morpheme');
    const run={schemaVersion:1,fixtureDigest:bundle.fixtureDigest,responses:[]};
    expect(lexicalResponseReport(rows,run)).toMatchObject({total:40,counts:{'not-run':40},accuracy:null});
    expect(()=>lexicalResponseReport(rows.map((r,i)=>i===0?{...r,meaning:'변경'}:r),run)).toThrow('fixture_mismatch');
  });
  it('keeps missing, failed, synthetic, stored and unselected candidates distinct',()=>{
    const run={schemaVersion:1,fixtureDigest:lexicalRequestBundle(rows).fixtureDigest,responses:[
      {id:'zh01',source:'stored',answer:{senses:[{meaning:'학문을 탐구하다'}]}},
      {id:'zh02',source:'ai',error:true},
      {id:'ja-amb-hashi',source:'ai',answer:{senses:[{meaning:'다리'},{meaning:'젓가락'}]}},
      {id:'zh17',source:'synthetic',answer:{reading:'shǒu zhǐ',meaning:'편지',pos:'명사'}},
    ]};
    const result=lexicalResponseReport(rows,run);
    expect(result.counts).toEqual({'not-run':36,'request-failed':1,'needs-review':2,contradiction:1});
    expect(result.results.find(r=>r.id==='zh01')).toMatchObject({source:'stored',reason:'candidate-list-not-selected-sense'});
    expect(result.results.find(r=>r.id==='zh17')).toMatchObject({source:'synthetic',status:'contradiction'});
    expect(result.accuracy).toBeNull();
    expect(()=>lexicalResponseReport(rows,{...run,responses:[...run.responses,run.responses[0]]})).toThrow('duplicate');
    expect(()=>lexicalResponseReport(rows,{...run,responses:[{id:'unknown',source:'ai'}]})).toThrow('unknown');
    expect(()=>lexicalResponseReport(rows,{...run,responses:[{id:'zh01'}]})).toThrow('source_required');
  });
});
