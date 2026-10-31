# ADR 0008: Gentle fail state: lose a leg, regrow it, never lose banked progress

- Status: Accepted. The "Losing the fourth leg" rule is amended by [ADR 0010](0010-carried-home-full-reset.md) (being carried home is a full trip reset).
- Date: 2026-10-18
- Amends: [ADR 0007](0007-kid-safety-and-privacy.md) (replaces only its "No harsh fail states" play rule; every other ADR 0007 rule stays in force)

## Context

ADR 0007 said "No harsh fail states. Challenges are optional; missing one never costs progress."

The MVP ([PRD](../prds/axolotl-mvp.md)) adds a predator, the invasive tilapia, a real Xochimilco threat, so exploring has stakes. With no fail state at all, the predator means nothing and banking has no purpose.

Harsh fail states (lives, game over, losing everything) are wrong for ages 8 to 12. Real axolotls regrow limbs, which is teachable.

The product owner asked for this: hits lose limbs that slowly regrow; losing all limbs loses the items found and returns you to the tank.

## Decision

- A tilapia hit (a lunge that connects) costs exactly one of four legs. Touching a non-lunging tilapia costs nothing.
- Leg loss shows as a sparkle poof, never gore. The lost leg shows as a faint outline and regrows after a set time, one at a time, with sparkles. The time was about 20 s when this was decided; it is now about 35 s, and the PRD (A7 and its Tuning values) holds the current value.
- After a hit there is brief protected time with no second hit. Its cue is steady and non-flashing (see [`docs/art-style-guide.md`](../art-style-guide.md)).
- Fewer legs means slower, wobblier swimming, but the axolotl can always beat currents and swim home.
- Every lunge is telegraphed (glint and wind-up) and followed by a cooldown, so hits are avoidable.
- Losing the fourth leg: the axolotl is carried home to the Home Tank in a gentle transition and arrives with four legs. Only unbanked trip finds (treasures and any rescue made this trip) are lost, and they return to their hiding spots to be found again. Amended by [ADR 0010](0010-carried-home-full-reset.md).
- Banked treasures, rescued axolotls already home, tank layout, outfits and Collection Book unlocks are never lost to gameplay. Only an explicit, confirmed "Start over" erases them.
- No lives counter, no game over, no punishing timers. The UI never says die, dead, killed or game over.
- Retained from ADR 0007: challenges stay optional and missing one never costs progress; reduced motion is respected; content is never scary or gory; regeneration is shown with sparkles.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep no fail state (predator only bumps) | No stakes, so banking is pointless. |
| Lose everything including banked items | Too harsh; punishes past play. |
| Lives and a game-over screen | Stressful and harsh for this audience. |
| Lose a random banked item | Punishes progress already earned. |
| Instant loss on the first hit | No room to learn the telegraph. |

## Consequences

- Banking becomes the core risk-versus-reward choice: carry finds home safely, or keep exploring with them at risk.
- Game rules must strictly separate unbanked trip finds from banked items, and only banked items are saved.
- The predator must stay fair: telegraphed lunges, a cooldown, and a safe Home Spot.
- Play-tests must watch for upset, especially after a leg loss or a trip home.
- [ADR 0007](0007-kid-safety-and-privacy.md) status points here for the amended play rule.
- Future enemies (for example the heron) and future habitats must follow the same rules.
