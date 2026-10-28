# Math notes

Specs and reference code from the Math Consultant role. Reference code here is for reading and testing, not part of the app build; the app's own versions go into `truss-explorer-src-v58/truss-explorer/src/` through Dev Lead.

| Doc | What it is |
|---|---|
| [sweep-file-format.md](sweep-file-format.md) | The `.tsweep` file: version, sweep info, fingerprint, number columns, merging |
| [build-guide-sweep-data.md](build-guide-sweep-data.md) | How to build the file, the result check for shared files, and charts with millions of designs |
| [reference/](reference/) | `tsweep.js` + `tsweep.test.js`, `density.js` + `density.bench.js` (run with Node 18+) |
