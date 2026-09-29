"""Read-only rendered kanji exposure inventory, not an automatic difficulty score.

Uses the same standard-library HTML parser as the pinned edition builder. Ruby
readings, answer explanations, navigation and back matter are not new body text.
"""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'src/content/textbookEditions'
HAN = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Node:
    def __init__(self, tag='', attrs=None, parent=None, text=''):
        self.tag, self.attrs, self.parent, self.text = tag, attrs or {}, parent, text
        self.children = []

    def ancestors(self):
        node = self
        while node:
            yield node
            node = node.parent

    def visible_text(self):
        if self.tag in {'rt', 'rp', 'script', 'style'}:
            return ''
        return self.text + ''.join(child.visible_text() for child in self.children)

    def descendants(self):
        yield self
        for child in self.children:
            yield from child.descendants()


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root')
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(Node(parent=self.stack[-1], text=data))


def compact(text):
    return re.sub(r'\s+', ' ', text).strip()


def inspect(html):
    tree = Tree()
    tree.feed(html)
    occurrences, lesson_numbers = [], set()
    for article in (n for n in tree.root.descendants() if n.tag == 'article'):
        unit = article.attrs.get('data-unit-page', '')
        page = article.attrs.get('id', '')
        if not re.fullmatch(r'u\d{2}', unit) or not page.startswith(unit + '-'):
            continue  # Front/back matter and answer-key articles do not introduce kanji.
        lesson = int(unit[1:])
        lesson_numbers.add(lesson)
        for node in article.descendants():
            if node.tag or not HAN.search(node.text):
                continue
            ancestors = list(node.ancestors())
            if any(n.tag in {'rt', 'rp', 'script', 'style', 'nav', 'a'} for n in ancestors):
                continue
            language = next((n.attrs['lang'] for n in ancestors if 'lang' in n.attrs), None)
            ruby = next((n for n in ancestors if n.tag == 'ruby'), None)
            if language != 'ja' and not ruby:
                continue  # Korean labels are not Japanese reading exposures.
            classes = set(' '.join(n.attrs.get('class', '') for n in ancestors).split())
            if any(n.tag == 'details' for n in ancestors) or 'answers' in classes:
                role = 'answer'
            elif classes & {'cue', 'check', 'review-task', 'block-task', 'practice-task'}:
                role = 'question'
            elif classes & {'note', 'kanji-note'}:
                role = 'guidance'
            elif classes & {'words', 'block-words'}:
                role = 'vocabulary'
            elif classes & {'examples', 'example', 'block-example'}:
                role = 'example'
            elif classes & {'reading', 'block-reading'}:
                role = 'reading'
            elif 'formula' in classes:
                role = 'form'
            else:
                role = 'body'
            section = next((n for n in ancestors if n.tag == 'section'), article)
            heading = next((compact(n.visible_text()) for n in section.children if n.tag in {'h2', 'h3', 'h4'}), '')
            context = next((n for n in ancestors if n.tag == 'tr'), None) or next((n for n in ancestors if n.tag in {'p', 'li'} or 'phrase' in n.attrs.get('class', '').split()), node.parent)
            source = next((n.attrs['id'] for n in ancestors if n.attrs.get('data-book-source') == 'true' and n.attrs.get('id')), page)
            reading = ''
            # visible_text intentionally drops rt; its descendants contain the reading.
            if ruby:
                reading = ''.join(''.join(c.visible_text() for c in n.children) for n in ruby.children if n.tag == 'rt')
            occurrences.append({'lesson': lesson, 'page': page, 'source': source, 'role': role, 'heading': heading,
                                'text': compact(node.text), 'characters': list(dict.fromkeys(HAN.findall(node.text))),
                                'ruby': compact(reading) or None, 'context': compact(context.visible_text())[:240]})
    records = {}
    for i, row in enumerate(occurrences):
        if row['role'] == 'answer':
            continue
        for char in row['characters']:
            entry = records.setdefault(char, {'character': char, 'firstBody': None, 'firstRuby': None, 'firstQuestion': None, 'firstUnassistedQuestion': None})
            if row['role'] != 'answer':
                if row['role'] != 'question' and entry['firstBody'] is None:
                    entry['firstBody'] = i
                if row['ruby'] and entry['firstRuby'] is None:
                    entry['firstRuby'] = i
                if row['role'] == 'question':
                    if entry['firstQuestion'] is None:
                        entry['firstQuestion'] = i
                    if not row['ruby'] and entry['firstUnassistedQuestion'] is None:
                        entry['firstUnassistedQuestion'] = i
    lessons = []
    for lesson in sorted(lesson_numbers):
        own = [r for r in occurrences if r['lesson'] == lesson and r['role'] != 'answer']
        first = [c for c, v in records.items() if v['firstBody'] is not None and occurrences[v['firstBody']]['lesson'] == lesson]
        lessons.append({'lesson': lesson, 'bodyCharacters': sorted({c for r in own if r['role'] != 'question' for c in r['characters']}),
                        'introducedInBody': first, 'unassistedQuestionCharacters': sorted({c for r in own if r['role'] == 'question' and not r['ruby'] for c in r['characters']})})
    return {'scope': 'Rendered Japanese lesson text only. Missing ruby is a review candidate, not an error. First ruby is not proof of instruction; questions and answers are separate.',
            'htmlSha256': hashlib.sha256(html.encode()).hexdigest(), 'lessons': lessons, 'characters': list(records.values()), 'occurrences': occurrences}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--edition')
    parser.add_argument('--html', type=Path)
    args = parser.parse_args()
    if args.html:
        source = args.html
    else:
        edition = args.edition or json.loads((ROOT / 'index.json').read_text())['current']
        if not re.fullmatch(r'[a-f0-9]{24}', edition):
            raise ValueError('Invalid edition')
        source = ROOT / edition / 'index.html'
    print(json.dumps(inspect(source.read_text()), ensure_ascii=False, indent=2))
