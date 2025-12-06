# Project TODO List

This document consolidates all incomplete features, deferred items, and technical debt identified during the Sprint 1 & Sprint 2 frontend integration review.

## 🚀 High Priority (Sprint 3 Candidates)

### Download Experience
- [ ] **Pause/Resume/Cancel UI**: Add controls to `TransfersPage` for managing active downloads. (Requires backend `PauseTransfer`/`ResumeTransfer` support)
- [ ] **Resumable Downloads**: Connect to backend range request support to allow resuming interrupted downloads.
- [ ] **Transfer Persistence**: Persist transfer tasks to local DB so they can be resumed after app restart.

### Verification & Quality
- [ ] **Unit Tests**: Add Vitest component tests for critical flows:
  - `RenameDialog` (validation logic)
  - `CreateFolderDialog` (duplicate check logic)
  - `BatchAttributesDialog` (state management)
- [ ] **E2E Tests**: Add Playwright/Cypress tests for critical object operations.

---

## 🛠 Low Priority / Nice to Have

### UI Refinements
- [ ] **Download Progress Details**: Show more detailed progress (speed, ETA) in the transfer list.
- [ ] **Context Menu Icons**: Standardize icon usage across all context menus.
- [ ] **Empty States**: Improve empty state illustrations for `ObjectBrowser` and `LinkHistoryPanel`.

---

## 📦 Backlog / Future Considerations

- **Virtual Folder Optimization**: For buckets with millions of objects, virtual folder calculation might be slow on frontend. Consider backend-side directory listing.
- **Large File Handling**: optimize memory usage for multi-GB file uploads/downloads in Wails.
- **Cross-Platform Testing**: Verify file system paths and drag-and-drop on Windows/Linux.
