# Rotatable, cel-shaded companions · 2026-10-25

The latest direction combines true 3D rotation with an illustrated 2D appearance.
The original JPEG remains the reference. The large companion uses articulated
geometry with two-band toon shading, fine outlines and orthographic projection.
The existing SVG characters appear immediately and remain the fallback when
WebGL is unavailable. This is a reconstruction, not pixel-identical reproduction.

| Existing QR ID | Display identity | Greeting | Rest |
| --- | --- | --- | --- |
| lumi | Mori / 모리 / 莫里 · explorer cat | Question mark, small wave | Look around |
| bori | Popo / 포포 / 波波 · foodie hamster | Eating bread | Reach for bread, nibble |
| mori | Lulu / 루루 / 露露 · relaxed panda | Slow arrival | Lie down, eyes closed, breathing |

All three cycle when GPS confirms riding. Head, eyes, mouth, hands, tail,
backpack and bicycle are separately animated. Feet follow the rotating pedals;
voice amplitude drives the mouth. Zero speed pauses pedaling. Reduced-motion,
offscreen visibility and hidden documents suppress unnecessary motion. Drag
horizontally to rotate, use left/right arrow keys, or Home to face forward.
The review page also offers front, side, back and optional auto-turn controls.
Animation never requests camera, microphone or location permissions.

The existing GPS hysteresis remains: >=4 km/h for 1.5 seconds establishes
riding, <=1.5 km/h for 8 seconds establishes rest. Missing, inaccurate (>40 m),
stale (>15 seconds) and out-of-order fixes cannot establish riding/rest.

## Dialogue

- Mori: “오늘은 어떤 재밌는걸 보러갈까?”
- Popo: “오늘은 어떤 맛있는걸 먹으러갈까?”
- Lulu, fresh good current weather: “날씨가 좋으니 천천히가자”
- Lulu, fresh bad current weather: “오늘은 그냥 쉬면 안되?”

The first voice introduces the new name before the personality line. Lulu uses
a neutral greeting until current weather is available. Existing forecast
precautions and deduplication remain. English and Korean intro clips are local
files under public/audio/characters13/. Chinese input still receives English
speech. UI defaults to English once for this redesign, then remembers explicit
later choices. Skill folder IDs and saved bicycle memories remain unchanged.


## Loading and export

`character-loader.mjs` starts SVG immediately, then imports the separately
compressed `character-toon.bundle.mjs` without delaying app readiness. One shared
WebGL renderer serves visible companions of at least 125 px; small avatars remain
SVG. It clears both color and depth between scenes. Context loss or loading failure
reveals the SVG again. Detached views release geometry, materials and listeners.
PNG export copies the visible rendered canvas, or rasterizes SVG as a fallback.
Camera capture itself is unchanged.

Model tests verify two-band materials, real rotation, pedal contact, zero-speed
behaviour, reduced motion, speech and personality rest states. Startup checks cover
the home page and all QR entrances; all six legacy QR byte hashes still match.
Physical Samsung/Bluetooth behaviour has not been retested for this visual change.

Implementation: Three.js MeshToonMaterial and OutlineEffect, pinned to 0.186.1.
References: https://threejs.org/docs/pages/MeshToonMaterial.html and
https://threejs.org/docs/pages/OutlineEffect.html. Third-party license is preserved
at public/vendor/three-LICENSE.txt. The original public QR destinations and all six QR image bytes are preserved.
