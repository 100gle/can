# Sprint 16 Implementation Plan: Image Hosting & Compression

## 1. Goal
Add a dedicated **Image Hosting (图床)** module to the application, allowing users to quickly upload images to object storage with features like drag-and-drop, clipboard pasting, and client-side compression (TinyPNG-like).

## 2. Core Features

### 2.1 Upload Methods
- **Drag & Drop**: A refined drop zone specifically for images.
- **Clipboard Paste**: Support pasting images directly from the system clipboard (`Ctrl+V`).

### 2.2 Image Processing (Client-side)
- **Pre-upload Compression**:
  - Optional "Smart Compression" (similar to TinyPNG) before uploading.
  - Configurable quality/size targets.
  - Visual feedback: "Original: 5MB -> Compressed: 1.2MB (76% saved)".
- **Format Conversion** (Optional for v1): Convert to WebP/JPEG automatically.

### 2.3 Post-Upload Actions
- **Quick Copy**: One-click copy for:
  - Markdown: `![alt](url)`
  - HTML: `<img src="url" />`
  - Raw URL
- **History**: Display a list of recently uploaded images with thumbnails and copy buttons.

## 3. Architecture & Technical Design

### 3.1 Backend Changes (Go)
To reuse the robust `UploadFilesFromPaths` transfer system, we need a bridge to convert in-memory blobs (from Paste/Compression) into local temporary files.

*   **New Binding**: `App.WriteTempFile(filename string, dataB64 string) (string, error)`
    *   Decodes Base64 data.
    *   Writes to `os.TempDir()` or a dedicated app cache scope.
    *   Returns the absolute file path.
    *   *Note*: These temp files should be cleaned up on app exit or periodically.

### 3.2 Frontend Changes (React/Typescript)
*   **Dependency**: Add `browser-image-compression` or `compressorjs`.
*   **New Route**: `/gallery` (Image Hosting Dashboard).
*   **State Management**: `useGalleryStore`
    *   Persist settings (target bucket, compression toggle).
    *   Maintain upload history (IndexedDB or LocalStorage).
*   **Workflow**:
    1.  User Drops/Pastes Image -> `File` object.
    2.  (Optional) Run compression -> New `File/Blob`.
    3.  Convert to Base64 -> Call `WriteTempFile` -> Get `tempPath`.
    4.  Call `transfersStore.uploadFilesFromPaths([tempPath], targetOptions)`.
    5.  Monitor `transfersStore` for completion -> Add to History.

## 4. Implementation Steps

### Phase 1: Infrastructure & Dependencies
1.  [ ] Install frontend dependencies: `npm install browser-image-compression`.
2.  [ ] Implement Backend `WriteTempFile` method in `app.go`.
3.  [ ] Create `GalleryStore` for managing gallery state and history.

### Phase 2: UI Implementation
1.  [ ] Create `GalleryLayout` and Route.
2.  [ ] Implement `DropZone` component with Paste support.
    *   *Hint*: Listen for `paste` events on the window or a focused container.
3.  [ ] Implement `ImagePreview` card showing compression stats.

### Phase 3: Logic Integration
1.  [ ] Wire up `handleImageDrop` -> `Compression Service` -> `WriteTempFile` -> `UploadFilesFromPaths`.
2.  [ ] Implement result handling: once upload finishes (polling transfer store), update UI with the public URL.
    *   **Requirement**: The system MUST use a user-configured **Public Domain / CDN Host** (e.g., `https://cdn.example.com`) to generate links.
    *   **Constraint**: Do NOT use presigned URLs or raw S3 endpoints.
    *   **Validation**: If no Public Domain is configured for the selected bucket, prompt the user to set it up before showing copy buttons.

### Phase 4: Polish
1.  [ ] Add "Copy Link" buttons with toast feedback.
2.  [ ] Add "Auto Copy" preference (automatically copy Markdown link after upload).

## 5. Proposed File Structure

```
frontend/src/
  pages/
    gallery/
      index.tsx          # Main Gallery View
      components/
        drop-zone.tsx    # Drag & Drop + Paste handler
        settings-bar.tsx # Bucket selection, compression toggle, Public Domain Input
        history-list.tsx # Recent uploads (persisted in local storage)
  state/
    gallery.ts           # Zustand store:
                         # - settings: { bucket: string, publicDomain: string, compression: boolean }
                         # - history: UploadRecord[]
  lib/
    image-processing.ts  # Wrapper around compression lib
```

## 6. Questions / Risky Assumptions
*   **Public Domain Storage**: This will be stored in the frontend's local storage (likely `zustand/persist`) per bucket or as a global setting for the gallery.
*   **Path appending**: We assume standard path appending (`domain + / + key`) works. Users using rewrite rules might need more advanced config (out of scope for v1).
