import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lexicalCases, assessLexical, inspectLexical } from './qa-lexical.mjs';
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
});
