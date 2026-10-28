# Creative documentation standard

**Version 1.0 · 2026-10-28 · written by UI Designer at Brian's request · applies to UI Designer and Graphics Designer (Art Lead)**

## Why this exists

The balsaPixel preview only loosely follows the creative specs (#237). Some agreed features never reached a build step at all, for example the restless bridge (#144) and the Truss ↔ Analysis transitions (#143). The cause was where the specs lived, not the code: in artifacts, prototypes and issue comments that the dev side doesn't open while it builds. This standard makes every creative decision **findable, numbered, cited by a build issue and checked in review**.

**The gap rule: a creative decision isn't done until it has (1) a rule number in the spec in the repo and (2) a build issue that cites that number.** A decision that only lives in a prototype, a chat, a board row or a comment doesn't exist for the build.

## 1. One home per area, in the repo

| Area | Owner | Spec (source of truth) | Review checklist | Reference build |
|---|---|---|---|---|
| Layout, behaviour, when and where | UI Designer | `docs/ui-spec.md` (rules `UI-…`) | `docs/ui-review-checklist.md` | Click-Through |
| Look, art, motion curves, assets | Graphics Designer | `docs/art-spec.md` (rules `ART-…`) | `docs/art-review-checklist.md` | Motion Lab |

- **The repo copy wins** over the prototype, the Claude Doc, the canvas and Drive. A prototype that disagrees with the spec is a bug in the prototype.
- **Who writes what:** each role writes only its own spec. Where the two meet, one rule points to the other instead of repeating it. For example, UI-M5 says *when* a transition plays and points to Graphics for *how it moves*.
- **A dated copy** of each version goes in the role's Drive folder (UI: [31] UI Specs; Graphics: [30] Art Assets) with a "read me first" pointing to the repo. This is for reading without GitHub.

## 2. How to write a rule

Every rule is one numbered line or table row that a reviewer can check against a screenshot or a build:

| Field | What goes in it | Example |
|---|---|---|
| ID | area prefix + group letter + number; never reuse a number | `UI-V7`, `ART-M3` |
| Rule | one sentence, present tense, no "should" | "Look from opens Side / Top / End downward." |
| On screen | what a person sees or does | "under the button, never over the cube; nothing else moves" |
| Values | numbers, colours (as tokens), timings, sizes | "≤ 0.9 s; ease-out; `--te-mem-hi` #ffe14d" |
| Source | the issue, decision or note it came from | "#33; Brian's note 2026-10-28" |
| Status | live, planned (#n), or retired | "planned #230" |

**Write for the builder:**
- numbers, not adjectives ("fades over 150 ms", not "fades quickly");
- name the states (default, hover, pressed, on, disabled, focus);
- name the off-switch and the reduced-motion version of anything that moves;
- say what never happens ("never covers the cube", "never blocks input").

## 3. How a change flows (the same for both roles)

1. **Decision.** Brian leaves a note on the prototype (Click-Through or Motion Lab) or decides on an issue.
2. **Prototype.** The owner updates the prototype so it can be clicked.
3. **Spec PR.** The owner opens a pull request that changes only its own spec files (`docs/ui*` or `docs/art*`):
   - edit or add the rule;
   - add a change-log line naming the rule numbers;
   - update the **build-step table** and the **coverage table** (§4).

   Dev Lead merges it.
4. **Issues.** Every build issue whose step is affected gets a comment naming the new or changed rule numbers. If no build issue covers a rule, open one (or ask the Project Manager to). This is the step that was missing.
5. **Board row.** "UI-… / ART-… changed: what changed, which issues." Short; the spec holds the content.
6. **Drive copy.** Save the dated copy in the role's folder.

## 4. Two tables every spec keeps at the end

- **Build steps → rules.** Each build issue and the rules it must meet. Each issue gets a comment with its list, and its PR lists the same numbers.
- **Coverage.** Any rule not yet cited by a build issue, with the issue that will cover it. An empty coverage table means nothing is waiting. The Project Manager reads both tables for the weekly all-hands and flags any rule with no issue.

## 5. Review: closing the loop

- **Author's job:** a PR that changes what users see lists the rule numbers it meets, with screenshots at 1440 × 900 and 1152 × 1062 (Brian's second monitor), plus 390 px wide for phone work.
- **Creative review:** the owning role reviews it against its checklist, rule by rule (✓ / ✗ / ?), signed with the role name. A UI PR that touches art gets both reviews.
- **The review doesn't gate merging.** Dev Lead still merges. A ✗ that ships becomes an issue citing the rule number, so it can't get lost.
- **Creative sign-off is Brian's.** He approves the look and feel. The spec and the reviews make sure what he approved is what gets built.

## 6. Prototypes are references, not specs

- The Click-Through and the Motion Lab show the rules working. They are where Brian tests and leaves notes.
- Anything that exists only in a prototype (a dial, a default, a stop rule) has to be written as a rule before it counts.
- Each prototype says which spec version it matches.

## 7. Assets

- Shipping assets (theme CSS, pictures, textures) live in the repo under `themes/`, through Graphics PRs that the Dev Lead merges after a White Hat check.
- Drive [30] Art Assets holds working files and exports.
- `docs/art-spec.md` lists each asset by file name, with the rule numbers that use it.
- Hooks the code must provide for an asset (e.g. `data-lean`, `book1`/`book2`, `woodpile.svg`) are written as rules in *both* specs: UI states the hook, Graphics states the asset.

## 8. Permissions

- **UI Designer:** may push `ui/` branches and open PRs touching only `docs/ui*` (Brian, 2026-10-28).
- **Graphics Designer:** needs the matching approval for `art/` branches touching only `docs/art*` (and `themes/` as today). That's Brian's call; until then, Graphics writes the files in Drive [30] and the Architecture Lead or Dev Lead commits them.

## Templates

**Rule row:** `| ART-M3 | The bridge sags when the books land | 0.3 s ease-out, then 2 small bounces | ≤ 0.6 s total; off with reduced motion | #146 | planned (#146) |`

**Change-log line:** `- 1.2 · 2026-11-02 · ART-M3 added (books drop), ART-M1 timing 0.4 → 0.3 s. Issues: #146, #221.`

**Board row:** `Subject: ART-M3 added, ART-M1 changed (spec v1.2). Message: books drop on new designs (#146). Rule numbers in docs/art-spec.md. #221 updated.`
