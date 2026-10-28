# Build-document checks (Math Consultant, TE-B-129, #282)

Two plain-Node scripts that re-derive the build documents' numbers from the truss geometry, independently of `src/builddoc.js`. Run them from the app folder, and pass bridge files (Brian's own stay outside the repo, rule 8):

```
cd truss-explorer-src-v58/truss-explorer
TE_ROOT=. node ../../docs/math/reference/build-docs/cutcheck.js [bridge.json ...]   # no files: the course sample and presets
TE_ROOT=. node ../../docs/math/reference/build-docs/arc.js bridge.json ...
```

**`cutcheck.js`**: the straight-piece cut list. For every bridge it checks:
- every flush end's two cut edges lie on the face it butts against (b/2 from that member's centre line, to 1e-6 mm);
- each end's stated angle matches its edge offsets (|eA − eB| = b·tan angle);
- each piece's length is the sum of its members' lengths, with long ≥ short > 0, and no piece over the stock length that could have been spliced;
- every member is in exactly one piece after splicing;
- the pieces under one item number agree to 0.5 mm, and the quantities add up;
- the stock plan never over-fills a stick and cuts every piece once.

It also prints the cut wood (long points) against the centre-line ΣL. The cut wood is 1.5–6% less, because the ends stop at faces.

**`arc.js`**: the bent top chord (#282). It reports:
- the centre-line arc of the app's own curve over the curved run, against the sum of straight chords;
- the tightest radius and the outer-fibre strain b/2R;
- how far the bent stick sits off the straight chords between joints (the eccentricity in Physics' #194 check);
- how far the members meeting the stick are off the chord direction (their flush cuts must follow the tangent);
- the total turning angle, from which the outer face is b·Δθ longer than the inner face.
