# xworth

Tints each X post red to green by how much of your time it is worth.

![screenshot](docs/screenshot.png)

## Why

A timeline of ragebait, memes, and hot takes costs time and gives little back. xworth scores every post for usefulness to the reader and colors it, so the good posts stand out while scrolling.

The method carries over to lead scoring: an LLM judge labels a few hundred examples, then a small embedding model plus a linear head learns to copy it and runs locally for almost nothing.

## How it works

- An LLM judge scores each post 0 to 4 across five worth levels, from Waste to Great.
- Three engines: jev (TypeSafe API), local (Qwen3.5-9B on llama-server), and small (EmbeddingGemma plus a ridge head distilled from Jev scores).
- The local engine takes the expected level over the digit logprobs, so the score is smooth from 0 to 1.
- The small engine embeds the post and runs a ridge head stored in head.json.
- A score of 0 paints red, the top level paints green. Paint is keyed by post id so recycled nodes repaint correctly.
- Score levels and instructions live in config.js. Editing them means retraining the small head.

## Results

- On 45 held-out posts labelled by Claude as a reference: Spearman 0.86 (Jev), 0.82 (Qwen3.5-9B), 0.74 (small).
- The small head trained on 336 posts.
- Small engine runs at ~20 ms per post. Local engine runs at 0.1s per post.

## Stack

JavaScript, Chrome Manifest V3, Ollama EmbeddingGemma, llama.cpp Qwen3.5-9B, TypeSafe Jev API, Python

## Run it

- Copy `config.example.js` to `config.js` and pick an `ENGINE` (`small`, `local`, or `jev`).
- For `jev`, set `KEY` in config.js. For `small`, run Ollama with `embeddinggemma` and set `OLLAMA_ORIGINS=chrome-extension://*`.
- Load the folder unpacked in Chrome or Brave. Reload the extension after editing config.js.
- Rebuild the small head after editing WORTH: delete `bench/labels.jsonl` and run `python distill.py --write` from `bench/` (needs numpy, scikit-learn, scipy; expects the repo at `~/xworth`).
- Bench scripts: harvest.mjs harvests posts from handles.txt, bench.py scores, distill.py trains, score.py and parity.js check results.
- Bench data files are not included: `harvest.jsonl` (harvest.mjs rebuilds it from the public profiles in handles.txt), `labels.jsonl` (distill.py rebuilds it with Jev) and `posts.json` (the 45-post test set).
