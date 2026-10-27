# Builds the single-page app: src/ui.html with each module dropped into its placeholder -> index.html
# balsaPixel: src/shell.js is its own <script> after app.js and reaches the app only through window.TrussApp;
# src/shell.css goes into its own <style>; every theme listed in themes/index.json is inlined as a string, so the page stays one file.
import os, json
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

shell = rd(src, 'shell.js').replace('/*THEMES*/{ files: {}, list: [] }', theme_pack(), 1)
ui = rd(src, 'ui.html').replace('/*SHELLCSS*/', rd(src, 'shell.css'), 1)
for tag, text in [('/*CORE*/', rd(src, 'core.js')), ('/*CORE3D*/', rd(src, 'core3d.js')), ('/*EXPORT*/', rd(src, 'export.js')), ('/*TEMPLATE*/', rd(src, 'template.js')), ('/*BUILDDOC*/', rd(src, 'builddoc.js')), ('/*FORMATS*/', rd(src, 'formats.js')), ('/*APP*/', rd(src, 'app.js')), ('/*SHELL*/', shell)]:
    ui = ui.replace(tag, text, 1)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(ui); print('built index.html')
