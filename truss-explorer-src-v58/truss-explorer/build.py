# Builds the single-page app: src/ui.html with each module dropped into its placeholder -> index.html
import os
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, 'src')
ui = open(os.path.join(src, 'ui.html'), encoding='utf-8').read()
for tag, f in [('/*CORE*/', 'core.js'), ('/*CORE3D*/', 'core3d.js'), ('/*EXPORT*/', 'export.js'), ('/*TEMPLATE*/', 'template.js'), ('/*BUILDDOC*/', 'builddoc.js'), ('/*FORMATS*/', 'formats.js'), ('/*APP*/', 'app.js')]:
    ui = ui.replace(tag, open(os.path.join(src, f), encoding='utf-8').read())
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(ui); print('built index.html')
