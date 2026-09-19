# Chocolate Cupcake Agent — Phase 2

AI Learning Companion backend for Negeri Sugaria / Chocolate Abyss Gate.

## What Phase 2 provides

- Chocolate Cupcake persona
- 7 agent states:
  - welcome
  - encouraging
  - thinking
  - oops
  - teaching
  - celebrating
  - victory
- Structured JSON responses
- Adaptive hint behavior based on attempt count
- Backend API
- OpenClaw + Nemotron integration
- No frontend/game changes required yet

## Requirements

- Node.js 22+
- OpenClaw installed and working
- OpenClaw agent `main`
- Working model:
  `9router/openrouter/nvidia/nemotron-3-super-120b-a12b:free`

## Local setup

```bash
npm start
```

The API listens on:

`http://127.0.0.1:3000`

Health:

```bash
curl http://127.0.0.1:3000/health
```

## API

`POST /api/cupcake/respond`

The game sends an event plus game/question/answer context. The API asks Chocolate Cupcake for a short tutoring response.

The game engine remains the source of truth for correctness, score, level and progress.

## Test

```bash
npm start
```

Then in another terminal:

```bash
curl -s -X POST http://127.0.0.1:3000/api/cupcake/respond \
  -H "Content-Type: application/json" \
  --data @tests/welcome.json
```

More examples are in `tests/`.

## Security

Do not put OpenClaw tokens, provider keys, or VPS credentials in this repository.

The Phase 2 server binds to `127.0.0.1` intentionally. Public HTTPS exposure should be added later through a reverse proxy/API domain.
