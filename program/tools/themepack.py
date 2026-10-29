# Packs the built-in themes into the one-file page (#265; spec docs/art-implementation.md section 3, tests section 7).
# Used by build.py; also a command for tests and for Graphics:
#   python3 tools/themepack.py [themes-dir]      prints each theme's packed size, exit 1 with a clear message on any refusal
# A theme listed in themes/index.json may name a CSS file at the top of themes/ (the one-file themes of today) or inside its
# own folder (themes/<folder>/theme.css). While packing:
#   url(...)   a relative file in the theme's folder or themes/fonts/ becomes a data: URI. Allowed: .webp .png .jpg .jpeg .svg .woff2.
#              Refused: absolute paths, '..', any scheme (http:, //, javascript: ...), files outside those folders, other types,
#              and data: URIs of any type but those images and woff2 fonts.
#   @import    refused anywhere.
#   pictures/  every *.svg in the theme's folder goes into the pack as text; icons.svg too.
#   SVG        refused, never cleaned, if it has <script>, an on* attribute, <foreignObject>, javascript:, an outside href or an
#              embedded raster (ART-H6, WH-T4). This applies to SVGs packed from url() too.
#   fonts      themes/fonts/fonts.css (if present) is packed the same way and returned separately, for the page's <style>.
#   budget     each theme's packed CSS + pictures, fonts not counted, must be at most 400 KB (ART-X4). Fonts are reported apart.
# Output is deterministic: the same files give the same bytes.
import base64, json, os, re, sys

BUDGET = 400 * 1024
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}
DATA_OK = re.compile(r'^data:(image/(webp|png|jpeg|svg\+xml)|font/woff2|application/font-woff2|application/x-font-woff2)[;,]', re.I)
URL = re.compile(r'url\(\s*(?P<q>["\']?)(?P<u>.*?)(?P=q)\s*\)', re.I | re.S)
FONTFACE = re.compile(r'@font-face\s*\{[^}]*\}', re.I | re.S)


# the one outside load left in a built-in theme, removed by Graphics' PR #268 (self-hosted fonts); delete this entry when it merges
KNOWN_IMPORTS = {('notebook-calc.css', 'https://fonts.googleapis.com/'): '#268'}
KNOWN_SEEN = []


class Refused(Exception):
    pass


def svg_problems(text):
    """Why an SVG can't be packed (empty list = fine). Refused, not cleaned (ART-H6)."""
    p = []
    low = text.lower()
    if re.search(r'<\s*script', low): p.append('a <script>')
    if re.search(r'<\s*foreignobject', low): p.append('a <foreignObject>')
    if re.search(r'\son[a-z]+\s*=', low): p.append('an on* event attribute')
    if 'javascript:' in low: p.append('a javascript: link')
    for m in re.finditer(r'(?:xlink:)?href\s*=\s*["\']\s*([^"\']*)', text, re.I):
        h = m.group(1).strip()
        if h.lower().startswith('data:image/') and not h.lower().startswith('data:image/svg'): p.append('an embedded raster image')
        elif h and not h.startswith('#'): p.append('an outside link (' + h[:40] + ')')
    for m in re.finditer(r'url\(\s*["\']?\s*([^"\')\s]*)', text, re.I):
        if not m.group(1).startswith('#'): p.append('a url() that is not a #reference')
    if re.search(r'<\s*image\b', low) and 'an embedded raster image' not in p: p.append('an <image> element')
    return sorted(set(p))


def _inside(path, roots):
    rp = os.path.realpath(path)
    return any(rp == os.path.realpath(r) or rp.startswith(os.path.realpath(r) + os.sep) for r in roots)


def pack_css(css, base_dir, roots, what):
    """Return css with every relative url() inlined; raise Refused on anything not allowed."""
    known = ''
    for imp, issue in KNOWN_IMPORTS.items():
        if what.endswith('(' + imp[0] + ')') and imp[1] in css:
            m = re.search(r'@import\s+url\(\s*["\']?' + re.escape(imp[1]) + r'[^;]*;\s*', css)
            if m: known = m.group(0); css = css[:m.start()] + '\x00KNOWN-IMPORT\x00' + css[m.end():]; KNOWN_SEEN.append(f'KNOWN {what}: the Google Fonts @import stays until {issue} merges')
    if re.search(r'@import\b', css, re.I): raise Refused(f'{what}: @import is not allowed (themes load nothing from outside, WH-N4)')

    def one(m):
        u = m.group('u').strip()
        if u.startswith('#'): return m.group(0)
        if u.lower().startswith('data:'):
            if not DATA_OK.match(u): raise Refused(f'{what}: data: URI of a type that is not allowed ({u[:40]}...)')
            if u.lower().startswith('data:image/svg'):
                body = u.split(',', 1)[1] if ',' in u else ''
                try: text = base64.b64decode(body).decode('utf-8', 'replace') if ';base64' in u.split(',', 1)[0].lower() else __import__('urllib.parse').parse.unquote(body)
                except Exception: raise Refused(f'{what}: an SVG data: URI that does not decode')
                bad = svg_problems(text)
                if bad: raise Refused(f'{what}: an inline SVG has ' + ', '.join(bad))
            return m.group(0)
        if re.match(r'^[a-z][a-z0-9+.-]*:', u, re.I) or u.startswith('//'): raise Refused(f'{what}: url({u}) points outside the theme (no schemes or outside links)')
        if u.startswith('/') or u.startswith('\\'): raise Refused(f'{what}: url({u}) is an absolute path')
        if '..' in u.replace('\\', '/').split('/'): raise Refused(f"{what}: url({u}) uses '..'")
        clean = u.split('?')[0].split('#')[0]
        ext = os.path.splitext(clean)[1].lower()
        if ext not in MIME: raise Refused(f'{what}: url({u}): {ext or "no extension"} is not an allowed file type ({" ".join(sorted(MIME))})')
        f = os.path.join(base_dir, clean)
        if not _inside(f, roots): raise Refused(f'{what}: url({u}) is outside the theme folder and themes/fonts/')
        if not os.path.isfile(f): raise Refused(f'{what}: url({u}): file not found')
        data = open(f, 'rb').read()
        if ext == '.svg':
            bad = svg_problems(data.decode('utf-8', 'replace'))
            if bad: raise Refused(f'{what}: {clean} has ' + ', '.join(bad))
        return 'url("data:' + MIME[ext] + ';base64,' + base64.b64encode(data).decode('ascii') + '")'

    out = URL.sub(one, css)
    return out.replace('\x00KNOWN-IMPORT\x00', known) if known else out   # put the known @import back where it was


def font_bytes(css):
    return sum(len(m.group(0).encode('utf-8')) for m in FONTFACE.finditer(css))


def pack(tdir):
    """-> (pack dict for the page, fonts css, report lines). Raises Refused."""
    rd = lambda p: open(p, encoding='utf-8').read()
    idx = json.loads(rd(os.path.join(tdir, 'index.json')))
    fonts_dir = os.path.join(tdir, 'fonts')
    files, lst, pictures, report = {}, [], {}, []
    for t in idx['themes']:
        tid = t.get('id')
        if t.get('format') != 'truss-explorer-theme' or t.get('version') != 1: raise Refused(f'theme {tid}: unknown format or version')
        css = t.get('css')
        if css:
            if '..' in css.replace('\\', '/').split('/') or css.startswith('/') or not css.endswith('.css'): raise Refused(f'theme {tid}: css "{css}" must be a .css file inside themes/')
            path = os.path.join(tdir, css)
            folder = os.path.dirname(path)
            own = folder if os.path.realpath(folder) != os.path.realpath(tdir) else None
            roots = [own or tdir, fonts_dir]
            if css not in files:
                files[css] = pack_css(rd(path), folder, roots, f'theme {tid} ({css})')
            # pictures and icons live only in a theme's own folder
            pics = {}
            if own:
                pdir = os.path.join(own, 'pictures')
                if os.path.isdir(pdir):
                    for name in sorted(os.listdir(pdir)):
                        if not name.endswith('.svg'): continue
                        text = rd(os.path.join(pdir, name)); bad = svg_problems(text)
                        if bad: raise Refused(f'theme {tid}: pictures/{name} has ' + ', '.join(bad))
                        pics[name[:-4]] = text
                    pcss = os.path.join(pdir, 'pictures.css')
                    if os.path.isfile(pcss): pics['css'] = pack_css(rd(pcss), pdir, [own, fonts_dir], f'theme {tid} (pictures.css)')
                icons = os.path.join(own, 'icons.svg')
                if os.path.isfile(icons):
                    text = rd(icons); bad = svg_problems(text)
                    if bad: raise Refused(f'theme {tid}: icons.svg has ' + ', '.join(bad))
                    pics['icons'] = text
            if pics: pictures[tid] = pics
            size = len(files[css].encode('utf-8')) + sum(len(v.encode('utf-8')) for v in pics.values())
            fb = font_bytes(files[css]); counted = size - fb
            report.append(f'theme {tid}: {counted / 1024:.0f} KB packed' + (f' (+ {fb / 1024:.0f} KB fonts)' if fb else ''))
            if counted > BUDGET: raise Refused(f'theme {tid}: {counted / 1024:.0f} KB packed, over the {BUDGET // 1024} KB budget (ART-X4; fonts not counted)')
        lst.append({k: t[k] for k in ('id', 'name', 'css') if k in t})
    fonts = ''
    fcss = os.path.join(fonts_dir, 'fonts.css')
    if os.path.isfile(fcss):
        fonts = pack_css(rd(fcss), fonts_dir, [fonts_dir], 'themes/fonts/fonts.css')
        report.append(f'shared fonts: {len(fonts.encode("utf-8")) / 1024:.0f} KB')
    out = {'files': files, 'list': lst}
    if pictures: out['pictures'] = pictures
    return out, fonts, report


def pack_json(p):
    # inside a <script>: no "</" can close it early
    return json.dumps(p, ensure_ascii=True, sort_keys=False).replace('</', '<\\/')


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    tdir = args[0] if args else os.path.join(here, 'themes')
    try:
        p, fonts, report = pack(tdir)
    except Refused as e:
        print('REFUSED: ' + str(e)); sys.exit(1)
    if '--json' in sys.argv:
        print(json.dumps({'pack': p, 'fonts': fonts}, ensure_ascii=True)); sys.exit(0)
    for line in KNOWN_SEEN + report: print(line)
    print('ok')
