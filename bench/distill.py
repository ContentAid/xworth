"""Distil Jev's worth score into EmbeddingGemma + ridge regression (void router pattern).
Train: harvest.jsonl posts labelled by Jev (cached in labels.jsonl). Test: the 45 hand-labelled posts
in posts.json/ref.json, never trained on. Writes head.json in the repo root for the extension.
Run with ~/.local/share/void/venv/bin/python (numpy + sklearn)."""
import json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import cross_val_predict
from scipy.stats import spearmanr

EMB, PREFIX = 'embeddinggemma', 'task: classification | query: '
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo root, above bench/
cfg = open(os.path.join(ROOT, 'config.js')).read()
KEY = re.search(r"KEY = '([^']+)'", cfg).group(1)
INSTR = ' '.join(re.findall(r"'((?:[^'\\]|\\.)*)'", cfg.split('instructions:')[1].split('criteria:')[0])).replace("\\'", "'")
LEVELS = re.findall(r"'([^']+)'", cfg.split('criteria: [')[1].split(']')[0])

def post(url, body, hdr={}):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json', **hdr})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())

def jev(p):
    a = post('https://api.typesafe.ai/v1/systemone', {'model': 'jev-latest', 'state': {'post': p},
             'questions': {'worth': {'type': 'score', 'instructions': INSTR, 'criteria': LEVELS}}},
             {'Authorization': f'Bearer {KEY}'})['answers']['worth']
    return a['score'] / (len(LEVELS) - 1)

def embed(texts):
    out = []
    for i in range(0, len(texts), 32):
        out += post('http://127.0.0.1:11434/api/embed', {'model': EMB, 'input': [PREFIX + t for t in texts[i:i + 32]]})['embeddings']
    v = np.array(out, dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)

test = json.load(open('posts.json')); ref = np.array(json.load(open('ref.json'))) / 4
held = {p['post'] for p in test} | {p['id'] for p in test}
seen, train = set(), []
for l in open('harvest.jsonl'):
    d = json.loads(l)
    if d['post'] not in held and d['id'] not in held and d['post'] not in seen:
        seen.add(d['post']); train.append(d)
cache = {}
if os.path.exists('labels.jsonl'):
    for l in open('labels.jsonl'): d = json.loads(l); cache[d['post']] = d['jev']
todo = [d['post'] for d in train if d['post'] not in cache]
with ThreadPoolExecutor(8) as ex, open('labels.jsonl', 'a') as f:
    for p, s in zip(todo, ex.map(jev, todo)):
        cache[p] = s; f.write(json.dumps({'post': p, 'jev': s}) + '\n')
y = np.array([cache[d['post']] for d in train])
X, Xt = embed([d['post'] for d in train]), embed([p['post'] for p in test])
print(f'train {len(train)} posts, Jev label mean {y.mean():.2f} sd {y.std():.2f}')

m = RidgeCV(alphas=np.logspace(-2, 2, 9))
cv = cross_val_predict(m, X, y, cv=5)
print(f'5-fold vs Jev: spearman {spearmanr(cv, y)[0]:.2f}  mae {abs(cv - y).mean():.2f}')
m.fit(X, y); pt = m.predict(Xt)
lo, hi = pt[ref == 0], pt[ref >= .75]
print(f'held-out 45 vs hand labels: spearman {spearmanr(pt, ref)[0]:.2f}  mae {abs(pt - ref).mean():.2f}  alpha {m.alpha_}  '
      f'range {pt.min():.2f}-{pt.max():.2f}  ref0 {lo.mean():.2f} ref3 {hi.mean():.2f}  ref3 above every ref0 {(hi > lo.max()).sum()}/{len(hi)}')
json.dump(pt.tolist(), open('s-small.json', 'w'))
if '--write' in sys.argv:
    # lo/hi: 5th/95th percentile of out-of-fold predictions. Ridge squeezes scores toward the mean,
    # so the extension stretches lo..hi onto red..green. Ranking is unchanged.
    lo, hi = np.percentile(cv, [5, 95])
    json.dump({'model': EMB, 'prefix': PREFIX, 'b': round(float(m.intercept_), 6), 'lo': round(float(lo), 4), 'hi': round(float(hi), 4),
               'w': np.round(m.coef_, 6).tolist()},
              open(os.path.join(ROOT, 'head.json'), 'w'))
    print('wrote', os.path.join(ROOT, 'head.json'))
