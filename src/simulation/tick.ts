import { applyFlockBehavior } from './ai/flock';
import { planAgentRoute } from './ai/navigation';
import {
  personalityFromSeed,
  personalityFromVisitTraits,
  selectAgentIntent,
} from './ai/personality';
import { PRODUCTION_BUDGETS } from './content';
import {
  calculateDailyOperatingCosts,
  calculateDailyRevenue,
  calculateOperationalMetrics,
  recalculateEconomy,
} from './placement';
import { generateId, nextRandomSeed, type RandomSource, seedToUnit } from './random';
import { getHour } from './time';
import {
  type Agent,
  BUILDINGS,
  type ClockState,
  DAY_TICKS,
  type EconomyState,
  type GameNotification,
  type NavigationWaypoint,
  STAR_REQUIREMENTS,
  type TowerRoom,
  type TowerState,
} from './types';
import {
  type CohortExperienceContext,
  chooseVisitVenue,
  createVisitMemoryRecord,
  estimateCohortSpend,
  evaluateCohortFriction,
  generateVisitCohort,
  rememberCohortExperience,
  type VisitCohort,
  type VisitGenerationContext,
} from './visitors';

export interface StepResult {
  tower: TowerState;
  economy: EconomyState;
  clock: ClockState;
  events: string[];
}

function pushNotification(
  notifications: GameNotification[],
  text: string,
  type: GameNotification['type'] = 'info',
  time = 220,
): void {
  notifications.push({ id: generateId('notice'), text, type, time });
  if (notifications.length > 5) notifications.shift();
}

function cloneTower(tower: TowerState): TowerState {
  return {
    rooms: tower.rooms.map((room) => ({ ...room })),
    shafts: tower.shafts.map((shaft) => ({ ...shaft })),
    elevators: tower.elevators.map((elevator) => ({ ...elevator, riders: [...elevator.riders] })),
    agents: tower.agents.map((agent) => ({
      ...agent,
      route: agent.route?.map((waypoint) => ({ ...waypoint })),
    })),
    particles: tower.particles.map((particle) => ({ ...particle })),
    notifications: tower.notifications.map((notification) => ({ ...notification })),
    clouds: tower.clouds.map((cloud) => ({ ...cloud })),
    visits: tower.visits.map((visit) => ({
      ...visit,
      traits: { ...visit.traits },
      goals: [...visit.goals],
      memory: {
        ...visit.memory,
        impressions: [...visit.memory.impressions],
        pressureReasons: [...visit.memory.pressureReasons],
      },
    })),
    visitMemories: tower.visitMemories.map((memory) => ({
      ...memory,
      impressions: [...memory.impressions],
      pressureReasons: [...memory.pressureReasons],
    })),
  };
}

function canHostVisit(tower: TowerState): boolean {
  return tower.rooms.some((room) =>
    [
      'cafe',
      'hotel',
      'office',
      'eventHall',
      'retail',
      'observation',
      'conference',
      'gallery',
    ].includes(room.type),
  );
}

function visitColor(cohort: VisitCohort): string {
  if (cohort.traits.statusSensitivity > 0.75) return '#C7B58A';
  if (cohort.traits.kindness > 0.78) return '#9EBB9D';
  if (cohort.traits.groupCohesion > 0.84) return '#A9B5C0';
  return '#B9A7A0';
}

function experienceContextFrom(visitContext: VisitGenerationContext): CohortExperienceContext {
  return {
    ...visitContext.operations,
    weatherRisk: visitContext.weatherRisk ?? visitContext.operations?.weatherRisk,
  };
}

function createAgent(type: Agent['type'], target: TowerRoom, random: RandomSource): Agent {
  const palette =
    type === 'janitor'
      ? '#78A87F'
      : type === 'guest'
        ? '#B8A8C0'
        : type === 'visitor'
          ? '#B9A7A0'
          : '#CFD6D8';
  const spawnFloor = type === 'janitor' ? target.y : 0;
  const spawnX = type === 'janitor' ? target.x : 0;
  const seed = random();
  return {
    id: generateId(type),
    type,
    x: spawnX,
    y: spawnFloor,
    floor: spawnFloor,
    targetX: target.x,
    targetFloor: target.y,
    targetId: target.id,
    state: type === 'janitor' ? 'idle' : 'walking',
    color: palette,
    seed,
    personality: personalityFromSeed(type, seed),
    intent: type === 'janitor' ? 'idle' : 'work',
    waitTicks: 0,
  };
}

function createVisitorAgent(
  target: TowerRoom,
  cohort: VisitCohort,
  index: number,
  random: RandomSource,
): Agent {
  const seed = random();
  return {
    id: generateId('visitor'),
    type: 'visitor',
    x: index % 2 === 0 ? 0 : 1,
    y: 0,
    floor: 0,
    targetX: target.x + Math.min(target.width - 1, index % Math.max(1, target.width)),
    targetFloor: target.y,
    targetId: target.id,
    state: 'walking',
    color: visitColor(cohort),
    seed,
    personality: personalityFromVisitTraits(cohort.traits, seed),
    intent: 'visit',
    waitTicks: 0,
    cohortId: cohort.id,
  };
}

function resolveVisitTarget(tower: TowerState, cohort: VisitCohort, random: RandomSource) {
  let target = cohort.targetRoomId
    ? tower.rooms.find((room) => room.id === cohort.targetRoomId)
    : undefined;
  if (!target) {
    cohort.targetRoomId = chooseVisitVenue(tower, cohort.goals, random);
    target = cohort.targetRoomId
      ? tower.rooms.find((room) => room.id === cohort.targetRoomId)
      : undefined;
  }
  return target;
}

function spawnVisitRepresentatives(
  tower: TowerState,
  cohort: VisitCohort,
  random: RandomSource,
): boolean {
  const target = resolveVisitTarget(tower, cohort, random);
  if (!target) return false;
  const remaining = cohort.representativeCount - cohort.spawnedAgents;
  if (remaining <= 0) return true;
  // Respect the runtime agent ceiling. If we're at or near the cap, spawn
  // what fits and defer the rest to a later tick — dropping visitors on the
  // floor is better than unbounded growth that compounds across cloneTower
  // copies.
  const capacity = Math.max(0, PRODUCTION_BUDGETS.maxAgents - tower.agents.length);
  const toSpawn = Math.min(remaining, capacity);
  if (toSpawn === 0) return false;
  for (let i = 0; i < toSpawn; i += 1) {
    tower.agents.push(createVisitorAgent(target, cohort, cohort.spawnedAgents + i, random));
  }
  cohort.spawnedAgents += toSpawn;
  cohort.status = 'arriving';
  return toSpawn === remaining;
}

function settleArrival(
  agent: Agent,
  tower: TowerState,
  events: string[],
  economy: EconomyState,
  clock: ClockState,
  visitContext: VisitGenerationContext,
): void {
  agent.waitTicks = 0;
  if (agent.targetId === 'exit') {
    agent.state = 'idle';
    agent.targetId = 'despawn';
    return;
  }

  const target = tower.rooms.find((room) => room.id === agent.targetId);
  if (!target) {
    agent.state = 'idle';
    return;
  }

  if (agent.type === 'visitor') {
    const cohort = tower.visits.find((visit) => visit.id === agent.cohortId);
    agent.state = 'visiting';
    agent.intent = 'visit';
    agent.jobTimer = Math.max(40, Math.round((DAY_TICKS / 24) * (cohort?.dwellHours ?? 2)));
    if (cohort) {
      cohort.status = 'inside';
      Object.assign(
        cohort,
        rememberCohortExperience(
          cohort,
          economy,
          {
            day: clock.day,
            hour: getHour(clock.tick),
          },
          experienceContextFrom(visitContext),
        ),
      );
      if (!cohort.spendCollected) {
        const spend = estimateCohortSpend(cohort);
        economy.funds += spend;
        cohort.spendCollected = true;
        tower.particles.push({
          id: generateId('visit-spend'),
          x: target.x,
          y: target.y + 1,
          text: `visit +$${spend}`,
          color: '#D3B15D',
          life: 70,
          floatSpeed: 0.28,
        });
        events.push('visit-spend');
      }
    }
  } else if (agent.type === 'janitor') {
    agent.state = 'cleaning';
    agent.intent = 'clean';
    agent.jobTimer = 45;
  } else if (target.type === 'cafe') {
    agent.state = 'eating';
    agent.intent = 'eat';
    economy.funds += BUILDINGS.cafe.income ?? 0;
    events.push('cafe-sale');
  } else if (agent.type === 'guest') {
    agent.state = 'sleeping';
    agent.intent = 'idle';
  } else {
    agent.state = 'working';
    agent.intent = 'work';
  }
}

function resetRoute(agent: Agent): void {
  agent.route = undefined;
  agent.routeIndex = undefined;
  agent.routeTargetId = undefined;
  agent.routeStatus = undefined;
  agent.transitFloor = undefined;
  agent.elevatorId = undefined;
  agent.waitTicks = 0;
}

function setDestination(
  agent: Agent,
  targetFloor: number,
  targetX: number,
  targetId: string,
): void {
  if (
    agent.targetFloor === targetFloor &&
    agent.targetX === targetX &&
    agent.targetId === targetId
  ) {
    return;
  }
  agent.targetFloor = targetFloor;
  agent.targetX = targetX;
  agent.targetId = targetId;
  resetRoute(agent);
}

function ensureRoute(agent: Agent, tower: TowerState): boolean {
  if (agent.route?.length && agent.routeTargetId === agent.targetId) return true;

  const route = planAgentRoute(
    tower,
    { x: Math.round(agent.x), floor: Math.round(agent.floor) },
    { x: Math.round(agent.targetX), floor: Math.round(agent.targetFloor) },
  );

  if (!route.reachable) {
    agent.route = undefined;
    agent.routeIndex = undefined;
    agent.routeTargetId = agent.targetId;
    agent.routeStatus = 'blocked';
    return false;
  }

  agent.route = route.waypoints;
  agent.routeIndex = route.waypoints.length > 1 ? 1 : 0;
  agent.routeTargetId = agent.targetId;
  agent.routeStatus = 'planned';
  return true;
}

function currentWaypoint(agent: Agent): NavigationWaypoint | undefined {
  return agent.route?.[agent.routeIndex ?? 0];
}

function followYukaRoute(
  agent: Agent,
  tower: TowerState,
  moveSpeed: number,
  events: string[],
  economy: EconomyState,
  clock: ClockState,
  visitContext: VisitGenerationContext,
): void {
  if (!ensureRoute(agent, tower)) {
    agent.state = 'waiting';
    agent.elevatorId = undefined;
    return;
  }

  const waypoint = currentWaypoint(agent);
  if (!waypoint) {
    settleArrival(agent, tower, events, economy, clock, visitContext);
    return;
  }

  if (agent.route?.length === 1) {
    agent.x = waypoint.x;
    agent.floor = waypoint.floor;
    agent.y = waypoint.floor;
    settleArrival(agent, tower, events, economy, clock, visitContext);
    return;
  }

  const dx = waypoint.x - agent.x;
  if (Math.abs(dx) > moveSpeed) {
    agent.x += Math.sign(dx) * moveSpeed;
    agent.y = agent.floor;
    return;
  }

  agent.x = waypoint.x;
  if (Math.abs(agent.floor - waypoint.floor) <= 0.1) {
    agent.floor = waypoint.floor;
    agent.y = waypoint.floor;
    agent.routeIndex = (agent.routeIndex ?? 0) + 1;
    if ((agent.routeIndex ?? 0) >= (agent.route?.length ?? 0)) {
      settleArrival(agent, tower, events, economy, clock, visitContext);
    }
    return;
  }

  const elevator = tower.elevators.find(
    (candidate) =>
      candidate.x === waypoint.x &&
      agent.floor >= candidate.min &&
      agent.floor <= candidate.max &&
      waypoint.floor >= candidate.min &&
      waypoint.floor <= candidate.max,
  );

  if (!elevator) {
    agent.routeStatus = 'blocked';
    agent.state = 'waiting';
    agent.elevatorId = undefined;
    return;
  }

  agent.elevatorId = elevator.id;
  agent.transitFloor = waypoint.floor;
  agent.state = 'waiting';
}

function updateAgent(
  agent: Agent,
  tower: TowerState,
  clock: ClockState,
  economy: EconomyState,
  events: string[],
  visitContext: VisitGenerationContext,
): Agent {
  const hour = getHour(clock.tick);
  const speedMult = clock.speed === 4 ? 4 : 1;
  const moveSpeed = 0.2 * speedMult;
  const next = { ...agent };
  next.waitTicks = next.state === 'waiting' ? (next.waitTicks ?? 0) + speedMult : 0;

  if (
    next.type === 'visitor' &&
    next.state === 'walking' &&
    next.targetId !== 'exit' &&
    (!next.route || next.routeStatus === 'blocked')
  ) {
    const cohort = tower.visits.find((visit) => visit.id === next.cohortId);
    if (cohort) {
      const decision = selectAgentIntent(next, tower, economy, hour, cohort);
      next.intent = decision.intent;
      if (decision.targetRoom) {
        setDestination(next, decision.targetRoom.y, decision.targetRoom.x, decision.targetRoom.id);
      }
    }
  }

  if (next.type === 'janitor') {
    if (next.state === 'idle') {
      const decision = selectAgentIntent(next, tower, economy, hour);
      next.intent = decision.intent;
      if (decision.intent === 'clean' && decision.targetRoom) {
        setDestination(next, decision.targetRoom.y, decision.targetRoom.x, decision.targetRoom.id);
        next.state = 'walking';
      }
    } else if (next.state === 'cleaning') {
      next.jobTimer = (next.jobTimer ?? 0) - speedMult;
      if ((next.jobTimer ?? 0) <= 0) {
        const room = tower.rooms.find((candidate) => candidate.id === next.targetId);
        if (room) {
          room.dirt = 0;
          tower.particles.push({
            id: generateId('sparkle'),
            x: room.x,
            y: room.y + 1,
            text: 'clean',
            color: '#8EC7D2',
            life: 40,
            floatSpeed: 0.35,
          });
        }
        next.state = 'idle';
      }
    }
  }

  if (next.type === 'worker' && next.state === 'working' && hour === 12 && !next.hadLunch) {
    const decision = selectAgentIntent(next, tower, economy, hour);
    next.intent = decision.intent;
    if (decision.intent === 'eat' && decision.targetRoom) {
      next.returnToId = next.targetId;
      setDestination(next, decision.targetRoom.y, decision.targetRoom.x, decision.targetRoom.id);
      next.hadLunch = true;
      next.state = 'walking';
    }
  }

  if (next.type === 'worker' && next.state === 'eating' && hour === 13 && next.returnToId) {
    const office = tower.rooms.find((room) => room.id === next.returnToId);
    if (office) {
      setDestination(next, office.y, office.x, office.id);
      next.state = 'walking';
    }
  }

  if (next.type === 'worker' && next.state === 'working' && hour >= 17) {
    const decision = selectAgentIntent(next, tower, economy, hour);
    next.intent = decision.intent;
    if (decision.intent === 'exit') {
      setDestination(next, 0, 0, 'exit');
      next.state = 'walking';
    }
  }

  if (next.type === 'guest' && next.state === 'sleeping' && hour >= 8) {
    setDestination(next, 0, 0, 'exit');
    next.state = 'walking';
    next.intent = 'exit';
    economy.funds += BUILDINGS.hotel.income ?? 0;
    events.push('hotel-checkout');
  }

  if (next.type === 'visitor' && next.state === 'visiting') {
    next.jobTimer = (next.jobTimer ?? 0) - speedMult;
    if ((next.jobTimer ?? 0) <= 0) {
      setDestination(next, 0, 0, 'exit');
      next.state = 'walking';
      next.intent = 'exit';
    }
  }

  if (next.state === 'walking') {
    followYukaRoute(next, tower, moveSpeed, events, economy, clock, visitContext);
  } else if (next.state === 'waiting' && !next.elevatorId && next.routeStatus !== 'blocked') {
    next.state = 'walking';
  } else if (next.state === 'riding' && next.elevatorId) {
    const elevator = tower.elevators.find((candidate) => candidate.id === next.elevatorId);
    if (elevator) {
      next.x = elevator.x;
      next.y = elevator.y;
      next.floor = elevator.y;
      const transitFloor = next.transitFloor ?? next.targetFloor;
      if (Math.abs(next.floor - transitFloor) < 0.1 && elevator.state === 'open') {
        elevator.riders = elevator.riders.filter((id) => id !== next.id);
        next.routeIndex = (next.routeIndex ?? 0) + 1;
        next.transitFloor = undefined;
        next.elevatorId = undefined;
        next.waitTicks = 0;
        next.state = 'walking';
      }
    }
  }

  return next;
}

function updateElevators(tower: TowerState, clock: ClockState): void {
  const speedMult = clock.speed === 4 ? 4 : 1;
  const elevatorSpeed = 0.15 * speedMult;

  for (const elevator of tower.elevators) {
    if (elevator.state === 'idle') {
      const rider = tower.agents.find((agent) => elevator.riders.includes(agent.id));
      const waiter = [...tower.agents]
        .filter((agent) => agent.state === 'waiting' && agent.elevatorId === elevator.id)
        .sort((a, b) => (b.waitTicks ?? 0) - (a.waitTicks ?? 0))[0];
      if (rider) {
        elevator.targetY = rider.transitFloor ?? rider.targetFloor;
        elevator.state = 'moving';
      } else if (waiter) {
        elevator.targetY = waiter.floor;
        elevator.state = 'moving';
      }
    } else if (elevator.state === 'moving' && elevator.targetY !== null) {
      const dy = elevator.targetY - elevator.y;
      if (Math.abs(dy) <= elevatorSpeed) {
        elevator.y = elevator.targetY;
        elevator.floor = Math.round(elevator.y);
        elevator.timer = 30;
        elevator.state = 'open';
      } else {
        elevator.y += Math.sign(dy) * elevatorSpeed;
        elevator.floor = elevator.y;
      }
    } else if (elevator.state === 'open') {
      elevator.timer -= speedMult;
      if (elevator.timer > 10) {
        const waiters = tower.agents
          .filter(
            (agent) =>
              agent.state === 'waiting' &&
              agent.elevatorId === elevator.id &&
              Math.abs(agent.floor - elevator.floor) < 0.1,
          )
          .sort((a, b) => (b.waitTicks ?? 0) - (a.waitTicks ?? 0));
        for (const waiter of waiters) {
          if (
            elevator.riders.length < (BUILDINGS.elevator.cap ?? 20) &&
            !elevator.riders.includes(waiter.id)
          ) {
            elevator.riders.push(waiter.id);
            waiter.state = 'riding';
            waiter.waitTicks = 0;
          }
        }
      }
      if (elevator.timer <= 0) {
        elevator.state = 'idle';
        elevator.targetY = null;
      }
    }
  }
}

export function stepSimulation(
  tower: TowerState,
  economy: EconomyState,
  clock: ClockState,
  random?: RandomSource,
  visitContext: VisitGenerationContext = {},
): StepResult {
  if (clock.speed === 0) return { tower, economy, clock, events: [] };

  const nextTower = cloneTower(tower);
  const nextEconomy = { ...economy };
  let rngSeed = clock.rngSeed ?? 0x5eed_4104;
  const deterministicRandom = () => {
    rngSeed = nextRandomSeed(rngSeed);
    return seedToUnit(rngSeed);
  };
  const randomSource = random ?? deterministicRandom;
  const speedMult = clock.speed === 4 ? 4 : 1;
  const previousHour = getHour(clock.tick);
  let nextTick = clock.tick + speedMult;
  let nextDay = clock.day;
  const events: string[] = [];

  if (nextTick >= DAY_TICKS) {
    nextTick %= DAY_TICKS;
    nextDay += 1;
  }

  const hour = getHour(nextTick);
  const isNewHour = hour !== previousHour;

  nextTower.particles = nextTower.particles
    .map((particle) => ({
      ...particle,
      life: particle.life - speedMult,
      y: particle.y + particle.floatSpeed,
    }))
    .filter((particle) => particle.life > 0);
  nextTower.notifications = nextTower.notifications
    .map((notification) => ({ ...notification, time: notification.time - speedMult }))
    .filter((notification) => notification.time > 0);
  nextTower.clouds = nextTower.clouds.map((cloud) => ({
    ...cloud,
    x: cloud.x > 150 ? -150 : cloud.x < -150 ? 150 : cloud.x + cloud.speed * speedMult,
  }));

  if (isNewHour) {
    if (hour === 7)
      pushNotification(nextTower.notifications, 'Morning rush: workers are arriving.');
    if (hour === 12) pushNotification(nextTower.notifications, 'Lunch hour: cafes will be busy.');
    if (hour === 17)
      pushNotification(nextTower.notifications, 'Evening rush: workers are heading home.');
    if (hour === 0) {
      const operational = calculateOperationalMetrics(nextTower);
      const rent = calculateDailyRevenue(nextTower.rooms, operational.rentEfficiency);
      const costs = calculateDailyOperatingCosts(nextTower.rooms, {
        population: nextEconomy.population,
        transitPressure: operational.transitPressure,
        servicePressure: operational.servicePressure,
      });
      Object.assign(nextEconomy, operational, {
        dailyRevenue: rent,
        dailyCosts: costs,
        netRevenue: rent - costs,
      });
      nextEconomy.funds += rent - costs;
      nextEconomy.lifetimeRent += rent;
      pushNotification(
        nextTower.notifications,
        `Collected daily revenue: $${rent.toLocaleString()} - $${costs.toLocaleString()} costs`,
        'success',
      );
      events.push('rent');
      if (operational.rentEfficiency < 92) {
        pushNotification(
          nextTower.notifications,
          `Tenant confidence reduced yield to ${operational.rentEfficiency}%.`,
          'warning',
        );
        events.push('rent-leak');
      }
    }

    let dirtyCount = 0;
    for (const room of nextTower.rooms) {
      const category = BUILDINGS[room.type].cat;
      if (category !== 'infra' && category !== 'trans' && category !== 'utility') {
        const foodTraffic = ['cafe', 'retail', 'eventHall'].includes(room.type) ? 3 : 0;
        room.dirt = Math.min(100, room.dirt + randomSource() * 4 + foodTraffic);
        if (room.dirt > 60) dirtyCount += 1;
      }
    }
    if (dirtyCount > 3 && hour % 6 === 0) {
      pushNotification(nextTower.notifications, `${dirtyCount} rooms need maintenance.`, 'warning');
    }

    const activeCohorts = new Set(
      nextTower.agents
        .map((agent) => agent.cohortId)
        .filter((cohortId): cohortId is string => Boolean(cohortId)),
    );
    nextTower.visits = nextTower.visits.filter((visit) => {
      if (visit.status === 'inside' && visit.spawnedAgents > 0 && !activeCohorts.has(visit.id)) {
        const memory = createVisitMemoryRecord(visit, { day: nextDay, hour });
        nextTower.visitMemories = [memory, ...nextTower.visitMemories].slice(0, 14);
        if (memory.outcome === 'praised') {
          pushNotification(
            nextTower.notifications,
            `${visit.label} left praising the tower.`,
            'success',
          );
          events.push('visit-success');
        } else if (memory.outcome === 'complained') {
          pushNotification(
            nextTower.notifications,
            `${visit.label} left with complaints: ${memory.impressions[0]}`,
            'warning',
          );
          events.push('visit-failure');
        } else {
          pushNotification(
            nextTower.notifications,
            `${visit.label} departed with a mixed impression.`,
            'info',
          );
          events.push('visit-neutral');
        }
        events.push('visit-departure');
        return false;
      }
      return true;
    });

    const canceledVisits = new Set<string>();
    for (const visit of nextTower.visits) {
      const dueToday = nextDay > visit.createdDay || hour >= visit.arrivalHour;
      if (visit.status === 'inquiry' && dueToday) {
        if (spawnVisitRepresentatives(nextTower, visit, randomSource)) {
          pushNotification(
            nextTower.notifications,
            `${visit.label} arrived: ${visit.size} visitors represented by ${visit.representativeCount} agents.`,
            'info',
            260,
          );
          events.push('visit-arrival');
        } else {
          pushNotification(
            nextTower.notifications,
            `${visit.label} canceled: no suitable venue remained.`,
            'warning',
          );
          events.push('visit-canceled');
          canceledVisits.add(visit.id);
        }
      }
    }
    if (canceledVisits.size > 0) {
      nextTower.visits = nextTower.visits.filter((visit) => !canceledVisits.has(visit.id));
    }

    if (
      hour >= 9 &&
      hour <= 20 &&
      nextTower.visits.length < 3 &&
      canHostVisit(nextTower) &&
      randomSource() < 0.08
    ) {
      let cohort = generateVisitCohort(
        Math.floor(randomSource() * 0xffff_ffff),
        nextTower,
        {
          day: nextDay,
          hour,
        },
        {
          ...visitContext,
          economy: nextEconomy,
        },
      );
      cohort = rememberCohortExperience(
        cohort,
        nextEconomy,
        { day: nextDay, hour },
        experienceContextFrom(visitContext),
      );
      const friction = evaluateCohortFriction(
        cohort,
        nextEconomy,
        experienceContextFrom(visitContext),
      );
      nextTower.visits.push(cohort);
      pushNotification(
        nextTower.notifications,
        `${cohort.label} inquiry: ${cohort.size} visitors, ${friction.mood} outlook.`,
        friction.mood === 'angry' ? 'warning' : 'info',
        260,
      );
      events.push('visit-inquiry');
    }
  }

  // Hard agent ceiling — skips every spawn path below when at cap. Without
  // this the probabilistic spawns multiply with speedMult on late-game
  // towers and each new agent is deep-copied by cloneTower every tick.
  const underCap = nextTower.agents.length < PRODUCTION_BUDGETS.maxAgents;

  const maintRooms = nextTower.rooms.filter((room) => room.type === 'maint');
  const targetJanitors = maintRooms.length * (BUILDINGS.maint.pop ?? 0);
  const currentJanitors = nextTower.agents.filter((agent) => agent.type === 'janitor').length;
  const firstMaintenanceRoom = maintRooms[0];
  if (
    underCap &&
    currentJanitors < targetJanitors &&
    firstMaintenanceRoom &&
    randomSource() < 0.1
  ) {
    nextTower.agents.push(createAgent('janitor', firstMaintenanceRoom, randomSource));
  }

  if (underCap && hour >= 7 && hour < 10 && randomSource() < 0.05 * speedMult) {
    const offices = nextTower.rooms.filter((room) => room.type === 'office');
    const target = offices.find(
      (office) =>
        nextTower.agents.filter((agent) => agent.targetId === office.id).length <
        (BUILDINGS.office.pop ?? 0),
    );
    if (target) nextTower.agents.push(createAgent('worker', target, randomSource));
  }

  if (underCap && hour >= 16 && hour < 20 && randomSource() < 0.02 * speedMult) {
    const hotel = nextTower.rooms.find(
      (room) =>
        room.type === 'hotel' &&
        !nextTower.agents.some((agent) => agent.type === 'guest' && agent.targetId === room.id),
    );
    if (hotel) nextTower.agents.push(createAgent('guest', hotel, randomSource));
  }

  nextTower.agents = nextTower.agents
    .map((agent) =>
      updateAgent(
        agent,
        nextTower,
        { ...clock, tick: nextTick },
        nextEconomy,
        events,
        visitContext,
      ),
    )
    .filter((agent) => agent.targetId !== 'despawn');
  nextTower.agents = applyFlockBehavior(nextTower.agents, nextTower.visits);
  updateElevators(nextTower, { ...clock, tick: nextTick });

  const nextClock: ClockState = {
    ...clock,
    tick: nextTick,
    day: nextDay,
    rngSeed: random ? clock.rngSeed : rngSeed,
  };
  const recalculatedEconomy = recalculateEconomy(nextTower, nextEconomy, nextTower.agents.length);
  if (recalculatedEconomy.stars > economy.stars) {
    pushNotification(
      nextTower.notifications,
      `${STAR_REQUIREMENTS[recalculatedEconomy.stars]?.title ?? 'New permit'} unlocked.`,
      'success',
      360,
    );
    events.push('milestone');
  }
  return {
    tower: nextTower,
    economy: recalculatedEconomy,
    clock: nextClock,
    events,
  };
}
