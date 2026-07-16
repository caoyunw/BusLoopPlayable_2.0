# Playable Multi-Platform Execution Plan

Historical note: this file describes the former advertising-playable phase. It is retained for provenance only and is not the current mechanic-lab workflow. Do not use it to reintroduce platform packaging, store redirects, MRAID, CTA, or advertising QA unless the user explicitly asks to study the old delivery path.

## Historical implementation status

- Editor/AppLovin baseline prototype continues to use Three.js runtime particles for vehicle effects.
- Latest effect parity work: Effect_Ribbon departure burst now separates ParticleRibbon and ParticleSmoke, including Ribbon_01 3x3 atlas sampling.
- Effect_Ribbon movement now has per-particle speedOverLifetime and moveRange controls for Unity parity tuning.
- At that time, before platform packaging, the playable phase still needed manual visual comparison against Unity reference for:
  - ribbon frame variety,
  - smoke density,
  - initial particle size,
  - fade-out speed,
  - movement range after spawn,
  - speed curve / deceleration over lifetime,
  - direction/position relative to departing vehicle.
