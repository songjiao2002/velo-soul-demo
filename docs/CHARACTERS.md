# Original characters · 2026-10-25

The supplied 1536 × 1024 JPEG is the visual source of truth. Its bytes are
preserved in `public/assets/characters-original-20261025.jpg` (SHA-256
`4412873ca032102b50efc41d0248184204835d62c83e85563864b4643084e565`).
No generated replacements are used. SVG display windows select the original
poses; two cover windows exclude neighboring editorial text. Pastel grounds
remain because the supplied image is not a transparent, layered character file.

| Printed QR / stored bicycle ID | Display identity | First encounter | Sustained rest |
| --- | --- | --- | --- |
| `lumi` | 모리 · Mori · 莫里, explorer cat | Question mark, curious entrance | Dismount, look around |
| `bori` | 포포 · Popo · 波波, foodie hamster | Eating bread, playful entrance | Bag pose, then bread pose |
| `mori` | 루루 · Lulu · 露露, relaxed panda | Slow entrance | Lie down and sleep |

All three ride their own bicycles when valid GPS speed remains at least
4 km/h for 1.5 seconds. A speed at or below 1.5 km/h for 8 seconds establishes
rest. Uncertain, missing, stale (>15 seconds) or inaccurate (>40 m) speed fixes
do not establish movement or rest. Mid-range speeds preserve the preceding
state. Old QR URLs, PNG/SVG downloads, memory keys and server persona IDs stay
unchanged. No new sensor or microphone requests are made by animation.

The poses retain original proportions and clothing. CSS adds entrance timing,
small tilts, riding bounce, motion lines, bread gestures and sleep breathing.
This is screen-space 2D pose animation, not a newly rigged 3D character, true
pedaling skeleton or spatially anchored AR. Speech uses a small amplitude meter
so no replacement mouth is drawn over the user's face design. Reduced-motion
preferences disable decorative motion.

## Exact Korean lines

- Mori: “오늘은 어떤 재밌는걸 보러갈까?”
- Popo: “오늘은 어떤 맛있는걸 먹으러갈까?”
- Lulu, good current weather: “날씨가 좋으니 천천히가자”
- Lulu, bad current weather: “오늘은 그냥 쉬면 안되?”

The first voice introduces the new name, then the personality line. Lulu uses
a neutral opening until fresh weather is available. Weather never comes from
the illustration or a future rain forecast treated as current rain. Existing
current/forecast precautions and deduplication continue. Korean and English
introductions are packaged under `public/audio/characters13/` to avoid an API
round trip. Chinese input still receives English speech.

The existing three skill folders retain their IDs for compatibility, with
updated identities, embodiment rules and exact opening lines. Existing camera,
weather, memory-consent and factual-grounding boundaries remain in force.
