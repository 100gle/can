# Sprint 2: Data Management & Migration

**Goal**: Enable users to manage data lifecycle, perform migrations, and protect data.

## 1. Data Migration Service
**Context**: This feature is completely missing. It requires a new package to handle migrating data between different providers.
**Relevant Spec**: `docs/spec/data_migration.md`
**File Paths**:
- `internal/migration/` (New Directory)
- `frontend/src/components/migration/` (New Directory)

**Tasks**:
- [ ] Create `internal/migration` package.
- [ ] Implement cross-provider migration logic (Source -> Destination).
- [ ] Implement migration status tracking and error handling.
- [ ] Create a Migration UI Wizard in the frontend to guide users through the process.

## 2. Backup & Recovery
**Context**: Completely missing. Need to allow users to create snapshots or backups of their buckets.
**Relevant Spec**: `docs/spec/backup_recovery.md`
**File Paths**:
- `internal/backup/` (New Directory)

**Tasks**:
- [ ] Create `internal/backup` package.
- [ ] Implement Snapshot logic (point-in-time copy or metadata marker).
- [ ] Implement Restore logic.
- [ ] Create a Backup Management UI to view and restore backups.

## 3. Bucket Website Configuration
**Context**: Backend stubs likely exist in `internal/config/website.go`, but the UI is missing.
**Relevant Spec**: `docs/spec/bucket_properties_config.md`
**File Paths**:
- `internal/config/website.go`
- `frontend/src/components/buckets/website-panel.tsx` (New)
- `frontend/src/pages/bucket-settings-page.tsx`

**Tasks**:
- [ ] Verify backend `GetWebsite` and `SetWebsite` implementation.
- [ ] Create `WebsitePanel` component in `frontend/src/components/buckets/`.
- [ ] Add `WebsitePanel` to `bucket-settings-page.tsx`.

## Parallel Development Notes
> [!IMPORTANT]
> **Conflict Prevention Strategy**:
> *   **Bucket Settings UI**: This sprint shares `bucket-settings-page.tsx` with Sprint 1. To avoid conflicts:
>     1.  Create the `WebsitePanel` in a new, separate file: `frontend/src/components/buckets/website-panel.tsx`.
>     2.  Only modify `bucket-settings-page.tsx` at the very end to import and add the panel to the list.
>     3.  If another team has already touched `bucket-settings-page.tsx`, simply merge the new object into the `sections` array.
> *   **Backend Config**: `internal/config/website.go` is isolated. Do not modify `service.go` unless absolutely necessary (use receiver methods in `website.go`).
