# Release notes for the one-click releases (TE-B-570)

From alpha.7, a pre-release on `balsaPixel-1.0` is made by merging its **release-name pull request**:

1. The Dev Lead opens a pull request titled `Release name 1.0.0-alpha.N (Dev Lead)` into `balsaPixel-1.0`, labels it
   `release gate`, and adds `docs/release-notes/alpha.N.md` here: the plain public notes, copied word for word from
   the alpha.N row of the 'Truss Explorer Release Notes' sheet (last column).
2. QA, the UI Designer and the Chaos Tester gate on that pull request's **head** and post their PASS or HOLD rows.
   The Future Vision Lead posts the look line. The pull request stays unmerged until all of that is in and there is
   no White Hat hold.
3. The Dev Lead merges it. `.github/workflows/release.yml` then makes the annotated tag `v1.0.0-alpha.N` on the merge
   commit, publishes the pre-release 'balsaPixel 1.0.0 Alpha N' with this file as its notes, and starts the deploy.
4. Brian approves the `production` deploy. That is his one click.

The workflow refuses a title that isn't `1.0.0-alpha.N`, `-beta.N` or `-rc.N` (so 1.0.0 itself, a MAJOR release, is
never made here), a missing notes file, and a tag that already exists (a tag is never moved).

A release-name pull request changes nothing but its notes file (and the version line, if one is kept), so the merge
commit's tree is the gate head's tree only if nothing else merged into `balsaPixel-1.0` after the gate head was made.
The workflow checks exactly that and tags nothing if the trees differ, so merge the release-name pull request while
GitHub shows its branch up to date; if something else merged first, bring the branch up to date and re-gate.
