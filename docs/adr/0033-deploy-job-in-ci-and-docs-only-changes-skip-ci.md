# ADR 0033: The deploy is a job in CI, and docs-only changes skip CI

- Status: Accepted
- Date: 2026-10-30
- Related: [ADR 0005](0005-hosting-github-pages.md) (hosting on GitHub Pages), [ADR 0009](0009-update-check.md) (build ID), [ADR 0027](0027-ci-workflow-and-deploy-after-ci.md) (the CI and deploy split this replaces)

## Context

Docs-only changes (`docs/**` and root `*.md` files) do not need lint, tests or a build. The owner wants CI to skip them. The owner also wants two things to hold:

- A code change never loses its deploy.
- Code that did not pass its checks never deploys.

[ADR 0027](0027-ci-workflow-and-deploy-after-ci.md) split CI and the deploy into two workflows linked by `workflow_run`. The deploy ran only if its CI run's commit was still the head of `main`. That key was one run's commit SHA, used by another run. Two review rounds on PR #192 showed the same flaw:

- A `paths` filter on `push` meant a docs push started no CI run. The code push before it was no longer the head, so it skipped its deploy, and nothing deployed it. The code deploy was lost.
- A per-push "docs only" skip, based on the files between `before` and `sha`, ran no checks for a docs push. After a failed or still-running code push, that docs push deployed code nobody had checked.

Both come from one root cause. A commit identity shared across runs was the key for "this code was checked and can deploy". The class to remove: a deploy ships a tree its own checks did not pass, or the deploy is lost because another run's SHA moved.

## Decision

**One workflow.** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), named "CI", does the checks and the deploy. `deploy-pages.yml`, the `workflow_run` hand-off, the `dist` artifact upload and download, the `git ls-remote` head check and the `queue: max` group are gone. So is the per-push docs-only scope step added earlier in this PR.

**Triggers.**

- `pull_request` and `push` to `main` share one `paths-ignore` list, written once with a YAML anchor: `docs/**` and `*.md` (root `.md` files only).
- `workflow_dispatch` has no filter.

**Concurrency.** The workflow group is `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: false`. Runs on `main` go one at a time, and a newer pending run replaces an older pending one. GitHub does not guarantee the order of runs within a group (see Consequences).

**Job `check`, "Lint, test and build".** It runs `npm ci`, lint, tests and build on every run, with no condition. On a non-PR run on `main` it also runs `actions/configure-pages` and `actions/upload-pages-artifact` on `dist`.

**Job `deploy`, "Deploy to GitHub Pages".**

- `needs: check`, so it runs only after the check job succeeds.
- It runs on a non-PR run on `main` only.
- Permissions: `pages: write` and `id-token: write`. Environment: `github-pages`. It uses `actions/deploy-pages`.
- It ships only the artifact its own run checked. No other run's commit decides anything.

**Action versions.** The owner decision in ADR 0027 stands: every action stays on its GitHub-published major version tag, not a commit SHA.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the SHA head check and add a `paths` filter on `push` | A docs push starts no run, so the code push before it is no longer the head and skips its deploy. The deploy is lost (round 1). |
| Keep the SHA head check, run on every push, skip checks per push with a docs-only scope step | A docs push after a failed or in-flight code push has no checks of its own and deploys unchecked code (round 2). |
| Key the head check on the non-docs tree, with a second path list in git pathspec syntax | The two lists can drift apart, and drift brings back both failures. |
| `queue: max` on the deploy group | Every waiting build deploys, though only the newest matters. |
| An 11-entry "run" `paths` list instead of the 2-entry `paths-ignore` | A build input missing from the list would not deploy. With `paths-ignore`, a new file is checked and deployed by default. |
| A newest-code-commit check before the deploy | It closes the ordering gap, but it needs a second copy of the docs list, in git pathspec form, in `ci.yml`. The owner rejected it as not worth it. |

## Consequences

- Recorded trade-off (owner decision, 2026-10-30, PR #192 review thread [r4429269599](https://github.com/brenpike/glam-gills/pull/192#discussion_r4429269599)): GitHub does not guarantee run order within a concurrency group, so two code pushes to `main` seconds apart can deploy out of order. An older checked build can then stay live until the next code push to `main` or a manual CI run on `main`. It is never unchecked code, and no deploy is lost.
- Re-running a superseded run on `main` by hand redeploys an older but checked build. Fix it by re-running the newest run, or by a manual CI run on `main`.
- Pages can lag `main` when the newest run fails. It never ships unchecked code.
- A docs push to `main` starts no run, so the build ID stays on the last code commit ([ADR 0009](0009-update-check.md)). Players get no false update prompt.
- A manual deploy is now CI, then Run workflow, on `main`.
- The "Deploy to GitHub Pages" workflow and the 7-day `dist` artifact are gone.
- A pull request shows the deploy job as skipped.
- If "Lint, test and build" is ever made a required check, a docs-only pull request waits on a check that never starts. Revisit the filter before turning it on.
- The deploy job is proven only by the first run on `main` after this merges.
- The `github-pages` environment's deployment branch rule is the guard against a deploy from a branch other than `main`. The owner confirms it allows only `main`.
