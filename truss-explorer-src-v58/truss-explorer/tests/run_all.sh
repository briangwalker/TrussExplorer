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

step "build twice: the page must come out byte-identical (index.html isn't committed on balsaPixel-1.0, TE-B-018)"
first="$(mktemp)"
python3 "$root/build.py"; r1=$?; cp "$root/index.html" "$first" 2>/dev/null || : > "$first"
python3 "$root/build.py" > /dev/null; r2=$?; mark $((r1 + r2)) "build.py"
if cmp -s "$first" "$root/index.html"; then echo "two builds identical ($(wc -c < "$root/index.html") bytes)"; else mark 1 "build.py is not deterministic: two builds differ"; fi
rm -f "$first"

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
# every module in src/, so a new file needs no edit here (#109, TE-B-018)
ok=0; for f in "$root"/src/*.js; do node --check "$f" || ok=1; done
# a folder of parts (src/app/NN-*.js, #109) only parses once joined: check the joined text
for d in "$root"/src/*/; do [ -n "$(ls "$d"*.js 2>/dev/null)" ] || continue; j="$(mktemp --suffix=.js)"; cat "$d"*.js > "$j"; node --check "$j" || { ok=1; echo "in the parts of $d"; }; rm -f "$j"; done; mark $ok "syntax"; [ $ok -eq 0 ] && echo "all modules parse"

step "node: every tests/*.test.js (solver audit, v58 regressions, sampler, file formats ...)"
node --test "$here"/*.test.js 2>&1 | grep -aE '^not ok|^# (tests|pass|fail)|changed since v58|error:'
node --test "$here"/*.test.js >/dev/null 2>&1; mark $? "node tests"

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

# any other browser test in tests/ui/ (a new *.mjs there runs without editing this file; harness.mjs is the shared helper)
for t in "$here"/ui/*.mjs; do
  case "$(basename "$t")" in harness.mjs|smoke.mjs|saving.mjs|documents.mjs|files.mjs|shell.mjs|regressions.mjs) continue;; esac
  step "browser: $(basename "$t" .mjs)"
  node "$t" 2>&1 | grep -aEv '^ok '; mark ${PIPESTATUS[0]} "UI $(basename "$t" .mjs)"
done

step "RESULT"
if [ $fail -eq 0 ]; then echo "ALL GREEN"; else echo "SOMETHING FAILED (see >>> lines)"; fi
exit $fail
