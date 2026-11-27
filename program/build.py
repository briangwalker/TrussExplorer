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
import base64, os, re, json, sys
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
# The tab icon (ART-O3; Brian's decision 72a, TE-B-757): one of Graphics' four icons from the website art pack, picked at random
# on each page load and kept for the whole visit. Each is inlined as a data: icon, as the TE mark was (#289, TE-B-317), so the
# site is still one page (img-src allows data:), and they are read from the art pack itself, so there is one copy of each.
# The <link> starts as D (today's TE mark, the same bytes as favicon.svg), so a page whose scripts don't run keeps today's icon;
# the one-line <script> after it picks A, B, C or D once. Its hash joins the CSP below like every other inline script.
TAB_ICONS = ['a-pixel-b', 'b-cream-b', 'c-truss-b', 'd-te-mark']
def favicon():
    uris = []
    for name in TAB_ICONS:
        svg = rd(here, '..', 'docs', 'art-website-pack', 'favicon', 'four', name + '.svg').strip()
        if '<script' in svg.lower() or 'href=' in svg.lower(): sys.exit(f'build.py: {name}.svg must hold no script and no links')
        uris.append('data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode('ascii'))
    link = '<link rel="icon" id="tabIcon" type="image/svg+xml" href="' + uris[-1] + '">'
    pick = ('<script>/* ART-O3: the tab icon is one of four, picked at random on each page load and kept for the visit */'
            '(function(){var l=document.getElementById("tabIcon"),u=' + json.dumps(uris, separators=(',', ':')) + ';l.href=u[Math.floor(Math.random()*u.length)];})()</script>')
    return link + '\n' + pick
def fill(m):
    if m.group(0) == '<!--FAVICON-->': return favicon()
    if m.group(0) == '/*SHELLCSS*/': return rd(src, 'shell.css') + ('\n' + FONTS if FONTS else '')   # shared theme fonts (themes/fonts/fonts.css), packed
    if m.group(0) == '<!--MODULES-->': return '\n'.join('<script>' + module(f) + '</script>' for f in others)
    return '<script>' + module(m.group(1).lower() + '.js') + '</script>'
ui = re.sub(r'<!--FAVICON-->|/\*SHELLCSS\*/|<!--MODULES-->|<script>/\*([A-Z0-9]+)\*/</script>', fill, ui)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(ui); print('built index.html' + (f' (modules: {", ".join(others)})' if others else ''))
# CSP script hashes (#297, WH-N3): the page is one file of inline <script> blocks, so the website's Content-Security-Policy
# allows exactly these by hash instead of 'unsafe-inline'. The deploy (#3) reads index.csp.txt from THIS build, never a
# kept copy, because the hashes change with every build. tests/ui/csp.mjs loads the page under the policy.
import hashlib, base64
hashes = [base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode('ascii')
          for m in re.finditer(r'<script>(.*?)</script>', ui, re.S)]
if re.search(r'<script[^>]+src=', ui): sys.exit('build.py: a <script src=...> would need its own CSP entry (#297)')
policy = ("default-src 'self'; script-src " + ' '.join(f"'sha256-{h}'" for h in hashes) +
          "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';"
          " worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'")
open(os.path.join(here, 'index.csp.txt'), 'w', encoding='utf-8').write('# Content-Security-Policy for this build of index.html (#297). Send it as the HTTP header; it changes with every build.\n' + policy + '\n')
