import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BASE = process.env.SN_IMAGE_GEN_BASE_URL || process.env.SN_BASE_URL || 'https://token.sensenova.ai/v1';
const KEY = process.env.SN_IMAGE_GEN_API_KEY || process.env.SN_API_KEY || process.env.SENSENOVA_API_KEY || '';
const MODEL = process.env.SN_IMAGE_GEN_MODEL || 'sensenova-u1.5-lite';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--help' || a === '-h') { console.log('node tools/sensenova-image.mjs --prompt "..." [--out .cache/sensenova/x.png] [--size 2048x2048] [--model sensenova-u1.5-lite]\nkey from env: SN_IMAGE_GEN_API_KEY > SN_API_KEY > SENSENOVA_API_KEY (never pass key on CLI)'); process.exit(0); }
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[++i] ?? '');
}
const prompt = args.get('prompt') || '';
if (!prompt) { console.error('missing --prompt "..."'); process.exit(2); }
if (!KEY) { console.error('missing API key: set $env:SN_API_KEY="sk-..." (PowerShell) or SN_IMAGE_GEN_API_KEY; key never goes in repo or CLI history'); process.exit(2); }

const SIZES_1_1 = new Set(['1344x1344', '2048x2048', '4096x4096']);
const size = args.get('size') || '2048x2048';
if (!SIZES_1_1.has(size)) { console.error(`size must be a 1:1 bucket for masters: ${[...SIZES_1_1].join(' ')} (got ${size}); downscale to 1024x1024 via the D11 PIL pipeline after`); process.exit(2); }

const body = {
  model: args.get('model') || MODEL,
  prompt,
  size,
  response_format: 'url',
  output_format: 'png',
  watermark: false,
};
const res = await fetch(`${BASE.replace(/\/$/, '')}/images/generations`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(170000),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`SenseNova ${res.status}: ${JSON.stringify(json).slice(0, 500)}`); process.exit(1); }
const item = json?.data?.[0];
const url = item?.url;
if (!url) { console.error(`no url in response: ${JSON.stringify(json).slice(0, 500)}`); process.exit(1); }
const out = resolve(args.get('out') || `.cache/sensenova/${Date.now()}.png`);
mkdirSync(dirname(out), { recursive: true });
const img = await fetch(url);
if (!img.ok) { console.error(`download ${img.status}: ${url.slice(0, 80)}... (URL expires ~24h, retry generate)`); process.exit(1); }
writeFileSync(out, Buffer.from(await img.arrayBuffer()));
console.log(out);
