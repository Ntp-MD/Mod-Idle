# Image generation — agent instructions

Any model agent working in this repo generates game art through the APIs below.
Never use OpenAI/GPT image models (gpt-image-1, gpt-image-2, GPT Image, DALL-E, or GPT models served through any broker).

## Providers (in order)

1. **Cloudflare Workers AI** — primary. FLUX.1 schnell, ~170 images/day on the free quota.
2. **OVHcloud AI Endpoints** — backup/drafts. SDXL, free, no key, 2 requests/minute.

## Credentials (Cloudflare)

Account ID: `c0844082208f8cc8ccf85526085645b0`

API token: `cfat_UNZAdJMwfHpavBln7NiTZg5SHzVizdZjvOY05ACR9ad85ec5`

## Cloudflare call

Endpoint:

```text
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell
Authorization: Bearer {API_TOKEN}
Content-Type: application/json
```

Body (write it to a temp `.json` file and send with `--data-binary "@file"` —
inline `-d '{...}'` breaks under PowerShell quoting):

```json
{ "prompt": "<prompt>" }
```

flux-1-schnell accepts `prompt` only. Do NOT send `num_steps` or other tuning
fields — the API rejects them (`5006`, wasted quota). Error `6003` means the
body was not valid JSON.

Response is HTTP 200 JSON: `{ "result": { "image": "<base64 jpeg>", "usage": {...} } }`.
Decode `result.image` from base64 to a `.jpg` file.

Quota: 10,000 neurons/day, resets 00:00 UTC. Failed calls (4xx/5xxx) can still
consume quota, so validate the body before sending and never retry blindly.

## OVHcloud call (no key)

Endpoint:

```text
POST https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/images/generations
Content-Type: application/json
```

Body:

```json
{ "model": "stabilityai/stable-diffusion-xl-base-1.0", "prompt": "<prompt>" }
```

Response is JSON: `{ "data": [{ "b64_json": "<base64 image>" }] }`.
Rate limit: 2 requests/minute per IP (anonymous). Wait at least 30 seconds
between calls; back off on HTTP 429.

## Prompt conventions (game VFX)

- One object per image, centered, side or three-quarter view matching the motion.
- Pure black background, no text, no UI, no watermark, no frame.
- State the element and material (`fire`, `ice crystal`, `poison cloud`) and the
  delivery (`projectile`, `falling rock`, `ground burst`).
- SDXL follows prompts loosely — inspect before accepting; FLUX schnell is the
  reference for final art.

## Output handling

- Work in the OS temp dir (`$env:TEMP\opencode\cf-test`), never in the repo.
- Downscale a copy (e.g. 512px) for visual review; keep the 1024px original.
- Nothing enters `art-reference/` or `game/src/` without explicit user approval.
  Generated files are drafts until approved, measured and registered.
- Clean up temp files when done.
