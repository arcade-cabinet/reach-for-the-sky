import { GoalEvaluator, Think } from 'yuka';
import type { BuildingId, EconomyState, LensMode } from './types';
import type { CohortExperienceContext, CohortFriction, VisitCohort } from './visitors';
import { describeVisitorBehavior, evaluateCohortFriction } from './visitors';

export type VisitorHostingActionId =
  | 'expand-transit'
  | 'clean-public-rooms'
  | 'staff-service'
  | 'buffer-noise'
  | 'protect-privacy'
  | 'prove-safety'
  | 'harden-weather'
  | 'preserve-current-plan';

export interface VisitorHostingPriority {
  id: VisitorHostingActionId;
  label: string;
  pressureReason: string | null;
  lensMode: LensMode;
  toolId: BuildingId | null;
  score: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
}

export interface VisitorHostingPlan {
  primary: VisitorHostingPriority;
  priorities: VisitorHostingPriority[];
  summary: string;
}

interface HostingPlanOwner {
  priorities: VisitorHostingPriority[];
  selectedPriority: VisitorHostingPriority | null;
}

interface PriorityDraft {
  id: VisitorHostingActionId;
  label: string;
  pressureReason: string | null;
  lensMode: LensMode;
  toolId: BuildingId | null;
  rawScore: number;
  rationale: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function urgencyFor(score: number): VisitorHostingPriority['urgency'] {
  if (score >= 72) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}

function priorityFromDraft(draft: PriorityDraft): VisitorHostingPriority {
  const score = Math.round(clamp(draft.rawScore));
  return {
    id: draft.id,
    label: draft.label,
    pressureReason: draft.pressureReason,
    lensMode: draft.lensMode,
    toolId: draft.toolId,
    score,
    urgency: urgencyFor(score),
    rationale: draft.rationale,
  };
}

class HostingPriorityEvaluator extends GoalEvaluator {
  readonly priority: VisitorHostingPriority;

  constructor(priority: VisitorHostingPriority) {
    super(1);
    this.priority = priority;
  }

  override calculateDesirability(): number {
    return this.priority.score / 100;
  }

  override setGoal(owner: HostingPlanOwner): void {
    owner.selectedPriority = this.priority;
  }
}

function choosePrimaryWithYuka(priorities: VisitorHostingPriority[]): VisitorHostingPriority {
  const owner: HostingPlanOwner = { priorities, selectedPriority: null };
  const thinker = new Think(owner);
  for (const priority of priorities) thinker.addEvaluator(new HostingPriorityEvaluator(priority));
  thinker.arbitrate();
  return owner.selectedPriority ?? priorities[0];
}

function preservePriority(cohort: VisitCohort): VisitorHostingPriority {
  const behavior = describeVisitorBehavior(cohort);
  return {
    id: 'preserve-current-plan',
    label: 'Preserve the visit pattern',
    pressureReason: null,
    lensMode: 'sentiment',
    toolId: null,
    score: 18,
    urgency: 'low',
    rationale: `${cohort.label} has no obvious live blocker. Protect ${behavior.values[0]} and avoid creating new queues before arrival.`,
  };
}

export function planVisitorHosting(
  cohort: VisitCohort,
  economy: EconomyState,
  context: CohortExperienceContext = {},
  friction: CohortFriction = evaluateCohortFriction(cohort, economy, context),
): VisitorHostingPlan {
  const traits = cohort.traits;
  const quietDemand = Math.max(0, 1 - traits.noiseTolerance);
  const behavior = describeVisitorBehavior(cohort);
  const drafts: PriorityDraft[] = [
    {
      id: 'expand-transit',
      label: 'Protect arrival routes',
      pressureReason: 'queues',
      lensMode: 'transit',
      toolId: 'elevator',
      rawScore:
        (economy.transitPressure / 100) * (1 - traits.patience) * 74 +
        (friction.reasons.includes('queues') ? 22 : 0) +
        (traits.groupCohesion > 0.82 ? 8 : 0),
      rationale: `Transit is at ${economy.transitPressure}%; this group will remember visible waiting.`,
    },
    {
      id: 'clean-public-rooms',
      label: 'Clean public-facing rooms',
      pressureReason: 'cleanliness',
      lensMode: 'maintenance',
      toolId: 'maint',
      rawScore:
        ((100 - economy.cleanliness) / 100) * traits.cleanlinessDemand * 76 +
        (friction.reasons.includes('cleanliness') ? 20 : 0),
      rationale: `Cleanliness is ${economy.cleanliness}%; their cleanliness demand is ${Math.round(
        traits.cleanlinessDemand * 100,
      )}%.`,
    },
    {
      id: 'staff-service',
      label: 'Match service expectations',
      pressureReason: 'service',
      lensMode: 'maintenance',
      toolId: 'restroom',
      rawScore:
        (economy.servicePressure / 100) *
          (traits.statusSensitivity * 0.45 + traits.spendingPower * 0.35 + 0.2) *
          70 +
        (friction.reasons.includes('service') ? 18 : 0),
      rationale: `Service pressure is ${economy.servicePressure}%; ${behavior.moneySignal} groups punish thin service coverage.`,
    },
    {
      id: 'buffer-noise',
      label: 'Buffer noisy public space',
      pressureReason: 'noise',
      lensMode: 'privacy',
      toolId: 'skyGarden',
      rawScore:
        ((100 - (context.noiseControl ?? 70)) / 100) * quietDemand * 86 +
        (cohort.goals.includes('quiet') ? 16 : 0) +
        (friction.reasons.includes('noise') ? 22 : 0),
      rationale: `Noise control is ${context.noiseControl ?? 70}%; this cohort values ${behavior.values
        .slice(0, 2)
        .join(' and ')}.`,
    },
    {
      id: 'protect-privacy',
      label: 'Protect privacy and status',
      pressureReason: 'privacy',
      lensMode: 'privacy',
      toolId: 'security',
      rawScore:
        ((100 - (context.privacyComfort ?? 70)) / 100) *
          (traits.privacyDemand * 0.72 + traits.statusSensitivity * 0.28) *
          86 +
        traits.ego * traits.statusSensitivity * 14 +
        (friction.reasons.includes('privacy') ? 22 : 0),
      rationale: `Privacy comfort is ${context.privacyComfort ?? 70}%; uncontrolled crowds are a dealbreaker for this profile.`,
    },
    {
      id: 'prove-safety',
      label: 'Prove code and security readiness',
      pressureReason: 'safety',
      lensMode: 'safety',
      toolId: 'security',
      rawScore:
        ((100 - (context.safetyReadiness ?? 70)) / 100) *
          (traits.statusSensitivity * 0.55 + traits.groupCohesion * 0.3 + 0.15) *
          82 +
        (friction.reasons.includes('safety') ? 24 : 0),
      rationale: `Safety readiness is ${context.safetyReadiness ?? 70}%; public legitimacy depends on visible control.`,
    },
    {
      id: 'harden-weather',
      label: 'Harden skyline exposure',
      pressureReason: 'weather',
      lensMode: 'safety',
      toolId: 'weatherCore',
      rawScore:
        ((context.weatherRisk ?? 0) / 100) *
          (cohort.goals.includes('publicity') ? 58 : 38) *
          (1.1 - traits.patience * 0.35) +
        (friction.reasons.includes('weather') ? 22 : 0),
      rationale: `Weather risk is ${context.weatherRisk ?? 0}%; skyline-facing visits amplify exposure.`,
    },
  ];

  const priorities = drafts
    .map(priorityFromDraft)
    .filter((priority) => priority.score >= 14)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (priorities.length === 0) {
    const primary = preservePriority(cohort);
    return {
      primary,
      priorities: [primary],
      summary: `${cohort.label}: ${behavior.temperament}; protect the current pattern.`,
    };
  }

  const primary = choosePrimaryWithYuka(priorities);
  return {
    primary,
    priorities,
    summary: `${cohort.label}: ${behavior.temperament}; ${primary.label.toLowerCase()} first.`,
  };
}
