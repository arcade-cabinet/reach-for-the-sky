import type { SaveSlotSummary, SimulationEventRecord } from '@/persistence/saveRepository';
import type { RenderStats } from '@/rendering/cutawayRenderer';
import { PRODUCTION_BUDGETS, PRODUCTION_RELEASE } from '@/simulation/content';
import type { SimulationSnapshot } from '@/simulation/types';

export interface DiagnosticsBundleInput {
  snapshot: SimulationSnapshot;
  saveSlots: readonly SaveSlotSummary[];
  recentEvents: readonly SimulationEventRecord[];
  rendererStats: RenderStats | null;
  preferencesReady: boolean;
  url?: string;
  userAgent?: string;
}

export interface DiagnosticsBundle {
  release: typeof PRODUCTION_RELEASE;
  budgets: typeof PRODUCTION_BUDGETS;
  createdAt: string;
  runtime: {
    url: string | null;
    userAgent: string | null;
    preferencesReady: boolean;
  };
  summary: {
    day: number;
    act: number;
    mode: SimulationSnapshot['campaign']['mode'];
    victory: SimulationSnapshot['campaign']['victory'];
    funds: number;
    population: number;
    rooms: number;
    agents: number;
    activeContracts: number;
    visits: number;
    memories: number;
    lensMode: string;
  };
  rendererStats: RenderStats | null;
  saveSlots: readonly SaveSlotSummary[];
  recentEvents: readonly SimulationEventRecord[];
  snapshot: SimulationSnapshot;
}

export function createDiagnosticsBundle(input: DiagnosticsBundleInput): DiagnosticsBundle {
  return {
    release: PRODUCTION_RELEASE,
    budgets: PRODUCTION_BUDGETS,
    createdAt: new Date().toISOString(),
    runtime: {
      url: input.url ?? null,
      userAgent: input.userAgent ?? null,
      preferencesReady: input.preferencesReady,
    },
    summary: {
      day: input.snapshot.clock.day,
      act: input.snapshot.campaign.act,
      mode: input.snapshot.campaign.mode,
      victory: input.snapshot.campaign.victory,
      funds: input.snapshot.economy.funds,
      population: input.snapshot.economy.population,
      rooms: input.snapshot.tower.rooms.length,
      agents: input.snapshot.tower.agents.length,
      activeContracts: input.snapshot.campaign.activeContracts.length,
      visits: input.snapshot.tower.visits.length,
      memories: input.snapshot.tower.visitMemories.length,
      lensMode: input.snapshot.view.lensMode,
    },
    rendererStats: input.rendererStats,
    saveSlots: input.saveSlots,
    recentEvents: input.recentEvents,
    snapshot: input.snapshot,
  };
}

export function diagnosticsFilename(bundle: DiagnosticsBundle): string {
  const createdAt = bundle.createdAt.replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
  return `reach-for-the-sky-diagnostics-${bundle.release.version}-${createdAt}.json`;
}
