# ADR 0027: A CI workflow checks every PR and push, and Pages deploys only after CI passes on main

- Status: Accepted
- Date: 2026-10-26
- Related: [ADR 0005](0005-hosting-github-pages.md) (hosting on GitHub Pages), [ADR 0009](0009-update-check.md) (build ID)

## Context

Issue #144 asks to split the build and test check from the deploy.
Today one workflow, `.github/workflows/deploy-pages.yml` ("Deploy to GitHub Pages"), runs `npm ci`, lint, tests and build on pull requests, pushes to `main` and manual runs, then deploys on a push to `main`.
So the tests already gate the deploy, but a pull request's check shows up as "Deploy to GitHub Pages", and `main` has no branch protection, so no check is required before a merge.

## Decision

**A CI workflow.** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), named "CI":

- Triggers: `pull_request` to `main`, `push` to `main` and `workflow_dispatch`.
- One job, `Lint, test and build`: checkout, setup-node from `.nvmrc` with the npm cache, `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- `permissions: contents: read`. It never deploys.
- On a push only, it uploads `dist` as the `dist` artifact with `actions/upload-artifact`, kept for 7 days, and fails if `dist` is empty. A pull request run uploads nothing.
- No concurrency group.

**A deploy after CI.** [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml), still named "Deploy to GitHub Pages":

- Triggers: `workflow_run` on "CI", type `completed`, branch `main`; and `workflow_dispatch`. There is no `pull_request` trigger.
- It runs from a CI run only when that run's conclusion is `success`, its event was `push` and its branch is `main`. A manual run builds from any branch, but it deploys only from `main`.
- After CI, it downloads CI's `dist` artifact from the triggering run with `actions/download-artifact` (`run-id` of that run and the workflow token), so the deployed files are the tested files. It does not check out or build.
- A manual run has no CI run to take a build from. It checks out the dispatched commit, runs `npm ci`, lint, tests and build, and deploys that build.
- Before deploying, it checks that the commit being deployed is still the head of `main`: `github.event.workflow_run.head_sha` after CI, `github.sha` for a manual run. A newer head skips the deploy, because the run for the newer commit deploys. If the head cannot be read, it warns and deploys anyway.
- The deploy job keeps the `pages` concurrency group (no cancelling in progress) and the `github-pages` environment.
- Permissions: `contents: read` for the workflow. The build job has `contents: read` and `actions: read` (to download another run's artifact). The deploy job has `pages: write` and `id-token: write`.

**Named defaults.** Issue #144 had no owner reply when this was built, so these build choices were posted on the issue as defaults, each open to change:

- **ND-1 Reuse CI's build** (the issue's default). CI uploads `dist` on a push to `main` only, kept for 7 days, and the deploy downloads it from the triggering run, then runs `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`. The new actions use their current majors, `upload-artifact@v7` and `download-artifact@v8`; checkout, setup-node, configure-pages, upload-pages-artifact and deploy-pages stay on the versions already in use.
- **ND-2 Manual deploy.** A `workflow_dispatch` run checks out the dispatched commit, runs `npm ci`, lint, tests and build, and deploys that build. `GITHUB_SHA` is that commit there, so the build ID is right.
- **ND-3 Head check.** The "still the head of main" check compares the commit being deployed: `head_sha` after CI, `github.sha` for a manual run. Its warnings and its skip are unchanged.
- **ND-4 Check name.** CI has one job, `Lint, test and build`, shown on a pull request as "CI / Lint, test and build".
- **ND-5 Required check: yes** (the issue's default). The owner turns it on after the change merges.
- **ND-6 No concurrency group in CI.** The deploy keeps its `pages` group.
- **ND-7 Docs.** AGENTS.md, README, the tech-stack "Hosting / CI" row and [ADR 0005](0005-hosting-github-pages.md) say CI checks every pull request and push to `main`, and Pages deploys after CI passes on `main`. This ADR records the split.

## Alternatives considered

| Option | Why not |
|---|---|
| Rebuild from `head_sha` in the deploy | The deployed files would be a second build, not the tested one. It also repeats `npm ci` and the build on every deploy. |
| Keep one workflow | Pull request checks keep showing as "Deploy to GitHub Pages", and the check to require on `main` is a deploy workflow's job. |
| Deploy on `push` with no link to CI | The deploy could run before CI finishes, or after CI fails, unless it repeats every check itself. |

## Consequences

- The owner turns on branch protection for `main` and requires the check "Lint, test and build" (shown on a pull request as "CI / Lint, test and build"). Until then, nothing blocks a merge with a failing check.
- Under `workflow_run`, `GITHUB_SHA` is the latest commit on the default branch, not the commit CI tested. So the deploy never rebuilds after CI, and the head check uses `head_sha`. The build ID stays the tested commit's first 12 characters, because CI's push build stamps it ([ADR 0009](0009-update-check.md)).
- A `workflow_run` workflow runs from the default branch's copy of the file, so the new deploy is proven only after this change merges to `main`.
- CI's `dist` artifact is kept for 7 days. Re-running a deploy for a CI run older than that fails, because the artifact is gone; a manual deploy is the fallback.
- A failed CI on `main` deploys nothing and leaves the live build as it was.
