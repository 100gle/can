# Sprint 1: Core Reliability & Foundation

**Goal**: Finalize the core data movement engine and essential security/configuration features. Ensure the system is robust before adding advanced operational tools.

## 1. Synchronization Engine
**Context**: The `internal/sync` package has scaffolding but no logic. We need to implement the core sync service.
**Relevant Spec**: `docs/spec/synchronization.md`
**File Paths**:
- `internal/sync/service.go`
- `internal/sync/types.go`

**Tasks**:
- [ ] Implement `StartSync` and `StopSync` logic in `internal/sync/service.go`.
- [ ] Implement one-way and two-way sync algorithms.
- [ ] Implement conflict resolution strategies (e.g., newer wins, source wins).
- [ ] Create a "Sync" tab in the Frontend or integrate it into the Dashboard to manage sync tasks.

## 2. Advanced Transfer Management
**Context**: Basic transfers work, but robust retry mechanisms and task prioritization are missing.
**Relevant Spec**: `docs/spec/transfer_management.md`
**File Paths**:
- `internal/transfer/service.go`
- `internal/transfer/types.go`

**Tasks**:
- [ ] Implement exponential backoff retry logic in `internal/transfer/service.go`.
- [ ] Implement task prioritization (queue management) so critical transfers happen first.
- [ ] Add support for pausing and resuming transfers purely from the backend state.

## 3. Bucket Access & Policy
**Context**: The `policy` gate exists in the frontend code, but the UI panel is implementation is missing in `bucket-settings-page.tsx`.
**Relevant Spec**: `docs/spec/bucket_access_control.md`
**File Paths**:
- `internal/config/policy.go`
- `frontend/src/components/buckets/policy-panel.tsx` (New)
- `frontend/src/pages/bucket-settings-page.tsx`

**Tasks**:
- [ ] Implement backend `SetPolicy` and `GetPolicy` in `internal/config/policy.go` (verify partial implementation).
- [ ] Create `PolicyPanel` component in `frontend/src/components/buckets/`.
- [ ] Integrate `PolicyPanel` into `bucket-settings-page.tsx`.

## Parallel Development Notes
> [!IMPORTANT]
> **Conflict Prevention Strategy**:
> *   **Bucket Settings UI**: This sprint shares `bucket-settings-page.tsx` with Sprint 2. To avoid conflicts:
>     1.  Create the `PolicyPanel` in a new, separate file: `frontend/src/components/buckets/policy-panel.tsx`.
>     2.  Only modify `bucket-settings-page.tsx` at the very end to import and add the panel to the list.
>     3.  If another team has already touched `bucket-settings-page.tsx`, simply merge the new object into the `sections` array.
> *   **Backend Config**: `internal/config/policy.go` is isolated. Do not modify `service.go` unless absolutely necessary (use receiver methods in `policy.go`).
