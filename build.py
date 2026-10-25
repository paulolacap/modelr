import json, base64
d = 'src/'
head = open(d + 'head.html').read(); body = open(d + 'body.html').read(); js = open(d + 'app.js').read().replace('// @@MAKERS@@\n', open(d + 'makers.js').read()).replace('// @@HARDWARE@@\n', open(d + 'hardware.js').read()).replace('// @@JOINTS@@\n', open(d + 'joints.js').read()).replace('// @@EDITOR@@\n', open(d + 'editor.js').read()).replace('// @@PICTURE@@\n', open(d + 'picture.js').read()).replace('// @@PROMPT@@\n', open(d + 'prompt.js').read())
font = json.dumps(json.load(open('src/helvetiker_bold.typeface.json')), separators=(',', ':'))
wasm = base64.b64encode(open('node_modules/manifold-3d/manifold.wasm', 'rb').read()).decode()
def imap(three, manifold):
    return json.dumps({"imports": {"three": three + "build/three.module.js", "three/addons/": three + "examples/jsm/", "manifold-3d": manifold}}, indent=1)
cdn = imap("https://cdn.jsdelivr.net/npm/three@0.186.1/", "https://cdn.jsdelivr.net/npm/manifold-3d@3.5.4/manifold.js")
loc = imap("/node_modules/three/", "/node_modules/manifold-3d/manifold.js")
def page(m):
    return (head + body
        + '<script type="application/json" id="font-data">' + font + '</script>\n'
        + '<script type="application/octet-stream" id="manifold-wasm">' + wasm + '</script>\n'
        + '<script type="importmap">' + m + '</script>\n'
        + '<script type="module">\n' + js + '</script>\n')
wrap = lambda c: ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<style>body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + c + '</body>\n</html>\n')
art = page(cdn)
open('dist/shape-workshop.html', 'w').write(art)
open('index.html', 'w').write(wrap(art))
open('dist/test.html', 'w').write(wrap(page(loc)))
print(len(art))
