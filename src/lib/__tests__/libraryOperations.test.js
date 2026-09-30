import {describe,it,expect,vi} from 'vitest';
import {uniqueTargets,selectedRange,continueOperation,prepareOperation,operationCounts,folderPaths,filterActiveSources,parsePendingOperation} from '../libraryOperations';
const row=(id,revision=0)=>({target_kind:'material',target_id:String(id),revision});
describe('library management protocol',()=>{
 it('retains undo intent across reload and accepts earlier ID-only requests',()=>{
  const id='00000000-0000-4000-8000-000000000001';
  expect(parsePendingOperation(JSON.stringify({id,undo:true}))).toEqual({id,undo:true});
  expect(parsePendingOperation(id)).toEqual({id,undo:false});
  expect(parsePendingOperation('invalid')).toBeNull();
 });
 it('keeps edition/root identity and revision while deduplicating visible selection',()=>{
  expect(uniqueTargets([row(1),row(1,2),{...row(1),target_kind:'edition'}])).toEqual([row(1,2),{...row(1),target_kind:'edition'}]);
 });
 it('extends/reduces only the visible range, preserving off-page choices',()=>{
  const rows=[row(1),row(2),row(3)];expect(selectedRange(rows,[row(9)],'material:3','material:1',true,true)).toEqual([row(9),...rows]);
  expect(selectedRange(rows,[...rows,row(9)],'material:2','material:1',false,true)).toEqual([row(3),row(9)]);
 });
 it('sends a stable request and canonical key payload, without body/owner fields',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({data:{id:'stable'}})};
  await prepareOperation(client,'stable','trash',[{...row(1),title:'private',owner_id:'ignored'}]);
  expect(client.rpc).toHaveBeenCalledWith('library_operation_prepare',{p_id:'stable',p_action:'trash',p_targets:[row(1)],p_options:{}});
 });
 it('queries committed status after reconnect and skips already successful entries',async()=>{
  const client={rpc:vi.fn().mockResolvedValueOnce({data:{items:[{status:'success'},{status:'pending'}]}}).mockResolvedValueOnce({data:{items:[{status:'success'},{status:'conflict'}]}})};
  const result=await continueOperation(client,'id');expect(client.rpc.mock.calls.map(x=>x[0])).toEqual(['library_operation_status','library_operation_apply']);expect(operationCounts(result)).toEqual({success:1,conflict:1});
 });
 it('does not retry conflicts or spin when the server made no progress',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({data:{items:[{status:'conflict'}]}})};await continueOperation(client,'id');expect(client.rpc).toHaveBeenCalledTimes(1);
  client.rpc.mockResolvedValue({data:{items:[{status:'pending'}]}});await expect(continueOperation(client,'id')).rejects.toThrow('library_no_progress');
 });
 it('only asks the server to undo the operation; never restores a client list snapshot',async()=>{
  const client={rpc:vi.fn().mockResolvedValueOnce({data:{items:[{status:'success'}]}}).mockResolvedValueOnce({data:{items:[{status:'undo_conflict'}]}})};
  await continueOperation(client,'id',{undo:true});expect(client.rpc.mock.calls[1][1]).toEqual({p_id:'id',p_undo:true});
 });
 it('builds readable folder paths and terminates on corrupt legacy cycles',()=>{
  expect(folderPaths([{id:'a',name:'A'},{id:'b',name:'B',parent_id:'a'}])[1].path).toBe('A / B');
  expect(folderPaths([{id:'a',name:'A',parent_id:'b'},{id:'b',name:'B',parent_id:'a'}])).toHaveLength(2);
 });
 it('filters legacy source groups without touching source objects',async()=>{
  const query={select(){return this;},eq(){return this;},neq(){return this;},range:vi.fn().mockResolvedValue({data:[{target_kind:'pdf',target_id:'pdf'},{target_kind:'material',target_id:'1'},{target_kind:'book',target_id:'book'}]})};
  const rows=[{id:1},{id:2,source_pdf_id:'pdf'},{id:3,processed_json:{metadata:{book:{key:'book'}}}},{id:4}];
  expect(await filterActiveSources({from:()=>query},'owner',rows)).toEqual([{id:4}]);expect(rows).toHaveLength(4);
 });
});
