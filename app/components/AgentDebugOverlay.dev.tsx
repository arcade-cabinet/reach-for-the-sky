import type { Accessor, JSX } from 'solid-js';
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { Agent, TowerState } from '@/simulation/types';
import type { VisitCohort } from '@/simulation/visitors';

export const AGENT_DEBUG_OVERLAY_MARKER = 'agent-debug-overlay';
const HOTKEY = 'D';

export interface AgentDebugOverlayProps {
  tower: Accessor<TowerState>;
}

function hasDebugQueryFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === 'agents';
}

export function DevAgentDebugOverlay(props: AgentDebugOverlayProps): JSX.Element {
  const [enabled, setEnabled] = createSignal(hasDebugQueryFlag());

  const toggle = (event: KeyboardEvent) => {
    if (event.shiftKey && (event.key === HOTKEY || event.key === HOTKEY.toLowerCase())) {
      setEnabled((v) => !v);
    }
  };

  onMount(() => {
    window.addEventListener('keydown', toggle);
    onCleanup(() => window.removeEventListener('keydown', toggle));
  });

  const grouped = createMemo(() => {
    if (!enabled()) return [];
    const tower = props.tower();
    const byCohort = new Map<string, { cohort: VisitCohort | null; agents: Agent[] }>();
    for (const agent of tower.agents) {
      const key = agent.cohortId ?? `__type:${agent.type}`;
      const bucket = byCohort.get(key);
      if (bucket) {
        bucket.agents.push(agent);
      } else {
        const cohort = agent.cohortId
          ? (tower.visits.find((visit) => visit.id === agent.cohortId) ?? null)
          : null;
        byCohort.set(key, { cohort, agents: [agent] });
      }
    }
    return [...byCohort.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.agents.length - a.agents.length);
  });

  return (
    <Show when={enabled()}>
      <aside class="agent-debug-overlay" data-debug-marker={AGENT_DEBUG_OVERLAY_MARKER}>
        <header>
          <strong>Agent debug</strong>
          <small>Shift+D to toggle · ?debug=agents</small>
        </header>
        <ul class="agent-debug-list">
          {grouped().map((group) => (
            <li>
              <div class="agent-debug-group-head">
                <strong>{group.cohort?.label ?? group.key}</strong>
                <span>{group.agents.length} agents</span>
              </div>
              {group.cohort && (
                <div class="agent-debug-goals">
                  goals: {group.cohort.goals.join(', ')} · cohesion{' '}
                  {group.cohort.traits.groupCohesion.toFixed(2)} · patience{' '}
                  {group.cohort.traits.patience.toFixed(2)}
                </div>
              )}
              <div class="agent-debug-agents">
                {group.agents.slice(0, 6).map((agent) => (
                  <div class="agent-debug-row">
                    <span>{agent.id.slice(0, 10)}</span>
                    <span>{agent.state}</span>
                    <span>{agent.intent ?? '—'}</span>
                    <span>
                      → {agent.targetId.slice(0, 10)} ({agent.targetFloor})
                    </span>
                  </div>
                ))}
                {group.agents.length > 6 && (
                  <div class="agent-debug-row muted">…{group.agents.length - 6} more</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </Show>
  );
}
