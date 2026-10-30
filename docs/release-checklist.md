# Release checklist (publishing step 0)

**Owner:** QA and Accessibility. **Rule:** Standing Instructions 4c, step 0.

Before every publish, whoever publishes ticks every item for that line:

- **M**: the live page, built from a tag on `main` (v62, v63 …).
- **B**: the balsaPixel preview, built from the head of `balsaPixel-1.0`.

A failed item (✗) stops the publish until it's fixed or Brian overrides. Removing or weakening an item is Brian's call (A4).

Steps 1–6 of rule 4c come after this list and aren't repeated here: check out the commit, build, LIVE SWEEP, publish, read back and compare, then record.

**How to record it:** paste the block at the end of this file into the release notes (live) or the "in the preview" comment (preview). Mark each item ✓, ✗ or n/a, and add a few words for each ✗ or n/a.

## Every publish

| # | Check | How | M | B |
|---|---|---|:-:|:-:|
| 1 | **Right line, right commit** | M: a `vNN` tag on `main`. B: the head of `balsaPixel-1.0`. An M build never says "balsaPixel"; a B build always does (page and saved files). | ✓ | ✓ |
| 2 | **The version shows** | The page, a freshly saved bridge file and the tag all give the same release name. `APP_VER` was bumped if the solver or row format changed. | ✓ | ✓ |
| 3 | **Local run matches CI** | Rebase on the target branch, then `CI=1 bash tests/run_all.sh` with Node 22, Python 3.12 and the pinned tools (`npm ci`, `tests/requirements.txt`). Result is ALL GREEN, and every KNOWN line names an open issue. | ✓ | ✓ |
| 4 | **Yesterday's work survives** | Open the new build in a browser that already has saved work. The last bridge and sweep come back, and ☰ → Go back to an earlier version lists the backups. | ✓ | ✓ |
| 5 | **Partner round trip** | Save the team's bridge file (3D, with its build-document settings) and open it in a private window. It shows the same 2D/3D choice, the same wood and the same build-document summary line. | ✓ | ✓ |
| 6 | **Starter bridge and presets pass** | The default bridge and every preset pass in 2D and in 3D. v62 baseline: starter 3616 mm, 18.6 kg (2D) and 5153 mm (3D). | ✓ | ✓ |
| 7 | **Works inside claude.ai** | On the published artifact (not a local file), one save of each kind downloads and the name pop-up is on top. Light and dark modes are both readable. | ✓ | ✓ |
| 8 | **Phone width** | At 390 px wide, portrait: no sideways scroll, ☰ can be reached, and build documents download. | ✓ | ✓ |
| 9 | **Keyboard, 5 minutes** | By keyboard alone: Tab to ☰ → Build documents → Download. Esc closes the dialog. Save bridge file works with Enter. Focus is visible the whole time. | ✓ | ✓ |

## When build documents, bridge files or cut lists changed, and before every build day

| # | Check | How | M | B |
|---|---|---|:-:|:-:|
| 10 | **The printed set is complete** | Run manual test MT-1 ([51] Test Cases) on the team's bridge. The print-preview page count equals the N in "SHEET 1 OF N", every table ends on a page, and nothing sits under a title block. | ✓ | n/a |
| 11 | **Actual size** | Print one template page at 100 % and measure one long member with a ruler. It must be within 1 mm of the cut list. | ✓ | n/a |
| 12 | **Black-and-white copy** | Tick "Line pattern by part" and print in greyscale. Every part can still be told apart. | ✓ | n/a |
| 13 | **The cut list makes sense** | Run manual test MT-3. No long or short point is ≤ 0, changed joints carry a note, and the stick count in the summary equals the sticks drawn. | ✓ | ✓ |
| 14 | **The course script agrees** | Export the team's bridge as .py and run it with the professor's script. Member forces must match the app; cmp.py only covers the test bridges. | ✓ | if the solver changed |

## Preview only

| # | Check | How | M | B |
|---|---|---|:-:|:-:|
| 15 | **Accessibility doesn't get worse** | Run `node tests/a11y/a11y.mjs` (it moves to `tests/ui/` once it passes). The pass count must be at least the last recorded baseline (6/28 on 647631e), and no check that passed before may now fail. New screens add no critical or serious axe finding. | n/a | ✓ |
| 16 | **Every theme is readable** | In ☰ → Look and controls → Theme, try each built-in theme in light and dark. Pass/fail and C/T/0 must be readable and the focus ring visible (a11y.mjs check A measures the contrast). | n/a | ✓ |
| 17 | **Review request sent** | The publish row goes To: UI Designer, Graphics Designer, QA and Accessibility, with the commit and the step numbers (rule 3, Spec first d). | n/a | ✓ |

## After publishing

| # | Check | How | M | B |
|---|---|---|:-:|:-:|
| 18 | **Lines kept in step** | A fix on main is merged forward into `balsaPixel-1.0` the same day. Each issue is closed with "Shipped in vNN", and the newsletter line is given. | ✓ | n/a |

## Block to paste

```
Release checklist (docs/release-checklist.md) — <line M or B> — <tag or commit> — <date> — <role>
1 line/commit _  2 version _  3 local = CI _  4 saved work _  5 round trip _  6 presets _
7 claude.ai _  8 phone _  9 keyboard _
10 MT-1 print _  11 ruler _  12 b/w _  13 MT-3 cut list _  14 course script _
15 a11y (n/28) _  16 themes _  17 review row _  18 lines in step _
Failed or n/a: <item: why>
```

History: first written 2026-10-27 as a comment on #127; became publishing step 0 on 2026-10-28 (TE-B-077).
