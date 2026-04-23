# Reach for the Sky Vector Library

This directory is the authored 2D visual source for precise tower interiors and core details.

The renderer composes these SVGs as Pixi textures. Pixi still owns batching, placement, camera, lenses, agents, and simulation overlays; SVG owns authored architectural detail that should not be hand-built from primitive rectangles.

Conventions:

- `rooms/`: room interior composites scaled into tower bays.
- `cores/`: elevator/shaft composites used by transit systems.
- `agents/`: worker, guest, janitor, and waiting-state actor vectors for dynamic simulation readability.
- `ui/`: construction ghosts and data-lens badges that replace debug-style Pixi rectangles.
- `environment/`: authored clouds, skyline silhouettes, and site markers for atmospheric depth.
- `elements/`: reusable authored components composed by `src/rendering/roomCompositions.ts`.
- Structural elements such as `facade-rib`, `floor-slab`, and `ceiling-rail` should appear across room templates so the tower reads as an engineered building rather than isolated icons.
- Keep colors restrained and material-oriented. Use saturated color only for data lenses and gameplay alerts.
- Prefer paths, strokes, and reusable motifs over flat category blocks.
