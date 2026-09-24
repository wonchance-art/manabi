import {describe,it,expect,vi} from 'vitest';
import {correctViewerToken} from '../viewerTokenCorrection';
const old={text:'图书馆',meaning:'도서관',furigana:'tú shū guǎn'};
const material={id:12,owner_id:'owner',raw_text:'去图书馆',processed_json:{dictionary:{one:old}}};
describe('material token correction transport',()=>{
  it('uses the displayed snapshot, receives the server record and never replaces the full JSON',async()=>{
    const latest={...material,processed_json:{dictionary:{one:{...old,meaning:'서고'},other:{text:'学生'}}}};
    const client={rpc:vi.fn().mockResolvedValue({data:{material:latest}})};
    expect(await correctViewerToken(client,material,'one',{meaning:'서고'},old,material.raw_text)).toBe(latest);
    expect(client.rpc).toHaveBeenCalledWith('viewer_correct_token',{p_id:'12',p_token:'one',p_before:old,p_corrections:{meaning:'서고'},p_expected_raw:'去图书馆'});
  });
  it('returns the conflict token for explicit confirmation without a retry',async()=>{
    const current={...old,meaning:'자료실'},rpc=vi.fn().mockResolvedValue({data:{conflict:'token',current_token:current}});
    await expect(correctViewerToken({rpc},material,'one',{meaning:'서고'},old)).rejects.toMatchObject({code:'VIEWER_TOKEN_CONFLICT',latestToken:current});
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['PGRST202','42501','40001','network'])('never falls back to an unsafe write on %s',async code=>{
    const rpc=vi.fn().mockResolvedValue({error:{code,message:'VIEWER_TOKEN_SOURCE_CHANGED'}});
    await expect(correctViewerToken({rpc},material,'one',{meaning:'서고'})).rejects.toMatchObject({code:'VIEWER_CORRECTION_FAILED'});
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null,{material:{id:13,owner_id:'owner'}},{material:{id:12,owner_id:'other'}},{material},
    {material:{...material,processed_json:{dictionary:{one:{...old,text:'学生',meaning:'서고'}}}}}])('rejects unconfirmed save result',async data=>{
    await expect(correctViewerToken({rpc:async()=>({data})},material,'one',{meaning:'서고'})).rejects.toThrow('저장 결과');
  });
});
