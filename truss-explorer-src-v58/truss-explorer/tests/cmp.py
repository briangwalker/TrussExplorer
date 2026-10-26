"""Compare the app's member forces with the professor's own TrussFEA_Bridge_SE310.py.
Section 0-1 (materials, books, geometry) come from the app's .py export; sections 2-6
(the solver) are taken unchanged from the professor's script. Pass: maxdF 0.000 N."""
import json, os, re, subprocess, sys, tempfile, pathlib
here = pathlib.Path(__file__).resolve().parent
# The course script is not ours to publish (rule 8), so it lives in the git-ignored tests/private/
# or wherever TRUSSFEA_PY points.
import os
prof_path = pathlib.Path(os.environ.get('TRUSSFEA_PY', here / 'private' / 'TrussFEA_Bridge_SE310.py'))
if not prof_path.exists():
    print(f'SKIP: put TrussFEA_Bridge_SE310.py in tests/private/ (or set TRUSSFEA_PY) to compare with the course script.'); sys.exit(0)
prof = prof_path.read_text(encoding='utf-8')
cut = prof.index('#  2. PROBLEM INITIALIZATION')
prof_solver = prof[prof.rindex('\n# ====', 0, cut):]
work = pathlib.Path(tempfile.mkdtemp(prefix='te-cmp-'))
subprocess.run(['node', str(here / 'export_cases.js'), str(work)], check=True)
cases = json.loads((work / 'js.json').read_text())
worst_all, bad, known_hit = 0.0, [], []
# Known differences with an open ticket: reported, not failed.
KNOWN = {'saved:Test': 'TE-083: the .py export writes joint coordinates to 0.001 mm; this shallow curved design moves ~0.003 N'}
for c in cases:
    exp = (work / (c['file'] + '.py')).read_text(encoding='utf-8')
    head = exp[:exp.index('#  2. PROBLEM INITIALIZATION')]
    head = head[:head.rindex('\n# ====')]
    csv = work / (c['file'] + '.csv')
    script = 'import matplotlib\nmatplotlib.use("Agg")\n' + head + prof_solver
    script = re.sub(r"CSV_OUT\s*=.*", f"CSV_OUT = r'{csv}'", script)
    script = script.replace('plt.show()', 'pass')
    p = work / (c['file'] + '.run.py'); p.write_text(script, encoding='utf-8')
    r = subprocess.run([sys.executable, '-I', str(p)], capture_output=True, text=True, cwd=work)
    if r.returncode:
        bad.append(f"{c['name']}: script error {r.stderr.strip().splitlines()[-1]}"); continue
    import csv as _csv
    rows = list(_csv.DictReader(open(csv)))
    Fp = [float(x['F (N)']) for x in rows]
    if len(Fp) != len(c['F']):
        bad.append(f"{c['name']}: {len(Fp)} members in script vs {len(c['F'])} in app"); continue
    dF = max(abs(a - round(b, 2)) for a, b in zip(Fp, c['F']))   # the script rounds F to 0.01 N
    m = re.search(r"D_max = ([0-9.]+) mm.*?M = ([0-9.]+) g", r.stdout, re.S)
    dd = abs(float(m.group(1)) - c['defl']) if m else float('nan')
    note = ' (lift-off/sliding: script solves the final support set)' if c['lifted'] or c['sliding'] else ''
    print(f"{c['name']:<26} maxdF {dF:.3f} N   d_defl {dd:.4f} mm{note}")
    worst_all = max(worst_all, dF)
    if dF > 0.005:
        (known_hit if c['name'] in KNOWN else bad).append(f"{c['name']}: maxdF {dF:.3f}" + (f"  [{KNOWN[c['name']]}]" if c['name'] in KNOWN else ''))
print(f"\nWORST maxdF {worst_all:.3f} N over {len(cases)} designs")
if bad:
    print('FAIL\n  ' + '\n  '.join(bad)); sys.exit(1)
print('PASS' + ('\nKNOWN\n  ' + '\n  '.join(known_hit) if known_hit else ''))
