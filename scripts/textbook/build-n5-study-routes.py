"""Deterministic, web-only revision of one pinned, verified publication.

Retain the accepted renderer's HTML, form keys, ruby and example boxes. Only
the declared lesson routes, reading guidance and question wording change. No database/publication
write, PDF generation, new audio, or modification of the original edition.
"""
import argparse
import copy
import hashlib
import json
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from practice_labels import practice_text, rename_html, rename_manuscript

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / 'src/content/textbookEditions'
BASE_SHA = 'ac5f4355474f88012f896d17e6925715f10140ed682092236b4d1bc9ad79bc1e'


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def rich(value):
    return re.sub(r'[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]+',
                  lambda m: '<span lang="ja">' + m[0] + '</span>', escape(value)).replace('\n', '<br>')


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Expected one rendering: ' + before[:120])
    return text.replace(before, after, 1)


class Sources(HTMLParser):
    """Same visible-text convention as the original packager (ruby excluded)."""
    def __init__(self, lessons):
        super().__init__(convert_charrefs=True)
        self.lessons, self.stack, self.index = lessons, [], {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        target = attrs.get('id') if attrs.get('id') in self.lessons else None
        if target:
            if target in self.index:
                raise ValueError('Duplicate source: ' + target)
            self.index[target] = {'lesson': self.lessons[target], 'text': ''}
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append((tag, target))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        if any(tag in {'rt', 'script', 'style'} for tag, _ in self.stack):
            return
        for _, target in self.stack:
            if target:
                self.index[target]['text'] += data


def route_html(lesson):
    stages = []
    for i, stage in enumerate(lesson['study_route'], 1):
        stages.append(f'<li><span class="book-route-number" aria-hidden="true">{i:02d}</span>'
                      f'<div><h3>{escape(stage["title"])}</h3><p>{rich(stage["goal"])}</p>'
                      f'<p class="small">{rich(stage["check"])}</p>'
                      f'<a class="page-jump" href="#{lesson["id"]}-{stage["targets"][0]}">'
                      f'{i}단계 시작 →</a></div></li>')
    return (f'<article class="paper book-route" id="{lesson["id"]}-route" data-book-source="true" '
            f'data-unit-page="{lesson["id"]}" hidden><div class="stage">공부 순서</div>'
            f'<h2>내 속도로 나누어 배워요</h2><p>{escape(lesson["durationNote"])}</p>'
            f'<ol class="book-route-list">{"".join(stages)}</ol></article>')


def enhance_article(article, lesson, suffix):
    stages = lesson.get('study_route', [])
    stage = next((s for s in stages if suffix in s['targets']), None)
    if stage:
        label = (f'<p class="book-stage-label">{stages.index(stage)+1:02d} · {escape(stage["title"])}'
                 f' <a href="#{lesson["id"]}-route">공부 순서</a></p>')
        article, count = re.subn(r'(<h2>[\s\S]*?</h2>)', lambda m: m[0] + label, article, count=1)
        assert count == 1
    note = lesson.get('reading_notes', {}).get(suffix)
    if note:
        article = replace_once(article, rich(note['before']), rich(note['text']))
    links = [link for link in lesson.get('recall_links', []) if link['after'] == suffix]
    extra = ''
    if links:
        extra += '<nav class="book-recall-links" aria-label="막힌 표현 다시 보기"><strong>막혔다면 이곳부터</strong><ul>'
        extra += ''.join(f'<li><a href="#{x["target"]}">{escape(x["label"])} →</a></li>' for x in links)
        extra += '</ul></nav>'
    if stage and stage['targets'][-1] == suffix:
        next_stage = stages[stages.index(stage)+1] if stage is not stages[-1] else None
        extra += (f'<aside class="book-study-pause" aria-label="{stages.index(stage)+1}단계 마침">'
                  f'<strong>{"여기서 잠깐 쉬어 가도 좋아요" if next_stage else "다음 공부를 위한 한 문장"}</strong>'
                  f'<p>{rich(stage["pause"])}</p>')
        if next_stage:
            extra += f'<a class="page-jump" href="#{lesson["id"]}-{next_stage["targets"][0]}">다음 · {escape(next_stage["title"])} →</a>'
        extra += '</aside>'
    for pause in lesson.get('study_pauses', []):
        if pause['after'] == suffix:
            extra += '<aside class="book-study-pause" aria-label="공부 마침점"><strong>' + escape(pause['title']) + '</strong>'
            extra += '<p>' + rich(pause['body']) + '</p>'
            extra += ''.join(f'<a class="page-jump" href="#{link["target"]}">{escape(link["label"])} →</a>' for link in pause['links'])
            extra += '</aside>'
    if extra:
        if '<footer>' in article:
            article = article.replace('<footer>', extra + '<footer>', 1)
        else:
            article = article.replace('</article>', extra + '</article>', 1)
    if suffix == 'start' and stages:
        article = article.replace('<p class="goal">', f'<p><a class="page-jump" href="#{lesson["id"]}-route">나누어 공부하는 순서 보기 →</a></p><p class="goal">', 1)
    for help_item in lesson.get('reading_support', []):
        if help_item['page'] == suffix:
            help_html = ('<aside class="note book-reading-help"><b>읽기 도움</b><p><span lang="ja"><ruby>'
                         + escape(help_item['word']) + '<rt>' + escape(help_item['reading']) + '</rt></ruby></span> · '
                         + escape(help_item['meaning']) + '</p></aside>')
            article, count = re.subn(r'(<p class="subtitle">[\s\S]*?</p>)', lambda m: m[0] + help_html, article, count=1)
            assert count == 1, 'Reading support needs an explicit placement'
    return article


def questions(value):
    if isinstance(value, dict):
        if 'id' in value and 'prompt' in value and 'answer' in value:
            yield value
        for child in value.values():
            yield from questions(child)
    elif isinstance(value, list):
        for child in value:
            yield from questions(child)


def build(out_root):
    spec = json.loads((Path(__file__).with_name('n5-study-routes.json')).read_text())
    base_dir = ROOT / spec['baseEdition']
    raw = (base_dir / 'bundle.json').read_bytes()
    assert sha(raw) == BASE_SHA, 'Base publication changed; review instead of silently rebasing'
    base = json.loads(raw)
    # Verify the three inputs used by this builder; all inherited media keep the
    # original edition URL and its existing runtime hash/authorization checks.
    for file in ['index.html', 'app.js', 'style.css']:
        assert sha((base_dir / file).read_bytes()) == base['assets'][file]['sha256']
    book = copy.deepcopy(base['manuscript'])
    for lesson in book['lessons']:
        if lesson['id'] in spec['lessons']:
            lesson.update(copy.deepcopy(spec['lessons'][lesson['id']]))
            for note in lesson.get('reading_notes', {}).values():
                target = lesson
                for key in note['path'][:-1]:
                    target = target[key]
                key = note['path'][-1]
                assert target[key] == note['before'], 'Reading guidance changed; review replacement'
                target[key] = note['text']
    corrections = []
    for correction in [spec['questionCorrection'], *spec.get('wordingCorrections', [])]:
        unit = next(l for l in book['lessons'] if l['id'] == correction['lesson'])
        matches = [q for q in questions(unit) if q['id'] == correction['id']]
        assert len(matches) == 1, 'Ambiguous question ID'
        question = matches[0]
        old_question = copy.deepcopy(question)
        assert correction.get('answer', old_question['answer']) == old_question['answer'], 'Answer key migration requires separate review'
        question.update({k: correction[k] for k in ['prompt', 'cue', 'why'] if k in correction})
        corrections.append((old_question, question))
    for support in spec.get('readingSupport', []):
        unit = next(l for l in book['lessons'] if l['id'] == support['lesson'])
        unit.setdefault('reading_support', []).append(copy.deepcopy(support))
    if spec.get('practiceTerminology'):
        book = rename_manuscript(book)
        book['practiceTerminology'] = spec['practiceTerminology']
    digest = sha(canonical({k: v for k, v in book.items() if k not in {'revision', 'source', 'editorialChanges'}}))
    edition = digest[:24]
    book['revision'] = edition
    book['editorialChanges'] = ['20·23·32·35·42과 학습 경로와 마침점', '39과 본학습·다음 날·누적 복습 구분', '앞 과로 돌아가는 누적 회상 링크', '32·39과 지시문 및 42과 대비 근거 명확화', '교재 연습 명칭과 저장 표현 복습 구분', '한자 읽기 도움 6곳 보완']

    pages = copy.deepcopy(base['pages'])
    lessons = {l['id']: l for l in book['lessons'] if l['id'] in spec['lessons'] or l.get('reading_support')}
    for uid, lesson in lessons.items():
        start = next(i for i, p in enumerate(pages) if p['id'] == uid + '-start')
        if lesson.get('study_route'):
            pages.insert(start + 1, {'id': uid + '-route', 'kind': 'route', 'lesson': lesson['number'], 'title': '내 속도로 나누어 배워요'})
        if lesson.get('page_order'):
            order = {uid + '-' + suffix: i for i, suffix in enumerate(lesson['page_order'])}
            positions = [i for i, p in enumerate(pages) if p['id'] in order]
            sorted_pages = sorted([pages[i] for i in positions], key=lambda p: order[p['id']])
            for i, page in zip(positions, sorted_pages):
                pages[i] = page
        for i, stage in enumerate(lesson.get('study_route', []), 1):
            for suffix in stage['targets']:
                page = next(p for p in pages if p['id'] == uid + '-' + suffix)
                page['study_stage'] = f'{i:02d} · ' + stage['title']
    for i, page in enumerate(pages, 1):
        page['page'] = i
        if spec.get('practiceTerminology'):
            page['title'] = practice_text(page['title'])
    page_map = {p['id']: p for p in pages}
    old_numbers = {p['page']: page_map[p['id']]['page'] for p in base['pages']}
    html = (base_dir / 'index.html').read_text()
    # Local-only scripts/styles belong to the new edition; unchanged licensed
    # fonts and pre-existing audio stay behind the original verified asset route.
    html = html.replace(f'content="{spec["baseEdition"]}"', f'content="{edition}"')
    for file in ['app.js', 'style.css']:
        html = html.replace(f'/{spec["baseEdition"]}/asset?file={file}', f'/{edition}/asset?file={file}')
    for old_question, question in corrections:
        for key in ['prompt', 'cue', 'why']:
            if old_question.get(key) != question.get(key):
                html = replace_once(html, rich(old_question[key]), rich(question[key]))

    def article_replacement(match):
        article = match[0]
        uid_match = re.search(r'data-unit-page="(u\d\d)"', article.split('>', 1)[0])
        id_match = re.search(r'\bid="([a-z0-9-]+)"', article.split('>', 1)[0])
        if not id_match:
            return article
        pid = id_match[1]
        if pid in page_map:
            number = page_map[pid]['page']
            article = re.sub(r'(<div class="meta"><span>[^<]*</span><b>)\d+(</b>)', lambda m: m[1] + str(number) + m[2], article)
            article = re.sub(r'(<footer>manabi · 일본어 N5<span>)\d+ / \d+(</span>)', lambda m: m[1] + f'{number} / {len(pages)}' + m[2], article)
        if uid_match and uid_match[1] in lessons:
            lesson = lessons[uid_match[1]]
            suffix = pid[len(lesson['id'])+1:]
            article = enhance_article(article, lesson, suffix)
            if suffix == 'start' and lesson.get('study_route'):
                article += route_html(lesson)
        return article
    html = re.sub(r'<article\b[^>]*>[\s\S]*?</article>', article_replacement, html)
    for uid, lesson in lessons.items():
        if lesson.get('page_order'):
            articles = list(re.finditer(r'<article\b[^>]*>[\s\S]*?</article>', html))
            selected = [m for m in articles if f'data-unit-page="{uid}"' in m[0].split('>', 1)[0]]
            assert selected and all(x.end() == y.start() for x, y in zip(selected, selected[1:]))
            ordered = sorted(selected, key=lambda m: page_map[re.search(r'\bid="([^"]+)"', m[0])[1]]['page'])
            html = html[:selected[0].start()] + ''.join(m[0] for m in ordered) + html[selected[-1].end():]
    if spec.get('practiceTerminology'):
        html = rename_html(html)
    # Existing route labels refer to web page order, not a newly generated PDF.
    html = re.sub(r'(href="#[^"]+">)(\d+)(?:–(\d+))?(쪽 · 이 단계 시작 →)',
                  lambda m: m[1] + str(old_numbers[int(m[2])]) + ('–' + str(old_numbers[int(m[3])]) if m[3] else '') + m[4], html)
    source_lessons = {key: value['lesson'] for key, value in base['sourceIndex'].items()}
    source_lessons.update({uid + '-route': lesson['number'] for uid, lesson in lessons.items() if lesson.get('study_route')})
    parser = Sources(source_lessons)
    parser.feed(html)
    assert set(parser.index) == set(source_lessons), 'Lost source anchor'
    ids = re.findall(r'\bid="([^"]+)"', html)
    assert len(ids) == len(set(ids)), 'Duplicate HTML ID'
    for lesson in lessons.values():
        for link in lesson.get('recall_links', []):
            assert link['target'] in ids
        for pause in lesson.get('study_pauses', []):
            assert lesson['id'] + '-' + pause['after'] in ids
            for link in pause['links']:
                assert link['target'] in ids
    # A revision must not silently change learners' persisted answer keys.
    assert sorted(re.findall(r'data-save="([^"]+)"', html)) == sorted(re.findall(r'data-save="([^"]+)"', (base_dir / 'index.html').read_text()))
    js = (base_dir / 'app.js').read_text()
    js, count = re.subn(r'const editionPages=[\s\S]*?;\nfunction syncEditionPdf',
                        lambda _: 'const editionPages=' + json.dumps(pages, ensure_ascii=False) + ';\nfunction syncEditionPdf', js)
    assert count == 1
    css = (base_dir / 'style.css').read_text() + '\n' + (REPO / 'src/components/books/study-route.css').read_text()
    files = {'index.html': html, 'app.js': js, 'style.css': css}
    assets = {key: {'sha256': sha(value.encode()), 'bytes': len(value.encode()), 'type': base['assets'][key]['type']} for key, value in files.items()}
    manifest = {'bundleHash': sha(canonical(assets)), 'pages': len(pages), 'webContentRevision': edition,
                'media': {'web': True, 'pdf': False, 'audio': 'existing-only'},
                'baseEdition': spec['baseEdition'], 'baseBundleSha256': BASE_SHA,
                'inheritedMedia': {'editionId': spec['baseEdition'], 'bundleHash': base['artifactManifest']['bundleHash'], 'paths': ['fonts/', 'font-licenses/', 'audio/']}}
    bundle = {'bookId': 'japanese-n5', 'editionId': edition, 'contentHash': digest,
              'manuscript': book, 'pages': pages, 'sourceIndex': parser.index, 'assets': assets,
              'artifactManifest': manifest,
              'qa': {'passed': True, 'scope': 'Deterministic artifact integrity, source/answer-key preservation and route targets; visual/browser review is recorded separately.',
                     'audioNew': False, 'pdfReviewed': False}}
    files['bundle.json'] = json.dumps(bundle, ensure_ascii=False, separators=(',', ':'))
    target = out_root / edition
    assert target.resolve() != base_dir.resolve()
    target.mkdir(parents=True, exist_ok=True)
    for key, value in files.items():
        (target / key).write_text(value)
    print(json.dumps({'edition': edition, 'pages': len(pages), 'sourceAnchors': len(parser.index), 'bundleHash': manifest['bundleHash'], 'out': str(target)}))


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--out', type=Path, default=ROOT)
    build(args.parse_args().out)
