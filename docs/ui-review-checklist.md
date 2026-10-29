# UI review checklist

Use this list for any pull request that changes what a user sees: `shell.js`, `shell.css`, the drawing, the chart, the Inputs UI, or themes. The author fills in the top part. UI Designer then leaves a review comment, signed "UI Designer", that ticks the rules or names the ones that don't match. The review doesn't gate merging; Dev Lead still merges. A mismatch that ships gets its own issue citing the rule number.

## Author (in the PR description)

- **Rules this PR meets:** list the `UI-…` numbers from [ui-spec.md](ui-spec.md). The build-step table at the end of that file gives the set for each balsaPixel step.
- **Rules it knowingly doesn't meet yet,** and the issue that will finish them.
- **Screenshots at 1440 × 900 and 1152 × 1062** (Brian's second monitor). Add 390 px wide if it touches a phone layout.

## UI review: the quick pass (every PR)

1. **Base layer (UI-A3):** the picture fills the stage at both sizes. Opening, closing or moving every window never moves or resizes the picture.
2. **One switch (UI-A7):** no 2D/3D control exists outside the top bar.
3. **Window homes and states (UI-W1–W7, UI-A4):** each window is in its home and steps words + icons → icons → tab.
4. **Pop-ups (UI-W8):** an outside click closes each pop-up and does nothing else, and Esc closes it.
5. **Text on text (UI-D6):** no label overlaps another, at both sizes.
6. **Meaning (UI-A17, UI-A18):** fails are magenta ✕ and grey means zero force only. Every state also has a shape or a word, not colour alone.
7. **Preview vs loaded (UI-A11):** every place that can preview shows the state badge or NOT LOADED.
8. **Words (UI-A19, UI-W13):** hints say how to use the screen, not how it works, and every dialog button names its action.
9. **Click-Through check:** the same steps on the Click-Through behave the same way. If they don't, either the PR or the Click-Through is wrong. Say which.

## Then the rules named in the PR

Check each listed rule against the PR's screenshots or a local build. Reply with:

- ✓ for rules that are met;
- ✗ for rules that aren't, each with the rule number, what happens instead and a screenshot;
- ? for rules UI couldn't check, and why.
