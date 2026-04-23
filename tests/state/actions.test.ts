import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { createRecoveryDrillSnapshot } from '@/simulation/scenario';
import {
  forecastPublicVisitInvite,
  hydrateSnapshot,
  inspectPublicStoryFocus,
  invitePublicVisit,
  startGame,
  summarizeActivePublicVisits,
} from '@/state/actions';
import {
  BuildDragTrait,
  CampaignTrait,
  ClockTrait,
  EconomyTrait,
  InspectionTrait,
  MacroTrait,
  OperationsTrait,
  PhaseTrait,
  SettingsTrait,
  TowerTrait,
  ViewTrait,
} from '@/state/traits';

function createTestWorld() {
  return createWorld(
    PhaseTrait,
    TowerTrait,
    EconomyTrait,
    CampaignTrait,
    MacroTrait,
    OperationsTrait,
    ClockTrait,
    ViewTrait,
    SettingsTrait,
    BuildDragTrait,
    InspectionTrait,
  );
}

describe('state actions', () => {
  it('invites a public visit through the same campaign and cohort systems', () => {
    const world = createTestWorld();
    hydrateSnapshot(createRecoveryDrillSnapshot(), world);
    const initialSeed = world.get(ClockTrait)?.rngSeed;
    const forecast = forecastPublicVisitInvite(world);

    expect(forecast).toMatchObject({ canInvite: true });
    expect(forecast.behavior).toMatchObject({
      temperament: expect.any(String),
      summary: expect.any(String),
    });
    expect(forecast.behavior?.dealbreakers.length).toBeGreaterThan(0);
    expect(forecast.hostingPlan?.primary.label).toEqual(expect.any(String));
    expect(forecast.hostingPlan?.priorities.length).toBeGreaterThan(0);
    expect(world.get(ClockTrait)?.rngSeed).toBe(initialSeed);

    const result = invitePublicVisit(world);
    const tower = world.get(TowerTrait);
    const campaign = world.get(CampaignTrait);
    const clock = world.get(ClockTrait);

    expect(result).toMatchObject({ ok: true });
    expect(result.events).toContain('visit-inquiry');
    expect(tower?.visits).toHaveLength(1);
    expect(tower?.visits[0]).toMatchObject({ status: 'inquiry', spawnedAgents: 0 });
    expect(tower?.visits[0]?.label).toBe(forecast.label);
    expect(tower?.visits[0]?.targetRoomId).toBe(forecast.targetRoomId);
    expect(tower?.visits[0]?.targetRoomId).toEqual(expect.any(String));
    expect(campaign?.activeContracts.some((contract) => contract.source === 'visit')).toBe(true);
    expect(clock?.rngSeed).not.toBe(initialSeed);

    const readiness = summarizeActivePublicVisits(world);
    expect(readiness).toHaveLength(1);
    expect(readiness[0]).toMatchObject({
      label: forecast.label,
      phaseLabel: 'Accepted inquiry',
      targetRoomId: forecast.targetRoomId,
      representativeCount: expect.any(Number),
      spawnedAgents: 0,
    });
    expect(readiness[0]?.recommendations.length).toBeGreaterThan(0);
    expect(readiness[0]?.behavior.summary).toBe(forecast.behavior?.summary);
    expect(readiness[0]?.hostingPlan.primary.id).toEqual(expect.any(String));
  });

  it('forecasts blocked public invitations without mutating clock seed', () => {
    const world = createTestWorld();
    startGame(world);
    const initialSeed = world.get(ClockTrait)?.rngSeed;

    const forecast = forecastPublicVisitInvite(world);

    expect(forecast).toMatchObject({
      canInvite: false,
      label: null,
      targetRoomId: null,
    });
    expect(forecast.message).toContain('No credible public venue');
    expect(forecast.recommendations[0]).toContain('Build a cafe');
    expect(world.get(ClockTrait)?.rngSeed).toBe(initialSeed);
  });

  it('refuses public invitations when the tower has no credible venue', () => {
    const world = createTestWorld();
    startGame(world);

    const result = invitePublicVisit(world);
    const tower = world.get(TowerTrait);

    expect(result).toMatchObject({ ok: false });
    expect(tower?.visits).toHaveLength(0);
    expect(tower?.notifications.at(-1)?.text).toContain('No credible public venue');
  });

  it('attaches public story context to an inspection focus', () => {
    const world = createTestWorld();
    hydrateSnapshot(createRecoveryDrillSnapshot(), world);

    inspectPublicStoryFocus(
      { gx: 0, gy: 0 },
      {
        memoryLabel: 'Foreign prince and retainers',
        pressureReason: 'queues',
        headline: 'Vertical core bottleneck',
        metricLabel: 'Core load',
        metricValue: '100% pressure',
        diagnostic: 'Longest visible wait: 84 ticks on floor 2.',
        recommendation: 'Open transit lens and extend the elevator core.',
      },
      world,
    );

    const selection = world.get(InspectionTrait)?.selection;
    expect(selection?.context).toMatchObject({
      source: 'public-story',
      memoryLabel: 'Foreign prince and retainers',
      pressureReason: 'queues',
      headline: 'Vertical core bottleneck',
    });
    expect(selection?.context?.recommendation).toContain('Open transit lens');
  });
});
