import {
  BUILDINGS,
  type CampaignState,
  CELL_SIZE,
  type EconomyState,
  type GridCell,
  type InspectionTarget,
  type MacroState,
  type OperationsState,
  type TowerRoom,
  type TowerState,
} from './types';
import { evaluateCohortFriction } from './visitors';

function roomCovers(room: TowerRoom, cell: GridCell): boolean {
  return (
    cell.gx >= room.x &&
    cell.gx < room.x + room.width &&
    cell.gy >= room.y &&
    cell.gy < room.y + room.height
  );
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function roomValue(room: TowerRoom): number {
  const def = BUILDINGS[room.type];
  return (def.rent ?? 0) + (def.sale ?? 0) + (def.income ?? 0) * 8;
}

function personalityText(personality: string): string {
  switch (personality) {
    case 'status':
      return 'status-seeking, low patience, reputation-sensitive';
    case 'civic':
      return 'civic-minded, patient, service-aware';
    case 'quiet':
      return 'quiet-seeking, noise-sensitive, privacy-aware';
    case 'diligent':
      return 'diligent, service-focused, dirt-sensitive';
    case 'impatient':
      return 'impatient, queue-sensitive';
    case 'comfort':
      return 'comfort-seeking, cleanliness-sensitive';
    case 'social':
      return 'social, amenity-seeking';
    case 'punctual':
      return 'punctual, schedule-driven';
    default:
      return personality;
  }
}

function roomWarnings(
  room: TowerRoom,
  economy: EconomyState,
  operations: OperationsState,
): string[] {
  const warnings: string[] = [];
  if (room.dirt > 65) warnings.push('Dirty enough to damage sentiment and yield.');
  if (room.y > 8 && operations.heightRisk > 55)
    warnings.push('High-floor exposure needs weather systems.');
  if (BUILDINGS[room.type].kind === 'event' && operations.eventReadiness < 50) {
    warnings.push('Venue is ahead of security, service, or transit readiness.');
  }
  if (BUILDINGS[room.type].cat !== 'infra' && economy.transitPressure > 70) {
    warnings.push('Current transit pressure will shape how people remember this space.');
  }
  return warnings;
}

function roomCausalLine(
  room: TowerRoom,
  economy: EconomyState,
  campaign: CampaignState,
  macro: MacroState,
): string {
  if (room.dirt > 50) {
    return `Because dirt is ${Math.round(room.dirt)}% and cleanliness demand scales with visit status, this room is actively pulling sentiment down.`;
  }
  if (economy.transitPressure > 60) {
    return `Because transit pressure is ${economy.transitPressure}%, people remember how long they waited more than the room itself.`;
  }
  if (macro.publicTrust < 50) {
    return `Because public trust is ${macro.publicTrust}%, good rooms still can't outrun the tower's current reputation.`;
  }
  const isInfra = BUILDINGS[room.type].cat === 'infra';
  if (campaign.towerIdentity === 'unformed') {
    return 'Because the tower is still forming its identity, every placement is a vote for what cohorts show up next.';
  }
  if (isInfra) {
    return `Because the tower identity is ${campaign.towerIdentity}, infra like this room sets the circulation baseline every cohort is measured against.`;
  }
  return `Because the tower identity is ${campaign.towerIdentity}, cohorts arrive with goals and traits biased toward this space's fit.`;
}

function agentCausalLine(
  waitTicks: number,
  routeStatus: string | undefined,
  economy: EconomyState,
  personality: string,
): string {
  if (routeStatus === 'blocked') {
    return 'Because Yuka cannot find a valid route, this agent is stuck — the tower topology is missing a connection.';
  }
  if (waitTicks > 80) {
    return `Because this person has waited ${waitTicks} ticks, their visit memory will cite queues as the dominant reason.`;
  }
  if (personality === 'status' && economy.transitPressure > 55) {
    return `Because status-sensitive visitors amplify visible delays and transit pressure is ${economy.transitPressure}%, reputation damage compounds with every minute.`;
  }
  if (personality === 'quiet' && economy.servicePressure > 50) {
    return `Because this is a quiet-seeking visitor and service pressure is ${economy.servicePressure}%, they will read the tower as noisy even without direct noise cues.`;
  }
  return "Because no pressure reason dominates right now, this person's outcome is still steered by tower identity and cohort fit.";
}

function elevatorCausalLine(riderCount: number, transitPressure: number, topology: number): string {
  if (transitPressure > 70) {
    return `Because transit pressure is ${transitPressure}% and topology is ${topology}%, this core is the visible bottleneck the city will remember.`;
  }
  if (riderCount >= 4) {
    return `Because ${riderCount} riders are in the car, this core is near its comfortable capacity for patient cohorts.`;
  }
  return 'Because the core is not yet under pressure, this is the right moment to author adjacency and layout decisions.';
}

function emptyCausalLine(macro: MacroState, cellAboveStreet: boolean): string {
  if (!cellAboveStreet) {
    return 'Because this is the street interface, every placement here sets how cohorts read the tower from the sidewalk.';
  }
  if (macro.marketCycle === 'boom') {
    return `Because the district is in a ${macro.marketCycle} cycle, opportunistic placements compound faster than in cooler periods.`;
  }
  return `Because the district identity is ${macro.districtIdentity}, placements that align with it will be recognized sooner by arriving cohorts.`;
}

export function createInspectionForCell(
  tower: TowerState,
  economy: EconomyState,
  campaign: CampaignState,
  macro: MacroState,
  operations: OperationsState,
  cell: GridCell,
): InspectionTarget {
  const agent = [...tower.agents]
    .filter(
      (candidate) =>
        Math.abs(candidate.x - cell.gx) <= 0.55 && Math.abs(candidate.floor - cell.gy) <= 0.55,
    )
    .sort((a, b) => (b.waitTicks ?? 0) - (a.waitTicks ?? 0))[0];

  if (agent) {
    const cohort = agent.cohortId
      ? tower.visits.find((visit) => visit.id === agent.cohortId)
      : undefined;
    const friction = cohort
      ? evaluateCohortFriction(cohort, economy, {
          eventReadiness: operations.eventReadiness,
          noiseControl: operations.noiseControl,
          privacyComfort: operations.privacyComfort,
          safetyReadiness: operations.safetyReadiness,
          weatherRisk: macro.weatherRisk,
        })
      : null;
    const warnings: string[] = [];
    if (agent.routeStatus === 'blocked') {
      warnings.push('Yuka cannot find a valid route from this agent to its target.');
    }
    if (agent.state === 'waiting' && (agent.waitTicks ?? 0) > 80) {
      warnings.push('This person has waited long enough to affect transit pressure.');
    }
    if (agent.personality === 'status' && agent.state === 'waiting') {
      warnings.push('Status-sensitive visitors amplify visible delays into reputation risk.');
    }
    if (agent.personality === 'quiet' && economy.transitPressure > 65) {
      warnings.push('Noise and queue pressure will sour this quiet-seeking visitor quickly.');
    }
    return {
      id: agent.id,
      kind: 'agent',
      title: `${agent.type} · ${agent.state}`,
      subtitle: cohort
        ? `${cohort.label} · ${agent.personality}`
        : `${agent.personality} personality`,
      details: [
        agentCausalLine(agent.waitTicks ?? 0, agent.routeStatus, economy, agent.personality),
        `Personality: ${personalityText(agent.personality)}`,
        `Intent: ${agent.intent ?? 'idle'}`,
        `Target floor: ${agent.targetFloor}`,
        `Wait burden: ${agent.waitTicks ?? 0} ticks`,
        `Route: ${agent.routeStatus ?? 'unplanned'}`,
        ...(cohort
          ? [
              `Cohort goals: ${cohort.goals.join(', ')}`,
              `Cohort outlook: ${friction?.mood ?? 'steady'} (${friction?.score ?? 0})`,
              `Pressure reasons: ${
                friction && friction.reasons.length > 0 ? friction.reasons.join(', ') : 'none'
              }`,
            ]
          : []),
      ],
      warnings,
      x: agent.x * CELL_SIZE.w,
      y: -agent.floor * CELL_SIZE.h,
    };
  }

  const elevator = tower.elevators.find(
    (candidate) => Math.round(candidate.x) === cell.gx && Math.round(candidate.floor) === cell.gy,
  );
  if (elevator) {
    return {
      id: elevator.id,
      kind: 'elevator',
      title: 'Elevator Car',
      subtitle: `${elevator.state} · floors ${elevator.min}-${elevator.max}`,
      details: [
        elevatorCausalLine(
          elevator.riders.length,
          economy.transitPressure,
          operations.transitTopology,
        ),
        `Riders: ${elevator.riders.length}`,
        `Target: ${elevator.targetY ?? 'idle'}`,
        `Transit topology: ${operations.transitTopology}%`,
      ],
      warnings:
        economy.transitPressure > 70 ? ['The core is overloaded relative to current demand.'] : [],
      x: elevator.x * CELL_SIZE.w,
      y: -elevator.floor * CELL_SIZE.h,
    };
  }

  const room = [...tower.rooms].reverse().find((candidate) => roomCovers(candidate, cell));
  if (room) {
    const def = BUILDINGS[room.type];
    return {
      id: room.id,
      kind: 'room',
      title: def.name,
      subtitle: `${def.kind ?? def.cat} · floor ${room.y}`,
      details: [
        roomCausalLine(room, economy, campaign, macro),
        `Dirt: ${Math.round(room.dirt)}%`,
        `Value signal: ${money(roomValue(room))}`,
        `Tower identity: ${campaign.towerIdentity}`,
        `Public trust: ${macro.publicTrust}%`,
      ],
      warnings: roomWarnings(room, economy, operations),
      x: room.x * CELL_SIZE.w,
      y: -room.y * CELL_SIZE.h,
    };
  }

  return {
    id: `empty-${cell.gx}-${cell.gy}`,
    kind: 'empty',
    title: cell.gy <= 0 ? 'Surveyed Air Rights' : 'Open Bay',
    subtitle: cell.gy <= 0 ? 'street interface' : `floor ${cell.gy}`,
    details: [
      emptyCausalLine(macro, cell.gy > 0),
      `District identity: ${macro.districtIdentity}`,
      `Market cycle: ${macro.marketCycle}`,
      `City influence: ${macro.cityInfluence}%`,
    ],
    warnings: cell.gy > 0 ? ['Rooms need complete floor support before placement.'] : [],
    x: cell.gx * CELL_SIZE.w,
    y: -cell.gy * CELL_SIZE.h,
  };
}
