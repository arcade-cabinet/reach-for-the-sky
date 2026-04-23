import { beforeEach, describe, expect, it } from 'vitest';
import { advanceGameSpine } from '@/simulation/campaign';
import {
  createInitialCampaign,
  createInitialClock,
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
} from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import {
  createRecoveryDrillSnapshot,
  createSkylineCharterSnapshot,
  createWeatherStressSnapshot,
} from '@/simulation/scenario';
import type {
  BuildingId,
  CampaignState,
  ClockState,
  EconomyState,
  MacroState,
  OperationsState,
  TowerState,
} from '@/simulation/types';

beforeEach(() => resetIdsForTests());

interface Fixture {
  tower: TowerState;
  economy: EconomyState;
  campaign: CampaignState;
  macro: MacroState;
  operations: OperationsState;
  clock: ClockState;
}

function freshFixture(): Fixture {
  return {
    tower: createInitialTower(),
    economy: createInitialEconomy(),
    campaign: createInitialCampaign(),
    macro: createInitialMacro(),
    operations: createInitialOperations(),
    clock: { ...createInitialClock(), speed: 1 },
  };
}

function applyBuild(
  fixture: Fixture,
  tool: BuildingId,
  start: { gx: number; gy: number },
  end: { gx: number; gy: number },
): Fixture {
  const result = placeBuild(fixture.tower, fixture.economy, tool, { start, end }, 0);
  if (!result.ok) throw new Error(result.message);
  const spine = advanceGameSpine({
    tower: result.tower,
    economy: result.economy,
    campaign: fixture.campaign,
    macro: fixture.macro,
    operations: fixture.operations,
    clock: fixture.clock,
    events: ['build'],
  });
  return {
    tower: spine.tower,
    economy: spine.economy,
    campaign: spine.campaign,
    macro: spine.macro,
    operations: spine.operations,
    clock: fixture.clock,
  };
}

describe('campaign game spine', () => {
  it('turns the first construction loop into act progression instead of a hard-coded checklist', () => {
    let fixture = freshFixture();
    for (const [tool, start, end] of [
      ['lobby', { gx: 0, gy: 0 }, { gx: 3, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 3, gy: 1 }],
      ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
      ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
    ] as const) {
      fixture = applyBuild(fixture, tool, start, end);
    }

    expect(fixture.campaign.completedContracts[0]?.id).toBe('act-1-viable-core');
    expect(fixture.campaign.act).toBe(2);
    expect(fixture.campaign.permits).toContain('working-core');
    expect(
      fixture.campaign.activeContracts.some(
        (contract) => contract.id === 'act-2-stable-operations',
      ),
    ).toBe(true);
  });

  it('derives tower identity and venue readiness from actual meso layout', () => {
    let fixture = freshFixture();
    for (const [tool, start, end] of [
      ['lobby', { gx: 0, gy: 0 }, { gx: 8, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 8, gy: 1 }],
      ['cafe', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
      ['hotel', { gx: 3, gy: 1 }, { gx: 4, gy: 1 }],
      ['retail', { gx: 5, gy: 1 }, { gx: 6, gy: 1 }],
      ['gallery', { gx: 0, gy: 2 }, { gx: 2, gy: 2 }],
    ] as const) {
      if (tool === 'gallery') {
        fixture = applyBuild(fixture, 'floor', { gx: 0, gy: 2 }, { gx: 2, gy: 2 });
      }
      fixture = applyBuild(fixture, tool, start, end);
    }

    expect(['hospitality', 'mixed-use', 'civic']).toContain(fixture.campaign.towerIdentity);
    expect(fixture.operations.venueCredibility).toBeGreaterThanOrEqual(30);
    expect(fixture.macro.tourismDemand).toBeGreaterThan(15);
  });

  it('generates reactive contracts from operating pressure instead of milestone scripts', () => {
    const fixture = freshFixture();
    const spine = advanceGameSpine({
      ...fixture,
      campaign: { ...fixture.campaign, act: 3, permits: ['foundation', 'operations-permit'] },
      economy: { ...fixture.economy, transitPressure: 92, servicePressure: 0 },
      events: [],
    });

    expect(spine.campaign.activeContracts.some((contract) => contract.source === 'transit')).toBe(
      true,
    );
  });

  it('turns failed pressure contracts into explicit recovery work', () => {
    const fixture = freshFixture();
    const pressured = advanceGameSpine({
      ...fixture,
      campaign: { ...fixture.campaign, act: 3, permits: ['foundation', 'operations-permit'] },
      economy: { ...fixture.economy, transitPressure: 92, servicePressure: 0 },
      events: [],
    });

    expect(
      pressured.campaign.activeContracts.some((contract) => contract.source === 'transit'),
    ).toBe(true);

    const failed = advanceGameSpine({
      ...pressured,
      clock: { ...fixture.clock, day: 5 },
      economy: { ...pressured.economy, transitPressure: 92 },
      events: [],
    });

    const recovery = failed.campaign.activeContracts.find(
      (contract) => contract.source === 'recovery-transit',
    );
    expect(failed.campaign.failedContracts.some((contract) => contract.source === 'transit')).toBe(
      true,
    );
    expect(recovery).toMatchObject({
      kind: 'reactive',
      rewardTrust: expect.any(Number),
      penaltyTrust: 0,
    });
  });

  it('scores contract progress and raises deadline pressure before binary failure', () => {
    let fixture = freshFixture();
    fixture = applyBuild(fixture, 'lobby', { gx: 0, gy: 0 }, { gx: 3, gy: 0 });

    const partial = fixture.campaign.activeContracts[0];
    if (!partial) throw new Error('Expected an active contract');
    expect(partial?.id).toBe('act-1-viable-core');
    expect(partial?.score).toBeGreaterThan(0);
    expect(partial?.score).toBeLessThan(100);

    const urgent = advanceGameSpine({
      ...fixture,
      campaign: {
        ...fixture.campaign,
        activeContracts: [{ ...partial, deadlineDay: fixture.clock.day }],
      },
      events: [],
    });

    expect(urgent.campaign.activeContracts[0]?.pressure).toBe('high');
  });

  it('creates end-of-day reports for the player journey', () => {
    const fixture = freshFixture();
    fixture.economy.population = 10;
    fixture.economy.dailyRevenue = 1_200;
    fixture.tower.visitMemories.push({
      id: 'memory-report',
      cohortId: 'cohort-report',
      archetypeId: 'stamp-collectors',
      label: 'Stamp collector convention',
      size: 28,
      createdDay: 1,
      resolvedDay: 1,
      sentiment: 42,
      frictionScore: 58,
      outcome: 'complained',
      impressions: ['Stamp collectors were polite until the room stopped feeling orderly.'],
      pressureReasons: ['noise'],
      updatedDay: 1,
      updatedHour: 16,
    });
    const spine = advanceGameSpine({
      ...fixture,
      clock: { ...fixture.clock, day: 2, tick: 0 },
      events: ['rent'],
    });

    expect(spine.events).toContain('daily-report');
    expect(spine.campaign.reports[0]).toMatchObject({ day: 2, title: 'Day 1 Operations Brief' });
    expect(spine.campaign.reports[0]?.notes.join(' ')).toContain('Stamp collector convention');
    expect(spine.campaign.reports[0]?.costs).toBeGreaterThan(0);
    expect(spine.campaign.reports[0]?.netRevenue).toBe(
      (spine.campaign.reports[0]?.revenue ?? 0) - (spine.campaign.reports[0]?.costs ?? 0),
    );
    expect(spine.campaign.reports[0]?.nextRisks.length).toBeGreaterThan(0);
  });

  it('turns negative public memories into targeted repair contracts', () => {
    const fixture = freshFixture();
    fixture.campaign = {
      ...fixture.campaign,
      act: 4,
      permits: ['foundation', 'working-core', 'operations-permit', 'district-profile'],
    };
    fixture.tower.visitMemories.push({
      id: 'memory-privacy',
      cohortId: 'cohort-privacy',
      archetypeId: 'movie-star',
      label: 'Movie star entourage',
      size: 8,
      createdDay: 2,
      resolvedDay: 2,
      sentiment: 34,
      frictionScore: 66,
      outcome: 'complained',
      impressions: ['Privacy failures became the visit story.'],
      pressureReasons: ['privacy'],
      updatedDay: 2,
      updatedHour: 18,
    });

    const spine = advanceGameSpine({
      ...fixture,
      clock: { ...fixture.clock, day: 2 },
      events: ['visit-failure'],
    });
    const repair = spine.campaign.activeContracts.find(
      (contract) => contract.source === 'memory-privacy',
    );

    expect(repair).toMatchObject({
      title: 'Public Memory: Privacy Breach',
      kind: 'reactive',
      rewardTrust: 5,
      penaltyTrust: 6,
    });
    expect(repair?.objectives.map((objective) => objective.metric)).toEqual(
      expect.arrayContaining(['privacy-comfort', 'room-count', 'successful-visits']),
    );
    expect(
      repair?.objectives.find((objective) => objective.metric === 'successful-visits'),
    ).toHaveProperty('target', fixture.campaign.successfulVisits + 1);
  });

  it('can execute the complete five-act campaign into the sandbox victory state', () => {
    const snapshot = createSkylineCharterSnapshot();

    expect(snapshot.campaign.act).toBe(5);
    expect(snapshot.campaign.victory).toBe('won');
    expect(snapshot.campaign.mode).toBe('sandbox');
    expect(snapshot.campaign.declaredIdentity).toBe('mixed-use');
    expect(snapshot.campaign.permits).toContain('skyline-charter');
    expect(snapshot.campaign.unlockedSystems).toContain('sandbox-city-cycle');
    const sandboxContract = snapshot.campaign.activeContracts.find(
      (contract) => contract.source === 'sandbox',
    );
    expect(sandboxContract).toMatchObject({
      kind: 'campaign',
      act: 5,
      status: 'active',
    });
    expect(sandboxContract?.deadlineDay).toBeGreaterThan(snapshot.clock.day);
    expect(
      sandboxContract?.objectives.some(
        (objective) =>
          objective.metric === 'successful-visits' &&
          objective.target > snapshot.campaign.successfulVisits,
      ),
    ).toBe(true);
    expect(snapshot.campaign.completedContracts.map((contract) => contract.id)).toEqual(
      expect.arrayContaining([
        'act-1-viable-core',
        'act-2-stable-operations',
        'act-3-tower-identity',
        'act-4-public-landmark',
        'act-5-skyline-institution',
      ]),
    );
    expect(snapshot.operations.floorCount).toBeGreaterThanOrEqual(18);
    expect(snapshot.macro.skylineStatus).toBeGreaterThanOrEqual(70);
    expect(snapshot.economy.funds).toBeGreaterThanOrEqual(750_000);
    expect(snapshot.tower.visitMemories.map((memory) => memory.archetypeId)).toEqual(
      expect.arrayContaining(['press-swarm', 'city-inspectors']),
    );
  });

  it('keeps sandbox pressure rotating after a post-victory mandate completes', () => {
    const snapshot = createSkylineCharterSnapshot();
    const firstSandbox = snapshot.campaign.activeContracts.find(
      (contract) => contract.source === 'sandbox',
    );
    if (!firstSandbox) throw new Error('Expected an active sandbox contract');

    const spine = advanceGameSpine({
      tower: snapshot.tower,
      economy: snapshot.economy,
      campaign: snapshot.campaign,
      macro: snapshot.macro,
      operations: snapshot.operations,
      clock: { ...snapshot.clock, day: snapshot.clock.day + 1 },
      events: ['visit-success'],
    });

    expect(
      spine.campaign.completedContracts.some((contract) => contract.id === firstSandbox.id),
    ).toBe(true);
    const nextSandbox = spine.campaign.activeContracts.find(
      (contract) => contract.source === 'sandbox',
    );
    expect(nextSandbox).toMatchObject({ kind: 'campaign', act: 5, status: 'active' });
    expect(nextSandbox?.id).not.toBe(firstSandbox.id);
    expect(
      nextSandbox?.objectives.some(
        (objective) =>
          objective.metric === 'successful-visits' &&
          objective.target > spine.campaign.successfulVisits,
      ),
    ).toBe(true);
  });

  it('provides a deterministic weather stress scenario for visual verification', () => {
    const snapshot = createWeatherStressSnapshot();

    expect(snapshot.clock.speed).toBe(0);
    expect(snapshot.macro.weatherRisk).toBeGreaterThanOrEqual(90);
    expect(snapshot.operations.heightRisk).toBeGreaterThanOrEqual(80);
    expect(snapshot.tower.notifications[0]?.text).toContain('Weather stress');
  });

  it('provides a deterministic recovery drill scenario for failure recovery verification', () => {
    const snapshot = createRecoveryDrillSnapshot();

    expect(snapshot.clock.speed).toBe(0);
    expect(
      snapshot.campaign.failedContracts.some((contract) => contract.source === 'transit'),
    ).toBe(true);
    expect(
      snapshot.campaign.activeContracts.some((contract) => contract.source === 'recovery-transit'),
    ).toBe(true);
  });

  it('uses declared identity as a player choice that shapes macro demand', () => {
    let fixture = freshFixture();
    fixture = { ...fixture, economy: { ...fixture.economy, funds: 900_000 } };
    for (const [tool, start, end] of [
      ['lobby', { gx: -4, gy: 0 }, { gx: 4, gy: 0 }],
      ['floor', { gx: -4, gy: 1 }, { gx: 4, gy: 2 }],
      ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 2 }],
      ['office', { gx: -4, gy: 1 }, { gx: -1, gy: 1 }],
      ['conference', { gx: 1, gy: 1 }, { gx: 3, gy: 1 }],
    ] as const) {
      fixture = applyBuild(fixture, tool, start, end);
    }

    const undeclared = advanceGameSpine({
      ...fixture,
      campaign: { ...fixture.campaign, act: 3 },
      events: [],
    });
    const declared = advanceGameSpine({
      ...fixture,
      campaign: { ...fixture.campaign, act: 3, declaredIdentity: 'business' },
      events: ['identity-declared'],
    });

    expect(declared.macro.districtIdentity).toBe('business');
    expect(declared.macro.businessDemand).toBeGreaterThanOrEqual(undeclared.macro.businessDemand);
    expect(
      declared.campaign.activeContracts
        .find((contract) => contract.id === 'act-3-tower-identity')
        ?.objectives.some((objective) => objective.metric === 'declared-identity'),
    ).toBe(true);
  });

  it('generates public-pressure contracts from macro risk and meso readiness', () => {
    let fixture = freshFixture();
    fixture = { ...fixture, economy: { ...fixture.economy, funds: 1_000_000 } };
    for (const [tool, start, end] of [
      ['lobby', { gx: -2, gy: 0 }, { gx: 2, gy: 0 }],
      ['floor', { gx: -2, gy: 1 }, { gx: 2, gy: 18 }],
      ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 18 }],
      ['office', { gx: -2, gy: 1 }, { gx: -1, gy: 1 }],
    ] as const) {
      fixture = applyBuild(fixture, tool, start, end);
    }

    const spine = advanceGameSpine({
      ...fixture,
      campaign: {
        ...fixture.campaign,
        act: 4,
        permits: ['foundation', 'working-core', 'operations-permit', 'landmark-review'],
      },
      economy: {
        ...fixture.economy,
        transitPressure: 86,
        servicePressure: 80,
        cleanliness: 56,
        tenantSatisfaction: 42,
      },
      macro: { ...fixture.macro, publicTrust: 45 },
      events: [],
    });

    expect(
      spine.campaign.activeContracts.some((contract) => contract.source === 'inspection'),
    ).toBe(true);
    expect(spine.campaign.activeContracts.some((contract) => contract.source === 'weather')).toBe(
      true,
    );
  });
});
