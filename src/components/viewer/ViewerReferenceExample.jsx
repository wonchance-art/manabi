'use client';
import {t} from '../../lib/viewerMessages';
import ActionIcon from '../ActionIcon';

// Same-context examples need only their parent's disclosure. Other senses stay separate.
export default function ViewerReferenceExample({matches,meaning,uiLocale='ko',children}) {
  if (matches) return <section className="reader-card-example" aria-label={t(uiLocale,'사전 예문')}>
    <h3>{t(uiLocale,'사전 예문')}</h3>
    {children}
  </section>;
  return <details className="reader-card-example reader-card-disclosure">
    <summary><span>{t(uiLocale,'사전의 다른 뜻 · {meaning}',{meaning})}</span><ActionIcon name="down"/></summary>
    {children}
  </details>;
}
