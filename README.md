# warbag

Personal site, app launcher and shared tools at [warbag.rodeo](https://warbag.rodeo).

- Rules: [CLAUDE.md](CLAUDE.md) · Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
- Next: [ROADMAP.md](ROADMAP.md) · Now: [STATUS.md](STATUS.md)
- Look: [docs/DESIGN.md](docs/DESIGN.md) · Words: [docs/LANGUAGE.md](docs/LANGUAGE.md)

Going live: [SETUP.md](SETUP.md)

## Develop

Needs Node 22 and any Postgres. Copy `.env.example` to `.env.local` and fill it in.

```bash
npm install
npm run migrate
npm run dev
```

Sign-in codes print in the dev server's terminal when Resend isn't configured.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`, then with a throwaway database (the tests wipe it):

```bash
TEST_DATABASE_URL=postgres://... npm test
TEST_DATABASE_URL=postgres://... npm run test:e2e
```
