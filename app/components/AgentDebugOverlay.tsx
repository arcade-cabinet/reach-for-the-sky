import type { Accessor, JSX } from 'solid-js';
import { lazy } from 'solid-js';
import type { TowerState } from '@/simulation/types';

export interface AgentDebugOverlayProps {
  tower: Accessor<TowerState>;
}

// Conditional lazy import: when `import.meta.env.DEV` is the literal `false` in
// a production build, Vite/esbuild evaluates the ternary to `null` at build
// time and tree-shakes the dev-only module (`AgentDebugOverlay.dev.tsx`) and
// its transitive imports out of the release bundle entirely.
//
// The grep target that verifies this is `agent-debug-overlay` — the marker
// declared inside the dev file. Presence of that string in `dist/assets/*.js`
// means the DCE failed and the overlay is shipping to players.
const LazyDevOverlay = import.meta.env.DEV
  ? lazy(() =>
      import('./AgentDebugOverlay.dev').then((module) => ({
        default: module.DevAgentDebugOverlay,
      })),
    )
  : null;

export function AgentDebugOverlay(props: AgentDebugOverlayProps): JSX.Element {
  if (!LazyDevOverlay) return null;
  return <LazyDevOverlay {...props} />;
}
