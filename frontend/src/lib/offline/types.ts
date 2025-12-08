export type OfflineActionType = "upload" | "delete" | "rename" | "move" | "create-folder";

export type OfflineActionStatus =
  | "pending"
  | "retrying"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export type OfflineAction = {
  id: string;
  accountId: string;
  bucket: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: OfflineActionStatus;
  lastError?: string;
  lastAttemptAt?: number;
  versionToken?: string;
  ttl: number;
};

export type OfflineActionInput = Omit<
  OfflineAction,
  "id" | "createdAt" | "retries" | "status" | "ttl"
>;

export type OfflineListSource = "network" | "cache";

export type OfflineListResult<T> = {
  items: T[];
  source: OfflineListSource;
  lastSyncedAt?: number;
  truncated?: boolean;
  nextMarker?: string;
  versionToken?: string;
};

export type OfflineFileResult = {
  content: string | ArrayBuffer;
  contentType: string;
  etag?: string;
  source: OfflineListSource;
  lastSyncedAt?: number;
};

export type OfflineActionExecution<T = void> =
  | { status: "executed"; result?: T }
  | { status: "queued"; actionId: string };
