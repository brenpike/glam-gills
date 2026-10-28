# Plan: Spring cave Area 7 (issue #105)

Repo: brenpike/glam-gills. Written 2026-10-28, when main was at 1b27809 (0.52.0, live, build 1b27809c8dd8), just after #77 (Area 6, PR #180) merged.

## Where things stand

- Brood 3 is done. #140 (PR #179, test-only, no bump) and #77 (PR #180, 0.52.0) are merged and cleaned up. No strain worktrees or tmux sessions are left. The owner's local hatchery run ledger for Brood 3 is at `hatchery_monitor`.
- Area 6 (#77) shipped:
  - the spring cave habitat (`spring-cave`), its look and its music cue (Cenote Glow, sounds in D);
  - support for areas of more than 2 rows (ADR 0028);
  - the crayfish;
  - the dark water and glow-plants puzzle element;
  - two new moving hazard types, the stalactite drip and the geyser vent (owner's ND-3 answer: option B);
  - a per-area stranding chance;
  - 12 treasures, and fact cards "Meet the crayfish", "Stalactites" and "Geysers".
  - Its named defaults are PRD open questions 506 to 525, all provisional except ND-3. They are listed in the late comment on #77 (2026-10-28) and in PR #180's body.
- Next free numbers on main: ADR 0029 and PRD open question 526. Check again before planning.
- #105's label is still `readiness:blocked`. The issue's own rule says it becomes `readiness:ready` once #77 merges, which has now happened.

## The next area: #105, Spring cave Area 7, the pulsing current and the pebble

The source of truth is `gh issue view 105 --comments`: the body plus six owner comments from 2026-10-22 to 2026-10-24. In summary:

- **Owner interrogation (2026-10-22), planning done:**
  - The pulsing current is the area's one new hazard. It pushes but never costs a leg. Cycle: calm 2.5 s, a 0.8 s warning, then a 1.5 s surge. 3 vents, with the calm time falling 2.5 s, 2.2 s, 2.0 s along the route. A surge never pushes the axolotl into a crayfish's reach, a dead end or a wall.
  - Carried forward from Area 6: 3 crayfish, one ladder step up (1.6 s cooldown, patrol 65), and a small dark stretch with 3 glow-plants.
  - The pebble is the area's one puzzle element. It rolls one way along a fixed groove, resets each trip, and opens an optional side path holding the special treasure and an Epic spot. Hint: after 10 s near the pebble, an arrow shows which way to push.
  - About 8 x 2 screens. 40 snacks (the first split was 22 worms and 18 bugs). 12 treasure slots. A stranded axolotl on 30% of trips.
  - 12 new treasures, with the Ancient clay pot as the Rare special treasure and Chocolate as the Dream colour.
  - Fact card "Underwater springs".
- **Level layout ladder (2026-10-22):** more branching routes, dead ends that hold treasure, and tighter gaps than Area 6, while staying beatable with one leg.
- **Shape (2026-10-22):** a climb. Start at the bottom, ride up past the vents, exit at the top.
- **Danger bar (2026-10-23):** about one moving threat per screen, at least 2 predator types, at least 1 moving hazard type that costs a leg, and every predator chasing.
- **Snack ramp (2026-10-23):** the mobile share is above Area 5's 60%, up to about 70%. This replaces the first worm and bug split.
- **Whole-water rules (2026-10-24):** the depth bands; floor predators wherever there is surface danger; about 5 carp for 16 screens; no quiet swim longer than 480 px, up-and-down swims included; tadpoles and shrimp keep moving. Each pulsing current's whole band counts as a current, so no snack home is ever in it.

## Gaps to settle in planning

These are not owner decisions yet. Cerebrate should make each one a named default, and ask the owner where it changes an owner decision.

1. **The moving hazard.** The pulsing current costs no leg, so it does not count toward the danger bar's moving hazard rule. Default: carry Area 6's stalactite drips and/or geyser vents forward within the habitat. This is the same "carried within the habitat" pattern the owner used for the crayfish and glow-plants, so no new type is needed. Ask the owner, as #77's ND-3 did.
2. **Predators.** 2 types: the crayfish and the carp, about 5 carp, with no tilapia. Area 6 needed 6 carp to pass the whole-water test, so 2 rows may need more. Stop and ask above 7.
3. **The climb.** Area 7 is 8 x 2 and climbs: the start is at the bottom and the exit at the top. The safe area and the Home Spot sit at the bottom start, the reverse of a descent. Check that the area framework and the shape test from ADR 0028 support a climb.
4. **The dark stretch.** It reuses Area 6's dark water and glow-plants. It must not hide what Area 6's rules say darkness never hides.
5. **The pulsing current.** It is a new kind of current with a cycle. Its pure rules, tests and "always finishable" proofs, plus the surge push-back rule (never into a crayfish's reach, a dead end or a wall).
6. **The pebble.** A new puzzle element kind beside the glow-plants. The main route never depends on it.
7. **Music and sounds.** Area 7 uses the existing spring cave cue (no new cue under M3). Sounds: decide whether the vent warning and the pebble roll get sounds or stay silent. The sound guide needs a row either way (S2), and any new sound must be sketched and measured first.
8. **Records.** The PRD (N2 row 7, "Area 7 as built", a danger pass paragraph, N3 rows, B5, B6, the Tuning values, and new open questions from 526), CONTEXT.md (Pulsing current, Pebble, naming no area anew per ADR 0022), the art guide, the CHANGELOG, and a minor bump (expect 0.53.0). An ADR only if a shared rule changes.

## Delivery shape

- A brood of at most 2 strains (owner limit: laptop hardware). #105 is large, as #77 was, so it can run alone or with one small separate strain.
- Owner process rules: all of them are still binding. They are in [Owner process rules](../handoffs/spring-cave-area-7.md#owner-process-rules). In short:
  - no AI attribution;
  - the owner merges;
  - show the full strain texts verbatim and spawn only after approval;
  - Codex local review on the default model at reasoning effort high;
  - the light-path block and the pause-and-ask rule at the top of every strain;
  - the 6-step cleanup after each merge.
- The strain text format follows Brood 3's approved texts, including the exact-PR-title rule. The format is summarised in [Strain text preamble](../handoffs/spring-cave-area-7.md#strain-text-preamble).

## Lessons from Brood 3 to bake into the next strain texts

- **Post the named defaults first.** #77's strain posted its named defaults on the issue after building, not before, and apologised for it. The strain text should make posting them, and asking the moving-hazard question, the first thing it does before any build step.
- **PR titles and bodies.** The workflow builds the PR title from the plan summary and the body from its own logs (hivemind #469, #470). Until those ship, the strain must set the title and body with `gh pr edit` after the PR opens, and check them before calling the PR ready.
- **One-commit PRs.** With a single commit, GitHub's squash title is that commit's subject, not the PR title. The commit subject must match the intended title too.
- **Remote control.** The spawn can report remote control as applied when `/rc` never ran (hivemind #470). Check that each strain's remote control link actually exists after the spawn. Never send Escape to a strain's session, since it interrupts the strain's turn.
