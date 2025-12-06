# Frontend Integration for Sprint 1 & Sprint 2

This plan integrates the frontend UI with backend APIs implemented in Sprint 1 (Object Operations & Metadata) and Sprint 2 (Download Experience & Share Links). The backend exposes comprehensive APIs that are not yet fully utilized by the frontend.

## ✅ Implementation Status (Updated 2025-12-07)

All major features have been implemented and verified:
- **Sprint 1**: Multi-selection, batch operations, copy/move/rename, folder creation, object details drawer, batch attributes dialog
- **Sprint 2**: Download options dialog, presigned link panel (enhanced), link history

See [frontend-integration-task.md](file:///Users/macbookpro/Repos/can/docs/frontend-integration-task.md) for detailed checklist.

---

## User Review Required

> [!IMPORTANT]
> **Scope Decision**: This is a significant amount of UI work. Should we implement all features at once, or prioritize specific ones?
> - **Priority A**: Multi-selection, batch delete, folder creation (quick wins)
> - **Priority B**: Object details drawer with metadata editing
> - **Priority C**: Enhanced share link panel with QR codes

> [!WARNING]
> **QR Code Library**: The backend generates QR codes as base64 PNG images. The frontend will display them directly. No additional library needed.

---

## Proposed Changes

### State Management

#### [MODIFY] [objects.ts](file:///Users/macbookpro/Repos/can/frontend/src/state/objects.ts)

Add selection state and new action methods:
- Add `selectedKeys: Set<string>` to state
- Add `toggleSelect(key)`, `selectAll()`, `clearSelection()` actions
- Add `copyObject`, `renameObject`, `moveObjects`, `createFolder` action wrappers
- Add `getObjectAttributes`, `updateObjectAttributes`, `batchUpdateAttributes` wrappers
- Add `downloadBatch` wrapper

---

### Object Browser Enhancements

#### [MODIFY] [object-browser.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/object-browser.tsx)

- Add checkbox column for multi-selection (both list and grid views)
- Import and render `BatchOperationsToolbar` when items are selected
- Add context menu with copy/move/rename/delete actions
- Add "New Folder" button in toolbar
- Add row click handler to open `ObjectDetailsDrawer`

#### [MODIFY] [object-grid-view.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/object-grid-view.tsx)

- Add checkbox overlay on grid items for selection
- Add context menu support

---

### New Dialogs and Components

#### [NEW] [batch-toolbar.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/batch-toolbar.tsx)

Floating toolbar that appears when items are selected:
- Selected count display
- Batch Download button
- Batch Delete button  
- Batch Edit Properties button
- Move/Copy button
- Clear Selection button

#### [NEW] [rename-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/rename-dialog.tsx)

Dialog for renaming a single object:
- Input for new name (preserves extension)
- Validation for empty/invalid names
- Connects to `RenameObject` API

#### [NEW] [move-copy-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/move-copy-dialog.tsx)

Dialog for move/copy operations:
- Mode toggle: Move vs Copy
- Bucket selector (for cross-bucket operations)
- Target prefix picker with folder tree
- Conflict strategy: Overwrite / Rename / Skip
- Progress indicator for batch operations
- Connects to `CopyObject` and `MoveObjects` APIs

#### [NEW] [create-folder-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/create-folder-dialog.tsx)

Simple dialog for creating folders:
- Folder name input
- Validation (no slashes, not empty, no duplicates)
- Connects to `CreateFolder` API

#### [NEW] [object-details-drawer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/object-details-drawer.tsx)

Side drawer (Sheet component) showing object details:
- Object info section: key, size, last modified, etag, content-type, storage class
- Metadata section: editable key-value pairs
- Tags section: editable key-value pairs
- ACL section: current ACL with edit capability
- Version history section (if versioning enabled)
- Save button connecting to `UpdateObjectAttributes` API

#### [NEW] [batch-attributes-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/batch-attributes-dialog.tsx)

Dialog for batch property updates:
- Tabs: Tags / Storage Class / ACL
- Apply to all selected objects
- Progress/result display with failure list
- Connects to `BatchUpdateObjectAttributes` API

---

### Download Enhancements

#### [NEW] [download-options-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/download-options-dialog.tsx)

Advanced download configuration:
- Target directory picker
- Conflict strategy selection
- Archive mode toggle (for batch downloads)
- Archive name input
- Connects to `DownloadBatch` API

---

### Share Link Enhancements

#### [MODIFY] [presigned-url-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/transfer/presigned-url-dialog.tsx)

Upgrade to full-featured `AccessLinkDialog`:
- Expiration picker (existing, enhanced)
- HTTP method selector (GET/PUT)
- Custom response headers input
- Custom filename input (Content-Disposition)
- Generated output in 3 formats: Raw URL / Markdown / HTML
- QR code display (from `AccessLink.qrCode` base64)
- Copy buttons for each format
- Connect to `GenerateAccessLinks` API

#### [NEW] [link-history-panel.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/transfer/link-history-panel.tsx)

Panel/popover showing recent access links:
- List of recent links with bucket/key/method/expiry
- Visual indicator for expired vs valid links
- Quick copy button
- Delete button per entry
- Connects to `ListAccessLinkHistory` and `DeleteAccessLinkHistory` APIs

---

### Context Menu

#### [NEW] [object-context-menu.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/object-context-menu.tsx)

Right-click context menu for objects:
- Download
- Copy Link (quick presign)
- Share (opens AccessLinkDialog)
- View Details (opens drawer)
- Rename
- Copy to...
- Move to...
- Delete

---

## Verification Plan

### Automated Tests

**Frontend Build Verification**:
```bash
cd /Users/macbookpro/Repos/can/frontend && pnpm build
```

**Vitest Unit Tests**:
```bash
cd /Users/macbookpro/Repos/can/frontend && pnpm test
```

> [!NOTE]
> The project uses Vitest for frontend testing. We will add component tests for new dialogs.

### Manual Verification

**Manual testing in Wails dev mode**:
1. Run `wails dev` from project root
2. Navigate to an account with an existing bucket
3. Verify these flows:

#### Multi-Selection & Batch Operations
- [ ] Click checkboxes to select multiple files
- [ ] Batch toolbar appears with correct count
- [ ] Batch delete works with confirmation
- [ ] Clear selection button works

#### Folder Creation
- [ ] Click "New Folder" button
- [ ] Enter folder name and confirm
- [ ] Folder appears in list

#### Rename
- [ ] Right-click object → Rename
- [ ] Enter new name and confirm
- [ ] Object renamed in list

#### Object Details
- [ ] Click on an object row
- [ ] Drawer opens with metadata/tags/ACL
- [ ] Edit a tag and save
- [ ] Changes persist on refresh

#### Enhanced Share Link
- [ ] Right-click → Share on an object
- [ ] Dialog shows expiry options, formats
- [ ] QR code displays
- [ ] Copy each format works

> [!TIP]
> User can test in dev mode with existing test accounts. All backend APIs are already functional based on previous Sprint implementation.
