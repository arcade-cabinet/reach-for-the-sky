import {
  normalizeCampaignState,
  normalizeMacroState,
  normalizeOperationsState,
} from '@/simulation/campaign';
import { PRODUCTION_BUDGETS } from '@/simulation/content';
import { createInitialTower } from '@/simulation/initialState';
import type { SimulationSnapshot, TowerIdentity } from '@/simulation/types';
import { normalizeVisitCohort, normalizeVisitMemoryRecord } from '@/simulation/visitors';
import { getDatabase, saveWebStore } from './database';

export const DEFAULT_SAVE_SLOT = 'autosave';

export interface SaveSlotSummary {
  slotId: string;
  savedAt: string;
  day: number;
  act: number;
  mode: SimulationSnapshot['campaign']['mode'];
  identity: TowerIdentity;
  declaredIdentity: TowerIdentity | null;
  funds: number;
  population: number;
  roomCount: number;
  victory: SimulationSnapshot['campaign']['victory'];
}

export interface SimulationEventContext {
  source: string;
  day: number;
  tick: number;
  hour: number;
  funds: number;
  population: number;
  act: number;
  mode: SimulationSnapshot['campaign']['mode'];
  victory: SimulationSnapshot['campaign']['victory'];
  identity: TowerIdentity;
  declaredIdentity: TowerIdentity | null;
  roomCount: number;
  activeContracts: string[];
  successfulVisits: number;
  failedVisits: number;
  slotId?: string;
  tool?: string | null;
}

export interface SimulationEventRecord {
  id: number;
  eventType: string;
  data: unknown;
  createdAt: string;
}

export type ParseSnapshotResult =
  | { ok: true; snapshot: SimulationSnapshot }
  | { ok: false; error: string };

export const DURABLE_SIMULATION_EVENTS = new Set([
  'build',
  'identity-declared',
  'rent',
  'rent-leak',
  'daily-report',
  'visit-inquiry',
  'visit-arrival',
  'visit-spend',
  'visit-canceled',
  'visit-success',
  'visit-failure',
  'visit-neutral',
  'visit-departure',
  'contract-complete',
  'contract-failed',
  'milestone',
  'victory',
]);

export function serializeSnapshot(snapshot: SimulationSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(raw: string): SimulationSnapshot {
  const parsed = JSON.parse(raw) as SimulationSnapshot;
  if (parsed.version !== 1) throw new Error(`Unsupported save version: ${parsed.version}`);
  parsed.tower = {
    ...createInitialTower(),
    ...parsed.tower,
    visits: (parsed.tower.visits ?? []).map((visit) => normalizeVisitCohort(visit)),
    visitMemories: (parsed.tower.visitMemories ?? []).map((memory) =>
      normalizeVisitMemoryRecord(memory),
    ),
  };
  parsed.clock = { ...parsed.clock, rngSeed: parsed.clock.rngSeed ?? 0x5eed_4104 };
  parsed.economy = {
    ...parsed.economy,
    dailyCosts: parsed.economy.dailyCosts ?? 0,
    netRevenue: parsed.economy.netRevenue ?? parsed.economy.dailyRevenue ?? 0,
    tenantSatisfaction: parsed.economy.tenantSatisfaction ?? 100,
    rentEfficiency: parsed.economy.rentEfficiency ?? 100,
  };
  parsed.campaign = normalizeCampaignState(parsed.campaign);
  parsed.macro = normalizeMacroState(parsed.macro);
  parsed.operations = normalizeOperationsState(parsed.operations);
  return parsed;
}

export function tryParseSnapshot(raw: string): ParseSnapshotResult {
  try {
    return { ok: true, snapshot: parseSnapshot(raw) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown save parse error',
    };
  }
}

export function createSaveSlotSummary(
  slotId: string,
  snapshot: SimulationSnapshot,
  savedAt = snapshot.savedAt,
): SaveSlotSummary {
  return {
    slotId,
    savedAt,
    day: snapshot.clock.day,
    act: snapshot.campaign.act,
    mode: snapshot.campaign.mode,
    identity: snapshot.campaign.towerIdentity,
    declaredIdentity: snapshot.campaign.declaredIdentity,
    funds: snapshot.economy.funds,
    population: snapshot.economy.population,
    roomCount: snapshot.tower.rooms.length,
    victory: snapshot.campaign.victory,
  };
}

export async function saveSnapshot(
  snapshot: SimulationSnapshot,
  slotId = DEFAULT_SAVE_SLOT,
): Promise<void> {
  const db = await getDatabase();
  await db.run('INSERT OR REPLACE INTO saves (slot_id, data, saved_at) VALUES (?, ?, ?)', [
    slotId,
    serializeSnapshot(snapshot),
    snapshot.savedAt,
  ]);
  await saveWebStore();
}

export async function loadSnapshot(slotId = DEFAULT_SAVE_SLOT): Promise<SimulationSnapshot | null> {
  const db = await getDatabase();
  const result = await db.query('SELECT data FROM saves WHERE slot_id = ? LIMIT 1', [slotId]);
  const row = result.values?.[0] as { data?: string } | undefined;
  if (!row?.data) return null;
  const parsed = tryParseSnapshot(row.data);
  return parsed.ok ? parsed.snapshot : null;
}

export async function listSaveSlots(): Promise<SaveSlotSummary[]> {
  const db = await getDatabase();
  const result = await db.query('SELECT slot_id, data, saved_at FROM saves ORDER BY saved_at DESC');
  return (result.values ?? [])
    .map((row) => row as { slot_id?: string; data?: string; saved_at?: string })
    .flatMap((row) => {
      if (!row.slot_id || !row.data) return [];
      const parsed = tryParseSnapshot(row.data);
      if (!parsed.ok) return [];
      return [createSaveSlotSummary(row.slot_id, parsed.snapshot, row.saved_at)];
    });
}

export async function deleteSnapshot(slotId = DEFAULT_SAVE_SLOT): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM saves WHERE slot_id = ?', [slotId]);
  await saveWebStore();
}

export async function recordSimulationEvent(eventType: string, data: unknown): Promise<void> {
  const db = await getDatabase();
  await db.run('INSERT INTO simulation_events (event_type, data, created_at) VALUES (?, ?, ?)', [
    eventType,
    JSON.stringify(data),
    new Date().toISOString(),
  ]);
  await pruneSimulationEventsInDatabase(db);
  await saveWebStore();
}

export function selectDurableSimulationEvents(events: readonly string[]): string[] {
  return events.filter((event) => DURABLE_SIMULATION_EVENTS.has(event));
}

export async function recordSimulationEvents(
  events: readonly string[],
  context: SimulationEventContext,
): Promise<number> {
  const durableEvents = selectDurableSimulationEvents(events);
  if (durableEvents.length === 0) return 0;

  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  for (const eventType of durableEvents) {
    await db.run('INSERT INTO simulation_events (event_type, data, created_at) VALUES (?, ?, ?)', [
      eventType,
      JSON.stringify({ ...context, batch: durableEvents }),
      createdAt,
    ]);
  }
  await pruneSimulationEventsInDatabase(db);
  await saveWebStore();
  return durableEvents.length;
}

export async function pruneSimulationEvents(
  maxRows = PRODUCTION_BUDGETS.maxSavedEvents,
): Promise<void> {
  const db = await getDatabase();
  await pruneSimulationEventsInDatabase(db, maxRows);
  await saveWebStore();
}

export async function listSimulationEvents(limit = 100): Promise<SimulationEventRecord[]> {
  const db = await getDatabase();
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const result = await db.query(
    'SELECT id, event_type, data, created_at FROM simulation_events ORDER BY id DESC LIMIT ?',
    [boundedLimit],
  );

  return (result.values ?? []).map((row) => {
    const record = row as {
      id?: number;
      event_type?: string;
      data?: string;
      created_at?: string;
    };
    return {
      id: Number(record.id ?? 0),
      eventType: record.event_type ?? 'unknown',
      data: parseSimulationEventData(record.data),
      createdAt: record.created_at ?? '',
    };
  });
}

async function pruneSimulationEventsInDatabase(
  db: Awaited<ReturnType<typeof getDatabase>>,
  maxRows = PRODUCTION_BUDGETS.maxSavedEvents,
): Promise<void> {
  const boundedRows = Math.max(100, Math.floor(maxRows));
  await db.run(
    `DELETE FROM simulation_events
     WHERE id NOT IN (
       SELECT id FROM simulation_events ORDER BY id DESC LIMIT ?
     )`,
    [boundedRows],
  );
}

function parseSimulationEventData(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
