# Frontend Lane Bootstrap

This workspace is owned by **worker-1 (frontend/WebGL lane)** and follows `ARCHITECTURE.md` + `plan.md`.

## Responsibility Scope
- Build the `web/` application shell for `Character / Privacy / Video / Settings` routes.
- Own browser-side camera capture, frame upload pacing, preview updates, and diagnostics UI.
- Prepare the `Character` rendering lane for **WebGL/Three.js-based preview/compositing** while keeping the P0 transport contract as `session -> frame upload -> processed frame response`.
- Keep frontend state aligned with the architecture state model (`realtime`, `batch job`, `diagnostics`).

## Concrete Deliverables
1. `web/src/app/*` route skeleton for `page`, `character`, `privacy`, `video`, `settings`.
2. Shared UI buckets for `camera`, `uploader`, `preview`, `diagnostics`, `common`.
3. Feature modules for `character`, `privacy`, `video`, and `allowlist`.
4. Service/hooks/store layers for API contracts, realtime session control, frame uploads, and batch polling.
5. `public/presets-preview/` asset mount for character preset thumbnails.

## First Implementation Order
1. **App shell + route skeleton** — mirror `ARCHITECTURE.md` Phase 1 so the frontend entrypoints exist first.
2. **Realtime plumbing** — camera hook, session lifecycle, frame uploader, preview surface, diagnostics state.
3. **Privacy MVP UI** — align with `plan.md` Milestone L and Architecture Phase 2.
4. **Video batch UI** — upload, polling, download affordances.
5. **Character/WebGL lane** — preset chooser and Three.js-backed preview/render overlay integration once backend contracts land.

## Lane Boundaries / Assumptions
- Worker-2 owns `app/` inference/rendering implementations and GPU execution.
- Worker-3 owns `contracts/` and shared API/schema validation.
- Frontend remains contract-first: no bespoke payload shapes outside `contracts/`.
- WebGL/Three.js is reserved for the **character preview/rendering path**; privacy/video flows should stay DOM/canvas-first unless profiling proves otherwise.

## Current Scaffold
```text
web/
├── public/presets-preview/
└── src/
    ├── app/
    ├── components/{camera,uploader,preview,diagnostics,common}/
    ├── features/{character,privacy,video,allowlist}/
    ├── services/
    ├── hooks/
    ├── store/
    ├── types/
    └── lib/
```

## Next Feasible Task
Scaffold the route files and frontend module placeholders under `web/src/app` + `web/src/features/*` without introducing dependencies beyond the architecture baseline.
