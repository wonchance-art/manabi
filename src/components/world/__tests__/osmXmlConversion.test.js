import { describe, expect, it } from 'vitest';
import { convertOsmXml } from '../../../../scripts/convert-osm-xml-to-overpass-json.mjs';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
 <node id="1" lat="48.605" lon="-1.527" />
 <node id="2" lat="48.606" lon="-1.526"><tag k="highway" v="crossing" /></node>
 <way id="3"><nd ref="1"/><nd ref="2"/><tag k="building" v="yes"/></way>
 <relation id="4"><member type="way" ref="3" role="outer"/><tag k="type" v="multipolygon"/></relation>
</osm>`;

describe('official OSM XML conversion contract', () => {
  it('preserves tags and resolves way and relation geometry deterministically', () => {
    const first = convertOsmXml(FIXTURE);
    const second = convertOsmXml(FIXTURE);
    expect(second).toEqual(first);
    expect(first.elements).toEqual([
      { type: 'node', id: 1, lat: 48.605, lon: -1.527 },
      { type: 'node', id: 2, lat: 48.606, lon: -1.526, tags: { highway: 'crossing' } },
      {
        type: 'way', id: 3, nodes: [1, 2],
        geometry: [{ lat: 48.605, lon: -1.527 }, { lat: 48.606, lon: -1.526 }],
        tags: { building: 'yes' },
      },
      {
        type: 'relation', id: 4,
        members: [{
          type: 'way', ref: 3, role: 'outer',
          geometry: [{ lat: 48.605, lon: -1.527 }, { lat: 48.606, lon: -1.526 }],
        }],
        tags: { type: 'multipolygon' },
      },
    ]);
  });
});
