# ADR 0045: Fact card sources live in the PRD

- Status: Accepted
- Date: 2026-11-06
- Amends: [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) (in part: ND-23's two records of a card's sources and owner checks, one in `src/logic/factCards.ts` and one in PRD C13; every other ADR 0020 rule stays in force), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (in part: its source-comment consequence), [ADR 0035](0035-deep-canal-moving-hazards-anchor-drop-and-mud-seep.md) (in part: its source-comment consequence)
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the fact cards true), [ADR 0033](0033-deploy-job-in-ci-and-docs-only-changes-skip-ci.md) (docs-only changes start no CI run)

This ADR records the build choice for issue #217: where a fact card's sources and owner checks are kept.

## Context

ADR 0020 (ND-23) had each fact card's sources and owner checks kept by hand in two places: the card's JSDoc in `src/logic/factCards.ts` and the card's paragraph in PRD C13 (C14 for some cards). The two copies drifted. Issue #217's local review found it on the heron card. The geyser card was the same: its PRD sources still described hot geysers while the card and the code described cold ones.

## Decision

**The card's PRD paragraph is the one record.** The card's paragraph in PRD C13 (C14 for "Boy or girl?", "Axolotl refuges" and "Canal clean-ups") is the only record of its sources, quotes, check dates, game's-rule notes and owner checks.

**The JSDoc points to it.** The card's JSDoc in `src/logic/factCards.ts` names the card, says when it shows and gives its PRD ID, then points to the PRD. It holds no sources, quotes, dates or checks.

**New cards and source fixes edit only the PRD.** Adding a card adds its PRD paragraph and a short JSDoc. Fixing a source edits the PRD paragraph and nothing else.

## Consequences

- The two copies can no longer drift, because there is one.
- A source-only fix becomes a docs-only change. It is a no-bump path under AGENTS.md, and it starts no CI run under ADR 0033.
- The PRD open-question rows stay the decision log: they record what the owner decided and when, as before.
- No lint enforces the rule. AGENTS.md states it.
- A card added on a branch cut before this ADR keeps the old two-copy form until the branch meets it, and must be converted then.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep both copies and check them by hand | The copies already drifted. A hand check is what failed. |
| Keep the sources in the JSDoc only | A source fix would change `src/**`, which needs a version bump and a CI run, and the owner reads the PRD for checks. |
| A lint or test that compares the two copies | The prose differs by design, and a comparison of free text would be fragile for a small gain. One record needs no comparison. |
