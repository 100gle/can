# Branch 2: 文件传输与预签名 URL

**分支名**: `feat/transfer-management`  
**预估工期**: 2-2.5 周  
**优先级**: P1  
**依赖**: 无（可与 Branch 1 并行开发）  
**关键特性**: 预签名 URL 生成、MultipartUpload、断点续传

---

## 📋 任务概览

**目标**: 实现完整的文件上传/下载管理，包括分片上传、断点续传、预签名 URL 生成等功能。

**关键特性**:
- MultipartUpload API（分片上传基础）
- 拖拽上传 / 文件夹上传
- 上传队列与进度管理
- 预签名 URL 生成与共享
- 文件夹下载 / ZIP 打包

**新增包**: `internal/transfer`

**文件修改范围**（独立性强，最少冲突）:
```
后端修改:
  ✏️ internal/objects/service.go       (新增 2 个方法)
  ✏️ internal/transfer/service.go      (新建，管理上传/下载)
  ✏️ app.go                            (新增 5+ 个方法)

前端修改:
  ✏️ frontend/src/state/transfers.ts   (新建)
  ✏️ frontend/src/components/objects/ObjectBrowser.tsx (扩展)
  ✏️ frontend/src/components/transfer/ (新建，上传/下载进度组件)
```

---

## 🎯 详细任务清单

### Task 1: 新建 transfer 包与基础服务（8h）

#### 1.1 创建 transfer 包结构
**目录**: `internal/transfer/`

```
internal/transfer/
├── service.go           # TransferService
├── types.go             # Transfer, Task 等类型
├── upload_manager.go    # 上传队列管理
├── download_manager.go  # 下载队列管理
└── service_test.go      # 单元测试
```

**耗时**: 1h

---

#### 1.2 定义 Transfer 类型
**文件**: `internal/transfer/types.go`

```go
package transfer

import "time"

// TaskStatus 定义传输任务状态
type TaskStatus string

const (
    TaskPending   TaskStatus = "pending"
    TaskRunning   TaskStatus = "running"
    TaskPaused    TaskStatus = "paused"
    TaskCompleted TaskStatus = "completed"
    TaskFailed    TaskStatus = "failed"
    TaskCanceled  TaskStatus = "canceled"
)

// TransferTask 表示单个上传/下载任务
type TransferTask struct {
    ID              string
    Type            string // "upload" | "download"
    AccountID       string
    Bucket          string
    Key             string
    Status          TaskStatus
    Progress        int64  // 已完成字节数
    Total           int64  // 总字节数
    Speed           int64  // 当前速度 B/s
    EstimatedTime   int64  // 预计剩余秒数
    StartTime       time.Time
    EndTime         *time.Time
    Error           *string
    Retries         int
    MaxRetries      int
    
    // For multipart upload
    UploadID        string
    CompletedParts  map[int]string // partNum -> etag
}

// UploadProgress 用于前端进度更新
type UploadProgress struct {
    TaskID   string
    Progress int64
    Total    int64
    Speed    int64
    Status   TaskStatus
}
```

**验收标准**:
- [ ] 类型定义完整，支持多种传输场景
- [ ] 字段清晰说明目的

**耗时**: 2h

---

#### 1.3 实现 TransferService
**文件**: `internal/transfer/service.go`

```go
package transfer

import (
    "context"
    "can/internal/accounts"
    "can/internal/providers"
)

type TransferService struct {
    accountsSvc    *accounts.Service
    clientFactory  providers.StorageFactory
    uploadMgr      *UploadManager
    downloadMgr    *DownloadManager
}

// GetOrCreateTask 获取或创建传输任务
func (s *TransferService) GetOrCreateTask(ctx context.Context, id string) (*TransferTask, error)

// ListTasks 列出所有传输任务
func (s *TransferService) ListTasks(ctx context.Context) ([]*TransferTask, error)

// CancelTask 取消任务
func (s *TransferService) CancelTask(ctx context.Context, taskID string) error

// PauseTask 暂停任务
func (s *TransferService) PauseTask(ctx context.Context, taskID string) error

// ResumeTask 恢复任务
func (s *TransferService) ResumeTask(ctx context.Context, taskID string) error

// GetTaskProgress 获取任务进度
func (s *TransferService) GetTaskProgress(ctx context.Context, taskID string) (*TransferTask, error)
```

**验收标准**:
- [ ] 服务初始化正常
- [ ] 任务创建、列表、状态管理正确
- [ ] 单元测试覆盖基本操作

**耗时**: 5h

---

### Task 2: 后端 - MultipartUpload 与预签名 URL（12h）

#### 2.1 在 objects.Service 中添加 Presigned URL 方法
**文件**: `internal/objects/service.go`

```go
// GetPresignedURL 生成预签名 URL
func (s *Service) GetPresignedURL(
    ctx context.Context,
    accountID, bucket, key string,
    expirationSeconds int64,
    method string, // "GET" | "PUT"
) (string, error) {
    // 1. 获取账户凭证
    // 2. 初始化 S3 client
    // 3. 使用 SDK 生成预签名 URL
    // 4. 返回 URL
}
```

**验收标准**:
- [ ] 能生成 GET 预签名 URL（下载）
- [ ] 能生成 PUT 预签名 URL（上传）
- [ ] 支持自定义过期时间（1h / 1d / 7d）
- [ ] URL 可在浏览器或 curl 中直接使用

**耗时**: 4h

---

#### 2.2 实现 MultipartUpload 初始化
**文件**: `internal/objects/service.go`

```go
// InitiateMultipartUpload 初始化分片上传
func (s *Service) InitiateMultipartUpload(
    ctx context.Context,
    accountID, bucket, key string,
) (uploadID string, error) {
    // 1. 获取账户凭证和 S3 client
    // 2. 调用 CreateMultipartUpload
    // 3. 返回 uploadID
}

// UploadPart 上传单个分片
func (s *Service) UploadPart(
    ctx context.Context,
    accountID, bucket, key, uploadID string,
    partNumber int,
    data []byte,
) (etag string, error) {
    // 1. 调用 UploadPart
    // 2. 返回 ETag
}

// CompleteMultipartUpload 完成分片上传
func (s *Service) CompleteMultipartUpload(
    ctx context.Context,
    accountID, bucket, key, uploadID string,
    parts map[int]string, // partNum -> etag
) error {
    // 1. 调用 CompleteMultipartUpload
    // 2. 返回结果
}

// AbortMultipartUpload 中止分片上传
func (s *Service) AbortMultipartUpload(
    ctx context.Context,
    accountID, bucket, key, uploadID string,
) error {
    // 1. 调用 AbortMultipartUpload
    // 2. 清理资源
}
```

**验收标准**:
- [ ] 能成功初始化分片上传
- [ ] 能上传单个分片
- [ ] 能完成分片上传
- [ ] 支持中止操作
- [ ] 单元测试覆盖完整流程

**耗时**: 8h

---

#### 2.3 在 app.go 暴露传输相关方法
**文件**: `app.go`

```go
// 预签名 URL
func (a *App) GetPresignedDownloadURL(
    accountID, bucket, key string, 
    expirationMinutes int64,
) (string, error)

func (a *App) GetPresignedUploadURL(
    accountID, bucket, key string,
    expirationMinutes int64,
) (string, error)

// MultipartUpload
func (a *App) InitiateMultipartUpload(accountID, bucket, key string) (string, error)
func (a *App) UploadPart(accountID, bucket, key, uploadID string, partNumber int, data []byte) (string, error)
func (a *App) CompleteMultipartUpload(accountID, bucket, key, uploadID string, parts map[int]string) error
func (a *App) AbortMultipartUpload(accountID, bucket, key, uploadID string) error

// 传输任务管理
func (a *App) ListTransferTasks() ([]*transfer.TransferTask, error)
func (a *App) CancelTransferTask(taskID string) error
func (a *App) PauseTransferTask(taskID string) error
func (a *App) ResumeTransferTask(taskID string) error
```

**耗时**: 2h

---

### Task 3: 前端 - 预签名 URL 与链接分享（8h）

#### 3.1 创建 Presigned URL Dialog 组件
**文件**: `frontend/src/components/transfer/PresignedURLDialog.tsx`

**功能**:
- 显示预签名 URL 生成对话框
- 选择过期时间（1h / 1d / 7d / custom）
- 选择操作类型（GET / PUT）
- 显示生成的 URL
- "复制到剪贴板"按钮
- "生成 QR 码"按钮（可选）

**实现步骤**:
1. 创建对话框 UI（Modal）
2. 表单字段：过期时间、操作类型
3. 调用 bridge 的 `GetPresignedDownloadURL` / `GetPresignedUploadURL`
4. 显示结果 URL
5. 集成复制功能（使用 clipboard API）

**验收标准**:
- [ ] 对话框能正常打开/关闭
- [ ] 能生成预签名 URL
- [ ] 能复制到剪贴板
- [ ] URL 在浏览器中可正常使用
- [ ] 错误提示清晰

**耗时**: 4h

---

#### 3.2 在 ObjectBrowser 中集成预签名 URL
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

在对象的右键菜单或操作栏中添加：
- "复制下载链接"：生成 GET 预签名 URL 并复制
- "生成分享链接"：打开 PresignedURLDialog

**耗时**: 2h

---

#### 3.3 实现下载链接生成与 QR 码（可选高级功能）
**文件**: `frontend/src/components/transfer/ShareLinkPanel.tsx`

**功能**:
- 显示预签名 URL
- 生成 QR 码（使用 qrcode.react 库）
- 复制链接
- 复制 QR 码图片

**耗时**: 2h

---

### Task 4: 前端 - 拖拽上传与文件夹上传（10h）

#### 4.1 实现拖拽上传 UI
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

**需求**:
- ObjectBrowser 整个文件列表区域支持拖拽
- 拖拽文件进入时显示"放开上传"提示
- 支持多个文件同时拖拽上传

**实现步骤**:
1. 在 ObjectBrowser 添加 drop 和 dragover 事件处理
2. 显示拖拽覆盖层提示
3. 调用 `transfersStore.uploadFiles(files, currentBucket, currentPrefix)`

**验收标准**:
- [ ] 能拖拽文件到浏览器
- [ ] 拖拽时显示提示
- [ ] 文件上传到正确位置

**耗时**: 4h

---

#### 4.2 实现点击选择上传
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

**需求**:
- 工具栏添加"上传文件"按钮
- 点击打开文件选择器
- 支持多选文件

**耗时**: 2h

---

#### 4.3 实现文件夹上传
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

**需求**:
- 工具栏添加"上传文件夹"按钮
- 使用 `<input type="file" webkitdirectory>` 选择文件夹
- 保持目录结构上传
- 递归创建虚拟目录

**实现步骤**:
1. 创建隐藏的文件夹输入框
2. 处理递归目录结构
3. 计算相对路径
4. 调用上传管理器

**验收标准**:
- [ ] 能选择文件夹
- [ ] 文件保持目录结构上传
- [ ] 虚拟目录自动创建

**耗时**: 4h

---

### Task 5: 前端 - 上传/下载队列管理（12h）

#### 5.1 新建 Zustand store - transfers
**文件**: `frontend/src/state/transfers.ts`

```typescript
type TransfersState = {
  tasks: Map<string, TransferTask>
  currentTask?: string
  sortBy: "name" | "status" | "progress" | "speed"
  
  // Actions
  uploadFiles: (files: File[], bucket: string, prefix: string) => Promise<void>
  downloadFiles: (bucket: string, keys: string[], asZip?: boolean) => Promise<void>
  addTask: (task: TransferTask) => void
  updateTask: (taskID: string, updates: Partial<TransferTask>) => void
  removeTask: (taskID: string) => void
  cancelTask: (taskID: string) => Promise<void>
  pauseTask: (taskID: string) => Promise<void>
  resumeTask: (taskID: string) => Promise<void>
  clearCompleted: () => void
}
```

**验收标准**:
- [ ] Store 初始化正确
- [ ] 任务增删改正常
- [ ] 状态更新及时反映到 UI

**耗时**: 4h

---

#### 5.2 创建上传进度 UI 组件
**文件**: `frontend/src/components/transfer/UploadProgress.tsx`

**显示**:
- 总体上传进度条（all tasks）
- 当前任务名称、大小、进度百分比
- 当前上传速度（KB/s 或 MB/s）
- 预计剩余时间

**实现**:
- 订阅 `transfersStore` 获取任务列表
- 实时更新进度条和统计信息
- 显示暂停/恢复/取消按钮

**验收标准**:
- [ ] 能显示上传进度
- [ ] 进度条动画流畅
- [ ] 速度和时间估算准确
- [ ] 能暂停/恢复/取消

**耗时**: 4h

---

#### 5.3 创建传输任务列表页面
**文件**: `frontend/src/routes/accounts/$accountId/transfers.tsx`

**功能**:
- 显示所有上传/下载任务列表
- 表格列：任务名、大小、进度、速度、状态、操作
- 支持排序
- 支持筛选（进行中/已完成/失败）
- 批量操作（清空已完成、取消所有）

**耗时**: 4h

---

### Task 6: 前端 - 断点续传与失败重试（8h）

#### 6.1 实现上传失败重试
**文件**: `frontend/src/state/transfers.ts`

**逻辑**:
- 上传失败时自动重试（指数退避）
- 最多重试 3 次
- 显示重试次数
- 允许手动重试

**实现**:
```typescript
const retryUpload = async (taskID: string) => {
  // 1. 检查重试次数 < maxRetries
  // 2. 重新上传
  // 3. 更新任务状态
}
```

**耗时**: 3h

---

#### 6.2 实现断点续传（基础）
**文件**: `frontend/src/state/transfers.ts` + `internal/transfer/`

**逻辑**:
- 每个分片上传后保存已完成分片列表到 localStorage
- 上传中断后，重新上传时检查已完成分片
- 跳过已完成分片，继续上传

**实现**:
```typescript
const saveUploadProgress = (taskID: string, completedParts: number[]) => {
  localStorage.setItem(`upload_${taskID}`, JSON.stringify(completedParts))
}

const loadUploadProgress = (taskID: string): number[] => {
  return JSON.parse(localStorage.getItem(`upload_${taskID}`) || '[]')
}
```

**耗时**: 4h

---

#### 6.3 文件夹下载与 ZIP 打包（可选）
**文件**: `frontend/src/components/transfer/`

**功能**:
- 支持批量选择文件
- 下载为 ZIP（client-side 或 server-side）
- 保持原目录结构

**库选择**: 
- Client-side: `jszip` + `file-saver`
- Server-side: 后端实现（复杂度更低）

**耗时**: 不在本任务范围内，标记为后续

---

### Task 7: 测试与集成（6h）

#### 单元测试
```bash
go test ./internal/transfer -v
go test ./internal/objects -v  # Multipart 相关
```

#### 集成测试
- [ ] 预签名 URL 可在浏览器中使用
- [ ] 拖拽上传完整流程
- [ ] 文件夹上传保持结构
- [ ] 上传进度正确显示
- [ ] 失败重试正常工作
- [ ] 断点续传功能

---

## 📦 代码提交清单

**Commit 1: 创建 transfer 包**
```
feat(transfer): create transfer service and types

- Create internal/transfer package structure
- Define TransferTask and related types
- Implement TransferService with basic operations
- Add unit tests

Closes #TODO
```

**Commit 2: MultipartUpload API**
```
feat(objects): implement multipart upload operations

- Add InitiateMultipartUpload, UploadPart, CompleteMultipartUpload
- Add AbortMultipartUpload for cleanup
- Support resumable uploads with part tracking
- Add comprehensive unit tests

Closes #TODO
```

**Commit 3: Presigned URL**
```
feat(objects): add presigned URL generation

- Implement GetPresignedURL for GET and PUT operations
- Support configurable expiration times
- Expose via app.go for frontend use
- Add unit tests

Closes #TODO
```

**Commit 4: Frontend - Presigned URL UI**
```
feat(ui/transfer): implement presigned URL dialog

- Create PresignedURLDialog component
- Support GET/PUT URL generation
- Add copy to clipboard functionality
- Integrate with ObjectBrowser

Closes #TODO
```

**Commit 5: Frontend - Upload UI**
```
feat(ui/transfer): implement drag-and-drop and folder upload

- Add drag-and-drop upload area
- Implement file selection upload
- Add folder upload with structure preservation
- Integrate with upload manager

Closes #TODO
```

**Commit 6: Frontend - Transfer Management**
```
feat(ui/transfer): implement transfer queue management

- Create transfersStore with Zustand
- Implement UploadProgress component
- Create transfers list page
- Add task pause/resume/cancel functionality

Closes #TODO
```

**Commit 7: Upload Resilience**
```
feat(transfer): add retry and resume capabilities

- Implement automatic retry with exponential backoff
- Add upload progress persistence (localStorage)
- Support resume from interrupted uploads
- Add error handling and notifications

Closes #TODO
```

---

## ✅ 完成标志（Definition of Done）

- [ ] 所有后端单元测试通过
- [ ] 所有前端 TypeScript 检查通过
- [ ] 预签名 URL 在浏览器中可正常使用
- [ ] 拖拽上传正常工作
- [ ] 上传队列管理正常
- [ ] 重试机制工作正常
- [ ] 提交的 PR 清晰有力

---

## 🔄 与其他分支的交互点

**完全独立 - 可并行开发** ✅
- Branch 1 (对象操作): 无冲突、无依赖（使用不同的 API）
- Branch 3 (存储桶配置): 无冲突、无依赖（完全独立功能）

**冲突点（最小）**:
- `app.go`: 新增不同的方法（通常无冲突）
- `frontend/src/components/objects/ObjectBrowser.tsx`: 拖拽上传部分可能轻微接触

---

**下一步**: 完成后，合并到 develop，准备 v1.0 release。
