import json, numpy as np, urllib.request
from scipy.stats import spearmanr
from sklearn.linear_model import RidgeCV, LogisticRegression
from sklearn.svm import SVR
from sklearn.model_selection import cross_val_predict
def embed(texts, prefix):
    out = []
    for i in range(0, len(texts), 32):
        req = urllib.request.Request('http://127.0.0.1:11434/api/embed', json.dumps({'model': 'embeddinggemma', 'input': [prefix + t for t in texts[i:i+32]]}).encode())
        out += json.load(urllib.request.urlopen(req))['embeddings']
    v = np.array(out, dtype=np.float32); return v / np.linalg.norm(v, axis=1, keepdims=True)
lab = {}
for l in open('labels.jsonl'): d = json.loads(l); lab[d['post']] = d['jev']
P = list(lab); y = np.array([lab[p] for p in P])
test = [p['post'] for p in json.load(open('posts.json'))]; ref = np.array(json.load(open('ref.json'))) / 4
for prefix in ['task: classification | query: ', 'task: search result | query: ', '']:
    X, Xt = embed(P, prefix), embed(test, prefix)
    for name, m in [('ridge', RidgeCV(alphas=np.logspace(-2, 2, 9))), ('svr', SVR(C=1.0)), ('svr C3', SVR(C=3.0))]:
        cv = cross_val_predict(m, X, y, cv=5); m.fit(X, y); pt = m.predict(Xt)
        lo, hi = pt[ref == 0], pt[ref >= .75]
        print(f'{prefix[:22]:22} {name:7} cv-vs-jev {spearmanr(cv, y)[0]:.2f}  held-out {spearmanr(pt, ref)[0]:.2f}  ref3>all ref0 {(hi > lo.max()).sum()}/5')
