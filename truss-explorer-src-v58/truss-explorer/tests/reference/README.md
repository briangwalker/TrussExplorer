# Reference solver

The reference solver (`TrussFEA_Bridge_SE310.py`) is not kept in this repository. `tests/cmp.py` reads it from the path in
`TRUSSFEA_PY`, or from `tests/reference/TrussFEA_Bridge_SE310.py` here, which `.gitignore` keeps out of git. In CI the file is
written from the repository secret `TRUSSFEA_PY` (`.github/workflows/tests.yml`); a CI run without it fails at cmp.py rather
than passing silently. Locally, without a copy, cmp.py prints SKIP and the rest of the suite runs.

`tests/cmp.py` runs the solver sections on each design's .py export and checks that the Truss Explorer's 2D member forces
match (maxdF 0.000 N). Don't edit the reference: it is what the 2D solver is held to. New physics goes on top of the baseline
as an option.
