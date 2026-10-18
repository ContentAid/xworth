import json, sys
R = [r / 4 for r in json.load(open('ref.json'))]
def rank(x):
    o = sorted(range(len(x)), key=lambda i: x[i]); r = [0] * len(x); i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and x[o[j + 1]] == x[o[i]]: j += 1
        for k in range(i, j + 1): r[o[k]] = (i + j) / 2
        i = j + 1
    return r
def spear(a, b):
    a, b = rank(a), rank(b); n = len(a); ma, mb = sum(a) / n, sum(b) / n
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) ** .5
for name in sys.argv[1:]:
    S = json.load(open(f's-{name}.json'))
    lo = [s for s, r in zip(S, R) if r == 0]; hi = [s for s, r in zip(S, R) if r >= .75]
    print(f'{name:14} spearman {spear(S, R):.2f}  mae {sum(abs(s - r) for s, r in zip(S, R)) / len(R):.2f}  '
          f'range {min(S):.2f}-{max(S):.2f}  mean ref0 {sum(lo)/len(lo):.2f} ref3 {sum(hi)/len(hi):.2f}  '
          f'ref3 above every ref0: {sum(h > max(lo) for h in hi)}/{len(hi)}')
