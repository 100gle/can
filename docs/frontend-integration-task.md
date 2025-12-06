# Frontend Integration for Sprint 1 & Sprint 2

## Sprint 1 — 对象操作与元数据中心 (Object Operations & Metadata Hub)

### 1. Multi-selection + Batch Operations
- [x] Add selection state to `objectsStore` (selectedKeys Set)
- [x] Update `object-browser.tsx` with checkbox column for multi-selection
- [x] Create batch operations toolbar component (appears when items selected)
- [x] Wire batch delete, batch download, batch property edit

### 2. Copy / Move / Rename Operations
- [x] Create `RenameDialog` component for single object rename
- [x] Create `MoveObjectsDialog` for copy/move with destination picker
- [x] Add conflict strategy options (overwrite/rename/skip)
- [x] Add context menu entries for copy/move/rename actions
- [x] Wire to backend `CopyObject`, `RenameObject`, `MoveObjects` APIs

### 3. Virtual Folder Creation
- [x] Create `CreateFolderDialog` component
- [x] Add "New Folder" button to object browser toolbar
- [x] Wire to backend `CreateFolder` API
- [x] Handle duplicate folder name validation

### 4. Object Details & Metadata Drawer
- [x] Create `ObjectDetailsDrawer` component (side panel/sheet)
- [x] Integrate with `GetObjectAttributes` API
- [x] Display: metadata, tags, storage class, ACL, version history
- [x] Enable editing of metadata, tags, content-type, storage class, ACL
- [x] Wire save to `UpdateObjectAttributes` API

### 5. Batch Attribute Editing
- [x] Create `BatchAttributesDialog` for multi-select property changes
- [x] Support: batch tag/ACL/storage class updates
- [x] Progress tracking with failure reporting
- [x] Wire to `BatchUpdateObjectAttributes` API

---

## Sprint 2 — 下载体验与分享链接增强 (Download Experience & Share Links)

### 1. Download Queue Management
- [x] Basic queue exists in `transfersStore`
- [ ] Enhance download task with pause/resume/cancel UI *(deferred)*
- [ ] Add download progress detailed view *(deferred)*

### 2. Batch/Folder Download
- [x] Add batch download action in batch toolbar
- [x] Create download options dialog (target directory, conflict handling)
- [x] Wire to `DownloadBatch` API for archive downloads

### 3. Resumable Downloads
- [ ] Connect to backend resumable download support *(deferred)*
- [ ] Show resume capability in transfer list *(deferred)*

### 4. Enhanced Presigned Link Panel
- [x] Upgrade `PresignedURLDialog` → `AccessLinkDialog`
- [x] Add configuration options: expiration, HTTP method, custom headers, filename
- [x] Generate URL/Markdown/HTML formats
- [x] Integrate QR code display (from backend)
- [x] One-click copy for each format

### 5. Link History
- [x] Create `AccessLinkHistory` component listing recent links
- [x] Integrate `ListAccessLinkHistory` API
- [x] Show expiration status (expired/valid)
- [x] Add delete functionality via `DeleteAccessLinkHistory` API

---

## Verification

- [x] Run frontend build (`pnpm build`) successfully
- [ ] Run Vitest tests (`pnpm test`) *(no tests written yet)*
- [x] Manual UI testing in Wails dev mode

---

> 延后功能详见 [TODO.md](file:///Users/macbookpro/Repos/can/docs/TODO.md)
