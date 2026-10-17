#!/usr/bin/env python3
"""Local OFL Noto subset refresh, reimplementing the missing N5 font tooling.

WOFF uses built-in zlib; no package installation, network, or N5 asset mutation.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import unicodedata

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(output):
    output = Path(output)
    text = html.unescape(re.sub(r'<[^>]+>', '', (output / 'index.html').read_text()))
    # Include runtime status/button text and all manuscript strings as well.
    text += (output / 'app.js').read_text()
    requested = {ord(char) for char in text if unicodedata.category(char) not in {'Cc', 'Cf'}}
    requested.update(range(32, 127))
    license_path = Path('/usr/share/doc/fonts-noto-cjk/copyright')
    license_bytes = license_path.read_bytes()
    if b'SIL OPEN FONT LICENSE' not in license_bytes and b'SIL Open Font License' not in license_bytes:
        raise ValueError('Local source does not establish SIL OFL permission')
    entries = {
        'JP': ('NotoSerifCJK-Regular.ttc', 0),
        'JPS': ('NotoSansCJK-Regular.ttc', 0),
        'KR': ('NotoSansCJK-Regular.ttc', 1),
        'KRS': ('NotoSerifCJK-Regular.ttc', 1),
        'KRB': ('NotoSansCJK-Bold.ttc', 1),
    }
    report = {'tooling': 'N4 subset refresh reimplementation; not recovered original N5 tooling', 'fontTools': fontTools.__version__, 'format': 'WOFF', 'license': 'SIL Open Font License 1.1', 'licenseSha256': sha(license_bytes), 'requestedCodepoints': len(requested), 'fonts': {}, 'passed': True}
    (output / 'fonts').mkdir(exist_ok=True)
    (output / 'font-licenses').mkdir(exist_ok=True)
    (output / 'font-licenses/NotoCJK-system-copyright.txt').write_bytes(license_bytes)
    for family, (filename, index) in entries.items():
        source = Path('/usr/share/fonts/opentype/noto') / filename
        font = TTFont(source, fontNumber=index, recalcTimestamp=False)
        supported = set(font.getBestCmap())
        missing = sorted(requested - supported)
        if missing:
            report['passed'] = False
        options = subset.Options()
        options.recalc_timestamp = False
        options.canonical_order = True
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=sorted(requested & supported))
        worker.subset(font)
        font.flavor = 'woff'
        destination = output / 'fonts' / (family + '.woff')
        font.save(destination)
        result = TTFont(destination, recalcTimestamp=False)
        actual_missing = sorted((requested & supported) - set(result.getBestCmap()))
        if actual_missing:
            report['passed'] = False
        report['fonts'][family] = {'sourceFile': str(source), 'sourceSha256': sha(source.read_bytes()), 'collectionIndex': index, 'output': 'fonts/' + family + '.woff', 'outputSha256': sha(destination.read_bytes()), 'bytes': destination.stat().st_size, 'missingCodepoints': [f'U+{code:04X}' for code in missing], 'subsetLostCodepoints': [f'U+{code:04X}' for code in actual_missing]}
    (output / 'font-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if not report['passed']:
        raise ValueError('Noto glyph audit has missing codepoints; see font-audit.json')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    result = prepare(args.out)
    print(json.dumps({'passed': result['passed'], 'requestedCodepoints': result['requestedCodepoints'], 'fonts': len(result['fonts'])}))
