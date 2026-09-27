"""Reviewed word/reading links. Never infer a link from a shared Han character."""
import importlib.util
import re
from html import escape
from pathlib import Path

_spec = importlib.util.spec_from_file_location('n5_kanji_audit', Path(__file__).with_name('audit-n5-kanji.py'))
_audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_audit)


def segments(node):
    if node.tag in {'rt', 'rp', 'script', 'style'}:
        return []
    if node.tag == 'ruby':
        reading = ''.join(''.join(c.visible_text() for c in n.children) for n in node.children if n.tag == 'rt')
        return [(node.visible_text(), reading)]
    return [(c, c) for c in node.text] + [s for child in node.children for s in segments(child)]


def has_reading(node, word, reading):
    """Match complete ruby segments plus okurigana, not substrings of compounds."""
    parts = segments(node)
    for start in range(len(parts)):
        surface, spoken = '', ''
        for left, right in parts[start:]:
            surface += left
            spoken += right
            if surface == word and spoken == reading:
                return True
            if not word.startswith(surface):
                break
    return False


def verify_links(html, entries):
    tree = _audit.Tree()
    tree.feed(html)
    articles = {n.attrs.get('id'): n for n in tree.root.descendants() if n.tag == 'article'}
    result = []
    for entry in entries:
        link = entry.get('readingLink')
        if not link:
            continue
        article = articles.get(link['target'])
        assert article and re.fullmatch(r'u\d{2}', article.attrs.get('data-unit-page', '')), 'Not a lesson destination'
        valid = []
        for node in article.descendants():
            ancestors = list(node.ancestors())
            classes = set(' '.join(n.attrs.get('class', '') for n in ancestors).split())
            if any(n.tag in {'details', 'a', 'nav'} for n in ancestors) or classes & {'answers', 'cue', 'check', 'review-task', 'block-task', 'practice-task'}:
                continue
            if link.get('evidence'):
                if node.tag in {'p', 'div'} and link['evidence'] in node.visible_text():
                    valid.append(node)
            elif node.attrs.get('lang') == 'ja' and has_reading(node, link['word'], link['reading']):
                valid.append(node)
        assert valid, f'Unverified word/reading destination: {entry["character"]} {link}'
        assert link['kind'] in {'word', 'form', 'usage'}
        if link['kind'] == 'word':
            assert (link['word'], link['reading']) == (entry['ja'], entry['reading'])
        else:
            assert link['word'] != entry['ja'], 'Label changed form explicitly'
        result.append({'character': entry['character'], **link})
    return result


def apply_links(book, spec):
    entries = book['kanjiIndex']
    linked, cards = spec['links'], spec['cardOnly']
    assert not set(linked) & set(cards)
    assert set(linked) | set(cards) == {e['character'] for e in entries}, 'Every index entry needs review'
    for entry in entries:
        entry['readingLink'] = linked.get(entry['character'])
    book['kanjiNavigation'] = spec['version']


def render_links(html, entries):
    verify_links(html, entries)
    for entry in entries:
        pattern = r'(<section class="kanji-card" id="' + re.escape(entry['id']) + r'"[^>]*>)([\s\S]*?)(</section>)'
        def card(match):
            content, count = re.subn(r'<a href="#[^"]+">[^<]*</a>$', '', match[2])
            assert count == 1
            links = ''
            link = entry['readingLink']
            if link:
                suffix = '' if link['kind'] == 'word' else f' · <span lang="ja">{escape(link["word"])}</span>'
                label = f'본문에서 읽기 · {int(link["target"][1:3]):02d}과{suffix}'
                links += f'<a class="kanji-reading-link" href="#{link["target"]}">{label}</a>'
                if link.get('contextNote'):
                    links += '<small class="meaning">' + escape(link['contextNote']) + '</small>'
            links += f'<a href="#{entry["target"]}">관련 과 · {entry["unit"]:02d}과</a>'
            return match[1] + content + '<div class="book-kanji-links">' + links + '</div>' + match[3]
        html, count = re.subn(pattern, card, html)
        assert count == 1, 'Missing or repeated kanji card'
    intro = '뜻과 예시를 가리고 먼저 떠올려 보세요. 연결된 과에서 배운 장면으로 돌아갈 수 있어요.'
    replacement = ('대표 단어의 읽기와 뜻을 먼저 떠올려 보세요. ‘본문에서 읽기’는 표기와 읽기를 확인할 수 있는 곳으로, '
                   '‘관련 과’는 함께 공부할 장면으로 이어져요. 본문 연결이 없는 단어는 이 카드에서 표기와 읽기를 익혀요.')
    def page(match):
        assert intro in match[0]
        return match[0].replace(intro, replacement, 1)
    return re.sub(r'<article\b[^>]*id="kanjiIndex-\d+"[^>]*>[\s\S]*?</article>', page, html)
