import type { buckets, objects } from "@wailsjs/go/models";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

type BucketInfo = buckets.BucketInfo;
type ObjectInfo = objects.ObjectInfo;

const DB_NAME = "can-offline-cache";
const DB_VERSION = 2;

type CacheConfig = {
  bucketTTL: number;
  objectTTL: number;
  fileTTL: number;
  sizeLimitBytes: number;
};

const MB = 1024 * 1024;
const DEFAULT_CONFIG: CacheConfig = {
  bucketTTL: 30 * 60 * 1000, // 30 minutes
  objectTTL: 15 * 60 * 1000, // 15 minutes
  fileTTL: 24 * 60 * 60 * 1000, // 24 hours
  sizeLimitBytes: 100 * MB,
};

type BucketListEntry = {
  items: BucketInfo[];
  lastSyncedAt: number;
  versionToken: string;
};

type ObjectListEntry = {
  items: ObjectInfo[];
  truncated: boolean;
  nextMarker?: string;
  lastSyncedAt: number;
  versionToken: string;
};

type FileContentEntry = {
  content: string | ArrayBuffer;
  contentType: string;
  etag?: string;
  size: number;
  lastSyncedAt: number;
};

interface OfflineCacheDB extends DBSchema {
  bucketLists: {
    key: string;
    value: BucketListEntry;
    indexes: { lastSyncedAt: number };
  };
  objectLists: {
    key: string;
    value: ObjectListEntry;
    indexes: { lastSyncedAt: number };
  };
  fileContent: {
    key: string;
    value: FileContentEntry;
    indexes: { lastSyncedAt: number };
  };
}

const createVersionToken = (values: string[]): string => {
  if (!values.length) return "empty";
  return values.join("|");
};

export class OfflineCache {
  private dbPromise: Promise<IDBPDatabase<OfflineCacheDB>>;
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dbPromise = this.open();
  }

  configure(config: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config };
  }

  private async open(): Promise<IDBPDatabase<OfflineCacheDB>> {
    return openDB<OfflineCacheDB>(DB_NAME, DB_VERSION, {
      upgrade: (db, oldVersion, _newVersion, transaction) => {
        if (!db.objectStoreNames.contains("bucketLists")) {
          const store = db.createObjectStore("bucketLists");
          store.createIndex("lastSyncedAt", "lastSyncedAt");
        } else if (oldVersion < 2) {
          const store = transaction.objectStore("bucketLists");
          if (!store.indexNames.contains("lastSyncedAt")) {
            store.createIndex("lastSyncedAt", "lastSyncedAt");
          }
        }

        if (!db.objectStoreNames.contains("objectLists")) {
          const store = db.createObjectStore("objectLists");
          store.createIndex("lastSyncedAt", "lastSyncedAt");
        } else if (oldVersion < 2) {
          const store = transaction.objectStore("objectLists");
          if (!store.indexNames.contains("lastSyncedAt")) {
            store.createIndex("lastSyncedAt", "lastSyncedAt");
          }
        }

        if (!db.objectStoreNames.contains("fileContent")) {
          const store = db.createObjectStore("fileContent");
          store.createIndex("lastSyncedAt", "lastSyncedAt");
        } else if (oldVersion < 2) {
          const store = transaction.objectStore("fileContent");
          if (!store.indexNames.contains("lastSyncedAt")) {
            store.createIndex("lastSyncedAt", "lastSyncedAt");
          }
        }
      },
    });
  }

  private bucketKey(accountId: string): string {
    return accountId;
  }

  private objectKey(accountId: string, bucket: string, prefix: string, delimiter: string): string {
    return `${accountId}:${bucket}:${prefix}:${delimiter ?? ""}`;
  }

  private fileKey(accountId: string, bucket: string, key: string): string {
    return `${accountId}:${bucket}:${key}`;
  }

  private isExpired(entryTime: number, ttl: number): boolean {
    return Date.now() - entryTime > ttl;
  }

  // Buckets
  async setBucketList(accountId: string, items: BucketInfo[]) {
    const db = await this.dbPromise;
    const lastSyncedAt = Date.now();
    const versionToken = createVersionToken(items.map((bucket) => bucket.name));
    await db.put("bucketLists", { items, lastSyncedAt, versionToken }, this.bucketKey(accountId));
  }

  async getBucketList(accountId: string) {
    const db = await this.dbPromise;
    const entry = await db.get("bucketLists", this.bucketKey(accountId));
    if (!entry) return null;
    if (this.isExpired(entry.lastSyncedAt, this.config.bucketTTL)) {
      await db.delete("bucketLists", this.bucketKey(accountId));
      return null;
    }
    return entry;
  }

  // Objects
  async setObjectList(params: {
    accountId: string;
    bucket: string;
    prefix: string;
    delimiter: string;
    items: ObjectInfo[];
    truncated: boolean;
    nextMarker?: string;
  }) {
    const { accountId, bucket, prefix, delimiter, items, truncated, nextMarker } = params;
    const db = await this.dbPromise;
    const lastSyncedAt = Date.now();
    const versionToken = createVersionToken(
      items.map((object) => `${object.key}:${object.etag ?? object.lastModified ?? ""}`),
    );
    await db.put(
      "objectLists",
      { items, truncated, nextMarker, lastSyncedAt, versionToken },
      this.objectKey(accountId, bucket, prefix, delimiter),
    );
  }

  async getObjectList(accountId: string, bucket: string, prefix: string, delimiter: string) {
    const db = await this.dbPromise;
    const entry = await db.get("objectLists", this.objectKey(accountId, bucket, prefix, delimiter));
    if (!entry) return null;
    if (this.isExpired(entry.lastSyncedAt, this.config.objectTTL)) {
      await db.delete("objectLists", this.objectKey(accountId, bucket, prefix, delimiter));
      return null;
    }
    return entry;
  }

  // File Content
  async setFileContent(params: {
    accountId: string;
    bucket: string;
    key: string;
    content: string | ArrayBuffer;
    contentType: string;
    etag?: string;
  }) {
    const { accountId, bucket, key, content, contentType, etag } = params;
    const db = await this.dbPromise;
    const lastSyncedAt = Date.now();
    const size = typeof content === "string" ? content.length : content.byteLength;
    await db.put(
      "fileContent",
      { content, contentType, etag, lastSyncedAt, size },
      this.fileKey(accountId, bucket, key),
    );
    await this.trimFileCache();
  }

  async getFileContent(accountId: string, bucket: string, key: string) {
    const db = await this.dbPromise;
    const entry = await db.get("fileContent", this.fileKey(accountId, bucket, key));
    if (!entry) return null;
    if (this.isExpired(entry.lastSyncedAt, this.config.fileTTL)) {
      await db.delete("fileContent", this.fileKey(accountId, bucket, key));
      return null;
    }
    return entry;
  }

  async clear(scope: "all" | "lists" | "files" = "all") {
    const db = await this.dbPromise;
    if (scope === "all" || scope === "lists") {
      await db.clear("bucketLists");
      await db.clear("objectLists");
    }
    if (scope === "all" || scope === "files") {
      await db.clear("fileContent");
    }
  }

  async getUsage() {
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage ?? 0,
          quota: estimate.quota ?? 0,
        };
      } catch {
        // ignore
      }
    }
    return null;
  }

  private async trimFileCache() {
    if (!this.config.sizeLimitBytes) return;
    const usage = await this.getUsage();
    if (!usage || usage.usage <= this.config.sizeLimitBytes) {
      return;
    }

    const db = await this.dbPromise;
    const tx = db.transaction("fileContent", "readwrite");
    const index = tx.store.index("lastSyncedAt");
    let cursor = await index.openCursor();
    let currentUsage = usage.usage;

    while (cursor && currentUsage > this.config.sizeLimitBytes) {
      const size = cursor.value.size ?? 0;
      await cursor.delete();
      currentUsage -= size;
      cursor = await cursor.continue();
    }

    await tx.done;
  }
}

export const offlineCache = new OfflineCache();
