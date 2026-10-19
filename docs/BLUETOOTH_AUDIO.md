# Audio routes and Bluetooth recovery

The webpage cannot pair a Bluetooth headset, reconnect its radio, or force a route in a browser that does not expose output selection. A live microphone is not evidence that replies are playing through the headset. No physical Samsung device has been used to validate this release.

## Changes

- One microphone stream and one Web Audio context remain alive across listening, streaming replies, and interruption commands. Reply completion does not restart capture.
- Reserve the context during the initiating click; activate `play-and-record`, where supported, only after the microphone is granted. A brief context suspension during grant can recover before listening starts.
- A temporarily muted live track has a 4.5-second grace period. Bursts of `devicechange` do not shorten it. An ended track or persistent mute receives one bounded capture replacement, keeping the context. Pause/exit invalidates pending grants and stops late streams.
- Do not call native speech synthesis cancellation when that service is unused. Do not reset an idle HTML audio element on every cloud reply. Packaged greetings are routed into the same output graph as streamed speech; repeated preparation does not create more unlock pulses.
- Camera and chat include an audio-device panel in Korean, English and Chinese. Where `AudioContext.setSinkId` is available, select a permitted output; use the browser picker when offered. Selected-output loss mutes the shared output while checking, instead of deliberately selecting the speaker. Reconnection rechecks the same device. This protection relies on browser device-change notifications and cannot promise zero leaked samples during an OS switch.
- Microphone selection uses only a device explicitly chosen by the user, with an exact constraint and one deliberate replacement. Missing devices do not silently fall back to a different microphone. Input/output IDs are kept only in page memory and are never uploaded or saved to local storage.
- Unsupported browsers show system-routing instructions. A selected microphone label is displayed separately from output status.

## Camera / map view

The camera view now has Camera and Map buttons. Switching changes only presentation: it does not navigate, replace video/voice DOM, start another microphone, stop a reply or request permissions again. The camera remains in a visibly labelled thumbnail while map mode is active; it can still be turned off with the existing camera control. GPS updates show on the map; without a reliable fix the map is a labelled Seoul preview. Conversation and weather continue in either view. Returning to Camera keeps the same stream. Closing the view releases its map instance.

## Samsung / in-app browsers

Connect the headset before starting a conversation. In Samsung Quick panel, select it under **Media output**. Check the headset's audio/call options in Bluetooth settings (names vary by One UI/device). If WeChat or another embedded browser still routes to the phone speaker, open the same website in Chrome or Samsung Internet and check the system output after allowing the microphone. These browsers are alternatives, not a guarantee that output selection is supported.

Do not change routing while riding. A browser workaround cannot fix a headset disconnecting at the operating-system or Bluetooth-radio level.

## Verification

Tests cover repeated voice turns, grant ordering, interrupted contexts, short mute and device-change bursts, persistent mute, ended tracks, bounded retries, pending permission cancellation, deliberate input changes, output disconnect/reconnect, selection denial and stale enumeration. UI smoke tests cover the unsupported route and explicit device selection. Physical Samsung/Bluetooth verification remains necessary.

Primary references:

- [Samsung Media output](https://www.samsung.com/us/support/answer/ANS10001355/)
- [AudioContext.setSinkId](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId)
- [MediaDevices.selectAudioOutput](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput)
- [Chromium mobile output-selection limitation](https://issues.chromium.org/issues/444576985)
- [WebKit microphone route issue](https://bugs.webkit.org/show_bug.cgi?id=282939) — informs activation order; not proof of the reported Samsung cause.
