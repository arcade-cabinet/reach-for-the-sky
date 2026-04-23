import conventionHall from './convention-hall.json';
import hospitalityWing from './hospitality-wing.json';
import skylineLandmark from './skyline-landmark.json';

export type RecoveryInstitution = 'skyline-landmark' | 'convention-hall' | 'hospitality-wing';
export type RecoveryPhase = 'soft-failure' | 'recovery-contract' | string;

export interface RecoveryArcStep {
  phase: RecoveryPhase;
  headline: string;
  brief: string;
  successCondition: string;
  failureEscalation?: string;
  rewardTrust?: number;
  rewardFunds?: number;
  penaltyTrust?: number;
}

export interface RecoveryArc {
  institution: RecoveryInstitution;
  label: string;
  trigger: {
    publicTrust?: number;
    tenantSatisfaction?: number;
    failedVisits?: number;
    direction: 'below' | 'at-or-above';
  };
  arc: RecoveryArcStep[];
}

type RawRecoveryArc = {
  institution: string;
  label: string;
  trigger: {
    publicTrust?: number;
    tenantSatisfaction?: number;
    failedVisits?: number;
    direction: string;
  };
  arc: Array<{
    phase: string;
    headline: string;
    brief: string;
    successCondition: string;
    failureEscalation?: string;
    rewardTrust?: number;
    rewardFunds?: number;
    penaltyTrust?: number;
  }>;
};

function narrow(data: RawRecoveryArc, expected: RecoveryInstitution): RecoveryArc {
  if (data.institution !== expected) {
    throw new Error(
      `recovery arc id mismatch: file declares "${data.institution}" but was registered as "${expected}"`,
    );
  }
  if (data.trigger.direction !== 'below' && data.trigger.direction !== 'at-or-above') {
    throw new Error(
      `recovery arc "${expected}" has invalid trigger.direction "${data.trigger.direction}"`,
    );
  }
  return data as unknown as RecoveryArc;
}

const AUTHORED_ARCS: readonly RecoveryArc[] = [
  narrow(skylineLandmark, 'skyline-landmark'),
  narrow(conventionHall, 'convention-hall'),
  narrow(hospitalityWing, 'hospitality-wing'),
];

function buildTable(): Record<RecoveryInstitution, RecoveryArc> {
  const table = {} as Record<RecoveryInstitution, RecoveryArc>;
  for (const arc of AUTHORED_ARCS) {
    if (table[arc.institution]) {
      throw new Error(
        `duplicate recovery institution "${arc.institution}" in src/content/recovery/*.json`,
      );
    }
    table[arc.institution] = arc;
  }
  return table;
}

export const RECOVERY_ARCS: Record<RecoveryInstitution, RecoveryArc> = buildTable();
