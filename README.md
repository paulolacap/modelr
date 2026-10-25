# Shape Workshop

A beginner-friendly 3D modeler for making things to 3D print, in the spirit of Tinkercad.
Everything runs in the browser; nothing is uploaded anywhere.

## Use it
Open `index.html` in Chrome, Edge, Firefox or Safari (it needs an internet
connection the first time to load Three.js). Export STL saves a `.stl` file directly.

## What it does
- 12 basic shapes plus text, and ready-made holes (box, round, 3 mm screw hole)
- Drag shapes across the plate; lift arrow, rotate rings and resize handles
- Exact sizes and positions in millimetres, snap from 0.1 mm to 10 mm
- Solid / hole switch; Group cuts holes out and fuses solids (watertight, via Manifold)
- Align, duplicate, drop to plate, 90° turns, undo/redo, autosave in the browser
- Save / open designs as `.json` files
- STL export is Z-up, in mm, sitting on the plate
- Storage makers: storage boxes (size, walls, rounded corners and bottom edge, dividers,
  finger scoops, finger notch, handle slots, label shelf or raised/engraved text,
  push-on / slide-on / hinged lids with adjustable fit gap, stacking foot),
  Gridfinity bins (units, stacking lip, magnet holes) and Gridfinity baseplates
- Draw your own: a dot editor for custom outlines. Drag dots, tap "+" on an edge or double-tap
  to add one, double-tap a dot to make it smooth, type exact X/Y, undo, zoom. Extrude (with twist
  and top taper) or spin into cups, bowls and vases. 15 starter templates; basic shapes can be
  converted to dots; trace over a picture
- From a picture (all in the browser, no AI): trace a logo or silhouette into editable outlines,
  lithophane, embossed relief tile, and HueForge-style colour layers (filament stack with TD values,
  layer height, simulated colour preview, colour-change list, height-map PNG)
- Hinges & locks: print-in-place, filament-pin, snap-on and living hinges; snap clip, sliding bolt,
  padlock hasp, magnet catch and turn button. Each has screw holes (optionally countersunk) and a fit gap
- Type what you want: a no-AI keyword box ("box 120 x 80 x 50 mm, 3 x 2 compartments, hinged lid").
  It suggests words as you type and shows what it understood and what it skipped
- Print check: printer bed size, floating parts, overhangs, thin walls, filament and time estimate

## Source
`src/` holds the page pieces (`head.html`, `body.html`, `app.js`, `makers.js`, `editor.js`, `picture.js`, `hardware.js`, `prompt.js`). `build.py` stitches them
together with the inlined font and the Manifold WASM binary (from the `manifold-3d@3.5.4` npm package).
Libraries: three@0.186.1, manifold-3d@3.5.4 (loaded from jsDelivr).

## Build
`npm install` (for the Manifold WASM file), then `python3 build.py`. It writes `index.html` (the whole app in
one file, open it in a browser) and `dist/` (Artifact page and a local test page).
