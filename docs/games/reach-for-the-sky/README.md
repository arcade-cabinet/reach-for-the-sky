# Reach for the Sky

An isometric skyscraper construction and management simulation.

## Creative Pillars

- Vertical ambition: every placement should make the tower feel taller.
- Readable stacking: modules need clear shapes and costs.
- Day-cycle economy: time, rent, and income should be visible through light and HUD rhythm.

## Presentation Direction

The skyscraper starts as a seeded mixed-use tower rather than an empty lot. Floor plates, elevator and stair cores, a luminous crown, window grids, cloud layers, and changing sun/fog color make the tower read as a 3D architectural object. Build placement fills deterministic bays so growth feels deliberate and inspectable.

## Responsive and Android Contract

- The root fills its parent with `GameViewport`.
- Responsive camera framing keeps the tower centered across portrait and landscape.
- Map controls and the HUD build button support mouse and touch interaction.
- HUD and tool selection must stay edge-aligned.
- Android packaging uses the standalone Capacitor app shell.

## Stack

React Three Fiber, Koota
