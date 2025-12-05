# Backend Architecture TODOs

## 1. Context Lifecycle Hygiene
- **Problem**: `App.ctx` from `startup` (`app.go:60-67`) is shared across every backend call (`app.go:79-333`). When the Wails window closes the context is canceled, and long-running S3/OSS operations never get their own timeout.
- **Actions**
  1. Add a helper such as `func (a *App) requestContext(parent context.Context) (context.Context, context.CancelFunc)` that wraps `context.WithTimeout(parent, defaultTimeout)`; default timeout should be configurable via env (e.g., `CAN_REQUEST_TIMEOUT`) with a sane fallback (60s).
  2. In every exported App method, call the helper with `context.Background()` (or the UI-provided context once available) and pass the returned `ctx` down to services instead of `a.ctx`. Only keep `a.ctx` for `runtime.*` dialogs/logging.
  3. For service calls that can legitimately run long (multipart transfer, search), allow method parameters to override timeout via optional args, but still derive them from the helper to ensure cancelation is scoped.
  4. Update services (`accounts`, `buckets`, `objects`, `search`, `config`, `transfer`) to accept the per-request context and remove any hidden dependency on `App.ctx`.
  5. Definition of Done: closing the Wails window no longer aborts background work immediately, and manual tests show that per-request timeouts emit user-friendly errors rather than hanging indefinitely.

## 2. Account Service Concurrency Safety
- **Problem**: `internal/accounts/service.go` keeps mutable fields (`activeID`, `activeLoaded`) without locks while multiple goroutines may call `SetActiveAccount`, `ActiveAccount`, or `DeleteAccount`.
- **Actions**
  1. Introduce a `sync.RWMutex` (e.g., `mu sync.RWMutex`) on the service; wrap all reads/writes to `activeID`/`activeLoaded` plus session store interactions inside the lock.
  2. Alternatively extract a small `ActiveAccountManager` struct (with its own mutex + session store dependency) and inject it into `accounts.Service` to keep responsibilities isolated.
  3. Add race-focused tests in `internal/accounts/service_test.go` that concurrently call `SetActiveAccount`, `ActiveAccount`, `DeleteAccount`, and `EnsureSeed`. Run `go test -race ./internal/accounts`.
  4. Definition of Done: race detector passes, and the session state persists correctly even under concurrent switching.

## 3. Provider Client Reuse
- **Problem**: `buckets.Service`, `objects.Service`, and `search.Service` rebuild storage clients on every call (`NewClient` + credential decryption), leading to repeated TLS handshakes and fragmented retry configuration.
- **Actions**
  1. Design a cache keyed by `accountID` (or hashed credentials) that stores `{StorageClient, expiresAt}`; expose it via a new `providers.ClientPool`.
  2. Ensure cached clients share HTTP transports so connection pooling works, and provide an explicit `Invalidate(accountID string)` hook that `accounts.Service` calls after credential updates/deletes.
  3. Move retry/backoff/metrics configuration into the factory/pool so all services pick up the same behavior; document defaults in `docs/spec/provider-clients.md` (new file).
  4. Update `buckets.Service.client`, `objects.Service.client`, `search.Service.client`, and `transfer.Service` to consume the pool rather than instantiating clients ad-hoc; keep credential decryption centralized to avoid redundant KMS calls.
  5. Definition of Done: repeated object listing/uploading reuses a single client (verified by instrumenting connection counts), and credentials updates immediately drop cached clients.

## 4. Bucket Configuration Capability Gating
- **Problem**: UI-facing methods for versioning/encryption/lifecycle/etc. are always bound (`app.go:144-232`), but `BucketConfigService` rejects non-S3 providers with `ErrUnsupportedProvider` (see `internal/config/service.go:24-58`).
- **Actions**
  1. Extend `types.ProviderCapability` (or add a `BucketConfigCapability` enum) to explicitly mark which providers support versioning/encryption/etc.; expose this via `ProviderCapabilities` and ensure `frontend` consumes it to gate buttons/menus.
  2. In the backend, wrap config calls with a small facade (`configfacade.Service`) that checks capabilities before invoking `BucketConfigService`, returning a descriptive error (e.g., `errors.New("provider OSS does not support bucket policies in CAN")`).
  3. Update `docs/spec/features.md` (bucket management section) to describe capability gating, including OSS/COS limitations, so QA has a reference.
  4. Add integration tests (or at least unit tests with fake providers) that verify OSS/COS accounts bypass these endpoints without surfacing raw `ErrUnsupportedProvider`.
  5. Definition of Done: UI no longer shows unsupported config actions, backend logs contain clearer messages, and specs mention which providers support which features.

## 5. Transfer Service Execution Model
- **Problem**: Transfers run synchronously inside `objects.Service` (`internal/objects/service.go:205-352`), while `transfer.Service` only tracks in-memory progress; tasks vanish on restart and “pause/cancel” simply cancel the current context.
- **Actions**
  1. Introduce a persistent task queue (SQLite table or bolt DB) owned by `transfer.Service`, storing metadata (account/bucket/key/status/progress/uploadID/chunks). Migrate existing in-memory managers to read/write through this store.
  2. Implement worker goroutines that pull queued tasks, obtain storage clients via the new client pool, and stream uploads/downloads. `objects.Service` should enqueue work instead of performing the transfer synchronously.
  3. Redefine pause/resume/cancel to update persisted state and signal workers via channels; ensure tasks survive app restarts by reloading pending work from the DB in `transfer.Service` initialization.
  4. Extend the API surface to expose task history and chunk-level progress if needed, and update the frontend poller to handle the new states.
  5. Definition of Done: transfers continue after restarting the app (manual test), pause/resume works without losing progress, and uploads/downloads no longer block the UI thread.
