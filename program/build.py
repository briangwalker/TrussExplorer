# Builds the single-page app: src/ui.html with each module dropped into its placeholder -> index.html
# balsaPixel: src/shell.js is its own <script> after app.js and reaches the app only through window.TrussApp;
# src/shell.css goes into its own <style>; every theme listed in themes/index.json is packed by tools/themepack.py and inlined, so the page stays one file.
#
# Where each module goes (#109, board TE-B-018: no shared list to edit, so two PRs adding files don't collide):
#   <script>/*NAME*/</script> in ui.html  -> src/name.js, at that spot (for modules whose position matters: the solver, app.js, the shell)
#   <!--MODULES-->            in ui.html  -> every other src/*.js, each in its own <script>, in alphabetical order.
#   A placeholder whose src/name.js doesn't exist but whose folder src/name/ does takes that folder's *.js joined in
#   name order, with nothing added between them: src/app/10-state.js ... 99-door.js are app.js cut into sections
#   (#109 step 1), so they still share one IIFE. The order is in the file names (NN-), never in a list.
#     A module placed this way must stand alone: it defines one global (TrussFormats, TrussNames...) and runs nothing
#     that needs another module while the page loads. Adding one = adding the file; nothing else changes.
# Run twice, it writes the same bytes (run_all.sh checks this, since index.html is not committed on balsaPixel-1.0).
import os, re, json, sys
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()

# themes: packed by tools/themepack.py (#265; docs/art-implementation.md section 3). It inlines each theme's images as data: URIs,
# packs pictures and icons, refuses anything that would load from outside or carry script, and checks the 400 KB budget.
sys.path.insert(0, os.path.join(here, 'tools'))
import themepack
try:
    THEMES, FONTS, _report = themepack.pack(os.path.join(here, 'themes'))
except themepack.Refused as e:
    sys.exit('build.py: theme refused: ' + str(e))
for line in themepack.KNOWN_SEEN: print(line)
def theme_pack(): return themepack.pack_json(THEMES)

ui = rd(src, 'ui.html')
PLACED = re.compile(r'<script>/\*([A-Z0-9]+)\*/</script>')
placed = [m.group(1).lower() + '.js' for m in PLACED.finditer(ui)]
def parts(f):
    d = os.path.join(src, f[:-3])
    return sorted(p for p in os.listdir(d) if p.endswith('.js')) if not os.path.exists(os.path.join(src, f)) and os.path.isdir(d) else None
for f in placed:
    if not os.path.exists(os.path.join(src, f)) and not parts(f): sys.exit(f'build.py: ui.html has a placeholder for src/{f}, which does not exist (nor a src/{f[:-3]}/ folder of parts)')
others = sorted(f for f in os.listdir(src) if f.endswith('.js') and f not in placed)
if others and ui.count('<!--MODULES-->') != 1: sys.exit(f'build.py: ui.html needs exactly one <!--MODULES--> line for {", ".join(others)}')

def module(f):
    p = parts(f)
    text = ''.join(rd(src, f[:-3], q) for q in p) if p else rd(src, f)
    if f == 'shell.js': text = text.replace('/*THEMES*/{ files: {}, list: [] }', theme_pack(), 1)
    return text

# one pass over the original ui.html, so text inside a module is never mistaken for a placeholder
def fill(m):
    if m.group(0) == '/*SHELLCSS*/': return rd(src, 'shell.css') + ('\n' + FONTS if FONTS else '')   # shared theme fonts (themes/fonts/fonts.css), packed
    if m.group(0) == '<!--MODULES-->': return '\n'.join('<script>' + module(f) + '</script>' for f in others)
    return '<script>' + module(m.group(1).lower() + '.js') + '</script>'
ui = re.sub(r'/\*SHELLCSS\*/|<!--MODULES-->|<script>/\*([A-Z0-9]+)\*/</script>', fill, ui)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(ui); print('built index.html' + (f' (modules: {", ".join(others)})' if others else ''))
