# Release notes, one file per pre-release

`1.0.0-alpha.N.md` (later `1.0.0-beta.N.md`, `1.0.0-rc.N.md`) holds the public notes of that pre-release, word for word the
"Version note" column of the **Truss Explorer Release Notes** sheet in Drive [21] Technical. The Dev Lead adds the file on the
release-name pull request ("Release name 1.0.0-alpha.N ..." into `balsaPixel-1.0`), the same pull request that sets
`APP_RELEASE` in `program/src/app/10-state.js`.

How a pre-release ships from alpha.7 (TE-B-570, Brian's decision of 2026-11-24):

1. The Dev Lead opens the release-name pull request and labels it `release gate`. Its head is the gate commit; it stays unmerged.
2. QA and Accessibility, the UI Designer and the Chaos Tester gate on that head (PASS or HOLD rows on the board); White Hat may hold;
   the Future Vision Lead posts the look line. A HOLD means a fix commit on the same pull request and a new gate on the new head.
3. With three PASS rows, no hold and the look line, the Dev Lead merges it. That is the one press on the team's side.
4. `.github/workflows/release.yml` runs on the merge: it checks the title, `APP_RELEASE` and this notes file agree, makes the
   annotated tag `v1.0.0-alpha.N` on the merge commit, publishes the pre-release with these notes, and calls `deploy.yml`.
5. `deploy.yml` runs the whole test suite and then waits for Brian's approval of the `production` environment. That is his one press.

Plain words, no security details (rulebook rule 1: private findings stay in Drive [52]). The file name is the version only, never
`v` in front of it.
