# Globe

A holographic three.js globe for a landing page: land, halo, grid, arcs and labelled city nodes.

**Live demo:** https://kaiotei.github.io/1333-globe/

Built by [Kaiotei](https://github.com/Kaiotei) for [13 <33 Covenant](https://1333covenant.com) and released as one of its open-source apps.

## Features

- One draw call each for land, halo, grid, arcs and city nodes; no per-city lights.
- The ocean is cut in the shader, not by a CPU pixel pass.
- Pointer parallax, a periodic glitch, reduced-motion support, and the loop pauses while the tab is hidden.
- City labels are DOM text with a glow, readable over any background.

## Run it

```sh
python -m http.server 8000
# then open http://localhost:8000/
```
It uses ES modules, so it has to be served; opening the file directly will not work.

## Make it yours

Drop `#globeContainer > #globeCanvas` into a page, add the CSS from `index.html`, and load `globe.js` as a module. Edit the `cities` list in `globe.js` (name, lat, lng) to change the labelled nodes and arcs.

**Stack:** three.js r185, one ES module.

## License

[AGPL-3.0](LICENSE). You can use, change and build on this. If you run a modified version for others over a network, you must share its source under the same license. Keep the credit to 13 <33 Covenant.

## More from 13 <33 Covenant

[1333-island-world](https://github.com/Kaiotei/1333-island-world) · [1333-changing-room](https://github.com/Kaiotei/1333-changing-room) · [1333-whole-armor](https://github.com/Kaiotei/1333-whole-armor) · [1333-jacobs-ladder](https://github.com/Kaiotei/1333-jacobs-ladder) · [1333-angelhub](https://github.com/Kaiotei/1333-angelhub) · [1333-bible-study](https://github.com/Kaiotei/1333-bible-study) · [1333-moon-calendar](https://github.com/Kaiotei/1333-moon-calendar) · [1333-guestbook](https://github.com/Kaiotei/1333-guestbook) · [1333-chat-widget](https://github.com/Kaiotei/1333-chat-widget) · [1333-contrast-check](https://github.com/Kaiotei/1333-contrast-check)
