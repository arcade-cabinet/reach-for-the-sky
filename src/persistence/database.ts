/// <reference types="vite/client" />
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';

const DB_NAME = 'reach_for_the_sky';
const DB_VERSION = 2;

const sqlite = new SQLiteConnection(CapacitorSQLite);
let connectionPromise: Promise<SQLiteDBConnection> | null = null;
let webReadyPromise: Promise<void> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS saves (
  slot_id  TEXT PRIMARY KEY,
  data     TEXT NOT NULL,
  saved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corrupt_saves (
  slot_id     TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  error       TEXT NOT NULL,
  saved_at    TEXT,
  detected_at TEXT NOT NULL
);
`;

export async function getDatabase(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    connectionPromise = initDatabase().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

async function initDatabase(): Promise<SQLiteDBConnection> {
  await prepareWebStore();
  await sqlite.checkConnectionsConsistency();
  const existing = await sqlite.isConnection(DB_NAME, false);
  const db = existing.result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
  await db.open();
  await db.execute(SCHEMA);
  await migrateSchema(db);
  return db;
}

async function migrateSchema(db: SQLiteDBConnection): Promise<void> {
  const versionResult = await db.query('PRAGMA user_version');
  const oldVersion = Number(versionResult.values?.[0]?.user_version ?? 0);
  if (oldVersion >= DB_VERSION) return;
  await db.execute(`PRAGMA user_version = ${DB_VERSION}`);
}

async function prepareWebStore(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (webReadyPromise) return webReadyPromise;

  webReadyPromise = (async () => {
    const basePath = `${import.meta.env.BASE_URL}assets`;
    defineJeepSqlite(window);
    await customElements.whenDefined('jeep-sqlite');
    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      element.setAttribute('autosave', 'true');
      element.setAttribute('wasmpath', basePath);
      document.body.appendChild(element);
    }
    await sqlite.initWebStore();
  })().catch((error) => {
    webReadyPromise = null;
    throw error;
  });

  return webReadyPromise;
}

export async function saveWebStore(database = DB_NAME): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;
  await getDatabase();
  await sqlite.saveToStore(database);
}

export async function closeDatabase(): Promise<void> {
  const existing = await sqlite.isConnection(DB_NAME, false);
  if (existing.result) await sqlite.closeConnection(DB_NAME, false);
  connectionPromise = null;
}
