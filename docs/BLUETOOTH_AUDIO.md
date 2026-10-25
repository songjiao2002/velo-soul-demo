# Camera and system audio recovery

Build: `20261025-simple21`, Android preview 0.1.3 (includes the media20 camera/audio fixes). Website, download page, legacy companion IDs and all six QR files retain their existing addresses and content.

## Reported failures and changes

The user reported camera startup failures and Samsung headphone playback falling back to speakers or becoming silent. Physical Samsung reproduction is unavailable; the changes below address defects observed in code and automated regression cases, not a claim that every headset route has been verified.

- Camera startup requests a rear camera at an ideal 1280×720, then progressively drops optional constraints on supported capture errors. Permission denial is never retried automatically. The muted, inline video is visible before `play()`, with a bounded preview deadline. Late grants after exit or timeout are stopped. The UI offers retry and permission settings in English, Korean and Chinese.
- Native camera/microphone permission requests are serialized. Each request has a deadline and checks that the initiating screen/session still exists before opening hardware. A stalled request no longer permanently blocks the queue. First microphone startup allows time for human permission choices; already granted capture is immediate.
- Android explicitly requests camera/microphone permissions before WebView capture. Android 12+ requests `BLUETOOTH_CONNECT` once for an already paired headset when voice first starts. Denying it does not disable the phone microphone. App settings can restore a denied permission. No scanning, pairing, speaker override or explicit communication-device selection is added.
- iOS stops capture on actual background entry, not `willResignActive` while its own permission prompt is showing.
- The app does not force `navigator.audioSession.type`, set an output sink, or mute replies because an output device is absent from browser enumeration. The operating system controls the selected output. Microphone capture remains continuous between conversation turns.
- Packaged greetings use the HTML media element directly instead of being redirected into Web Audio. Android native/embedded browsers default to system media playback; normal browsers retain streaming, and the obsolete saved mode preference is ignored in 0.1.3. Complete audio clips can start later than streaming. This is a compatibility choice, not a promise of zero latency or forced Bluetooth output.
- Device/visibility changes resume interrupted active playback, including playback without an active microphone. Stopped conversations do not restart. Existing bounded microphone recovery still avoids opening a new stream after every reply.
- WeChat/Kakao and other embedded browser guidance preserves the original companion URL. Native fallback links use the public website, never `localhost`. The host app may still restrict media; Chrome or Samsung Internet is an available handoff, not a guaranteed route fix.

## Relevant GitHub references

These implementations informed the diagnosis. No third-party source was copied and no additional audio-routing dependency was introduced.

- [Capacitor WebView permission bridge](https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java): one pending media-permission callback motivates serializing capture requests.
- [Capacitor App lifecycle](https://github.com/ionic-team/capacitor-plugins/blob/main/app/README.md): iOS inactive and real background events differ.
- [Twilio AudioSwitch](https://github.com/twilio/audioswitch): paired-headset permissions and device change handling. Integrating its route controller alongside WebView would introduce another owner of audio mode/focus; that is not part of this fix.
- [LiveKit Android audio handler](https://github.com/livekit/client-sdk-android/blob/main/livekit-android-sdk/src/main/java/io/livekit/android/audio/AudioSwitchHandler.kt): audio mode, output routing and audio focus must be coordinated. This project retains OS routing rather than introducing a second communication session.
- [Android Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions): Android 12+ `BLUETOOTH_CONNECT` and legacy permission scope.

## Verification and remaining device checks

Regression tests cover constraints, permission denial, startup/play timeouts, late grants, cancellation during native preflight, interrupted playback without a mic, and default playback selection. Native CI compiles both platforms. Android instrumented tests exercise first camera permission, real emulator video frames, capture release, QR decoding and companion selection.

Emulator results cannot establish physical Bluetooth routing. On the user's Samsung device, confirm a saved introduction before opening the microphone, then several Korean/English conversation turns, switching to/from the system-selected headset, background/resume, and a denied-then-restored camera permission. If the system itself disconnects the headset, a webpage cannot reconnect its radio.

The 0.1.3 Sound help panel contains permission/system-routing guidance only. Device refresh, sound-test and playback-mode controls were removed to avoid competing playback and stale local mode overrides.
