"""Score posts.json with jev | llama (void-llm :8089, Qwen3.5-9B) | ollama:<model>. Writes s-<name>.json."""
import json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

cfg = open(os.path.expanduser('~/xworth/config.js')).read()
KEY = re.search(r"KEY = '([^']+)'", cfg).group(1)
INSTR = ' '.join(re.findall(r"'((?:[^'\\]|\\.)*)'", cfg.split('instructions:')[1].split('criteria:')[0])).replace("\\'", "'")
LEVELS = re.findall(r"'([^']+)'", cfg.split('criteria: [')[1].split(']')[0])
SYS = f"{INSTR}\n\nLevels:\n" + '\n'.join(f'{i}. {l}' for i, l in enumerate(LEVELS)) + \
      '\n\nThe user message is one X post (author, handle, age, text, any quoted post, counts). Reply with only the level number.'

def post(url, body, hdr={}):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json', **hdr})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())

def jev(p):
    a = post('https://api.typesafe.ai/v1/systemone', {'model': 'jev-latest', 'state': {'post': p},
             'questions': {'worth': {'type': 'score', 'instructions': INSTR, 'criteria': LEVELS}}},
             {'Authorization': f'Bearer {KEY}'})['answers']['worth']
    return a['score'] / (len(LEVELS) - 1)

def expect(top):  # expected level over digit tokens 0..4, renormalised
    import math
    pr = {int(t['token'].strip()): math.exp(t['logprob']) for t in top if t['token'].strip() in '01234' and t['token'].strip()}
    return sum(k * v for k, v in pr.items()) / sum(pr.values()) / (len(LEVELS) - 1)

def llama(p):
    d = post('http://127.0.0.1:8089/v1/chat/completions', {'messages': [{'role': 'system', 'content': SYS}, {'role': 'user', 'content': p}],
             'max_tokens': 1, 'temperature': 0, 'logprobs': True, 'top_logprobs': 10})
    return expect(d['choices'][0]['logprobs']['content'][0]['top_logprobs'])

def ollama(model):
    def f(p):
        d = post('http://127.0.0.1:11434/api/chat', {'model': model, 'think': False, 'stream': False, 'messages': [{'role': 'system', 'content': SYS}, {'role': 'user', 'content': p}],
                 'options': {'num_predict': 1, 'temperature': 0}, 'logprobs': True, 'top_logprobs': 10})
        return expect(d['logprobs'][0]['top_logprobs'])
    return f

name = sys.argv[1]
fn = jev if name == 'jev' else llama if name == 'llama' else ollama(name.split(':', 1)[1])
posts = json.load(open('posts.json'))
fn(posts[0]['post'])  # warm-up (wakes llama-server / loads ollama model)
out, lat = [], []
with ThreadPoolExecutor(8 if name == 'jev' else 1) as ex:
    def run(p):
        t = time.time(); s = fn(p['post']); return s, time.time() - t
    for s, dt in ex.map(run, posts): out.append(s); lat.append(dt)
lat.sort()
json.dump(out, open(f"s-{re.sub(r'\W+', '_', name)}.json", 'w'))
print(name, 'median %.2fs p95 %.2fs' % (lat[len(lat)//2], lat[int(len(lat)*.95)]), 'n', len(out))
