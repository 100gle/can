# Provider Client Pooling

This document describes how CAN reuses provider clients to avoid redundant TLS handshakes and repeated credential decryption.

## Overview

- `providers.ClientPool` owns all `StorageClient` instances. Clients are keyed by `accountID` and live for **5 minutes** by default.
- `ClientPool.Get()` accepts a lazy credential supplier. Credentials are only decrypted when a new client is needed; cache hits reuse the already-decrypted copy.
- All services (`buckets`, `objects`, `search`, `transfer`) obtain clients through the pool so every operation shares the same HTTP transport and retry configuration from `providers.StorageFactory`.

## Lifecycle & TTL

1. `Get()` trims/validates the account ID.
2. When an entry exists and has not expired, the cached `{client, credentials}` pair is returned immediately.
3. On miss or expiry the supplier is invoked to decrypt credentials, `StorageFactory` builds a new client, and the entry is stored with `now + ttl`.
4. TTL is configurable via `providers.WithClientTTL` should we need to tighten/relax reuse windows for debugging.

## Invalidation

- `accounts.Service` holds a reference to the pool and calls `Invalidate(accountID)` after `UpdateAccount` and `DeleteAccount` succeed.
- Import/export flows reuse the normal CRUD methods, so invalidation automatically occurs when secrets change.
- Frontend edits should **not** attempt to hold on to `StorageClient` references; the pool provides the single source of truth and handles recycling.

## Failure Handling

- Suppliers returning an error (e.g., decrypt failure) propagate to callers so UI surfaces the root cause.
- If a new client cannot be built, the cache entry is untouched which forces the next request to retry creation.
- Invalidating a non-existent account ID is a no-op, allowing defensive calls during account removal.

## Service Integration Notes

| Package   | Usage                                                                 |
|-----------|------------------------------------------------------------------------|
| `buckets` | Needs both the client and the cached credentials to resolve regions.   |
| `objects` | Only the client is required; credentials remain inside the cache.      |
| `search`  | Pulls clients for iterative scans and tag lookups.                     |
| `transfer`| Currently stores the pool reference for the upcoming worker queue rev. |

By centralizing client reuse here we guarantee consistent retry/backoff behaviour and reduce load on provider control planes.
