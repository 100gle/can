import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { OfflineAction, OfflineActionInput, OfflineActionStatus } from "@/lib/offline/types";

const DB_NAME = "can-offline-queue";
const DB_VERSION = 2;
const STORE_NAME = "actions";

type QueueConfig = {
  maxItems: number;
  actionTTL: number; // ms
};

const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxItems: 500,
  actionTTL: 3 * 24 * 60 * 60 * 1000, // 3 days
};

interface OfflineQueueDB extends DBSchema {
  actions: {
    key: string;
    value: OfflineAction;
    indexes: {
      status: OfflineActionStatus;
      accountId: string;
      createdAt: number;
      ttl: number;
    };
  };
}

let config: QueueConfig = { ...DEFAULT_QUEUE_CONFIG };
let dbPromise: Promise<IDBPDatabase<OfflineQueueDB>> | null = null;

export const configureOfflineQueue = (patch: Partial<QueueConfig>) => {
  config = { ...config, ...patch };
};

const getDB = async (): Promise<IDBPDatabase<OfflineQueueDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
      upgrade: (db, oldVersion, _newVersion, transaction) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("accountId", "accountId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("ttl", "ttl", { unique: false });
        } else if (oldVersion < 2) {
          const store = transaction.objectStore(STORE_NAME);
          if (!store.indexNames.contains("status")) {
            store.createIndex("status", "status", { unique: false });
          }
          if (!store.indexNames.contains("accountId")) {
            store.createIndex("accountId", "accountId", { unique: false });
          }
          if (!store.indexNames.contains("createdAt")) {
            store.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (!store.indexNames.contains("ttl")) {
            store.createIndex("ttl", "ttl", { unique: false });
          }
        }
      },
    });
  }
  return dbPromise;
};

const ensureCapacity = async (db: IDBPDatabase<OfflineQueueDB>) => {
  const count = await db.count(STORE_NAME);
  if (count < config.maxItems) return;

  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("createdAt");
  let cursor = await index.openCursor();

  while (cursor && (await tx.store.count()) >= config.maxItems) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
};

export const addAction = async (input: OfflineActionInput): Promise<string> => {
  const db = await getDB();
  await ensureCapacity(db);

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const ttl = createdAt + config.actionTTL;
  const record: OfflineAction = {
    ...input,
    id,
    createdAt,
    ttl,
    retries: 0,
    status: "pending",
  };

  await db.add(STORE_NAME, record);
  return id;
};

export const getAction = async (id: string): Promise<OfflineAction | undefined> => {
  const db = await getDB();
  return db.get(STORE_NAME, id);
};

export const getAllActions = async (): Promise<OfflineAction[]> => {
  const db = await getDB();
  const entries = await db.getAll(STORE_NAME);
  return entries.sort((a, b) => b.createdAt - a.createdAt);
};

export const getPendingActions = async (accountId?: string): Promise<OfflineAction[]> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const index = tx.store.index("status");
  const pending = await index.getAll("pending");
  await tx.done;

  const filtered = pending.filter((action) => {
    if (action.ttl && action.ttl < Date.now()) {
      return false;
    }
    if (accountId && action.accountId !== accountId) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => a.createdAt - b.createdAt);
};

export const updateActionStatus = async (
  id: string,
  status: OfflineActionStatus,
  lastError?: string,
): Promise<void> => {
  const db = await getDB();
  const record = await db.get(STORE_NAME, id);
  if (!record) return;

  record.status = status;
  record.lastAttemptAt = Date.now();
  if (lastError) {
    record.lastError = lastError;
  } else if (status === "completed") {
    delete record.lastError;
  }

  await db.put(STORE_NAME, record);
};

export const incrementRetries = async (id: string): Promise<number> => {
  const db = await getDB();
  const record = await db.get(STORE_NAME, id);
  if (!record) {
    throw new Error(`Action ${id} not found`);
  }
  record.retries += 1;
  record.lastAttemptAt = Date.now();
  await db.put(STORE_NAME, record);
  return record.retries;
};

export const deleteAction = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
};

export const clearCompleted = async (): Promise<number> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("status");
  let cursor = await index.openCursor("completed");
  let removed = 0;

  while (cursor) {
    await cursor.delete();
    removed += 1;
    cursor = await cursor.continue();
  }

  await tx.done;
  return removed;
};

export const purgeExpiredActions = async (): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("ttl");
  const range = IDBKeyRange.upperBound(Date.now());
  let cursor = await index.openCursor(range);

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
};

export const getQueueStats = async () => {
  const db = await getDB();
  const entries = await db.getAll(STORE_NAME);
  return {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    running: entries.filter((e) => e.status === "running").length,
    completed: entries.filter((e) => e.status === "completed").length,
    failed: entries.filter((e) => e.status === "failed").length,
    canceled: entries.filter((e) => e.status === "canceled").length,
  };
};
