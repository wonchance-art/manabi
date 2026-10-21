#!/usr/bin/env python3
"""Refresh and verify local OFL Noto subsets for N3, without N4 asset changes."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unicodedata

SOURCE_ROOT = Path('/usr/share/fonts/opentype/noto')
LICENSE_PATH = Path('/usr/share/doc/fonts-noto-cjk/copyright')
FAMILIES = {
    'JP': ('NotoSerifCJK-Regular.ttc', 0),
    'JPS': ('NotoSansCJK-Regular.ttc', 0),
    'KR': ('NotoSansCJK-Regular.ttc', 1),
    'KRS': ('NotoSerifCJK-Regular.ttc', 1),
    'KRB': ('NotoSansCJK-Bold.ttc', 1),
}
TEXT_ATTRIBUTES = {'placeholder', 'title', 'alt', 'aria-label', 'value'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


class ProductText(HTMLParser):
    """Include authored visible attributes, without inventing arbitrary input text."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, _tag, attrs):
        self.parts.extend(value for name, value in attrs if name in TEXT_ATTRIBUTES and value)


def requested_codepoints(output):
    parser = ProductText()
    parser.feed((output / 'index.html').read_text())
    parser.close()
    # Runtime source contains the authored status, failure and button messages.
    # User-entered answers are not a finite bundled product vocabulary.
    text = ''.join(parser.parts) + (output / 'app.js').read_text()
    requested = {ord(char) for char in text if unicodedata.category(char) not in {'Cc', 'Cf'}}
    requested.update(range(32, 127))
    return requested


def prepare(output):
    import fontTools
    from fontTools import subset
    from fontTools.ttLib import TTFont

    output = Path(output)
    requested = requested_codepoints(output)
    license_bytes = LICENSE_PATH.read_bytes()
    if b'SIL OPEN FONT LICENSE' not in license_bytes and b'SIL Open Font License' not in license_bytes:
        raise ValueError('Local source does not establish SIL OFL permission')
    report = {'tooling': 'N3 subset refresh inherited N4 contracts; not recovered original N5 tooling', 'fontTools': fontTools.__version__, 'format': 'WOFF', 'license': 'SIL Open Font License 1.1', 'licenseSha256': sha(license_bytes), 'textSources': ['HTML text', 'placeholder/title/alt/aria-label/value attributes', 'authored local runtime strings'], 'requestedCodepoints': len(requested), 'fonts': {}, 'passed': True}
    (output / 'fonts').mkdir(exist_ok=True)
    (output / 'font-licenses').mkdir(exist_ok=True)
    (output / 'font-licenses/NotoCJK-system-copyright.txt').write_bytes(license_bytes)
    for family, (filename, index) in FAMILIES.items():
        source = SOURCE_ROOT / filename
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
        actual_missing = sorted(requested - set(result.getBestCmap()))
        if actual_missing:
            report['passed'] = False
        report['fonts'][family] = {'sourceFile': str(source), 'sourceSha256': sha(source.read_bytes()), 'collectionIndex': index, 'output': 'fonts/' + family + '.woff', 'outputSha256': sha(destination.read_bytes()), 'bytes': destination.stat().st_size, 'missingCodepoints': [f'U+{code:04X}' for code in missing], 'subsetLostCodepoints': [f'U+{code:04X}' for code in actual_missing]}
    (output / 'font-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if not report['passed']:
        raise ValueError('Noto glyph audit has missing codepoints; see font-audit.json')
    return report


def check_existing(output):
    """Read actual output cmaps and source/hash/license facts, without writing."""
    import fontTools
    from fontTools.ttLib import TTFont

    output = Path(output)
    requested = requested_codepoints(output)
    report = json.loads((output / 'font-audit.json').read_text())
    errors, fonts = [], {}
    if report.get('fontTools') != fontTools.__version__ or report.get('requestedCodepoints') != len(requested):
        errors.append('Font tooling/requested text report differs from actual product text')
    if report.get('licenseSha256') != sha(LICENSE_PATH.read_bytes()) or (output / 'font-licenses/NotoCJK-system-copyright.txt').read_bytes() != LICENSE_PATH.read_bytes():
        errors.append('Font license provenance mismatch')
    if set(report.get('fonts', {})) != set(FAMILIES):
        errors.append('Exactly the five inherited font families are required')
    for family, (filename, index) in FAMILIES.items():
        destination = output / 'fonts' / (family + '.woff')
        cmap = TTFont(destination, recalcTimestamp=False).getBestCmap()
        missing = sorted(code for code in requested if code not in cmap or cmap[code] in {'.notdef', 'notdef'})
        facts = report.get('fonts', {}).get(family, {})
        if facts.get('sourceSha256') != sha((SOURCE_ROOT / filename).read_bytes()) or facts.get('collectionIndex') != index or facts.get('sourceFile') != str(SOURCE_ROOT / filename):
            errors.append(f'{family}: source provenance mismatch')
        if facts.get('output') != 'fonts/' + family + '.woff' or facts.get('outputSha256') != sha(destination.read_bytes()) or facts.get('bytes') != destination.stat().st_size:
            errors.append(f'{family}: output hash/size mismatch')
        if missing:
            errors.append(f'{family}: actual cmap lacks product glyphs')
        fonts[family] = {'missingCodepoints': [f'U+{code:04X}' for code in missing], 'actualCmapChecked': True}
    return {'passed': not errors, 'scope': 'Read-only actual cmap, product text including attributes/runtime, source hashes and OFL license', 'requestedCodepoints': len(requested), 'fonts': fonts, 'errors': errors}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--inspect-text', action='store_true')
    args = parser.parse_args()
    if args.inspect_text:
        print(json.dumps({'codepoints': sorted(requested_codepoints(Path(args.out)))}))
    elif args.check:
        result = check_existing(args.out)
        print(json.dumps(result))
        raise SystemExit(0 if result['passed'] else 1)
    else:
        result = prepare(args.out)
        print(json.dumps({'passed': result['passed'], 'requestedCodepoints': result['requestedCodepoints'], 'fonts': len(result['fonts'])}))
