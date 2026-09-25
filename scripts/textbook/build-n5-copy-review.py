"""Apply reviewed copy edits to a pinned edition without republishing it.

The manifest records exact manuscript paths and rendered article occurrences.
Old editions, question/answer identities, page order and runtime assets survive.
This is an integrity check, not automatic Japanese or JLPT certification.
"""
import argparse
import copy
import importlib.util
import json
import re
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('study_routes', HERE / 'build-n5-study-routes.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
ROOT = core.ROOT
ARTICLE = re.compile(r'<article\b[^>]*>[\s\S]*?</article>')


def apply_edits(book, html, edits):
    for edit in edits:
        target = book
        for key in edit['path'][:-1]:
            target = target[key]
        key = edit['path'][-1]
        assert target[key] == edit['before'], f"Changed preimage: {edit['path']}"
        assert isinstance(target[key], str) and isinstance(edit['after'], str)
        # Deliberate copy-only boundary: no saved answer, option, source or ID migration.
        assert not any(k in {'id', 'answer', 'options', 'listen_answer', 'listen_choices',
                             'reading_answer', 'source', 'target'} for k in edit['path'])
        target[key] = edit['after']
        if edit['format'] == 'metadata':
            assert not edit['render']
            continue
        render = core.rich if edit['format'] == 'rich' else escape
        assert edit['format'] in {'rich', 'plain'} and edit['render']
        before, after = render(edit['before']), render(edit['after'])
        for occurrence in edit['render']:
            matches = [m for m in ARTICLE.finditer(html)
                       if f'id="{occurrence["target"]}"' in m[0].split('>', 1)[0]]
            assert len(matches) == 1, f"Missing/ambiguous article: {occurrence['target']}"
            match = matches[0]
            assert match[0].count(before) == occurrence['count'], f"Changed rendering: {edit['path']}"
            replacement = match[0].replace(before, after)
            html = html[:match.start()] + replacement + html[match.end():]
    return book, html


def build(out_root):
    plan = json.loads((HERE / 'n5-copy-edits.json').read_text())
    base_dir = ROOT / plan['baseEdition']
    raw = (base_dir / 'bundle.json').read_bytes()
    assert core.sha(raw) == plan['baseBundleSha256'], 'Pinned publication changed'
    base = json.loads(raw)
    for name, asset in base['assets'].items():
        assert core.sha((base_dir / name).read_bytes()) == asset['sha256'], f'Changed asset: {name}'
    original = (base_dir / 'index.html').read_text()
    book, html = apply_edits(copy.deepcopy(base['manuscript']), original, plan['edits'])
    digest = core.sha(core.canonical({k: v for k, v in book.items()
                                     if k not in {'revision', 'source', 'editorialChanges'}}))
    edition = digest[:24]
    book['revision'] = edition
    book['editorialChanges'] = [*book.get('editorialChanges', []),
                               '공식 N5 유형 대조·대화 질문 조건·한국어 해설·현재 매체 안내 교정']
    for pattern in [r'\bid="([^"]+)"', r'data-save="([^"]+)"', r'href="([^"]+)"']:
        assert re.findall(pattern, html) == re.findall(pattern, original), 'Changed stable identity/link'
    parser = core.Sources({key: value['lesson'] for key, value in base['sourceIndex'].items()})
    parser.feed(html)
    assert set(parser.index) == set(base['sourceIndex']), 'Lost expression source'
    files = {name: (html if name == 'index.html' else (base_dir / name).read_text())
             for name in ['index.html', 'app.js', 'style.css']}
    assets = {name: {'sha256': core.sha(value.encode()), 'bytes': len(value.encode()),
                     'type': base['assets'][name]['type']} for name, value in files.items()}
    manifest = {**base['artifactManifest'], 'bundleHash': core.sha(core.canonical(assets)),
                'webContentRevision': edition, 'baseEdition': plan['baseEdition'],
                'baseBundleSha256': plan['baseBundleSha256']}
    bundle = {**base, 'editionId': edition, 'contentHash': digest, 'manuscript': book,
              'sourceIndex': parser.index, 'assets': assets, 'artifactManifest': manifest,
              'qa': {'passed': True, 'scope': 'Pinned copy-edit preimages, artifact integrity and identity preservation only; editorial/coverage and browser review recorded separately.',
                     'audioNew': False, 'pdfReviewed': False}}
    files['bundle.json'] = json.dumps(bundle, ensure_ascii=False, separators=(',', ':'))
    target = out_root / edition
    assert target.resolve() != base_dir.resolve()
    # Never overwrite a different artifact under an existing immutable ID.
    for name, value in files.items():
        if (target / name).exists():
            assert (target / name).read_bytes() == value.encode(), f'Existing edition differs: {name}'
    target.mkdir(parents=True, exist_ok=True)
    for name, value in files.items():
        (target / name).write_text(value)
    print(json.dumps({'edition': edition, 'edits': len(plan['edits']), 'pages': len(base['pages']),
                      'sourceAnchors': len(parser.index), 'bundleSha256': core.sha(files['bundle.json'].encode())}))


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--out', type=Path, default=ROOT)
    build(args.parse_args().out)
