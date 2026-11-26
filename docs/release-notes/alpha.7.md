balsaPixel: Truss Explorer 1.0.0-alpha.7 (pre-release)

New
- Sweeps start from a bar at the bottom left that is on screen from the start: Run sweep, how many designs, the progress bar and Cancel are in one row, and the rest of the sweep settings fold away under "Sweep settings" (#488).
- Analysis > Members now sets the sticks (1 to 4) and the focus for each member, with "All members to 1 stick"; the old Member forces sheet has left the Drawing window, and the design facts sit in a closed section under the table (#499).
- In 3D, "Look from" next to the view cube shows the bridge from the Side, the Top (both bracing planes) or the End (each cross-frame) (#511).

Improved
- A focus ring takes the colour of what it sits on, so it stays visible on every bar and button; in the Notebook theme it is a 3 px dashed ring (#485, #507).
- Notebook theme: the number in a number box sits where you type it (#513).

Safer files
- File size limits count bytes, not letters; a theme file's backgrounds can't be see-through, a theme file with no colours is refused, and its ink-on-pale-line pair is checked like the others (#512, #516).

Behind the scenes
- The groundwork for checking a bridge file's values against the limits table, with one note at the top of Inputs, a Fix button and "No result" on the card while a value is out of range; it is switched off for now and comes on in a later alpha (#475, #483, #505, #517, #519, #520, #522, #523, #524, #526).
- New shared pieces: the ✎ value editor, grid editing in tables, the result callouts, the wood pile shape and the sweep bar's facts (#478, #489, #490, #492, #493).
- Releases are now made by merging one reviewed pull request; the website deploy still waits for a person's approval (#518).

Known
- The top bar can cover the Graph options in Analysis 3D (#495); a huge number of trusses can freeze the page (#500); Undo after opening a file can offer the older bridge's value (#501); the sweep legend can run through the drawn books at 1366 px wide (#503).

Results are unchanged: the solver was not touched.
