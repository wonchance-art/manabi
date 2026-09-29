// Keep the user's expected token separate from query-cache refreshes. The server
// owns the atomic comparison; never fall back to replacing the full analysis.
export async function correctViewerToken(client, material, tokenId, corrections, expectedToken, expectedRaw) {
  const {data,error}=await client.rpc('viewer_correct_token',{
    p_id:String(material.id),p_token:tokenId,
    p_before:expectedToken??material.processed_json.dictionary[tokenId],
    p_corrections:corrections,p_expected_raw:expectedRaw??material.raw_text,
  });
  if(error){
    const message=['PGRST202','42883'].includes(error.code)?'안전한 수정 저장 기능을 준비 중이에요. 입력한 내용은 유지됩니다.'
      :/VIEWER_TOKEN_ACCESS/.test(error.message)?'자료가 없거나 수정 권한이 변경됐어요. 다시 열어 확인해 주세요.'
      :/VIEWER_TOKEN_BUSY/.test(error.message)?'본문을 분석하고 있어요. 분석이 끝난 뒤 다시 확인해 주세요.'
      :/VIEWER_TOKEN_SOURCE_CHANGED/.test(error.message)?'원문이나 분석이 바뀌었어요. 자료를 다시 열어 확인해 주세요.'
      :'저장 결과를 확인하지 못했어요. 입력한 내용을 유지했으니 다시 시도해 주세요.';
    throw Object.assign(new Error(message),{code:'VIEWER_CORRECTION_FAILED'});
  }
  if(data?.conflict==='token'&&data.current_token&&typeof data.current_token==='object'){
    throw Object.assign(new Error('다른 곳에서 수정된 표현이에요.'),{code:'VIEWER_TOKEN_CONFLICT',latestToken:data.current_token});
  }
  const savedToken=data?.material?.processed_json?.dictionary?.[tokenId];
  if(String(data?.material?.id)!==String(material.id)||data?.material?.owner_id!==material.owner_id
    ||!savedToken||savedToken.text!==(expectedToken??material.processed_json.dictionary[tokenId]).text
    ||!Object.entries(corrections).every(([key,value])=>savedToken[key]===value))
    throw Object.assign(new Error('저장 결과를 확인하지 못했어요. 고른 뜻을 유지했으니 다시 시도해 주세요.'),{code:'VIEWER_CORRECTION_FAILED'});
  return data.material;
}
