# Daily Recall

[English](README.md) · [中文说明](README.zh-CN.md)

**Five questions a day about your own life. See how much you actually remember.**

<p align="center">
  <img src="docs/screenshots/question.png" width="30%" alt="Answering a question">
  <img src="docs/screenshots/result.png" width="30%" alt="Session result with a cross-day check">
  <img src="docs/screenshots/review.png" width="30%" alt="Reconciling conflicting memories">
</p>

Most memory apps test you on flashcards of things you *want* to remember. Daily Recall asks
about **yesterday** — what you ate, whether you went out, who you talked to — and then asks
about the same day again a few days later.

That second ask is the whole point:

| When it's asked | Question shown | The day being asked about |
|---|---|---|
| Sep 21 | Did you go out **yesterday**? | Sep 20 |
| Sep 22 | Did you go out **the day before yesterday**? | Sep 20 |
| Sep 27 | Did you go out **a week ago**? | Sep 20 |

Three different asks about one day. When the answers disagree, that's not a quiz score —
that's evidence about how your memory actually drifts.

## What makes it different

- **Cross-day consistency checks.** Answer "yes" on Tuesday and "no" on Wednesday about the
  same Monday, and the app flags it. Original answers are *never* overwritten — the fact
  that you got it wrong the first time is the most valuable data point you have.
- **Three kinds of disagreement, not one.** Contradicting *facts* is an error. Forgetting
  something you used to recall (remembered → forgot) is normal decay, and should be plotted,
  not flagged. Recalling something *better* much later (forgot → remembered) is the
  suspicious one — that's usually confabulation.
- **Fact answers double as a diary.** Months in, you have an automatically written record of
  what you ate and where you went — as a side effect of practising.
- **Local-first, zero backend.** No account, no server, no tracking. Everything lives in your
  browser's `localStorage`. Export/import is one click.
- **Anchor questions.** A few questions per session aren't scored at all — they're hooks.
  "Did it rain?" doesn't evaluate you; it drags the rest of the day back into view.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Or run the static build in Docker:

```bash
docker compose up -d --build     # http://localhost:4470
```

The app compiles to a fully static site (`out/`), so any static host works — GitHub Pages,
Cloudflare Pages, Netlify, or a plain nginx. No server-side code, no database.

### Useful commands

```bash
npm run questions:build   # compile questions/*.yaml → src/generated/questions.json
npm test                  # unit tests + question bank validation
npm run typecheck
npm run build
```

## Three ways to run it

Same codebase, configured into one of three shapes. **Leaving everything blank works** —
that's the local-only mode described above.

| Mode | How to enable | What you get |
|---|---|---|
| Local only | default | Everything in the browser. No account, no database |
| Local + account | set `DATABASE_URL` | Email/password or OIDC sign-in, sync, question feedback |
| Partial | `AUTH_ENABLED=false` etc. | e.g. feedback without accounts, or the reverse |

```bash
cp .env.example .env    # optional: every value can stay empty
docker compose up -d --build
```

### Bring your own identity provider

Any standard OIDC provider works (Authentik, Keycloak, Auth0, Google) — three variables:

```bash
PUBLIC_URL=https://memory.example.com
OIDC_ISSUER=https://auth.example.com/application/o/memory/
OIDC_CLIENT_ID=xxxxxxxx
OIDC_CLIENT_SECRET=xxxxxxxx
```

Register `https://memory.example.com/api/auth/oidc/callback` as the redirect URI.
If your provider manages permissions through groups, put the admin group name in
`ADMIN_GROUPS` and those users get the question-management page.

### Where the data lives

The browser is always the first copy: offline, logged out, or database down — you keep
answering. The database is a second copy. Syncing is just a set union, because answers are
immutable and carry UUIDs, so there is no field-level conflict to resolve. With no database
configured, none of that machinery runs and behaviour is exactly the original version.

## How it works

```
questions/*.yaml        the question bank — the actual product, community-editable
src/lib/date.ts         anchors questions to a target date ("yesterday" → 2026-09-20)
src/lib/pick.ts         session assembly: fresh questions + a few repeats + anchors
src/lib/drift.ts        cross-day consistency detection
src/lib/scoring.ts      offset-weighted recall coverage
src/lib/storage.ts      localStorage persistence, export/import
```

Everything under `src/lib/` is plain TypeScript with no framework dependencies and has unit
tests. If you want to reuse the logic somewhere else, that's the part to take.

### Scoring, briefly

Recall coverage is not plain accuracy. Remembering something from 30 days ago counts for
more than remembering yesterday, and a 10-question perfect run isn't the same as a
5-question one. See `offsetWeight()` in `src/lib/scoring.ts`.

## Contributing questions

The question bank is the most valuable part of this project, and the easiest thing to
contribute. Start with **[docs/question-guide.md](docs/question-guide.md)** — it explains
what makes a question work (and the many ways to write a bad one) — then add entries to
`questions/zh-CN.yaml` and run `npm test`.

Three rules that the test suite enforces:

1. Options must be exhaustive and mutually exclusive — the user never types an answer.
2. Every `fact` question needs a `forgot` option. No exit hatch means people guess, and
   guesses are dirtier data than honest "I don't remember".
3. IDs are language-independent and stable. Translating a question must never change its ID.

## Translations

The UI has a string table for `zh-CN` and `en`, and the bank format is locale-aware. An
English question bank (`questions/en.yaml`) is very welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Status

v2 adds an optional server: accounts, cloud sync, and question feedback. All three are behind
config flags, and with them off you get the original local-first experience. For pure static
hosting (GitHub Pages etc.), use the `v1.0.0` tag.

## License

[MIT](LICENSE)
