// 품사 라벨 — 중국어 겸류사처럼 품사 후보가 여럿인 토큰(pos_all: '동사·명사')은 후보 전체를
// 보여주되 이 문장 맥락에서 짚힌 pos만 강조한다. pos_all이 없으면 기존처럼 단일 pos 문자열.
// 사용자가 pos를 교정해 후보 밖 값이 되면 교정값을 짚힌 항목으로 앞에 붙인다(교정 존중).
// X 2차 방어(#1077 5504885559): 이미 들어간 행의 정본 밖 조각(「동사·喝咖啡」의 喝咖啡)은 렌더하지
// 않는다. 토큰은 언어를 모르므로 네 언어 합집합으로 판정한다.
import {useContext} from 'react';
import {ViewerUiLocaleContext} from '../lib/viewerLocaleContext';
import {t} from '../lib/viewerMessages';
import { isCanonPos } from '../lib/server/posCanon';

export default function TokenPosLabel({ token }) {
  const uiLocale=useContext(ViewerUiLocaleContext);
  // Translate only after canonical validation; keep the exact legacy spacing for Korean.
  const displayPos=value=>uiLocale==='ko'?value:value.split('·').map(part=>t(uiLocale,part.trim())).join('·');
  const pos = isCanonPos(null, token?.pos) ? token.pos : '';
  const all = token?.pos_all
    ? token.pos_all.split('·').map((s) => s.trim()).filter((s) => isCanonPos(null, s))
    : [];
  if (all.length < 2) return pos ? displayPos(pos) : null;
  const picked = pos || all[0];
  const list = all.includes(picked) ? all : [picked, ...all];
  return (
    <span title={uiLocale==='ko'?`이 문장에서는 ${picked}로 쓰였어요`:t(uiLocale,'이 문장에서는 {pos}로 쓰였어요',{pos:displayPos(picked)})}>
      {list.map((p, i) => (
        <span key={p}>
          {i > 0 && <span style={{ opacity: 0.4 }}> · </span>}
          <span style={p === picked
            ? { color: 'var(--primary)', fontWeight: 700 }
            : { opacity: 0.5 }}>
            {displayPos(p)}
          </span>
        </span>
      ))}
    </span>
  );
}
