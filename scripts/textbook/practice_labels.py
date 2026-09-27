"""Rename displayed exercise copy without changing saved/source identifiers."""
import re
from html.parser import HTMLParser


def practice_text(text):
    for before, after in [('장면·표현·연습·복습', '장면·표현·연습·다시 쓰기'), ('누적 복습', '연결 연습'), ('앞 과 복습', '앞 과 표현 연습'),
                          ('다음 날 복습', '다음 날 다시 꺼내기'), ('복습 해설', '연습 해설'),
                          ('복습 두 묶음', '연습 두 묶음'), ('복습 세 문항', '연습 세 문항'),
                          ('아래 복습', '아래 연습'), ('마지막 복습', '마무리 연습'),
                          ('답하는 복습', '답하는 연습'), ('복습해', '다시 말해')]:
        text = text.replace(before, after)
    return re.sub(r'복습 ([0-9]+|[ABC])(?=\b| )', r'연습 \1', text)


def rename_manuscript(value):
    if isinstance(value, list):
        return [rename_manuscript(x) for x in value]
    if isinstance(value, dict):
        result = {k: v if k in {'id', 'before', 'path', 'target'} else rename_manuscript(v) for k, v in value.items()}
        if isinstance(value.get('id'), str) and value['id'].startswith('복습 '):
            result['label'] = practice_text(value.get('label', value['id']))
        return result
    return practice_text(value) if isinstance(value, str) else value


class DisplayLabels(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.html, self.edits, self.skip = html, [], []
        self.lines = [0]
        for m in re.finditer('\n', html):
            self.lines.append(m.end())

    def source_position(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style'}:
            self.skip.append(tag)
        raw = self.get_starttag_text()
        # Accessible labels describe the displayed question; persistence attributes
        # and internal page/source IDs must retain their original bytes.
        updated = re.sub(r'(\baria-label=")([^"]*)(")', lambda m: m[1] + practice_text(m[2]) + m[3], raw)
        if raw != updated:
            self.edits.append((self.source_position(), len(raw), updated))

    def handle_endtag(self, tag):
        if self.skip and self.skip[-1] == tag:
            self.skip.pop()

    def handle_data(self, data):
        updated = practice_text(data)
        if not self.skip and updated != data:
            self.edits.append((self.source_position(), len(data), updated))


def rename_html(html):
    parser = DisplayLabels(html)
    parser.feed(html)
    for start, length, replacement in reversed(parser.edits):
        html = html[:start] + replacement + html[start + length:]
    return html
