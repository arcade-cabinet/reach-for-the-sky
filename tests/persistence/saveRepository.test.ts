import { describe, expect, it } from 'vitest';
import {
  createSaveSlotSummary,
  parseSnapshot,
  selectDurableSimulationEvents,
  serializeSnapshot,
  tryParseSnapshot,
} from '@/persistence/saveRepository';
import {
  createInitialCampaign,
  createInitialClock,
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
  createInitialView,
} from '@/simulation/initialState';
import { VISITOR_ARCHETYPES } from '@/simulation/visitors';

function createSnapshotFixture() {
  return {
    version: 1 as const,
    savedAt: '2026-04-22T00:00:00.000Z',
    tower: createInitialTower(),
    economy: createInitialEconomy(),
    clock: createInitialClock(),
    view: createInitialView(),
    campaign: createInitialCampaign(),
    macro: createInitialMacro(),
    operations: createInitialOperations(),
  };
}

describe('save serialization', () => {
  it('round-trips v1 simulation snapshots', () => {
    const snapshot = createSnapshotFixture();

    expect(parseSnapshot(serializeSnapshot(snapshot))).toEqual(snapshot);
  });

  it('hydrates legacy v1 snapshots without clock RNG state', () => {
    const snapshot = createSnapshotFixture();
    const legacy = JSON.parse(serializeSnapshot(snapshot));
    delete legacy.clock.rngSeed;

    expect(parseSnapshot(JSON.stringify(legacy)).clock.rngSeed).toBe(createInitialClock().rngSeed);
  });

  it('hydrates legacy v1 snapshots without sentiment economy fields', () => {
    const snapshot = createSnapshotFixture();
    const legacy = JSON.parse(serializeSnapshot(snapshot));
    legacy.economy.dailyRevenue = 1_200;
    delete legacy.economy.dailyCosts;
    delete legacy.economy.netRevenue;
    delete legacy.economy.tenantSatisfaction;
    delete legacy.economy.rentEfficiency;

    const parsed = parseSnapshot(JSON.stringify(legacy));

    expect(parsed.economy.dailyCosts).toBe(0);
    expect(parsed.economy.netRevenue).toBe(1_200);
    expect(parsed.economy.tenantSatisfaction).toBe(100);
    expect(parsed.economy.rentEfficiency).toBe(100);
  });

  it('hydrates legacy v1 snapshots without visitor cohort state', () => {
    const snapshot = createSnapshotFixture();
    const legacy = JSON.parse(serializeSnapshot(snapshot));
    delete legacy.tower.visits;

    expect(parseSnapshot(JSON.stringify(legacy)).tower.visits).toEqual([]);
    expect(parseSnapshot(JSON.stringify(legacy)).tower.visitMemories).toEqual([]);
  });

  it('hydrates legacy visitor cohorts without lifecycle fields', () => {
    const snapshot = createSnapshotFixture();
    const archetype = VISITOR_ARCHETYPES['stamp-collectors'];
    const legacy = JSON.parse(serializeSnapshot(snapshot));
    legacy.tower.visits = [
      {
        id: 'legacy-visit',
        archetypeId: archetype.id,
        label: archetype.label,
        size: 24,
        traits: archetype.traits,
        goals: archetype.goals,
        volatility: archetype.volatility,
      },
    ];

    const [visit] = parseSnapshot(JSON.stringify(legacy)).tower.visits;

    expect(visit).toMatchObject({
      status: 'inquiry',
      arrivalHour: 10,
      dwellHours: 2,
      representativeCount: 2,
      spawnedAgents: 0,
      spendCollected: false,
      memory: {
        outcome: 'pending',
        sentiment: 72,
      },
    });
  });

  it('hydrates legacy public memories with structured pressure reasons', () => {
    const snapshot = createSnapshotFixture();
    const legacy = JSON.parse(serializeSnapshot(snapshot));
    legacy.tower.visitMemories = [
      {
        id: 'legacy-memory',
        cohortId: 'legacy-cohort',
        archetypeId: 'stamp-collectors',
        label: 'Stamp collector convention',
        size: 32,
        createdDay: 2,
        resolvedDay: 2,
        sentiment: 44,
        frictionScore: 56,
        outcome: 'complained',
        impressions: ['They remembered waiting more than the architecture.'],
        updatedDay: 2,
        updatedHour: 15,
      },
    ];

    const [memory] = parseSnapshot(JSON.stringify(legacy)).tower.visitMemories;

    expect(memory).toMatchObject({
      id: 'legacy-memory',
      pressureReasons: ['queues'],
    });
  });

  it('hydrates legacy snapshots without campaign macro operations state', () => {
    const legacy = JSON.parse(serializeSnapshot(createSnapshotFixture()));
    delete legacy.campaign;
    delete legacy.macro;
    delete legacy.operations;

    const parsed = parseSnapshot(JSON.stringify(legacy));

    expect(parsed.campaign.activeContracts[0]?.title).toBe('First Viable Core');
    expect(parsed.campaign.activeContracts[0]?.rewardTrust).toBe(0);
    expect(parsed.campaign.activeContracts[0]?.score).toBe(0);
    expect(parsed.campaign.activeContracts[0]?.pressure).toBe('low');
    expect(parsed.macro.publicTrust).toBe(58);
    expect(parsed.operations.operationalGrade).toBe(0);
  });

  it('hydrates legacy reports without cost and next-risk fields', () => {
    const legacy = JSON.parse(serializeSnapshot(createSnapshotFixture()));
    legacy.campaign.reports = [
      {
        id: 'legacy-report',
        day: 2,
        title: 'Day 1 Operations Brief',
        revenue: 1_200,
        sentiment: 74,
        cleanliness: 82,
        transitPressure: 44,
        servicePressure: 18,
        publicTrust: 61,
        fame: 12,
        identity: 'business',
        reputationDelta: 2,
        notes: ['Legacy report note.'],
      },
    ];

    const [report] = parseSnapshot(JSON.stringify(legacy)).campaign.reports;

    expect(report).toMatchObject({
      costs: 264,
      netRevenue: 936,
      queuePressure: 44,
      dirtBurden: 18,
      nextRisks: [],
    });
  });

  it('derives compact save slot summaries for menu and settings UI', () => {
    const snapshot = createSnapshotFixture();
    snapshot.clock.day = 12;
    snapshot.campaign.act = 3;
    snapshot.campaign.towerIdentity = 'hospitality';
    snapshot.campaign.declaredIdentity = 'mixed-use';
    snapshot.economy.funds = 345_678;
    snapshot.economy.population = 91;
    snapshot.tower.rooms = [
      { id: 'room-1', type: 'lobby', x: 0, y: 0, width: 1, height: 1, dirt: 0, seed: 0.1 },
      { id: 'room-2', type: 'office', x: 0, y: 1, width: 2, height: 1, dirt: 0, seed: 0.2 },
    ];

    expect(createSaveSlotSummary('campaign-a', snapshot)).toMatchObject({
      slotId: 'campaign-a',
      day: 12,
      act: 3,
      identity: 'hospitality',
      declaredIdentity: 'mixed-use',
      funds: 345_678,
      population: 91,
      roomCount: 2,
      victory: 'none',
    });
  });

  it('filters transient tick chatter out of durable simulation history', () => {
    expect(
      selectDurableSimulationEvents([
        'cafe-sale',
        'rent',
        'visit-success',
        'hotel-checkout',
        'daily-report',
        'victory',
      ]),
    ).toEqual(['rent', 'visit-success', 'daily-report', 'victory']);
  });

  it('reports corrupt saves without throwing through recovery helpers', () => {
    expect(tryParseSnapshot('{bad')).toMatchObject({ ok: false });
    expect(tryParseSnapshot(JSON.stringify({ version: 99 }))).toMatchObject({
      ok: false,
      error: 'Unsupported save version: 99',
    });
  });
});
