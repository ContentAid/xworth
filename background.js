importScripts('config.js');

const TOP = WORTH.criteria.length - 1;
const SYS = `${WORTH.instructions}\n\nLevels:\n${WORTH.criteria.map((l, i) => `${i}. ${l}`).join('\n')}\n\n` +
  'The user message is one X post (author, handle, age, text, any quoted post, counts). Reply with only the level number.';

// Local Qwen3.5-9B on void-llm.service (llama-server :8089). One token out; the score is the
// expected level over the digit logprobs, so it is a smooth 0..1 like Jev's, not 5 steps.
async function local(post) {
  const r = await fetch('http://127.0.0.1:8089/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: SYS }, { role: 'user', content: post }],
      max_tokens: 1, temperature: 0, logprobs: true, top_logprobs: 10,
    }),
  });
  if (!r.ok) throw `HTTP ${r.status}`;
  let sum = 0, w = 0;
  for (const t of (await r.json()).choices[0].logprobs.content[0].top_logprobs) {
    const k = t.token.trim();
    if (/^\d$/.test(k) && +k <= TOP) { sum += +k * Math.exp(t.logprob); w += Math.exp(t.logprob); }
  }
  if (!w) throw 'no level digit in reply';
  return sum / w / TOP;
}

// Small scorer: EmbeddingGemma on ollama (~20 ms, 621 MB) + a ridge head distilled from Jev's
// scores. head.json is built by bench/distill.py; rebuild it after editing WORTH.
const head = fetch(chrome.runtime.getURL('head.json')).then(r => r.json());
async function small(post) {
  const h = await head;
  const r = await fetch('http://127.0.0.1:11434/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: h.model, input: h.prefix + post }),
  });
  if (!r.ok) throw `HTTP ${r.status}`;
  const v = (await r.json()).embeddings[0], n = Math.hypot(...v);
  const raw = h.b + v.reduce((s, x, i) => s + x * h.w[i], 0) / n;
  return Math.min(1, Math.max(0, (raw - h.lo) / (h.hi - h.lo))); // stretch lo..hi onto red..green
}

async function jev(post) {
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state: { post }, questions: { worth: WORTH } }),
  });
  if (!r.ok) throw `HTTP ${r.status}`;
  return (await r.json()).answers.worth.score / TOP;
}

chrome.runtime.onMessage.addListener((m, _, reply) => {
  ({ small, local, jev })[ENGINE](m.state.post)
    .then(score => reply({ score }), e => reply({ error: String(e) }));
  return true; // reply is async
});
