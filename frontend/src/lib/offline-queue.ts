import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "can-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "actions";

export type QueuedActionType = "upload" | "delete" | "rename" | "move" | "create-folder";

export type QueuedActionStatus = "pending" | "running" | "completed" | "failed";

export type QueuedAction = {
  id: string;
  accountId: string;
  bucket: string;
  type: QueuedActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: QueuedActionStatus;
  error?: string;
  lastAttempt?: number;
};

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    },
  });

  return dbInstance;
}

/**
 * Add a new action to the offline queue
 */
export async function addToQueue(
  action: Omit<QueuedAction, "id" | "createdAt" | "retries" | "status">,
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const fullAction: QueuedAction = {
    ...action,
    id,
    createdAt: Date.now(),
    retries: 0,
    status: "pending",
  };

  await db.add(STORE_NAME, fullAction);
  return id;
}

/**
 * Get all pending actions (FIFO order)
 */
export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const index = tx.store.index("status");
  const actions = await index.getAll("pending");

  // Sort by createdAt (FIFO)
  return actions.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get all actions (for UI display)
 */
export async function getAllActions(): Promise<QueuedAction[]> {
  const db = await getDB();
  const actions = await db.getAll(STORE_NAME);

  // Sort by createdAt (newest first for display)
  return actions.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get a specific action by ID
 */
export async function getAction(id: string): Promise<QueuedAction | undefined> {
  const db = await getDB();
  return await db.get(STORE_NAME, id);
}

/**
 * Update an action's status
 */
export async function updateActionStatus(
  id: string,
  status: QueuedActionStatus,
  error?: string,
): Promise<void> {
  const db = await getDB();
  const action = await db.get(STORE_NAME, id);
  if (!action) {
    throw new Error(`Action ${id} not found`);
  }

  action.status = status;
  action.lastAttempt = Date.now();
  if (error) {
    action.error = error;
  }

  await db.put(STORE_NAME, action);
}

/**
 * Increment retry count for an action
 */
export async function incrementRetries(id: string): Promise<number> {
  const db = await getDB();
  const action = await db.get(STORE_NAME, id);
  if (!action) {
    throw new Error(`Action ${id} not found`);
  }

  action.retries += 1;
  action.lastAttempt = Date.now();
  await db.put(STORE_NAME, action);

  return action.retries;
}

/**
 * Delete an action from the queue
 */
export async function deleteAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Clear all completed actions
 */
export async function clearCompleted(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("status");
  const completed = await index.getAllKeys("completed");

  for (const key of completed) {
    await tx.store.delete(key);
  }

  await tx.done;
  return completed.length;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);

  return {
    total: all.length,
    pending: all.filter((a) => a.status === "pending").length,
    running: all.filter((a) => a.status === "running").length,
    completed: all.filter((a) => a.status === "completed").length,
    failed: all.filter((a) => a.status === "failed").length,
  };
}
