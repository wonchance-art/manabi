import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function overpassQueries([minLon, minLat, maxLon, maxLat]) {
  const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;
  const header = '[out:json][timeout:900][maxsize:536870912];\n';
  return {
    structures: `${header}(
  way["building"](${bbox});
);
out geom;
`,
    lines: `${header}(
  way["highway"](${bbox});
  node["highway"="crossing"](${bbox});
  way["waterway"~"^(river|canal|stream)$"](${bbox});
  way["railway"~"^(rail|subway|light_rail|tram)$"](${bbox});
  way["natural"="coastline"](${bbox});
);
out geom;
`,
    areas: `${header}(
  relation["building"](${bbox});
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["leisure"="park"](${bbox});
  relation["leisure"="park"](${bbox});
  way["landuse"~"^(grass|recreation_ground|forest)$"](${bbox});
  relation["landuse"~"^(grass|recreation_ground|forest)$"](${bbox});
  way["natural"="wood"](${bbox});
  relation["natural"="wood"](${bbox});
);
out geom;
`,
  };
}

export function writePartitionQueries(manifestPath, outputDir) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = manifest.partitions.flatMap(({ id, bbox }) => Object.entries(overpassQueries(bbox)).map(([layer, query]) => {
    const output = path.join(outputDir, `${id}-${layer}.query`);
    fs.writeFileSync(output, query);
    return output;
  }));
  return { outputDir, count: outputs.length, outputs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifestPath, outputDir] = process.argv.slice(2);
  if (!manifestPath || !outputDir) {
    throw new Error('Usage: node scripts/build-overpass-partition-queries.mjs <manifest.json> <output-dir>');
  }
  console.log(JSON.stringify(writePartitionQueries(manifestPath, outputDir)));
}
