balsaPixel: Truss Explorer 1.0.0-alpha.8 (pre-release)

New
- Home fits the whole 2D drawing, its legend and the callouts into the free part of the screen, so nothing hides under a window (#536, #503).
- Under 1100 px wide the Inputs window starts as icons, and the sweep bar never takes more than 40 % of the screen (#538, #470, #534).
- The results card says "No result" when the mid-span deflection would be more than the truss height (rule M2), with the deflection to two decimals where it would otherwise read the same as the height (#528, #530, #531).

Fixed
- Build documents: the buttons never scroll away, a click outside closes the sheet, the header has a ✕, every joint-table select has a name and the parts list scrolls by keyboard (#543, #548, #410, #411).
- Notebook theme: the results card reads on the generated wood, and the Calculator's keys show as pixel keys (#549).
- The number of trusses stays between 1 and 4 whatever way it comes in (typed, a file, a saved visit), so a huge number can no longer freeze the page (#552, #500).
- The height box is checked again when the curve or the top ends move (#525).

Behind the scenes
- The sweep gives no result for designs the limits table refuses, and the geometry check runs 6-7x faster with the same output; both still behind ?limits=1 until the limits switch on (#542, #546, #545, #535).
- ui-spec 1.5.11-1.5.13 (#531, #537, #544).

Known
- The top bar can cover the Graph options in Analysis 3D (#495); Undo after opening a file can offer the older bridge's value (#501); the load toast can linger after a click (#510); Esc on a 'Look from' item doesn't close the list (#533); the sweep bar after a narrow-then-wide window (#532).

Results are unchanged: the solver was not touched.
