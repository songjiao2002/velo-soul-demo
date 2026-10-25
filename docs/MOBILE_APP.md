# VELO SOUL mobile preview

App ID: `com.velosoul.companion` · Version: `0.1.0` · Android 7+ / iOS 15+.

The Android APK is a **test-signed preview**, not a Google Play release. The iOS target is a real Xcode project with a simulator build workflow. It is not a signed IPA or a published TestFlight app. The owner does not yet have Apple Developer membership.

## What is included

- Local bundled startup, all three cel-shaded companions, voice introductions, and original QR images.
- Home / Scan QR / Journeys bottom navigation, English default with Korean and Chinese interface options.
- Rear-camera scanner decodes original `?bike=lumi`, `?bike=bori`, `?bike=mori` QR URLs without replacing the printed codes. Unknown QR URLs are rejected rather than opened.
- Original character appearance and automatic riding/rest animation. Live ride activity follows GPS. The manual character editor was retired in 0.1.3.
- Native foreground GPS, WebView camera/microphone, streamed Qwen recognition, cloud speech, and local journey records. First camera and microphone prompts are serialized on native Android.
- Native image storage on the device and the system share sheet for exports. Journey thumbnails stay in IndexedDB. No cloud account is required.
- `/download.html`: Android APK download and an iPhone/iPad installation entry. Apple shows the honest pending-signing state until a real TestFlight invitation is configured.

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
6. After TestFlight approval, place the genuine `https://testflight.apple.com/join/...` invitation in `public/app-release.json` under `ios.testflight`. The Apple button then exposes that invitation. Until then it shows preparation status and a browser fallback.

## Before a production Android release

Replace the test/debug signature with an owner-controlled release/upload key kept outside Git, prepare an AAB and complete Play Console disclosures. A new debug key may require uninstalling an earlier preview, which deletes local data; export journeys before changing signing identity. Do not distribute a debug APK as a production release.

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
