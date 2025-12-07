# Sprint 5: 对象交互体验升级 (Advanced Object Interaction)

**目标**: 提升文件操作的便利性，不仅是存储，更是管理和预览。

## 1. 高级文件预览器 (File Previewer)
*   **功能描述**: 在文件浏览器中提供丰富的文件预览功能，无需下载即可查看内容。
*   **关联文档**: `docs/features.md` (Item 142)
*   **支持格式**:
    *   图片 (JPG, PNG, GIF, WEBP, SVG)
    *   文本与代码 (TXT, JSON, YAML, MD, JS, GO, etc. - 集成 Monaco Editor 只读模式)
    *   Markdown (渲染预览)
    *   视频/音频 (使用 HTML5 播放器，流式播放)
    *   PDF (可选，使用 PDF.js)
*   **关键任务**:
    *   [x] 前端: 实现 `FilePreviewModal` 组件（`frontend/src/components/objects/file-preview-modal.tsx`，支持图片/Markdown/文本/音视频/PDF 预览及编辑）。
    *   [x] 后端: 确保 `PresignedURL` 生成逻辑支持 `response-content-disposition: inline` 以便浏览器预览（`GetPresignedDownloadURLWithHeaders` + 各 provider `PresignURL` 实现）。

## 2. 在线文本编辑 (Edit-in-place)
*   **功能描述**: 允许用户直接在应用内修改简单的文本/配置/代码文件并直接保存回对象存储。
*   **关联文档**: `docs/features.md` (Item 143)
*   **关键任务**:
    *   [x] 前端: 在预览器中增加 "编辑" 模式（文本 & Markdown 均可切换编辑器）。
    *   [x] 前端: 实现保存逻辑 (获取内容 -> PutObject)。
    *   [x] UX: 处理并发冲突 (保存前重新获取 ETag 并自动刷新最新内容)。

## 3. 对象锁定与合规保留 (Object Lock)
*   **功能描述**: 支持 S3 Object Lock (WORM - Write Once Read Many)，防止对象在固定期限内被删除或篡改。
*   **关联文档**: `docs/features.md` (Item 155)
*   **关键任务**:
    *   [x] 后端: 适配 `GetObjectLockConfiguration`, `PutObjectRetention`, `PutObjectLegalHold`（参见 `internal/objects/service.go` 及 provider 实现）。
    *   [x] 前端: 在对象属性侧边栏增加 "Compliance & Retention" 面板（`frontend/src/components/objects/object-details-drawer.tsx`）。

## 4. 高级元数据与软链接
*   **功能描述**: 完善对象属性的展示，支持识别和创建 Symlink (OSS)。
*   **关联文档**: `docs/features.md` (Item 156)
*   **关键任务**:
    *   [x] 后端: 在 `HeadObject` 中解析 `x-oss-object-type: Symlink` 等特定头（`internal/providers/oss_storage_client.go`）。
    *   [x] 前端: 在文件列表为软链接显示特殊图标（`frontend/src/components/browser/file-explorer.tsx`）。
    *   [x] 前端: 创建软链接的对话框。
