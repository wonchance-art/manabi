export default function TokenCorrectionConflict({token,onConfirm}) {
  if(!token)return null;
  return <div role="alert">
    <p>다른 곳에서 수정됐어요. 입력한 내용은 유지됩니다.</p>
    <p>현재 뜻: <strong>{token.meaning||'(뜻 없음)'}</strong>
      {token.furigana&&<> · 발음: {token.furigana}</>}{token.pos&&<> · {token.pos}</>}</p>
    <button type="button" className="btn btn--primary btn--sm" onClick={onConfirm}>현재 내용 확인</button>
    <p>확인한 뒤 저장하면 입력한 내용으로 바뀝니다.</p>
  </div>;
}
