# Published mobile UI

`ride/` is the group's published site downloaded on 2026-11-16. `SOURCE.json` records the source URL and hashes. Preserve these files as the reference; `app.pretty.js` is the same script formatted with esbuild.

`npm run build` runs `build-reference.mjs`, copies the original styles, character renderer and interactions, and inserts `live-adapter.js` with imports from `live-imports.txt`. The resulting `public/reference-entry.generated.mjs` is bundled into the app. Do not edit the generated entry directly.

The adapters restore production APIs, streaming speech, Chinese Lulu voice, third-person afterwords and translation, and generation-2 QR validation. Changes to the reference itself should be made in this directory and rebuilt; the build fails when a required source anchor changes.

Run `npm start`, then open http://localhost:3000/. The server uses `.env` when available. Never place credentials in public files. `npm run native:prepare` builds the same UI for Android/iOS.

The current QR catalog is `public/qr-links.mjs`. Old unsigned bike links return HTTP 410 on the server and fail the app scanner. Older installed apps must update. QR identifiers are public routing identifiers, not authentication credentials.
