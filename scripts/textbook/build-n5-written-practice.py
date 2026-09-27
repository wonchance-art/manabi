"""Add a small, original practice set to an immutable, SHA-pinned web edition.

Reuses the existing reader's radios, draft keys, example boxes and disclosures.
No old question/answer is rewritten; no publication, PDF or audio is produced.
"""
import argparse
import copy
import importlib.util
import json
import re
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('routes', HERE / 'build-n5-study-routes.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
ARTICLE = re.compile(r'<article\b[^>]*>[\s\S]*?</article>')


def nav(links, label):
    return ('<nav class="book-recall-links" aria-label="' + escape(label) + '"><strong>'
            + escape(label) + '</strong><ul>' + ''.join(
                '<li><a href="#' + escape(x['target']) + '">' + escape(x['label']) + ' →</a></li>'
                for x in links) + '</ul></nav>')


def example(ja, ko):
    return ('<div class="examples"><span class="caption">확인 문장</span><div class="example">'
            '<span lang="ja">' + escape(ja) + '</span><p>' + escape(ko) + '</p></div></div>')


def render(page, number, total, following):
    source = ' data-book-source="true"' if page['unit'] == 'u42' else ''
    h = (f'<article class="paper reading-bridge" id="{page["id"]}"{source} '
         f'data-unit-page="{page["unit"]}" hidden><div class="meta"><span>선택 연습</span><b>{number}</b></div>'
         f'<h2>{escape(page["title"])}</h2><p class="subtitle">{escape(page["lead"])}</p>'
         f'<p>{core.rich(page["intro"])}</p>')
    vocabulary = [t for t in page['tasks'] if 'wordSource' in t]
    if vocabulary:
        h += '<details class="answers practice-preparation"><summary>처음 보는 말이 있나요? 단어 준비</summary>'
        for t in vocabulary:
            h += example(t['wordSource']['needle'], t['label'].split(' · ')[1])
            h += f'<a class="page-jump" href="#{t["wordSource"]["target"]}">책에서 다시 보기 →</a>'
        h += '</details>'
    if page.get('passage'):
        h += '<div class="examples"><span class="caption">먼저 글 전체를 읽어요</span><p class="bridge-passage" lang="ja">' + escape(page['passage']) + '</p></div>'
    for t in page['tasks']:
        h += f'<section class="review-task" id="{t["id"]}"><h3>{escape(t["label"])}</h3><p>{core.rich(t["prompt"])}</p><p class="cue">{core.rich(t["cue"])}</p>'
        if t.get('help'):
            h += '<p class="small">읽기 도움 · ' + core.rich(t['help']) + '</p>'
        h += f'<fieldset class="check bridge-options" data-question="{t["id"]}"><legend>{escape(t["label"])} · 하나 골라요</legend>'
        for i, option in enumerate(t['options']):
            h += (f'<label style="min-height:44px"><input type="radio" name="{t["id"]}" data-save="{t["id"]}" value="{i}">'
                  f'<span>{core.rich(option)}</span></label>')
        h += '</fieldset></section>'
    h += '<details class="answers review-answers"><summary>고른 뒤 정답과 이유 확인</summary>'
    for t in page['tasks']:
        h += '<section class="answer"><b>' + escape(t['label']) + '</b>'
        h += example(t.get('fullSentence', t['answer']), t.get('translation', ''))
        h += '<p><strong>정답 · ' + core.rich(t['answer']) + '</strong></p><p>' + core.rich(t['why']) + '</p>'
        h += '<ul>' + ''.join('<li>' + core.rich(k) + ' · ' + core.rich(v) + '</li>' for k, v in t['distractors'].items()) + '</ul></section>'
    h += '</details>' + nav(page['help'], '막히면 설명으로')
    back = 'guide-katakana' if page['unit'] == 'guide' else 'u42-review3'
    h += nav([{'target': back, 'label': '문자표로 돌아가기' if page['unit'] == 'guide' else '42과 본학습으로 돌아가기'}, following], '이어서 공부하기')
    return h + f'<footer>manabi · 일본어 N5<span>{number} / {total}</span></footer></article>'


def validate(plan, base, original):
    ids = set(re.findall(r'\bid="([^"]+)"', original))
    old_keys = set(re.findall(r'data-save="([^"]+)"', original))
    pages = plan['pages']
    new_ids = [p['id'] for p in pages] + [t['id'] for p in pages for t in p['tasks']]
    assert len(set(new_ids)) == len(new_ids) and not set(new_ids) & ids
    targets = ids | set(new_ids)
    for p in pages:
        assert p['after'] in targets and p['unit'] in {'guide', 'u42'}
        for link in p['help']:
            assert link['target'] in ids, 'Unverified prerequisite'
        for t in p['tasks']:
            assert t['id'] not in old_keys and re.fullmatch(r'[a-z0-9-]+', t['id'])
            assert len(t['options']) == len(set(t['options'])) == 4
            assert t['options'].count(t['answer']) == 1
            assert set(t['distractors']) == set(t['options']) - {t['answer']}
            assert t['why'] and all(t['distractors'].values())
            if 'order' in t:
                assert sorted(t['order']) == list(range(4))
                assert t['options'][t['order'][2]] == t['answer']
                assert t['cue'].count('★') == 1 and t['cue'].count('＿＿') == 3
            if 'wordSource' in t:
                source = t['wordSource']
                assert source['target'] in ids
                if source['target'].startswith('lex-'):
                    entry = next(x for x in base['manuscript']['lexicon'] if x['id'] == source['target'])
                    assert entry['ja'] == source['needle']
                else:
                    article = next(m[0] for m in ARTICLE.finditer(original) if f'id="{source["target"]}"' in m[0].split('>', 1)[0])
                    assert source['needle'] in article
    for link in plan['entryLinks']:
        assert link['from'] in ids and link['target'] in targets


def build(out_root):
    plan = json.loads((HERE / 'n5-written-practice.json').read_text())
    folder = core.ROOT / plan['baseEdition']
    raw = (folder / 'bundle.json').read_bytes()
    assert core.sha(raw) == plan['baseBundleSha256'], 'Pinned base changed'
    base = json.loads(raw)
    for name, info in base['assets'].items():
        assert core.sha((folder / name).read_bytes()) == info['sha256']
    original = (folder / 'index.html').read_text()
    validate(plan, base, original)
    book, pages = copy.deepcopy(base['manuscript']), copy.deepcopy(base['pages'])
    for p in plan['pages']:
        if p['unit'] == 'guide':
            index = len(book['frontMatter'])
            book['frontMatter'].append({**copy.deepcopy(p), 'kind': 'guide'})
            model = {'id': p['id'], 'kind': 'supplement', 'title': p['title'], 'section': 'frontMatter', 'index': index, 'group': 'guide'}
        else:
            unit = book['lessons'][41]
            collection = unit.setdefault('practice_pages', [])
            index = len(collection)
            collection.append(copy.deepcopy(p))
            model = {'id': p['id'], 'kind': 'practice_page', 'title': p['title'], 'lesson': 42, 'practice_index': index}
        place = next(i for i, old in enumerate(pages) if old['id'] == p['after'])
        pages.insert(place + 1, model)
    book['writtenPractice'] = {'pageIds': [p['id'] for p in plan['pages']], 'entryLinks': plan['entryLinks'], 'scope': plan['scope'], 'optionMinHeight': 44}
    digest = core.sha(core.canonical({k: v for k, v in book.items() if k not in {'revision', 'source', 'editorialChanges'}}))
    edition = digest[:24]
    book['revision'] = edition
    book['editorialChanges'] = [*book.get('editorialChanges', []), '가타카나9·문장배열3·글속문법3 독립 연습과 설명 왕복']
    for i, p in enumerate(pages, 1):
        p['page'] = i
    page_map = {p['id']: p for p in pages}
    html = original
    for p in plan['pages']:
        m = next(m for m in ARTICLE.finditer(html) if f'id="{p["after"]}"' in m[0].split('>', 1)[0])
        same = [x for x in plan['pages'] if x['unit'] == p['unit']]
        i = same.index(p)
        following = {'target': same[i + 1]['id'], 'label': '다음 · ' + same[i + 1]['title']} if i + 1 < len(same) else {'target': 'u01-start' if p['unit'] == 'guide' else 'u42-review4', 'label': '01과로 가기' if p['unit'] == 'guide' else '짧은 글 읽기로 이어가기'}
        html = html[:m.end()] + render(p, page_map[p['id']]['page'], len(pages), following) + html[m.end():]
    def update_article(m):
        article = m[0]
        match = re.search(r'\bid="([^"]+)"', article.split('>', 1)[0])
        if not match:
            return article
        id = match[1]
        links = [x for x in plan['entryLinks'] if x['from'] == id]
        if links:
            article = article.replace('<footer>', nav(links, '조금 더 연습해 볼까요?') + '<footer>', 1)
        if id in page_map:
            number = page_map[id]['page']
            article = re.sub(r'(<div class="meta"><span>[^<]*</span><b>)\d+(</b>)', lambda m: m[1] + str(number) + m[2], article)
            article = re.sub(r'(<footer>manabi · 일본어 N5<span>)\d+ / \d+(</span>)', lambda m: m[1] + f'{number} / {len(pages)}' + m[2], article)
        return article
    html = ARTICLE.sub(update_article, html)
    html, meta_count = re.subn(r'(<meta name="manuscript-revision" content=")[a-f0-9]{24}(">)', lambda m: m[1] + edition + m[2], html)
    assert meta_count == 1
    # The standalone artifact must load its own updated page catalog, while all
    # original font/audio URLs continue to use the verified inherited edition.
    html = re.sub(r'(/api/books/japanese-n5/)[a-f0-9]{24}(/asset\?file=(?:app\.js|style\.css))', lambda m: m[1] + edition + m[2], html)
    old_numbers = {p['page']: page_map[p['id']]['page'] for p in base['pages']}
    html = re.sub(r'(href="#[^"]+">)(\d+)(?:–(\d+))?(쪽 · 이 단계 시작 →)', lambda m: m[1] + str(old_numbers[int(m[2])]) + ('–' + str(old_numbers[int(m[3])]) if m[3] else '') + m[4], html)
    all_ids = re.findall(r'\bid="([^"]+)"', html)
    assert len(set(all_ids)) == len(all_ids), 'Duplicate HTML id'
    assert set(re.findall(r'data-save="([^"]+)"', html)) == set(re.findall(r'data-save="([^"]+)"', original)) | {t['id'] for p in plan['pages'] for t in p['tasks']}
    sources = {key: value['lesson'] for key, value in base['sourceIndex'].items()}
    sources.update({p['id']: 42 for p in plan['pages'] if p['unit'] == 'u42'})
    parser = core.Sources(sources)
    parser.feed(html)
    assert set(parser.index) == set(sources)
    js, count = re.subn(r'const editionPages=[\s\S]*?;\nfunction syncEditionPdf', lambda m: 'const editionPages=' + json.dumps(pages, ensure_ascii=False) + ';\nfunction syncEditionPdf', (folder / 'app.js').read_text())
    assert count == 1
    files = {'index.html': html, 'app.js': js, 'style.css': (folder / 'style.css').read_text()}
    assets = {k: {'sha256': core.sha(v.encode()), 'bytes': len(v.encode()), 'type': base['assets'][k]['type']} for k, v in files.items()}
    manifest = {**base['artifactManifest'], 'bundleHash': core.sha(core.canonical(assets)), 'pages': len(pages), 'webContentRevision': edition, 'baseEdition': plan['baseEdition'], 'baseBundleSha256': plan['baseBundleSha256']}
    bundle = {**base, 'editionId': edition, 'contentHash': digest, 'manuscript': book, 'pages': pages, 'sourceIndex': parser.index, 'assets': assets, 'artifactManifest': manifest, 'qa': {'passed': True, 'scope': 'Pinned-base integrity, unique questions/answers/keys, source evidence and deterministic rendering; language and browser review separate.', 'audioNew': False, 'pdfReviewed': False}}
    files['bundle.json'] = json.dumps(bundle, ensure_ascii=False, separators=(',', ':'))
    target = out_root / edition
    for name, value in files.items():
        if (target / name).exists():
            assert (target / name).read_bytes() == value.encode(), 'Immutable edition differs'
    target.mkdir(parents=True, exist_ok=True)
    for name, value in files.items():
        (target / name).write_text(value)
    print(json.dumps({'edition': edition, 'pages': len(pages), 'questionsAdded': 15, 'sourceAnchors': len(parser.index), 'bundleSha256': core.sha(files['bundle.json'].encode())}))


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--out', type=Path, default=core.ROOT)
    build(args.parse_args().out)
