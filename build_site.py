# Builds the website version: no inline WASM, JavaScript minified. Output: dist/site.html (CDN) and dist/site-local.html (node_modules).
import json, subprocess, re
d = 'src/'
head = open(d + 'head.html').read(); body = open(d + 'body.html').read()
js = open(d + 'app.js').read()
for mark, f in [('MAKERS', 'makers'), ('HARDWARE', 'hardware'), ('JOINTS', 'joints'), ('SKADIS', 'skadis'), ('EDITOR', 'editor'), ('PICTURE', 'picture'), ('PROMPT', 'prompt'), ('ACCOUNT', 'account')]:
    js = js.replace('// @@%s@@\n' % mark, open(d + f + '.js').read())
open('dist/site-app.js', 'w').write(js)
subprocess.run(['npx', 'esbuild', 'dist/site-app.js', '--minify', '--target=esnext', '--format=esm', '--outfile=dist/site-app.min.js', '--log-level=warning'], check=True)
mini = open('dist/site-app.min.js').read().replace('</script', '<\\/script')
font = json.dumps(json.load(open(d + 'helvetiker_bold.typeface.json')), separators=(',', ':'))
def imap(three, manifold):
    return json.dumps({"imports": {"three": three + "build/three.module.js", "three/addons/": three + "examples/jsm/", "manifold-3d": manifold}}, separators=(',', ':'))
def page(m, fonturl):
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="font-url" content="' + fonturl + '">\n<style>body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
        + head + body + '<script type="application/json" id="font-data">' + font + '</script>\n<script type="importmap">' + m + '</script>\n<script type="module">' + mini + '</script>\n</body>\n</html>\n')
open('dist/site.html', 'w').write(page(imap("https://cdn.jsdelivr.net/npm/three@0.186.1/", "https://cdn.jsdelivr.net/npm/manifold-3d@3.5.4/manifold.js"), "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/fonts/helvetiker_bold.typeface.json"))
open('dist/site-local.html', 'w').write(page(imap("/node_modules/three/", "/node_modules/manifold-3d/manifold.js"), "/node_modules/three/examples/fonts/helvetiker_bold.typeface.json"))
print(len(open('dist/site.html').read()))
