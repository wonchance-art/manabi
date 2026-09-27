import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import VocabDetailCard from './VocabDetailCard';

const query=vi.hoisted(()=>({value:{},options:null}));
vi.mock('@tanstack/react-query',()=>({useQuery:options=>{query.options=options;return query.value;}}));
vi.mock('../lib/AuthContext',()=>({useAuth:()=>({user:{id:'reader'}})}));
vi.mock('next/link',()=>({default:({prefetch:_prefetch,...props})=>React.createElement('a',props)}));
const id='00000000-0000-4000-8000-000000000001',candidate='00000000-0000-4000-8000-000000000002';
const word={id,word_text:'確認',meaning:'확인',language:'Japanese',created_at:'2026-09-01',next_review_at:'2030-01-01',interval:12,ease_factor:3,repetitions:8};
const render=patch=>renderToStaticMarkup(<VocabDetailCard word={{...word,...patch}} onClose={()=>{}}/>);
beforeEach(()=>{vi.stubGlobal('React',React);query.value={data:[],isPending:false,refetch:vi.fn()};});
afterEach(()=>vi.unstubAllGlobals());

describe('단어 상세의 저장 출처 복귀',()=>{
  it.each([
    [{kind:'reading',material_id:253,locator:{noteCandidate:candidate,notePage:'page-2'}},`/notes/253?candidate=${candidate}&amp;page=page-2`],
    [{id,kind:'reading',material_id:22,locator:{tokenId:'token'}},`/viewer/22?sourceContext=${id}`],
    [{kind:'textbook',locator:{bookId:'japanese-n5',editionId:'12d69782944b95ef7a11e529',pageId:'u31-practice'}},'/books/japanese-n5?edition=12d69782944b95ef7a11e529#u31-practice'],
    [{id,kind:'class',locator:{team:'qa-team',materialId:24}},`/viewer/local:24?team=qa-team&amp;returnTo=%2Fclass%2Fqa-team&amp;sourceContext=${id}`],
    [{kind:'pdf',pdf_id:id,locator:{page:12}},`/pdf/${id}?page=12`],
  ])('원래 자료 ID가 없어도 저장된 문맥의 정확한 주소를 사용한다 (%j)',(source,href)=>{
    query.value.data=[{...source,quote:'確認する',id:source.id||candidate}];
    const html=render();expect(html).toContain(`href="${href}"`);expect(html).toContain('target="_blank"');expect(html).toContain('rel="noopener noreferrer"');expect(html).not.toContain('이 문맥만 지우기');
  });
  it('조회 중에는 잘못된 단순 자료 링크로 먼저 이동하지 않는다',()=>{
    query.value={...query.value,data:undefined,isPending:true};const html=render({source_material_id:253});
    expect(html).toContain('저장한 문맥을 확인하고 있어요.');expect(html).not.toContain('href=');
  });
  it('구형 출처는 안전하게 연결하되 실패와 재시도를 숨기지 않는다',()=>{
    query.value.error=new Error('offline');const html=render({source_material_id:22,source_sentence:'確認する'});
    expect(html).toContain('/viewer/22?sourceText=');expect(html).toContain('원문 열기');expect(html).toContain('다시 시도');
  });
  it('출처가 없는 단어는 빈 출처 제목과 임의 링크를 만들지 않는다',()=>{
    const html=render();expect(html).not.toContain('출처 자료');expect(html).not.toContain('href=');
  });
  it('여러 문맥을 모두 유지하고 개인 카드의 뜻과 일정을 변경하지 않는다',()=>{
    const frozen=Object.freeze({...word});query.value.data=[{id,kind:'reading',material_id:22,quote:'確認する',locator:{}},{id:candidate,kind:'reading',material_id:253,quote:'確認',locator:{noteCandidate:candidate,notePage:'page-2'}}];
    const html=renderToStaticMarkup(<VocabDetailCard word={frozen}/>);
    expect(html).toContain('다른 문맥');expect(html).toContain('내 노트의 필기');expect(html).toContain('확인');expect(frozen).toEqual(word);
  });
  it('계정·단어별 조회만 사용하며 취소 신호와 잘못된 응답을 처리한다',async()=>{
    render();expect(query.options.queryKey).toEqual(['vocabulary-contexts','reader',id]);
    const signal=new AbortController().signal,fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetch);
    await expect(query.options.queryFn({signal})).rejects.toThrow('문맥을 불러오지 못했어요.');
    expect(fetch).toHaveBeenCalledWith(`/api/learning/vocabulary?id=${id}`,{cache:'no-store',signal});
  });
});
