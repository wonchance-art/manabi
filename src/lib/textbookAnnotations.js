// Location is based on the text stream, not dictionary token IDs (analysis may replace them).
export function textbookStream(json) {
  let text='';
  const tokens=(json?.sequence||[]).map(id=>{const start=text.length;text+=json.dictionary?.[id]?.text||'';return {id,start,end:text.length};});
  return {text,tokens};
}
export function makeTextbookAnchor(json,first,last=first) {
  const {text,tokens}=textbookStream(json),start=tokens.findIndex(t=>t.id===first),end=tokens.findIndex(t=>t.id===last);
  if(start<0||end<start)return null;
  const from=tokens[start].start,to=tokens[end].end,exact=text.slice(from,to);
  if(!exact.trim()||exact.length>1000)return null;
  return {type:'TextQuoteSelector',exact,prefix:text.slice(Math.max(0,from-48),from),suffix:text.slice(to,to+48),start:from,end:to};
}
export function resolveTextbookAnchor(json,anchor) {
  const {text,tokens}=textbookStream(json);
  if(!anchor||anchor.type!=='TextQuoteSelector'||!anchor.exact)return null;
  const matches=[];
  for(let at=text.indexOf(anchor.exact);at>=0;at=text.indexOf(anchor.exact,at+1)) {
    const end=at+anchor.exact.length;
    if((!anchor.prefix||text.slice(Math.max(0,at-anchor.prefix.length),at)===anchor.prefix)&&(!anchor.suffix||text.slice(end,end+anchor.suffix.length)===anchor.suffix))matches.push({start:at,end});
  }
  // Never silently attach to a different occurrence, even when old offsets happen to match.
  if(matches.length!==1)return null;
  const match=matches[0],covered=tokens.filter(t=>t.end>match.start&&t.start<match.end);
  return covered.length?{...match,first:covered[0].id,last:covered.at(-1).id}:null;
}
export const sameTextbookAnchor=(a,b)=>!!a&&!!b&&a.exact===b.exact&&a.start===b.start&&a.prefix===b.prefix&&a.suffix===b.suffix;
export function validTextbookAnchor(json,anchor) {
  if(!anchor||Object.keys(anchor).some(k=>!['type','exact','prefix','suffix','start','end'].includes(k))||typeof anchor.prefix!=='string'||typeof anchor.suffix!=='string'||anchor.prefix.length>48||anchor.suffix.length>48||anchor.exact?.length>1000)return false;
  const resolved=resolveTextbookAnchor(json,anchor);
  return !!resolved&&resolved.start===anchor.start&&resolved.end===anchor.end;
}
