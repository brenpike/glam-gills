# Tech Stack

One-page overview of the tools behind the axolotl game and why each was picked.
Each row links to an Architecture Decision Record (ADR) in [`docs/adr/`](adr/) with the full reasoning.

Current milestone: **swim test** (one canal zone, swim controls, Tail Dash).

## Choices

| Area | Choice | Version | Why | ADR |
|---|---|---|---|---|
| Game engine | Phaser 3 | 3.90.0 | Mature 2D web engine, small bundle, fast on mobile browsers, plain TypeScript that agents can read and test. | [0001](adr/0001-game-engine-phaser-3.md) |
| Language | TypeScript | 5.9.3 (pinned `~5.9`) | Type safety for game logic; pinned below 6.1 so typescript-eslint supports it. | [0002](adr/0002-typescript-and-vite.md) |
| Build / dev server | Vite | 8.3.4 | Fast dev server with hot reload, simple static build for Pages. | [0002](adr/0002-typescript-and-vite.md) |
| Tests | Vitest | 4.1.12 | Vite-native test runner; runs pure logic headless in Node. | [0006](adr/0006-testing-strategy.md) |
| Lint | ESLint + typescript-eslint | 10.13.0 / 8.71.2 (`@eslint/js` 10.0.1) | Catches bugs and enforces the `src/logic` import boundary. | [0002](adr/0002-typescript-and-vite.md) |
| Runtime | Node.js | 20.20.2 (`.nvmrc`), engines `>=20.19.0` | Matches the dev environment; see upgrade watchlist. | [0002](adr/0002-typescript-and-vite.md) |
| Mobile wrapper | Capacitor (deferred) | not installed | Ships the same web build to iOS and Android later; web first for now. | [0003](adr/0003-capacitor-mobile-deferred.md) |
| Hosting / CI | GitHub Pages via GitHub Actions | n/a | Free static hosting; lint, test, and build on every PR and push to `main`; deploy after CI passes on `main`. | [0005](adr/0005-hosting-github-pages.md), [0027](adr/0027-ci-workflow-and-deploy-after-ci.md) |
| Art pipeline | Procedural Canvas 2D baked into Phaser textures; live axolotls are a rig of baked parts posed each frame, with a frame-time budget | n/a | Reuses the approved cartoon prototype code; vector-sourced sprite atlases later. The rig keeps axolotl drawing cheap: parts bake again only when the look, colour, outfit, legs or scale change, never per pose. | [0004](adr/0004-art-pipeline.md), [0013](adr/0013-axolotl-rig-and-frame-budget.md) |
| Kid-safety posture | No ads, chat, IAP, analytics, accounts, or third-party requests; the only request beyond loading the game is one first-party update check | n/a | Players are 8 to 12; the game must be safe and private by design. | [0007](adr/0007-kid-safety-and-privacy.md), [0009](adr/0009-update-check.md) |
| Updates | First-party `version.json` check on the title screen; one-tap reload to the new build; version shown in small text | n/a | Play-testers get the new build right after a deploy, never mid-trip, with no player data sent. | [0009](adr/0009-update-check.md) |
| Fail state | Gentle: a predator hit costs one leg that regrows; losing all four legs sends you home, loses only unbanked trip finds, and starts the snacks over | n/a | Gives exploring real stakes without punishing players aged 8 to 12; banked progress is never lost. | [0008](adr/0008-gentle-fail-state.md), [0010](adr/0010-carried-home-full-reset.md) |

Live build: <https://brenpike.github.io/glam-gills/>

## Architecture at a glance

| Folder | Role | Rules |
|---|---|---|
| `src/logic/` | Pure game rules: swim physics, steering, Tail Dash, zones, collectibles, bubbles. | No Phaser, no DOM, no imports from `src/art` or `src/scenes`. Covered by headless Vitest tests. |
| `src/art/` | Draws art with Canvas 2D (ported from the cartoon prototype) and registers it as Phaser textures. | Follows [`docs/art-style-guide.md`](art-style-guide.md). |
| `src/scenes/` | Phaser glue: scenes, input, rendering, and wiring logic to art. | Thin; game rules belong in `src/logic/`. |
| `src/platform/` | Browser glue: network, page location, and build-time constants. | Thin; not tested headless. Passes build constants into `src/logic/` as arguments. |

The boundary is enforced by an ESLint `no-restricted-imports` rule on `src/logic/**` in [`eslint.config.js`](../eslint.config.js).
It blocks `phaser`, `phaser/**`, and any `art` or `scenes` path.

Import Phaser as `import * as Phaser from 'phaser'` (the Phaser 3 ESM build has no default export).

## Upgrade watchlist

| Item | Trigger to revisit | Notes |
|---|---|---|
| Phaser 4 | After the swim test, when Phaser 4 has settled | npm `latest` is 4.2.1. Migration is planned work, not a drop-in bump. See [ADR 0001](adr/0001-game-engine-phaser-3.md). |
| Node 22 or 24 LTS | Soon: Node 20 reached end of life on 2026-04-30 | Upgrading unlocks Vitest 5 (needs Node `>=22.12`). Update `.nvmrc`, `engines`, and the CI workflow together. |
| Vitest 5 | After the Node upgrade | Blocked on Node 22+. |
| TypeScript 6 / 7 | When typescript-eslint supports it | typescript-eslint 8 supports TypeScript `<6.1`, so TypeScript stays pinned `~5.9` until then. |
| Browser end-to-end tests (Playwright) | When a headless browser is available in the dev environment | See [ADR 0006](adr/0006-testing-strategy.md). |
| Capacitor | When the game is ready for app stores | See [ADR 0003](adr/0003-capacitor-mobile-deferred.md). |
