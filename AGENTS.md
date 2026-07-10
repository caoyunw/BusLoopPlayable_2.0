# AGENTS.md

# BusLoop Mechanic Lab Working Rules

This repository is a mechanic design and playtesting lab, not an advertising deliverable. Keep context focused, prefer the existing module boundaries, and record durable decisions in the project docs.

## Default Context Route

For ordinary work, read:

1. `docs/project/playable-project-progress.md`
2. `docs/project/code-navigation.md`
3. The source files and paired tests mapped for the change

For current priorities or a handoff, also read `task_plan.md` and `progress.md`. Read `findings.md` when gameplay facts, assets, tuning, or module boundaries matter.

Legacy files under `docs/platforms/`, `docs/playable/`, and `docs/project/playable-multi-platform-execution-plan.md` are historical references. They are not the default SOP and do not create a requirement to rebuild advertising packages or store flows.

## Code Navigation

Before changing code:

1. Read `docs/project/code-navigation.md`.
2. Choose the closest change area.
3. Read the mapped source and tests.
4. Broaden with targeted `rg` only when the map is insufficient.
5. Update the navigation file when files or ownership boundaries change.

Exclude `node_modules`, `dist`, logs, generated artifacts, and archives from broad searches unless they are directly relevant.

## Mechanic-First Workflow

Mechanic definitions are the first source of truth. A new mechanic starts in `src/mechanic-registry.js` with complete metadata and remains `planned` until its gameplay is actually usable.

For implementation:

1. Define the rule and player-facing experience.
2. Keep mechanism-specific data and behavior isolated; reuse the base runtime contracts instead of adding a large branch tree to `src/main.js`.
3. Wire selection, URL state, pause/reset behavior, and failure recovery through the lab layer.
4. Add registry tests plus focused gameplay/runtime tests.
5. Verify the actual desktop and mobile browser experience before changing the status to `playable`.

The current base runtime is composed from `game-model`, `level-data`, `scene-view`, audio, vehicle motion/effects, and the scene editor. Do not silently invent Unity assets or authored values; preserve known gaps and evidence.

## Runtime And Editor Rules

- `src/main.js` owns assembly, not individual mechanic rules.
- `src/mechanic-registry.js` owns identity and descriptive metadata.
- `src/mechanic-lab.js` owns mechanic URL helpers and safe storage removal.
- `src/mechanic-library.js` owns the mechanism browser UI.
- The scene editor is a permanent lab tool and defaults to collapsed.
- Preserve authored scene defaults before applying local overrides.
- Treat `localStorage` as optional: read, write, migration, and removal failures must not prevent startup.
- Keep runtime-optimized web assets under `public/assets/runtime/`; keep Unity source exports under `public/assets/unity/`.

## Testing And Visual QA

Known baseline on 2026-07-09:

- `test/mechanic-registry.test.js`: 22/22 passing.
- Full `npm test`: 66/73 passing with 7 existing failures recorded in `task_plan.md`.
- `npm run build`: passing with the existing large-chunk warning.

Do not report the full suite as passing until the seven recorded debts are resolved. Use the narrowest relevant tests while implementing, then run the full suite and build for cross-module or release-facing changes.

Browser QA is required for layout or interaction work. Check desktop three-column layout, mobile drawers, nonblank canvas, mechanism selection, search/empty states, frozen planned-mechanic overlay, reset/end states, editor controls, and console errors. Record viewport and remaining gaps.

## Documentation Policy

Update:

- `docs/project/playable-project-progress.md` for user-visible milestones and verification changes.
- `findings.md` for durable gameplay, asset, storage, tuning, or architecture conclusions.
- `task_plan.md` when goals, phases, priorities, or known debt change.
- `docs/project/code-navigation.md` when files or responsibilities change.
- `progress.md` for meaningful handoffs.

Keep current sections concise and retain useful historical material under clearly marked historical/archive headings. Do not put internal absolute paths, secrets, or unverified conclusions in project docs.

## Editing On Windows

Prefer `apply_patch` for manual edits. If it repeatedly fails with a helper-launch error, use a targeted PowerShell edit limited to the requested files, then immediately re-read the changed content. Never use broad destructive rewrites as a workaround.
