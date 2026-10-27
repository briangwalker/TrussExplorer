# Reference solver

`TrussFEA_Bridge_SE310.py` is the SE 310 course's direct-stiffness solver by Professor Dong, included unchanged with her permission under this repository's MIT licence (#147).

`tests/cmp.py` runs its solver sections on each design's .py export and checks that the Truss Explorer's 2D member forces match it (maxdF 0.000 N). Don't edit the script: it is the reference the 2D solver is held to. New physics goes on top of the baseline as an option.
