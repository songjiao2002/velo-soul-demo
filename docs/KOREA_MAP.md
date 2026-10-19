# Korea map and opening UI

The opening screen uses actual OpenStreetMap geography served by OpenFreeMap. It initially previews Seoul; this is explicitly not the visitor's GPS position. Users may pan across South Korea and zoom to other regions covered by the provider. After GPS is enabled during a ride, the map shows the locally recorded trail. The three curated place buttons remain the existing officially sourced Gyeongbokgung/Gwanghwamun, Seoul Forest and Daelim Warehouse entries. Other visible roads, parks, place names and landmarks come from vector tiles; not every visible POI triggers a conversation.

`public/korea-map-style.mjs` is an independently authored style: warm paper background, pale green parks, blue-green water, cream roads with soft outlines, dashed paths, restrained labels, and a soul-colored GPS line. `korea-map.mjs` supplies custom palace/tree/cafe SVG markers. The three languages use the corresponding OSM name when present, with a native-name fallback. No satellite imagery, proprietary map screenshots or paid map key is used.

MapLibre GL JS 6.15.0 is vendored from the official npm distribution. Its upstream license and notices remain at `public/vendor/maplibre/LICENSE.txt` (BSD-3-Clause and dependency notices). The rendering module, worker and stylesheet are separate compressed assets, loaded only when a map becomes visible. Leaving the page destroys the map, cancels pending view work and removes markers. Failed network/WebGL loading offers retry while the rest of the app remains usable. No external font download is needed for the app's own UI; the map uses provider glyphs and system CJK fonts.

The map displays OpenFreeMap, OpenMapTiles and OpenStreetMap attribution. OSM data are ODbL licensed. Tile requests disclose the displayed area and IP to OpenFreeMap; the complete GPS route stays client-side. This map is not a routing engine, cycling-permission check or live business directory. OpenFreeMap's public instance has no SLA. Offline journey cards use a clearly labelled schematic trace, not a copied street map; photos and QR files remain unchanged.

Sources:

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js/tree/v6.15.0)
- [MapLibre style specification](https://maplibre.org/maplibre-style-spec/)
- [OpenFreeMap quick start](https://openfreemap.org/quick_start/)
- [OpenFreeMap source](https://github.com/hyperknot/openfreemap)
- [OSM copyright and ODbL](https://www.openstreetmap.org/copyright)

The opening UI keeps the original characters and QR destinations. The encounter page has a single main invitation, with optional ways to meet and permission details in a disclosure. Maps, card typography and language hierarchy are aligned with the same quiet visual style. Korean, English and Chinese are available throughout.
