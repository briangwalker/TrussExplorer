#!/usr/bin/env bash
# Every check in one command (TE-002). Run from anywhere:
#   bash tests/run_all.sh                 # build + all tests
#   bash tests/run_all.sh --slow          # also the huge-space time-limited run (t71, ~1 min)
#   bash tests/run_all.sh --published page.html   # also compare the build with a saved copy of the live page
# Exit code 0 = all green. Lines marked KNOWN have an open ticket and don't fail the run.
set -u
here="$(cd "$(dirname "$0")" && pwd)"; root="$(dirname "$here")"
slow=""; pub=""
while [ $# -gt 0 ]; do case "$1" in --slow) slow="--slow";; --published) pub="$2"; shift;; esac; shift; done
fail=0; step() { printf '\n=== %s ===\n' "$1"; }
mark() { if [ "$1" -ne 0 ]; then fail=1; echo ">>> FAILED: $2"; fi; }

step "build (index.html must come out identical to the committed one)"
before="$(mktemp)"; cp "$root/index.html" "$before" 2>/dev/null || : > "$before"
python3 "$root/build.py"; mark $? "build.py"
if cmp -s "$before" "$root/index.html"; then echo "index.html unchanged by the build"; else echo "index.html changed: commit it with the source change"; [ -n "${CI:-}" ] && mark 1 "committed index.html is out of date"; fi
rm -f "$before"

if [ -n "$pub" ]; then
  step "build vs the published page"
  python3 - "$root/index.html" "$pub" <<'EOF'; mark $? "published-page compare"
import sys
built, pub = (open(f, encoding='utf-8').read() for f in sys.argv[1:3])
# the artifact service wraps the page (<!doctype>...<body>\n ... \n</body></html>) when it publishes
s = pub.find('<body>\n'); inner = pub[s + 7:] if s >= 0 else pub
if inner.endswith('\n</body></html>'): inner = inner[:-len('\n</body></html>')]
print('identical inside the publish wrapper' if inner == built else 'DIFFERENT'); sys.exit(inner != built)
EOF
fi

step "syntax"
ok=0; for f in core core3d export template builddoc formats app shell; do node --check "$root/src/$f.js" || ok=1; done; mark $ok "syntax"; [ $ok -eq 0 ] && echo "all modules parse"

step "node: solver audit + v58 regressions (golden.json) + file formats"
node --test "$here/solver.test.js" "$here/regressions.test.js" "$here/sampler.test.js" "$here/formats.test.js" 2>&1 | grep -aE '^not ok|^# (tests|pass|fail)|changed since v58|error:'
node --test "$here/solver.test.js" "$here/regressions.test.js" "$here/sampler.test.js" "$here/formats.test.js" >/dev/null 2>&1; mark $? "node tests"

step "cmp.py: member forces vs the course script"
python3 "$here/cmp.py" > /tmp/te-cmp.out 2>&1; r=$?; grep -E 'WORST|PASS|FAIL|KNOWN|SKIP|  ' /tmp/te-cmp.out | grep -v ' maxdF 0.000' ; mark $r "cmp.py"

step "browser: smoke"
node "$here/ui/smoke.mjs" 2>&1 | grep -aEv '^ok |saved summary'; mark ${PIPESTATUS[0]} "UI smoke"

step "browser: saving, every view and full-screen mode"
node "$here/ui/saving.mjs" 2>&1 | grep -aEv '^ok '; mark ${PIPESTATUS[0]} "UI saving"

step "browser: build documents print completely"
node "$here/ui/documents.mjs" 2>&1 | grep -aEv '^ok '; mark ${PIPESTATUS[0]} "UI documents"

step "browser: opening files"
node "$here/ui/files.mjs" 2>&1 | grep -aEv '^ok '; mark ${PIPESTATUS[0]} "UI files"

step "browser: balsaPixel window layout and themes"
node "$here/ui/shell.mjs" 2>&1 | grep -aEv '^ok '; mark ${PIPESTATUS[0]} "UI shell"

step "browser: v51-v58 regressions $slow"
node "$here/ui/regressions.mjs" $slow 2>&1 | grep -aEv '^ok |^-- |^$'; mark ${PIPESTATUS[0]} "UI regressions"

step "RESULT"
if [ $fail -eq 0 ]; then echo "ALL GREEN"; else echo "SOMETHING FAILED (see >>> lines)"; fi
exit $fail
