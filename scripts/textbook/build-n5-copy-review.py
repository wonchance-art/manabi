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
READING_FIELDS = {'reading_title', 'reading', 'reading_question', 'reading_answer', 'reading_why'}


def reading_html(text, lesson):
    """Reuse this lesson's reviewed readings, refusing unassisted new kanji."""
    readings = dict(lesson['kanji'])
    for item in lesson.get('reading_support', []):
        readings[item['word']] = item['reading']
    tokens = re.compile('|'.join(re.escape(k) for k in sorted(readings, key=len, reverse=True))
                        + r'|[\u3400-\u9fff]')

    def ruby(match):
        word = match[0]
        assert word in readings, f'Unreviewed reading: {word}'
        return '<ruby>' + escape(word) + '<rt>' + escape(readings[word]) + '</rt></ruby>'

    # Keep the accepted phrase layout and its soft wrapping, including punctuation.
    parts = re.split(r'(\s+|(?<=[、。]))', text)
    return '<span lang="ja">' + ''.join(
        part if part.isspace() else '<span class="phrase">' + tokens.sub(ruby, escape(part)) + '</span>'
        for part in parts if part) + '</span>'


def apply_reading_revisions(book, html, revisions, vocabulary):
    """Explicit atomic reading revisions; the copy-only edit boundary stays closed.

    These short readings have no saved response control. All structured exercises
    and saved keys remain unchanged; new content is isolated by its edition ID.
    """
    seen = set()
    for revision in revisions:
        uid = revision['lesson']
        assert uid not in seen, 'Duplicate reading revision'
        seen.add(uid)
        lesson = next(l for l in book['lessons'] if l['id'] == uid)
        before, after = revision['before'], revision['after']
        assert set(before) == set(after) == READING_FIELDS, 'Review the complete reading bundle'
        assert all(lesson[k] == before[k] for k in READING_FIELDS), 'Changed reading preimage'
        assert all(isinstance(v, str) and v.strip() for v in after.values())
        matches = [m for m in ARTICLE.finditer(html) if f'id="{uid}-practice"' in m[0].split('>', 1)[0]]
        assert len(matches) == 1
        match = matches[0]
        article = match[0]
        passages = list(re.finditer(r'<div class="reading">([\s\S]*?)</div>', article))
        assert len(passages) == 1
        passage = passages[0]
        assert not re.search(r'<(?:input|textarea|select)\b|data-save=', passage[0])
        parsed = core.Sources({'reading': 0})
        parsed.feed('<div id="reading">' + passage[1] + '</div>')
        compact = lambda text: re.sub(r'\s+', '', text)
        assert compact(parsed.index['reading']['text']) == compact(before['reading']), 'Reading HTML differs'
        article = article[:passage.start()] + '<div class="reading">' + reading_html(after['reading'], lesson) + '</div>' + article[passage.end():]
        article = core.replace_once(article, '<h3>' + escape(before['reading_title']) + '</h3>', '<h3>' + escape(after['reading_title']) + '</h3>')
        article = core.replace_once(article, '<p>' + core.rich(before['reading_question']) + '</p>', '<p>' + core.rich(after['reading_question']) + '</p>')
        old_answer = '<section class="answer"><b>읽기</b><p>' + core.rich(before['reading_answer']) + '</p><small>' + core.rich(before['reading_why']) + '</small></section>'
        new_answer = '<section class="answer"><b>읽기</b><p>' + core.rich(after['reading_answer']) + '</p><small>' + core.rich(after['reading_why']) + '</small></section>'
        article = core.replace_once(article, old_answer, new_answer)
        html = html[:match.start()] + article + html[match.end():]
        lesson.update(after)
    for support in vocabulary:
        uid = support['lesson']
        lesson = next(l for l in book['lessons'] if l['id'] == uid)
        assert 'reading_vocabulary' not in lesson, 'Vocabulary already exists'
        entries = support['entries']
        assert entries and len({e['word'] for e in entries}) == len(entries)
        assert all(e['word'] in lesson['reading'] and e['meaning'].strip() for e in entries)
        lesson['reading_vocabulary'] = copy.deepcopy(entries)
        matches = [m for m in ARTICLE.finditer(html) if f'id="{uid}-practice"' in m[0].split('>', 1)[0]]
        assert len(matches) == 1
        match = matches[0]
        help_html = '<aside class="note book-reading-help"><b>읽기 도움</b>' + ''.join(
            '<p><span lang="ja">' + escape(e['word']) + '</span> · ' + escape(e['meaning']) + '</p>' for e in entries) + '</aside>'
        article = core.replace_once(match[0], '<div class="reading">', help_html + '<div class="reading">')
        html = html[:match.start()] + article + html[match.end():]
    return book, html


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
        assert edit['format'] in {'rich', 'plain', 'phrase'} and edit['render']
        if edit['format'] == 'phrase':
            # Replace only a verified unannotated phrase; keep surrounding ruby
            # and the original reading renderer's segmentation intact.
            assert key == 'reading'
            fragment = edit['phrase']
            assert fragment['before'] and edit['before'].count(fragment['before']) == 1
            assert edit['before'].replace(fragment['before'], fragment['after']) == edit['after']
            def phrases(text):
                return ' '.join('<span class="phrase">' + escape(part) + '</span>' for part in text.split(' '))
            before, after = phrases(fragment['before']), phrases(fragment['after'])
        else:
            render = core.rich if edit['format'] == 'rich' else escape
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


def build(out_root, plan_path=HERE / 'n5-copy-edits.json'):
    plan = json.loads(plan_path.read_text())
    base_dir = ROOT / plan['baseEdition']
    raw = (base_dir / 'bundle.json').read_bytes()
    assert core.sha(raw) == plan['baseBundleSha256'], 'Pinned publication changed'
    base = json.loads(raw)
    for name, asset in base['assets'].items():
        assert core.sha((base_dir / name).read_bytes()) == asset['sha256'], f'Changed asset: {name}'
    original = (base_dir / 'index.html').read_text()
    book, html = apply_edits(copy.deepcopy(base['manuscript']), original, plan['edits'])
    book, html = apply_reading_revisions(book, html, plan.get('readingRevisions', []), plan.get('readingVocabulary', []))
    digest = core.sha(core.canonical({k: v for k, v in book.items()
                                     if k not in {'revision', 'source', 'editorialChanges'}}))
    edition = digest[:24]
    book['revision'] = edition
    book['editorialChanges'] = [*book.get('editorialChanges', []),
                               plan.get('revisionNote', '공식 N5 유형 대조·대화 질문 조건·한국어 해설·현재 매체 안내 교정')]
    for pattern in [r'\bid="([^"]+)"', r'data-save="([^"]+)"', r'href="([^"]+)"']:
        assert re.findall(pattern, html) == re.findall(pattern, original), 'Changed stable identity/link'
    # Old manifests remain byte-reproducible. New reviews opt in to identifying
    # their own artifact, while font/audio paths retain the inherited edition.
    if plan.get('refreshAssetLinks'):
        html, count = re.subn(r'(<meta name="manuscript-revision" content=")[a-f0-9]{24}(">)',
                             lambda m: m[1] + edition + m[2], html)
        assert count == 1, 'Missing/ambiguous edition marker'
        html, count = re.subn(r'(/api/books/japanese-n5/)[a-f0-9]{24}(/asset\?file=(?:app\.js|style\.css))',
                             lambda m: m[1] + edition + m[2], html)
        assert count == 2, 'Missing/ambiguous runtime asset links'
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
    args.add_argument('--plan', type=Path, default=HERE / 'n5-copy-edits.json')
    options = args.parse_args()
    build(options.out, options.plan)
