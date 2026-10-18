// 'small' = EmbeddingGemma + head.json distilled from Jev (~20 ms/post, 621 MB; held-out 0.74).
// 'local' = Qwen3.5-9B on void-llm.service (0.1s/post, ~6 GB VRAM; 0.82). 'jev' = TypeSafe API (0.86).
const ENGINE = 'small';

// TypeSafe key, only used when ENGINE is 'jev' (copied from ~/.config/typesafe/env). Never commit this file.
const KEY = ''; // TypeSafe API key, only for ENGINE 'jev'

// What "worth my time" means. Edit the levels, then reload the extension.
// 'small' engine learned the old levels: after editing, delete bench/labels.jsonl and run
// `cd ~/xworth/bench && ~/.local/share/void/venv/bin/python distill.py --write` (re-labels with Jev).
// Score 0 paints red, the top level paints green.
const WORTH = {
  type: 'score',
  instructions: 'How much of the reader\'s time this X post is worth. The reader is a ' +
    'solo freelancer building AI automations and RevOps systems for clients, who also ' +
    'grows a YouTube Shorts channel.',
  criteria: [
    'Waste: ragebait, drama, politics, memes, engagement bait, flexing',
    'Low: a hot take or vague opinion, nothing to learn or act on',
    'Some: a real point or news, mildly useful',
    'Good: a concrete tool, method, number or lesson worth knowing',
    'Great: directly usable today for building AI automations, landing clients or growing a channel',
  ],
};
