import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import ActionIcon from '../../components/ActionIcon';

describe('shared decorative action icons',()=>{
  it('leaves the accessible name to the control, without adding a keyboard stop',()=>{
    const html=renderToStaticMarkup(<button aria-label="읽기 설정"><ActionIcon name="type"/></button>);
    expect(html).toContain('aria-label="읽기 설정"');
    expect(html).toContain('aria-hidden="true" focusable="false"');
    expect(html).not.toContain('<title');
    expect(html).not.toContain('tabindex');
  });
  it('distinguishes transport actions and navigation with the same geometry',()=>{
    const icons=['play','pause','stop','back','book','library'].map(name=>renderToStaticMarkup(<ActionIcon name={name}/>));
    expect(new Set(icons).size).toBe(icons.length);
    for(const html of icons){expect(html).toContain('width="20" height="20"');expect(html).toContain('stroke-width="1.6"');expect(html).toContain('fill="none"');}
  });
});
