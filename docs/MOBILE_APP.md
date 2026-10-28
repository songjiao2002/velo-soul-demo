# VELO SOUL mobile preview

App ID: `com.velosoul.companion` · Source version: `0.1.8` · Android 7+ / iOS 15+.

Android 0.1.7 uses the **same owner-controlled release key as 0.1.3–0.1.6**. It includes the scanner-first home, directly visible companion descriptions, and transparent conversation captions in camera/map views. The public install entry points to the verified 0.1.7 APK. Existing 0.1.3–0.1.6 installations update in place after Android confirmation; do not uninstall them. Cycling companions, continuous voice, personality diaries and full-screen camera/map views are retained. This is not a Google Play release. The iOS target is a real Xcode project with a simulator build workflow. It is not a signed IPA or a published TestFlight app. The owner does not yet have Apple Developer membership.

## What is included

- Local bundled startup, all three cel-shaded companions, voice introductions, and original QR images.
- Scanner-first home with a rear-camera frame and one primary scan button. Companion descriptions appear only after selecting the scanned bicycle. UI/voice preferences are in Settings; English, Korean and Chinese interfaces remain available.
- Rear-camera scanner decodes original `?bike=lumi`, `?bike=bori`, `?bike=mori` QR URLs without replacing the printed codes. Unknown QR URLs are rejected rather than opened.
- Original character appearance and automatic riding/rest animation. Live ride activity follows GPS. The manual character editor was retired in 0.1.3.
- Native foreground GPS, WebView camera/microphone, streamed Qwen recognition, cloud speech, and local journey records. First camera and microphone prompts are serialized on native Android.
- Native image storage on the device and the system share sheet for exports. Journey thumbnails stay in IndexedDB. No cloud account is required.
- `/download.html`: Android APK download and an iPhone/iPad installation entry. The Apple button opens the original website. Safari → Share → Add to Home Screen provides the current iPhone installation path, using the owner-provided icon and a standalone web manifest. No service worker caches an old app shell; reopening online loads website updates. It is not an offline or background-audio app.

## Build

Requirements: Node 22+, Capacitor 8.5.3; Android SDK 36 and Java 21 for Android; macOS with Xcode 26+ for iOS. The project uses Swift Package Manager, not CocoaPods.

```sh
npm ci
npm run native:prepare
# Android, macOS/Linux
cd android
./gradlew assembleDebug
# Windows: gradlew.bat assembleDebug
```

Android output: `android/app/build/outputs/apk/debug/app-debug.apk`.
Open `ios/App/App.xcodeproj` on a Mac. Choose the App scheme and an iOS simulator to run without a distribution certificate.

The GitHub **Mobile preview** workflow builds both targets and uploads APK / iOS simulator artifacts. It only has repository read permissions, has no API key, and does not publish to stores. Builds run on mobile-related changes and by manual dispatch. Download artifacts before the 30-day retention expires; the published Android preview release is the durable public APK download.

`npm run native:prepare` copies an explicit public asset set into `native-www/` and syncs it to each platform. `.env`, database files, API credentials and signing keys are excluded. Do not set `server.url` to the live site: the UI is bundled in the app.

## Networking and safety boundaries

Only `/api/` requests use `https://velo-soul-demo-production.up.railway.app` in native builds. Real-time ASR uses that host's secure WebSocket. Qwen credentials remain on Railway. The backend permits exactly `https://localhost` (Android) and `capacitor://localhost` (iOS), in addition to normal same-origin web requests. Other website origins remain rejected; CORS never uses `*` or credentials. Existing API quotas and request validation still apply. CORS is a browser boundary, not authentication or device attestation; production-scale rollout needs abuse protection beyond this public demo.

Camera, microphone and GPS stop when the app goes to the background. This build does not promise lock-screen conversation, background GPS, or control over the phone's Bluetooth route. Mobile WebView/OS chooses audio routing. Test a real Samsung phone and iPhone with the intended headset before an outdoor study.

The old QR codes continue opening the website in a system camera/browser. The **in-app scanner** opens their corresponding companion inside the app. Automatic OS deep linking is not claimed: Android App Links/iOS Universal Links need the final signing certificate and Apple team association.

## Before TestFlight / App Store publication

1. Enroll the owner in Apple Developer and create an App Store Connect app. Confirm this bundle identifier is available for the owner's team before distribution.
2. In Xcode select the owner's Team and automatic signing. Set the final version/build number. No Apple password, private certificate or API key belongs in Git.
3. Review the existing permission descriptions, privacy manifest, privacy page and App Store Connect privacy answers against actual provider retention. Cloud voice, selected camera frames, chat content, approximate weather location and map-provider network requests must be considered. Never mark all data as “not collected” without reviewing these flows.
4. Test camera, QR scanning, GPS, Korean/English conversation, background/resume, system share, permission denial and Bluetooth on physical iPhones. The simulator cannot establish microphone/headset behavior.
5. Archive a **Release** build for Any iOS Device; distribute through App Store Connect. Complete export-compliance questions, screenshots, age rating, support/privacy URLs and review notes. Public store approval is not guaranteed.
6. The current Apple entry intentionally uses the website/Home Screen flow. Add a separate, verified TestFlight entry only when the owner is ready to distribute a signed iOS build.

## Before a production Android release

The fixed PKCS12 release key is backed up outside the project. The active publication route builds an unsigned release in the read-only Android package workflow, then signs and verifies it locally before uploading the public APK. The optional signed-CI route expects GitHub Actions secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD`; these have not been uploaded because explicit authorization is still pending. The normal Release build verifies the certificate against `android/release-certificate.sha256` and refuses missing keys. Never regenerate this key for subsequent updates. Increase Android versionCode for every published APK. Prepare an AAB and complete Play Console disclosures before a store release.

The original download page always points to the latest verified APK. Android decides whether to install or update; confirmation is still required. Native App.getInfo supplies a version hint to that page using a public HTTPS link. Browsers cannot reliably detect installed APKs. Previews 0.1.1 and 0.1.2 used different temporary debug keys, so export local journeys before a one-time uninstall/reinstall; uninstalling deletes app data. From 0.1.3, same-package, same-key updates preserve app data.

For manual release builds, set ANDROID_KEYSTORE_PATH and ANDROID_KEYSTORE_PASSWORD, then run `./gradlew assembleRelease`. Keep the PKCS12 file and password out of Git and APK contents. `assembleDebug` is for local development/instrumentation only.

## Verification

Local tests cover origin restrictions, CORS preflight, native API/WS routing, QR ID compatibility, GPS permission cancellation, camera/mic permission serialization and settings validation. Existing voice, weather, camera, character, memory and QR tests are included in the full suite. CI separately compiles native targets. Physical-device checks remain necessary.

References: [Capacitor setup](https://capacitorjs.com/docs/getting-started/environment-setup), [geolocation](https://capacitorjs.com/docs/apis/geolocation), [privacy manifest](https://capacitorjs.com/docs/ios/privacy-manifest), [App Store deployment](https://capacitorjs.com/docs/ios/deploying-to-app-store).

## Preview 0.1.1 validation

Build `20261025-app19` adds a companion-first phone home, clearer UI/voice selectors, a scanner that fits one phone screen and a consolidated character panel. The original six QR PNG/SVG files are unchanged. Android and iOS simulator builds passed in [Mobile preview](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40193928769). Android 15 WebView startup, three bundled QR decodes, choosing Lulu and native-origin API access passed in [Android device check](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40193947659). 215 local tests passed. Microphone, GPS and Bluetooth still require real phones.

## Preview 0.1.2 media recovery

Build `20261025-media20` adds bounded camera startup and permission recovery, a native Android permission bridge including paired-headset permission, corrected iOS permission-dialog lifecycle handling, and system media playback for Android embedded/native environments. See [camera and audio changes](BLUETOOTH_AUDIO.md) for references, latency tradeoff and physical-device limits. Use the existing `/download.html` page; original QR files and public URLs are preserved.

Validation: 225 local tests passed. Simulated English/Korean continuous-conversation and camera/map integration checks passed. [Mobile preview](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40200880858) compiled Android and iOS. [Android device check](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40200896849) passed first-use camera permission, actual emulator video dimensions, release on stop, all three QR decodes and native API access. Production English/Korean WAV synthesis returned valid audio. Physical Samsung Bluetooth output remains unverified.

## Preview 0.1.3 simplification

Build `20261025-simple21` removes manual character size/rotation/pose editing, simulated place/scenario triggers, repeated sound tests, and manual playback-mode controls. Existing records and QR codes are preserved. Navigation has three destinations: Home, Scan QR, Journeys. Character selection happens on Home. An explicit screen event replaces the editor’s page-wide mutation observer. Sound help retains native permission settings and same-link browser handoff but cannot change playback state. Output mode is selected once from the platform; obsolete local playback preferences are ignored. Camera/map, GPS/weather, continuous voice, text-chat fallback, capture/export and bicycle memories remain. Starting a ride no longer starts a competing prerecorded clip before the conversational introduction.

0.1.3 validation: 222 automated tests and English/Korean primary-flow DOM integration passed. Main bundle shrank from 353,255 to 325,554 bytes (about 8%); CSS shrank by about 4 KB. [Android/iOS builds](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40203273242) passed. The first device-check attempt lost its emulator before completing; the final update build must pass a fresh camera/QR check before APK publication. These checks do not validate a physical Samsung headset.

## Preview 0.1.3 install/update entry

Build `20261025-update22` adds fixed Android release signing, version-aware native update links, a direct iPhone web entry and English/Korean/Chinese Home Screen instructions. The provided green bicycle logo replaces app launcher icons and web icons; QR images and companion URLs are unchanged. iOS simulator builds remain available for development. Real iPhone Home Screen behavior and Samsung Bluetooth routing still require physical-device checks.

## Security and update checks (2026-10-26)

Build `20261026-security25` rejects malformed HTTP request targets and malformed realtime ASR JSON without terminating the server. Realtime handshake validation precedes shared quota reservation; completed transcription segments are bounded. The browser also rejects null, non-object and unknown transcription frames, closes the invalid stream and transcribes the retained utterance once through the existing fallback. Stale replies are ignored. Responses prohibit framing and object embedding. The application remains a public demo: origin checks and the shared request budget are not user authentication, and the in-process AI budget resets on process restart.

The download page validates the app ID, exact repository/tag/asset URL, integer build number, file size, SHA-256 and known signing certificate. It disables current/older downloads when opened from a newer native app, refreshes metadata on return/online and provides retry after timeout. These are metadata checks, not browser-side APK-byte verification. Android verifies the APK signature during installation. Early debug previews still require the documented one-time migration.

The release workflow accepts only the dispatch commit on main, with matching successful main-branch build and camera-check runs from the expected workflow paths. Checkout credentials are not persisted; the write token is scoped to publication steps. After actual APK signature/hash validation, publication verifies the GitHub asset digest and size and updates the original download metadata automatically. It refuses tag/source mismatches, repeat build numbers, downgrade and a changed main branch. Private signing material remains outside the repository. The pending explicit authorization to save it in GitHub Actions Secrets is still required before a new signed APK can be built there.

Validation: 234 local automated tests passed, including malformed WebSocket frames/HTTP targets, bounded transcription events, invalid release metadata, mismatched release artifacts and downgrade prevention. English/Korean simulated continuous-conversation flows and the three-language download UI passed. An npm audit of all dependencies initially reported three related moderate entries in the `@capacitor/cli → xcode → uuid` chain. Only `xcode`’s `uuid` was overridden to 11.1.1; its existing v4 use and iOS project parsing remain compatible. Final production/development audits reported zero known advisories. This addresses [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq); the app did not use the affected v3/v5/v6 buffer APIs directly. No private credentials are included in this change.

The Security scan workflow runs on main-branch changes and pull requests: dependency audit includes build tools; the application and update regression suite runs; CodeQL security-extended analyzes first-party JavaScript source (excluding duplicated bundles and vendored libraries). Startup cache-retry input is converted to a positive safe integer before forming the local script URL. CodeQL's file-to-network warning for the release publisher was reviewed as expected publication of validated public metadata to the fixed repository API, with the rationale recorded on the alert; it does not read private signing files or .env.

## Download page automatic release checks (2026-10-26)

The `download26` page keeps the original `/download.html` URL and QR codes. It checks verified release metadata on entry, every minute while visible, after returning from the background/back-forward cache and when connectivity returns. A single click on Download / Update performs another fresh check before requesting the latest verified APK. Simultaneous checks share one request; duplicate clicks do not start duplicate downloads; hidden pages stop polling. Current, newer, invalid or unavailable releases do not start a download. The visible published version, optional installed-version hint, last check time and manual retry are translated into English, Korean and Chinese.

Metadata refresh is automatic; APK installation still requires Android's confirmation. Browsers cannot detect arbitrary installed APKs. The page identified 0.1.2 as an earlier preview while its replacement was pending. The verified 0.1.3 publication now replaces that download. iPhone uses the unchanged website/Home Screen flow and loads website updates when reopened online. This page does not silently reload a ride or touch local journey data.
## Full-screen rides and automatic diaries (2026-10-26)

Camera entry and the Camera / Map switch now use the entire browser viewport by default. The OS browser bar may remain visible; this does not require the gesture-gated Fullscreen API. View switching retains the same video, map and voice session. GPS, weather, language and camera observation settings live in the collapsed More menu; recovery controls remain available on camera errors. Finish ride is always available in either view.

Finishing a ride writes its route, duration, photo previews and a factual EN/KO/ZH diary to the existing device-local IndexedDB store automatically. Notes save after a short pause, and in-app navigation waits for pending writes. Writes are serialized to prevent an earlier note overwriting a newer one. Storage failures keep the draft open with a retry/export message. Previously saved journeys remain readable. Clearing browser/app data removes these local records.

Export to Notes opens the system share sheet when available (Capacitor Share in the Android app, Web Share in supported browsers); the user chooses their notes app. Unsupported browsers download a UTF-8 text file. Copy diary is a separate fallback. The app does not silently write into Apple Notes or Samsung Notes. Exported text contains the diary and note; route and photo previews remain in the app and can also be exported as a card image. Generation runs locally without an AI API request.

## Locally signed Android 0.1.3 package (2026-10-26)

The Android package for local signing workflow compiles an unsigned, non-debuggable release variant and runs the app suite and dependency audit. It has read-only repository permissions, receives no signing secrets and cannot publish a release. The normal assembleRelease task still requires the configured private key.

The owner signs the downloaded artifact locally with the existing fixed PKCS12 key. Before publication, verify source revision, successful package/security/device-check runs, APK package/version, bundled build, original QR/icon assets, no private material in the archive, zip alignment, all APK signatures and the exact expected signing certificate. Upload only the signed APK and public checksums. Advance app-release.json only after GitHub confirms matching digest and size, preserving source/main and downgrade guards. No private key or password was uploaded to GitHub. The original signed-CI workflow remains optional and still requires separate authorization for GitHub Secrets.

This version includes full-screen camera/map views, continuous voice, automatic local ride diaries and Notes export. iPhone continues using the live website or Safari Add to Home Screen; there is no signed iOS installer. Previews 0.1.1/0.1.2 require exporting journeys before a one-time reinstall because their old signatures differ. Subsequent releases signed with the fixed key can update in place after Android confirmation.

Published source: `3fd2f3b27f7a37d6b7f9725bfdb2d9d94e3f32f8`, web build `20261026-ride27c`. [Package checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40318462323), [Android device checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40318465936) and [security scan](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40318469223) all passed on that revision. There were 241 automated tests; the emulator suite had zero failures/errors. All 92 bundled web/QR assets matched the local build. The public APK download was checked against its local SHA-256 after publication. The earlier emulator-disconnect failures remain in Actions history; the successful run supersedes them. Physical Samsung headset and iPhone installation behavior were not tested.

## 0.1.4 cycling companions and personal diary voices

Build `20261026-ride29` enters a bicycle animation as soon as a ride begins. Camera startup and replay preserve that state; camera/map switching preserves the same character. When GPS speed is unavailable, a presentation-only pedal cadence keeps the companion cycling while the recorded speed remains unknown. A valid zero speed stops the pedals; a sustained stop keeps the existing personality-specific resting behavior. Leaving the ride restores the normal greeting/idle states.

Cycling characters retain continuous 360-degree drag/keyboard rotation in the cel-shaded renderer. The complete bicycle, rider, wheels and pedal-linked feet turn together. Devices without WebGL retain the animated 2D fallback. Reduced-motion preferences still pause cycling movement.

Diaries use each companion's first-person voice in English, Korean and Chinese: Mori's questions and field notebook, Popo's playful bread wishes, and Lulu's unhurried reflection. Time, GPS distance and photo counts remain recorded facts; wishes never claim a meal, place or weather that was not recorded. Personal notes remain unchanged. On-screen diaries, text/Notes export and card images share this text. The new Android package uses version 0.1.4 / code 5 and the existing fixed key; public metadata advances only after package and device verification.

Published 0.1.4 source: `0d38a9cec2e42de0a09dff4e20b161d568b2f39c`. [Package checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40321721049), [Android device checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40321727005) and [security scan](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40321732351) passed. The 245 automated tests include cycling without fabricated speed, rest/restart, all three characters' pedal linkage throughout 360-degree rotation, and three-language diary voices. The production-bundle DOM flow preserves character state, camera/microphone and dialogue across view switches. Browser checks confirmed WebGL rotation beyond a full turn and pointer dragging while cycling. The 92 packaged assets, fixed certificate, APK version and publicly downloaded SHA-256 matched verification. Website URLs and six original QR images remain unchanged.

## 0.1.5 forward cycling correction (2026-10-28)

Build `20261028-forward30` corrects two independent issues. The 3D bicycle's front wheel is at local +Z, but wheel and crank rotations previously drove their upper points toward -Z. Both now rotate forward and the feet follow the corrected pedal coordinates. The left-facing SVG fallback's wheel rotation now matches its already-correct pedal orbit. Regression checks measure movement toward the actual front wheel at five viewing angles, rather than comparing rotation to the same implementation formula.

The riding AR overlay now starts facing away from the camera toward the road, using a slight rear three-quarter angle. Portraits and camera-free introductions keep their original facing. Dragging and keyboard rotation still turn through 360 degrees; map/camera switching retains the chosen angle. Zero speed and reduced-motion preferences still pause pedaling. This is camera-overlay presentation, not world-anchored AR navigation.

Android 0.1.5 / code 6 uses the same package and fixed release key as 0.1.3/0.1.4. Diary data and original QR codes are unchanged. Public install metadata advances only after the package and device checks pass and the signed download is verified.

Published 0.1.5 source: `9112d52513018d662fbf7ec55f9fe4b7e2630a6b`. [Package checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40624723022), [Android device checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40624725966) and [security scan](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40624729220) passed. All 248 automated tests passed. Browser verification showed all three riders facing down the road and preserved cycling during pointer rotation. The production-bundle camera/map/voice/diary flow passed. All 92 packaged assets matched the local build; the fixed signing certificate matched 0.1.4. The public APK SHA-256 and size were verified after publication. The original website/download URLs and all six QR files are unchanged. Physical Samsung headset behavior was not retested.

## Preview 0.1.6 scanner-first home

Build `20261028-scanhome32d` removes the homepage character list and top navigation. The first screen contains the QR camera frame; camera permission is requested when Scan is tapped. A successful scan displays only that bicycle’s companion name, personality and story. Settings retain UI/voice language and original PNG QR downloads. Small-phone layouts keep the primary button visible. Android versionCode is 7 and uses the existing fixed release certificate; 0.1.3–0.1.5 installations can update in place. The public download metadata now points to the verified 0.1.6 APK. The iPhone Home Screen edition already uses the updated original website.

0.1.6 verification: [package build](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40669490691), [Android camera/QR test](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40669495379) and [security checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40669499145) passed for source `f7f7807f744f5b1793a9275e723d0818bf2e5085`. All 248 automated tests passed. Local signing checked packaged assets, unchanged QR images, package identity, increasing versionCode and the original certificate; the public APK download was checked against its SHA-256 and size. Android emulator checks cover actual camera permission/video, all three bundled QR decodes and the selected companion introduction. Real Samsung headset behavior was not retested.

## Preview 0.1.7 transparent conversation captions

Build `20261028-caption34` removes the filled background, border, blur and box shadow from both the rider transcript and companion reply in the camera/map ride view. Camera captions use white text with a dark shadow; map captions use dark text with a light shadow. Short companion descriptions remain directly visible after scanning. Android versionCode 8 retains the original signing certificate. The original public download entry now points to the verified 0.1.7 APK.

0.1.7 verification: [package build](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40671062520), [Android camera/QR test](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40671066980) and [security checks](https://github.com/songjiao2002/velo-soul-demo/actions/runs/40671071245) passed for source `3cafa519cc656b2dad59be1b727d056a887fc1fa`. All 248 automated tests passed. Browser CSS inspection confirmed fully transparent backgrounds, no backdrop blur and no panel shadows for both transcript and reply, in camera and map modes. All three scanned companion introductions are directly displayed. Local signing verified 92 packaged assets, unchanged QR images and the original certificate; the public APK was checked against its digest and size. Physical Samsung headset behavior was not retested.

## Preview 0.1.8 study participant flow

Build `20261028-study35` removes QR downloads, camera-free preview, the separate welcome GPS panel and the alternate-entry/permission explanation section from the participant encounter. The main start action still requests the actual camera, microphone and foreground GPS permissions. Companion descriptions remain directly visible. Original QR files and destinations are unchanged. The separate `/manage.html` desktop page provides three original PNG downloads and printable bicycle cards, with an entry in the download page footer. It exposes only public QR material and has no participant-record or configuration access. It is not included in the native bundle. Android versionCode 9 retains the release certificate; the public APK pointer stays on 0.1.7 until validation finishes.

### Study encounter and voice controls (2026-10-28)

The scanned bicycle shows five fictional, personality-specific rider reviews with star ratings in English, Korean, or Chinese. These fixtures are labelled as samples and never enter public memory storage or model context. Actual end-of-ride notes and withdrawal controls remain separate. Riding uses accessible play and stop icons with no visible conversation captions or introductory instructions. Permission, connection, and audio recovery errors remain visible. Desktop QR management stays in the download page’s bottom-right footer; original QR targets remain unchanged.

Diary generation now uses three dedicated server skills: diary-mori (lumi), diary-popo (bori), diary-lulu (mori). At ride end, bounded photo previews (up to 3), completed conversation pairs (up to 8), and uncertain camera impressions (up to 6) are sent to the existing Qwen service; exact GPS and sample reviews are excluded. Results are saved locally with the ride and exported with a captured-photo cover. Failed generation preserves photos and a local fallback and exposes retry. Written EN/KO/ZH is independent of the voice language fallback. API origin checks, payload limits, shared budget, provider-error sanitisation and client cancellation also apply to /api/diary.
