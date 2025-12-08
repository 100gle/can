# Sprint 11: Technical Debt Paydown & Security Hardening

**Goal**: Address critical findings from expert code review to ensure data safety, correct API behavior, and code maintainability.

## Scopes

### 1. Data Security (Backup Encryption)
**Priority**: Critical
- **Problem**: `CreateAppBackup` currently returns plaintext even when encryption is requested.
- **Solution**: Implement AES-GCM encryption with password-based key derivation (Argon2/PBKDF2). Ensure `RestoreAppBackup` can decrypt it.

### 2. API Integrity (Snapshot Management)
**Priority**: High
- **Problem**: `DeleteSnapshot` is hidden behind a type assertion, making the `backup.Service` interface incomplete and fragile.
- **Solution**: Promote `DeleteSnapshot` to the first-class `backup.Service` interface.

### 3. Reliability (Graceful Shutdown)
**Priority**: High
- **Problem**: Application usage of `transfers` does not wait for active transfers to pause/finish/checkpoint before identifying process exit, risking data corruption or zombie locks.
- **Solution**: Implement `Shutdown(ctx)` with `WaitGroup` in Transfer Service.

### 4. Code Quality (DRY Clients)
**Priority**: Medium
- **Problem**: Repeated pattern of `client, err := s.pool.Get(...)` with identical error handling and credential fetching in multiple services.
- **Solution**: Extract a shared `GetClient` helper to centralize error handling and credential retrieval logic.

### 5. Implementation Honesty (Restore Stub)
**Priority**: Medium
- **Problem**: `RestoreSnapshot` returns `nil` (success) without doing anything.
- **Solution**: At minimum, return a "Not Implemented" error or perform a "Dry Run" log to avoid misleading users/callers.

## Success Metrics
- [ ] New backups created with password cannot be read as plain text.
- [ ] Backups can be restored with correct password.
- [ ] Code compiles without type assertion in `app.DeleteBucketSnapshot`.
- [ ] Transfer service waits for workers on shutdown (verified via logs/tests).
