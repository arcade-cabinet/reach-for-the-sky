import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialClock,
  createInitialEconomy,
  createInitialTower,
} from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import { stepSimulation } from '@/simulation/tick';
import {
  BUILDINGS,
  type ClockState,
  DAY_TICKS,
  type EconomyState,
  type TowerState,
} from '@/simulation/types';
import {
  createInitialVisitMemory,
  generateVisitCohort,
  VISITOR_ARCHETYPES,
  type VisitCohort,
  type VisitGenerationContext,
} from '@/simulation/visitors';

beforeEach(() => resetIdsForTests());

function buildWorkingTower(): { tower: TowerState; economy: EconomyState } {
  let tower = createInitialTower();
  let economy = createInitialEconomy();
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 4, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 4, gy: 1 }],
    ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
    ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ['maint', { gx: 3, gy: 1 }, { gx: 4, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return { tower, economy };
}

function buildVisitorChoiceTower(): { tower: TowerState; economy: EconomyState } {
  let tower = createInitialTower();
  let economy = { ...createInitialEconomy(), funds: 500_000 };
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 8, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 8, gy: 1 }],
    ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
    ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ['gallery', { gx: 3, gy: 1 }, { gx: 5, gy: 1 }],
    ['cafe', { gx: 6, gy: 1 }, { gx: 8, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return { tower, economy };
}

function buildDisconnectedTower(): { tower: TowerState; economy: EconomyState } {
  let tower = createInitialTower();
  let economy = createInitialEconomy();
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 1, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
    ['office', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    tower = result.tower;
    economy = result.economy;
  }
  return { tower, economy };
}

describe('simulation step', () => {
  it('spawns morning workers for offices', () => {
    const { tower, economy } = buildWorkingTower();
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 7) / 24) - 1,
    };
    const next = stepSimulation(tower, economy, clock, () => 0);

    expect(next.tower.agents.some((agent) => agent.type === 'worker')).toBe(true);
  });

  it('marks upper-floor workers blocked when Yuka finds no vertical route', () => {
    const { tower, economy } = buildDisconnectedTower();
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 7) / 24) - 1,
    };
    const next = stepSimulation(tower, economy, clock, () => 0);
    const worker = next.tower.agents.find((agent) => agent.type === 'worker');

    expect(worker).toMatchObject({ routeStatus: 'blocked', state: 'waiting' });
  });

  it('keeps blocked workers waiting while wait burden accumulates', () => {
    const { tower, economy } = buildDisconnectedTower();
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 7) / 24) - 1,
    };

    const first = stepSimulation(tower, economy, clock, () => 0);
    const second = stepSimulation(first.tower, first.economy, first.clock, () => 1);
    const worker = second.tower.agents.find((agent) => agent.type === 'worker');

    expect(worker).toMatchObject({ routeStatus: 'blocked', state: 'waiting' });
    expect(worker?.waitTicks).toBeGreaterThan(0);
  });

  it('plans an evening route from upper-floor offices back to the lobby', () => {
    const { tower, economy } = buildWorkingTower();
    const office = tower.rooms.find((room) => room.type === 'office');
    if (!office) throw new Error('expected fixture to include an office');
    tower.agents.push({
      id: 'worker-leaving',
      type: 'worker',
      x: office.x + 1,
      y: office.y,
      floor: office.y,
      targetX: office.x,
      targetFloor: office.y,
      targetId: office.id,
      state: 'working',
      color: '#CFD6D8',
      seed: 0.4,
      personality: 'punctual',
      intent: 'work',
    });
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 17) / 24) - 1,
    };

    const next = stepSimulation(tower, economy, clock, () => 1);
    const worker = next.tower.agents.find((agent) => agent.id === 'worker-leaving');

    expect(worker?.targetId).toBe('exit');
    expect(worker?.routeStatus).toBe('planned');
    expect(worker?.route?.some((waypoint) => waypoint.kind === 'shaft')).toBe(true);
  });

  it('collects daily revenue at midnight', () => {
    const { tower, economy } = buildWorkingTower();
    const clock: ClockState = { ...createInitialClock(), speed: 1, tick: DAY_TICKS - 1 };
    const next = stepSimulation(tower, economy, clock, () => 1);

    expect(next.clock.day).toBe(2);
    expect(next.economy.funds).toBeGreaterThan(economy.funds);
    expect(next.events).toContain('rent');
  });

  it('leaks daily revenue when tenant sentiment is damaged by unresolved pressure', () => {
    const { tower, economy } = buildDisconnectedTower();
    const clock: ClockState = { ...createInitialClock(), speed: 1, tick: DAY_TICKS - 1 };

    const next = stepSimulation(tower, economy, clock, () => 1);

    expect(next.events).toContain('rent-leak');
    expect(next.economy.tenantSatisfaction).toBeLessThan(100);
    expect(next.economy.rentEfficiency).toBeLessThan(100);
    expect(next.tower.notifications.some((notice) => /confidence/i.test(notice.text))).toBe(true);
  });

  it('dispatches idle elevators toward the longest-waiting requester', () => {
    const { tower, economy } = buildWorkingTower();
    const elevator = tower.elevators[0];
    if (!elevator) throw new Error('expected fixture to include an elevator');
    tower.agents.push(
      {
        id: 'short-wait',
        type: 'worker',
        x: elevator.x,
        y: 0,
        floor: 0,
        targetX: 1,
        targetFloor: 1,
        targetId: 'upper-office',
        state: 'waiting',
        color: '#CFD6D8',
        seed: 0.1,
        personality: 'punctual',
        intent: 'work',
        elevatorId: elevator.id,
        waitTicks: 5,
      },
      {
        id: 'long-wait',
        type: 'worker',
        x: elevator.x,
        y: 1,
        floor: 1,
        targetX: 0,
        targetFloor: 0,
        targetId: 'exit',
        state: 'waiting',
        color: '#CFD6D8',
        seed: 0.9,
        personality: 'impatient',
        intent: 'exit',
        elevatorId: elevator.id,
        waitTicks: 80,
      },
    );

    const next = stepSimulation(tower, economy, { ...createInitialClock(), speed: 1 }, () => 1);

    expect(next.tower.elevators[0]).toMatchObject({ state: 'moving', targetY: 1 });
  });

  it('generates visit inquiries from hosted cohort archetypes', () => {
    const { tower, economy } = buildWorkingTower();
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 9) / 24) - 1,
    };

    const next = stepSimulation(tower, economy, clock, () => 0);

    expect(next.events).toContain('visit-inquiry');
    expect(next.tower.visits).toHaveLength(1);
    expect(next.tower.notifications.some((notice) => /inquiry/i.test(notice.text))).toBe(true);
  });

  it('passes macro pressure into hourly cohort generation', () => {
    const { tower, economy } = buildVisitorChoiceTower();
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 9) / 24) - 1,
    };
    const context: VisitGenerationContext = {
      economy,
      fame: 96,
      publicTrust: 24,
      regulationPressure: 82,
      scandalRisk: 92,
      towerIdentity: 'mixed-use',
      weatherRisk: 68,
    };
    let pressureSeed = 1;
    for (; pressureSeed < 20_000; pressureSeed += 1) {
      const archetypeId = generateVisitCohort(
        pressureSeed,
        tower,
        { day: 1, hour: 9 },
        context,
      ).archetypeId;
      if (archetypeId === 'press-swarm' || archetypeId === 'city-inspectors') break;
    }
    expect(pressureSeed).toBeLessThan(20_000);

    const dirtRolls = tower.rooms.filter((room) => {
      const category = BUILDINGS[room.type].cat;
      return category !== 'infra' && category !== 'trans' && category !== 'utility';
    }).length;
    let calls = 0;
    const random = () => {
      calls += 1;
      if (calls <= dirtRolls) return 0;
      if (calls === dirtRolls + 1) return 0;
      if (calls === dirtRolls + 2) return (pressureSeed + 0.5) / 0xffff_ffff;
      return 0;
    };

    const next = stepSimulation(tower, economy, clock, random, context);

    expect(next.events).toContain('visit-inquiry');
    expect(['press-swarm', 'city-inspectors']).toContain(next.tower.visits[0]?.archetypeId);
  });

  it('turns due visit inquiries into representative visitor agents', () => {
    const { tower, economy } = buildWorkingTower();
    const office = tower.rooms.find((room) => room.type === 'office');
    if (!office) throw new Error('expected fixture to include an office');
    const archetype = VISITOR_ARCHETYPES['school-teachers'];
    tower.visits.push({
      id: 'visit-due',
      archetypeId: archetype.id,
      label: archetype.label,
      size: 36,
      traits: archetype.traits,
      goals: archetype.goals,
      volatility: archetype.volatility,
      status: 'inquiry',
      createdDay: 1,
      createdHour: 9,
      arrivalHour: 10,
      dwellHours: 2,
      targetRoomId: office.id,
      representativeCount: 3,
      spawnedAgents: 0,
      spendCollected: false,
      memory: createInitialVisitMemory(),
    });
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 10) / 24) - 1,
    };

    const next = stepSimulation(tower, economy, clock, () => 1);

    expect(next.events).toContain('visit-arrival');
    expect(next.tower.visits[0]).toMatchObject({ status: 'arriving', spawnedAgents: 3 });
    expect(next.tower.agents.filter((agent) => agent.type === 'visitor')).toHaveLength(3);
    expect(
      next.tower.agents
        .filter((agent) => agent.type === 'visitor')
        .every((agent) => agent.personality === 'civic'),
    ).toBe(true);
  });

  it('lets visitor personality goals retarget representatives before routing', () => {
    const { tower, economy } = buildVisitorChoiceTower();
    const office = tower.rooms.find((room) => room.type === 'office');
    const gallery = tower.rooms.find((room) => room.type === 'gallery');
    if (!office || !gallery) throw new Error('expected fixture to include office and gallery');
    const archetype = VISITOR_ARCHETYPES['stamp-collectors'];
    tower.visits.push({
      id: 'visit-quiet',
      archetypeId: archetype.id,
      label: archetype.label,
      size: 24,
      traits: archetype.traits,
      goals: archetype.goals,
      volatility: archetype.volatility,
      status: 'inquiry',
      createdDay: 1,
      createdHour: 9,
      arrivalHour: 10,
      dwellHours: 2,
      targetRoomId: office.id,
      representativeCount: 1,
      spawnedAgents: 0,
      spendCollected: false,
      memory: createInitialVisitMemory(),
    });
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 10) / 24) - 1,
    };

    const next = stepSimulation(tower, economy, clock, () => 1);
    const visitor = next.tower.agents.find((agent) => agent.type === 'visitor');

    expect(visitor).toMatchObject({
      targetId: gallery.id,
      personality: 'quiet',
      intent: 'visit',
    });
  });

  it('collects cohort spend when a visitor reaches the venue', () => {
    const { tower, economy } = buildWorkingTower();
    const office = tower.rooms.find((room) => room.type === 'office');
    if (!office) throw new Error('expected fixture to include an office');
    const archetype = VISITOR_ARCHETYPES['school-teachers'];
    const visit: VisitCohort = {
      id: 'visit-inside',
      archetypeId: archetype.id,
      label: archetype.label,
      size: 36,
      traits: archetype.traits,
      goals: archetype.goals,
      volatility: archetype.volatility,
      status: 'arriving',
      createdDay: 1,
      createdHour: 9,
      arrivalHour: 10,
      dwellHours: 2,
      targetRoomId: office.id,
      representativeCount: 1,
      spawnedAgents: 1,
      spendCollected: false,
      memory: createInitialVisitMemory(),
    };
    tower.visits.push(visit);
    tower.agents.push({
      id: 'visitor-at-venue',
      type: 'visitor',
      x: office.x,
      y: office.y,
      floor: office.y,
      targetX: office.x,
      targetFloor: office.y,
      targetId: office.id,
      state: 'walking',
      color: '#B9A7A0',
      seed: 0.4,
      personality: 'comfort',
      intent: 'visit',
      waitTicks: 0,
      cohortId: visit.id,
    });

    const next = stepSimulation(tower, economy, { ...createInitialClock(), speed: 1 }, () => 1);

    expect(next.events).toContain('visit-spend');
    expect(next.economy.funds).toBeGreaterThan(economy.funds);
    expect(next.tower.visits[0]).toMatchObject({ status: 'inside', spendCollected: true });
    expect(next.tower.agents[0]).toMatchObject({ state: 'visiting', intent: 'visit' });
    expect(next.tower.visits[0]?.memory.outcome).not.toBe('pending');
  });

  it('turns departed cohorts into public memories and reputation events', () => {
    const { tower, economy } = buildWorkingTower();
    const archetype = VISITOR_ARCHETYPES['school-teachers'];
    tower.visits.push({
      id: 'visit-finished',
      archetypeId: archetype.id,
      label: archetype.label,
      size: 36,
      traits: archetype.traits,
      goals: archetype.goals,
      volatility: archetype.volatility,
      status: 'inside',
      createdDay: 1,
      createdHour: 9,
      arrivalHour: 10,
      dwellHours: 2,
      targetRoomId: null,
      representativeCount: 1,
      spawnedAgents: 1,
      spendCollected: true,
      memory: {
        ...createInitialVisitMemory(1, 10),
        sentiment: 92,
        frictionScore: 8,
        outcome: 'praised',
        impressions: ['The group left calm, grateful, and easy to host.'],
      },
    });
    const clock: ClockState = {
      ...createInitialClock(),
      speed: 1,
      tick: Math.ceil((DAY_TICKS * 11) / 24) - 1,
    };

    const next = stepSimulation(tower, economy, clock, () => 1);

    expect(next.events).toContain('visit-success');
    expect(next.events).toContain('visit-departure');
    expect(next.tower.visits).toHaveLength(0);
    expect(next.tower.visitMemories[0]).toMatchObject({
      label: archetype.label,
      outcome: 'praised',
    });
  });

  it('dispatches janitors from maintenance rooms', () => {
    const { tower, economy } = buildWorkingTower();
    const office = tower.rooms.find((room) => room.type === 'office');
    if (!office) throw new Error('expected fixture to include an office');
    office.dirt = 80;
    const clock: ClockState = { ...createInitialClock(), speed: 1 };
    const next = stepSimulation(tower, economy, clock, () => 0);

    expect(next.tower.agents.some((agent) => agent.type === 'janitor')).toBe(true);
  });

  it('uses clock RNG state for repeatable default simulation steps', () => {
    const run = () => {
      resetIdsForTests();
      const { tower, economy } = buildDisconnectedTower();
      const clock: ClockState = {
        ...createInitialClock(),
        speed: 1,
        tick: Math.ceil((DAY_TICKS * 7) / 24) - 1,
      };
      return stepSimulation(tower, economy, clock);
    };

    expect(run()).toEqual(run());
  });
});
