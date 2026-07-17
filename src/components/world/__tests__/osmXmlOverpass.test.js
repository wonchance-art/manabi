import { describe, expect, it } from 'vitest';
import { convertOsmXmlToOverpass } from '../../../../scripts/convert-osm-xml-to-overpass.mjs';

describe('OSM XML 공식 API fallback 변환', () => {
  it('way geometry와 relation member geometry를 결정적으로 복원한다', () => {
    const xml = `<osm version="0.6">
      <node id="2" lat="48.2" lon="-1.2"><tag k="highway" v="crossing"/></node>
      <node id="1" lat="48.1" lon="-1.1"/>
      <way id="3"><nd ref="1"/><nd ref="2"/><tag k="natural" v="water"/><tag k="name" v="A &amp; B"/></way>
      <relation id="4"><member type="way" ref="3" role="outer"/><tag k="type" v="multipolygon"/><tag k="natural" v="water"/></relation>
    </osm>`;
    const first = convertOsmXmlToOverpass(xml);
    const second = convertOsmXmlToOverpass(xml);
    expect(second).toEqual(first);
    expect(first.elements.map(({ type, id }) => `${type}:${id}`)).toEqual(['node:2', 'way:3', 'relation:4']);
    expect(first.elements[1]).toMatchObject({
      tags: { natural: 'water', name: 'A & B' },
      geometry: [{ lat: 48.1, lon: -1.1 }, { lat: 48.2, lon: -1.2 }],
    });
    expect(first.elements[2].members[0].geometry).toEqual(first.elements[1].geometry);
  });
});
