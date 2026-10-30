# ADR 0005: Host on GitHub Pages, deployed by GitHub Actions

- Status: Accepted
- Date: 2026-10-18
- Updated: 2026-10-18. The repository was renamed from `game-test` to `glam-gills` (issue #28), so the URL and base path below changed. The decision is unchanged.
- Updated: 2026-10-26. The checks and the deploy are now two workflows; see [ADR 0027](0027-ci-workflow-and-deploy-after-ci.md).
- Updated: 2026-10-30 ([ADR 0033](0033-deploy-job-in-ci-and-docs-only-changes-skip-ci.md)). The deploy is now a job in the CI workflow, and docs-only changes skip CI.

## Context

The game is a static web build. Play-testing happens on real phones, so every change on `main` should be reachable at a stable public URL.
The dev environment is WSL2, where exposing the Vite dev server to a phone needs extra port forwarding.

## Decision

- Host on **GitHub Pages** at <https://brenpike.github.io/glam-gills/>. Pages is set to build type "workflow" (GitHub Actions).
- One workflow, [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):
  - its check job runs lint, tests, and build on every pull request and every push to `main` that changes more than docs;
  - its deploy job publishes the checked `dist/` to Pages on a push to `main`, or on a manual run on `main`.
- The repository is **public** (required for free Pages).
- Vite builds with base path `/glam-gills/` to match the Pages URL.

## Alternatives considered

| Option | Why not |
|---|---|
| Netlify, Vercel, or Cloudflare Pages | Another account and service to manage; GitHub Pages is enough for a static game. |
| itch.io | Good for later public release; manual uploads slow down play-testing. |
| Phone testing only via the local dev server | Fragile on WSL2 (port forwarding); Pages works from any network. |

## Consequences

- Every merge to `main` that changes more than docs updates the live build for phone play-testing.
- Broken lint, tests, or build block the PR before it can deploy.
- The source code is public. Nothing secret may be committed.
- Asset and route URLs must respect the `/glam-gills/` base path.
