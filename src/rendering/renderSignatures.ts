import { getHour } from '@/simulation/time';
import type { ClockState, LensMode, TowerState } from '@/simulation/types';

export type NormalTowerBaseDecision = 'rebuild' | 'hit' | 'disabled';

export interface NormalTowerBaseEvaluation {
  decision: NormalTowerBaseDecision;
  signature: string | null;
}

function stableNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

export function createNormalTowerBaseSignature(tower: TowerState, clock: ClockState): string {
  const hour = getHour(clock.tick);
  const occupiedRooms = new Set(
    tower.agents
      .filter((agent) => !['walking', 'waiting', 'riding'].includes(agent.state))
      .map((agent) => agent.targetId),
  );
  const roomParts = tower.rooms
    .map((room) =>
      [
        room.id,
        room.type,
        room.x,
        room.y,
        room.width,
        room.height,
        stableNumber(room.seed),
        occupiedRooms.has(room.id) ? 'occupied' : 'empty',
      ].join(':'),
    )
    .join('|');
  const shaftParts = tower.shafts
    .map((shaft) => [shaft.id, shaft.x, shaft.min, shaft.max].join(':'))
    .join('|');

  return ['normal', hour, roomParts, shaftParts].join('::');
}

export class NormalTowerBaseTracker {
  private signature: string | null = null;

  evaluate(tower: TowerState, clock: ClockState, lensMode: LensMode): NormalTowerBaseEvaluation {
    if (lensMode !== 'normal') {
      this.signature = null;
      return { decision: 'disabled', signature: null };
    }

    const nextSignature = createNormalTowerBaseSignature(tower, clock);
    if (nextSignature === this.signature) {
      return { decision: 'hit', signature: nextSignature };
    }

    this.signature = nextSignature;
    return { decision: 'rebuild', signature: nextSignature };
  }

  reset(): void {
    this.signature = null;
  }
}
