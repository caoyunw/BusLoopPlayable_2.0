# Findings

## Current Durable Findings - 2026-07-08

### Active Level Layout

- The playable now targets imported level12-style data for `GameSceneDualQueue2` rather than the original 6-vehicle level1 prototype.
- Active data has 94 visible vehicles, two fixed queues with 219 groups each, and authored `vehicleDepthes` blocker data for 90 vehicles.
- Vehicle seat totals match fixed passenger queue totals by color. Initial movable vehicles are `1, 4, 34, 51`.

### Conveyor / Passenger Entry Parity

- Unity conveyor progress is based on actual spline path length: initial fill uses passenger speed, normal belt motion uses conveyor speed, both divided by spline length.
- Unity queue supply waits until the queue head is ready. During initial fill, empty belt slots clamp just before the entry with `InitialEntryOffsetPercent = 0.0001` until a passenger can enter.
- Web should reuse the full queue-entry visual path for both initial-fill and later refill groups.

### Vehicle / Passenger Materials

- Vehicle prefabs use full Unity color atlases; authored model UVs should remain active for window/light/body regions.
- Passenger prefabs are color-specific materials/textures rather than simple runtime swatches. Unity materials combine `_MainTex`, `_BaseCol`, and `_EmissionCol` through `AnimSimpleLit`.
- Current web tuning exposes passenger material color/brightness controls for parity adjustment.

### Effects / Audio / Shadows

- Effect_Hit uses ParticleHit_2/Circle_01_Add, ParticleHit_1/Round_02_Add, and ParticleHit/Round_01_Add at vehicle collision contact.
- Effect_SmokeTrail uses ParticleTrail/Round_01_Alp as a looping moving-vehicle trail.
- Core audio clips are wired for collision, passenger boarding, and full-vehicle departure.
- Real-time Three.js shadow maps were removed after experimentation; authored fake shadows are the active shadow layer.

### AppLovin Packaging

- When inserting large inlined JS/CSS strings into HTML, use function replacers with `String.replace`; plain replacement strings interpret minified `$&` sequences and can inject the matched `</head>` text into the bundle, causing `SyntaxError: Unexpected token '<'` and a loading screen stuck at 0%.
- Editor tuning saved in browser `localStorage` is not a delivery artifact. Before AppLovin packaging, export the tuning JSON and apply it into `src/scene-tuning.js`; the AppLovin single HTML should not include the scene editor UI or editor code.
- Production/AppLovin runtime must not restore editor tuning from `localStorage`; stale platform-preview storage can override newly baked camera/CTA adaptation values and make repeated package changes appear unchanged on device.
- iOS AppLovin store jumps should use `itms-apps://itunes.apple.com/app/id6746743297` as the first MRAID URL, with the `https://apps.apple.com/app/id6746743297` link retained as a fallback. The static AppLovin checker now verifies the direct iOS scheme is present.
- The 10-vehicle install gate must fire from a successful vehicle dispatch user gesture on real devices; waiting until an asynchronous arrival/frame update can lose the MRAID-open gesture context.

### Camera / Screen Adaptation

- Current trial design-cover behavior is fixed visible height: `camera.fitHeight` remains the vertical visible height across viewport aspects. With `fitHeight: 14.9`, short/wide screens keep visible height 14.9 and only reveal more horizontal content.
- The phone preview frame is an editor-only tool. Production/AppLovin must not add `is-phone-preview`, otherwise CSS can force the stage back to the 1080x2160 design aspect and prevent camera adaptation from seeing the real device/container aspect.

### Vehicle Arrow / Motion

- Bus prefab hierarchy treats Arrow as part of the vehicle visual. Web hit clips should move the vehicle model and arrow under one shared hit root.
- Arrow outline parity is approximated with a dark outline layer behind the white Arrow_01 geometry.

## Archive

Full detailed 2026-07-07 findings were archived to:

- `docs/project/archive/findings.full-2026-07-08.md`
