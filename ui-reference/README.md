# Published mobile UI

`ride/` contains the group's mobile UI published on 2026-11-26 and downloaded on 2026-11-27. `SOURCE.json` records its URL and file hashes. HTML omits the host's per-request Cloudflare script. `app.pretty.js` is the published JavaScript formatted with esbuild in UTF-8.

`npm run build` runs `build-reference.mjs`, copies the original styles, character renderer and interactions, and inserts `live-adapter.js` with imports from `live-imports.txt`. The resulting `public/reference-entry.generated.mjs` is bundled into the app. Do not edit the generated entry directly.

The adapters restore production APIs, streaming speech, Chinese Lulu voice, third-person afterwords and translation, and generation-2 QR validation. Changes to the reference itself should be made in this directory and rebuilt; the build fails when a required source anchor changes.

Run `npm start`, then open http://localhost:3000/. The server uses `.env` when available. Never place credentials in public files. `npm run native:prepare` builds the same UI for Android/iOS.

The current QR catalog is `public/qr-links.mjs`. Old unsigned bike links return HTTP 410 on the server and fail the app scanner. Older installed apps must update. QR identifiers are public routing identifiers, not authentication credentials.
