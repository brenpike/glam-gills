# Agent Instructions

Instructions for AI coding agents working in this repository.

## Overview

`Glam Gills: Find Your Flair` (repo `glam-gills`) is a 2D axolotl web game for kids aged 8 to 12, built with Phaser 3, TypeScript, and Vite.
Current milestone: the swim test. See [`README.md`](README.md) for scripts and controls, and [`docs/tech-stack.md`](docs/tech-stack.md) for stack choices.

Node `>=20.19.0` (`.nvmrc` pins 20.20.2).

## Validation commands

Run-level gate, in this order:

```sh
npm run lint
npm test
npm run build
```

`npm run build` runs `tsc --noEmit && vite build`.

## Worker self-checks

Scope checks to the files you changed:

| Check | Command |
|---|---|
| Lint one file | `npx eslint <file>` |
| Run one test file | `npx vitest run <test file>` |
| Type-check | `npx tsc --noEmit` |

Markdown-only changes have no self-check.

## Rules

- `src/logic/` must stay pure: no imports from `phaser`, no DOM APIs, no imports from `src/art/` or `src/scenes/`. ESLint enforces the import part.
- Put game rules in `src/logic/` with `*.test.ts` tests next to them. Keep `src/scenes/` thin.
- Import Phaser as `import * as Phaser from 'phaser'`. The Phaser 3 ESM build has no default export.
- Stay on Phaser 3. Do not upgrade to Phaser 4 unless asked.
- Art follows [`docs/art-style-guide.md`](docs/art-style-guide.md).
- Requirements live in the PRD, [`docs/prds/axolotl-mvp.md`](docs/prds/axolotl-mvp.md). Any requirement change updates the PRD in the same PR. Issues link to PRD IDs (such as B4) instead of restating requirements.
- `src/platform/` holds browser glue: network, page location, text entry, device storage, and build-time constants. Build-time constants (`__APP_VERSION__`, `__BUILD_ID__`) never appear in `src/logic/`; pass them in as arguments.
- Do not add dependencies except in a planned scaffold step.
- No ads, chat, in-app purchases, analytics, accounts, or network requests (including CDNs and webfonts). See [ADR 0007](docs/adr/0007-kid-safety-and-privacy.md). The one exception is the first-party update check in [ADR 0009](docs/adr/0009-update-check.md).

## Versioning

| Item | Value |
|---|---|
| Artifact | One: the `glam-gills` web app |
| Canonical version | `"version"` in `package.json` |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog) |
| Tags | Not created yet |

Bump-trigger paths (a change here needs a version bump):

- `src/**`, except `*.test.ts`
- `index.html`
- `public/**`
- `vite.config.ts`
- `dependencies` in `package.json`

No-bump paths:

- `docs/**`
- `*.md`
- `.github/**`
- `*.test.ts`
- `eslint.config.js`
- `vitest.config.ts`

## Deploy

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, tests and build on PRs and pushes to `main`, unless every changed file is under `docs/` or is a root `*.md` file. Such changes start no run and deploy nothing. On a push to `main`, or a manual CI run (`workflow_dispatch`) on `main`, the same run's deploy job deploys that run's build after the checks pass. Runs on `main` go one at a time. See [ADR 0033](docs/adr/0033-deploy-job-in-ci-and-docs-only-changes-skip-ci.md).
Live URL: <https://brenpike.github.io/glam-gills/>. Vite builds with base path `/glam-gills/`.

## Decisions

Architecture Decision Records live in [`docs/adr/`](docs/adr/).
Add a new numbered ADR (next number, same format) for any significant decision: engine, tooling, dependencies, hosting, data, or safety rules.
