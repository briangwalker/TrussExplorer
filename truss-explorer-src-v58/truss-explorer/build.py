# Builds the single-page app: src/ui.html with each module dropped into its placeholder -> index.html
# balsaPixel: src/shell.js is its own <script> after app.js and reaches the app only through window.TrussApp;
# src/shell.css goes into its own <style>; every theme listed in themes/index.json is inlined as a string, so the page stays one file.
#
# Where each module goes (#109, board TE-B-018: no shared list to edit, so two PRs adding files don't collide):
#   <script>/*NAME*/</script> in ui.html  -> src/name.js, at that spot (for modules whose position matters: the solver, app.js, the shell)
#   <!--MODULES-->            in ui.html  -> every other src/*.js, each in its own <script>, in alphabetical order.
#     A module placed this way must stand alone: it defines one global (TrussFormats, TrussNames...) and runs nothing
#     that needs another module while the page loads. Adding one = adding the file; nothing else changes.
# Run twice, it writes the same bytes (run_all.sh checks this, since index.html is not committed on balsaPixel-1.0).
import os, re, json, sys
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()

def theme_pack():
    tdir = os.path.join(here, 'themes'); idx = json.loads(rd(tdir, 'index.json'))
    files, lst = {}, []
    for t in idx['themes']:
        css = t.get('css')
        if css and css not in files: files[css] = rd(tdir, css)
        assert t.get('format') == 'truss-explorer-theme' and t.get('version') == 1, f"theme {t.get('id')}: unknown format or version"
        lst.append({k: t[k] for k in ('id', 'name', 'css') if k in t})
    # inside a <script>: no "</" can close it early
    return json.dumps({'files': files, 'list': lst}, ensure_ascii=True).replace('</', '<\\/')

ui = rd(src, 'ui.html')
PLACED = re.compile(r'<script>/\*([A-Z0-9]+)\*/</script>')
placed = [m.group(1).lower() + '.js' for m in PLACED.finditer(ui)]
for f in placed:
    if not os.path.exists(os.path.join(src, f)): sys.exit(f'build.py: ui.html has a placeholder for src/{f}, which does not exist')
others = sorted(f for f in os.listdir(src) if f.endswith('.js') and f not in placed)
if others and ui.count('<!--MODULES-->') != 1: sys.exit(f'build.py: ui.html needs exactly one <!--MODULES--> line for {", ".join(others)}')

def module(f):
    text = rd(src, f)
    if f == 'shell.js': text = text.replace('/*THEMES*/{ files: {}, list: [] }', theme_pack(), 1)
    return text

# one pass over the original ui.html, so text inside a module is never mistaken for a placeholder
def fill(m):
    if m.group(0) == '/*SHELLCSS*/': return rd(src, 'shell.css')
    if m.group(0) == '<!--MODULES-->': return '\n'.join('<script>' + module(f) + '</script>' for f in others)
    return '<script>' + module(m.group(1).lower() + '.js') + '</script>'
ui = re.sub(r'/\*SHELLCSS\*/|<!--MODULES-->|<script>/\*([A-Z0-9]+)\*/</script>', fill, ui)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(ui); print('built index.html' + (f' (modules: {", ".join(others)})' if others else ''))
