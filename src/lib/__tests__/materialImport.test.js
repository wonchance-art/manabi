import { describe, it, expect } from 'vitest';
import { createImportAttempt, saveImportOnce, interruptedImportJson, persistImportAnalysis } from '../materialImport';
const row = { owner_id: 'member-a', visibility: 'private', raw_text: 'bonjour\n\nsalut', processed_json: { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: { language: 'French', source: { url: 'https://example.org/source' } } } };
function database() {
  const rows = []; let loseResponse = false, failRead = false, denyUpdate = false;
  const queries = [], writes = [];
  const client = { from() {
    let op = 'read', payload, predicates = [];
    const q = { select() { return q; }, eq(k,v) { predicates.push([k,v]); return q; }, limit() { return q; },
      insert(v) { op='insert';payload=v[0];return q; }, update(v) { op='update';payload=v;return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        queries.push({ op, predicates });
        if (op==='read' && failRead) return { error: new Error('read failed') };
        if (op==='insert') { const data={...structuredClone(payload),id:rows.length+1};rows.push(data);writes.push(data); if(loseResponse){loseResponse=false;throw new Error('response lost');}return { data:[{id:data.id}] }; }
        let found = rows.filter(r=>predicates.every(([k,v])=>(k.includes('importAttempt')?r.processed_json.metadata.importAttempt:r[k])===v));
        if (op==='update') { if(denyUpdate)found=[];found.forEach(r=>Object.assign(r,payload)); }
        return { data:found.map(r=>({id:r.id})) };
      }).then(resolve,reject); },
    };return q;
  }};
  return { client, rows, queries, writes, lose:()=>{loseResponse=true;}, failRead:()=>{failRead=true;}, deny:()=>{denyUpdate=true;} };
}
describe('one original per import attempt',()=>{
  it('deduplicates simultaneous submissions and preserves source, language and private ownership',async()=>{
    const db=database(), attempt=createImportAttempt(row,'attempt-1');
    const records=await Promise.all([saveImportOnce(db.client,attempt),saveImportOnce(db.client,attempt)]);
    expect(db.writes).toHaveLength(1);expect(records[0]).toBe(records[1]);
    expect(records[0]).toMatchObject(row);expect(row.processed_json.metadata.importAttempt).toBeUndefined();
    expect((await saveImportOnce(db.client,attempt)).id).toBe(1);expect(db.writes).toHaveLength(1);
  });
  it('reconciles a saved row when its first response was lost',async()=>{
    const db=database(), attempt=createImportAttempt(row,'attempt-2');db.lose();
    await expect(saveImportOnce(db.client,attempt)).rejects.toThrow('response lost');
    expect((await saveImportOnce(db.client,attempt)).id).toBe(1);expect(db.rows).toHaveLength(1);
    expect(db.queries.at(-1).predicates).toContainEqual(['owner_id','member-a']);
  });
  it('does not insert a second copy when reconciliation fails',async()=>{
    const db=database(), attempt=createImportAttempt(row,'attempt-3');db.lose();
    await expect(saveImportOnce(db.client,attempt)).rejects.toThrow();db.failRead();
    await expect(saveImportOnce(db.client,attempt)).rejects.toThrow('read failed');expect(db.writes).toHaveLength(1);
  });
  it('separates distinct attempts and owners',async()=>{
    const db=database();await saveImportOnce(db.client,createImportAttempt(row,'one'));
    await saveImportOnce(db.client,createImportAttempt({...row,owner_id:'member-b'},'two'));
    expect(db.rows.map(r=>r.owner_id)).toEqual(['member-a','member-b']);
  });
  it('keeps successful tokens and marks unfinished lines for retry after cancellation',()=>{
    const json={...row.processed_json,sequence:['id_0_0'],dictionary:{id_0_0:{text:'bonjour'}},last_idx:0,failed_indices:[]};
    const result=interruptedImportJson(row.raw_text,json);
    expect(result).toMatchObject({status:'partial',failed_indices:[2],sequence:json.sequence,dictionary:json.dictionary});
    expect(json.failed_indices).toEqual([]);expect(interruptedImportJson(row.raw_text,row.processed_json).status).toBe('pending');
  });
  it('checks an owner-scoped write and rejects zero changed rows',async()=>{
    const db=database(), record=await saveImportOnce(db.client,createImportAttempt(row,'three'));
    await persistImportAnalysis(db.client,record,{...row.processed_json,status:'completed'});
    expect(db.queries.at(-1).predicates).toEqual([['id',1],['owner_id','member-a']]);
    db.deny();await expect(persistImportAnalysis(db.client,record,row.processed_json)).rejects.toThrow('권한');
  });
});
