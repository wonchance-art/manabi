"""Verify the recorded evidence, not language quality or exam completeness."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def at(book, path):
    for key in path:
        book = book[key]
    return book


def audit():
    plan = json.loads(Path(__file__).with_name('n5-coverage-review.json').read_text())
    folder = ROOT / 'src/content/textbookEditions' / plan['edition']
    raw = (folder / 'bundle.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == plan['bundleSha256'], 'Review evidence is stale'
    bundle = json.loads(raw)
    book = bundle['manuscript']
    articles = {re.search(r'\bid="([^"]+)"', m[0])[1]: m[0]
                for m in re.finditer(r'<article\b[^>]*>[\s\S]*?</article>', (folder / 'index.html').read_text())
                if re.search(r'\bid="([^"]+)"', m[0].split('>', 1)[0])}
    assert [l['number'] for l in book['lessons']] == list(range(1, 43))
    expected = [*[f'v{i}' for i in range(1, 5)], *[f'g{i}' for i in range(1, 4)],
                *[f'r{i}' for i in range(1, 4)], *[f'l{i}' for i in range(1, 5)]]
    assert [r['id'] for r in plan['types']] == expected
    rows = []
    for row in plan['types']:
        assert row['remaining'] and row['status'] in {'representative', 'partial', 'deferred'}
        for page in row['foundationPages']:
            assert page in articles, f'Missing foundation: {page}'
        for proof in row['evidence']:
            question = at(book, proof['path'])
            digest = hashlib.sha256(json.dumps(question, ensure_ascii=False, sort_keys=True,
                                               separators=(',', ':')).encode()).hexdigest()
            assert digest == proof['sha256'], f"Changed evidence: {proof['path']}"
            assert question['id'] == proof['questionId'] and question['answer'] and question['why']
            assert proof['target'] in articles and question['id'] in articles[proof['target']]
        if row['id'].startswith('l'):
            assert row['status'] == 'deferred' and not row['evidence']
        else:
            assert row['evidence'], 'A written type needs actual question evidence'
        rows.append({'id': row['id'], 'label': row['label'], 'status': row['status'],
                     'verifiedRepresentativeQuestions': len(row['evidence'])})
    lengths = []
    for item in plan['passages']:
        text = at(book, item['path'])
        if item.get('beforeChoices'):
            assert '\n\n①' in text, 'Cannot separate passage from choices'
            text = text.split('\n\n①', 1)[0]
        lengths.append({'target': item['target'], 'charactersWithoutWhitespace': len(re.sub(r'\s', '', text))})
    return {'edition': plan['edition'], 'scope': plan['scope'], 'types': rows,
            'passageLengths': lengths, 'lengthConvention': 'Exclude choices and whitespace; retain punctuation, titles, numerals and cloze markers. Approximate editorial comparison, not an official scoring rule.'}


if __name__ == '__main__':
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
