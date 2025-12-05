# Branch 1: 对象操作核心增强

**分支名**: `feat/object-operations-core`  
**预估工期**: 1-1.5 周  
**优先级**: P0  
**并行开发**: ✅ 可与 Branch 2 和 3 同时进行（完全独立）

---

## 📋 任务概览

**目标**: 完善对象基础操作 API 和 UI 交互，支持重命名、虚拟目录、移动、批量删除等核心功能。

**关键特性**:
- 文件重命名 / 虚拟目录创建 / 文件移动
- ObjectBrowser 完整交互
- BucketBrowser 排序与搜索

**文件修改范围**（最小化其他分支冲突）:
```
后端修改:
  ✏️ internal/objects/service.go         (新增 3 个方法)
  ✏️ internal/buckets/service.go         (补充排序逻辑)
  ✏️ app.go                              (新增 3 个暴露方法)

前端修改:
  ✏️ frontend/src/components/objects/ObjectBrowser.tsx
  ✏️ frontend/src/components/buckets/BucketBrowser.tsx
  ✏️ frontend/src/state/objects.ts       (扩展 store)
  ✏️ frontend/src/state/buckets.ts       (扩展 store)
```

---

## 🎯 详细任务清单

### Task 1: 后端 API - 对象操作（8h）

#### 1.1 实现 RenameObject 方法
**文件**: `internal/objects/service.go`

```go
// RenameObject renames an object by copying and deleting
func (s *Service) RenameObject(
    ctx context.Context, 
    accountID, bucket, oldKey, newKey string,
) error {
    // 1. 验证新 key 不存在
    // 2. 调用 CopyObject(oldKey -> newKey)
    // 3. 调用 DeleteObject(oldKey)
    // 4. 错误处理（复制失败时不删除）
}
```

**验收标准**:
- [ ] 能成功重命名文件
- [ ] 重命名失败时保留原文件
- [ ] 新 key 已存在时返回错误
- [ ] 单元测试覆盖 3+ 场景

**耗时**: 3h

---

#### 1.2 实现 CreateDirectory 方法
**文件**: `internal/objects/service.go`

```go
// CreateDirectory creates a virtual directory by uploading an empty object with trailing slash
func (s *Service) CreateDirectory(
    ctx context.Context, 
    accountID, bucket, prefix string,
) error {
    // 1. 规范化 prefix（确保 / 结尾）
    // 2. 调用 PutObject(prefix, empty content)
    // 3. 返回结果
}
```

**验收标准**:
- [ ] 能创建虚拟目录
- [ ] 目录在列表中出现为文件夹图标
- [ ] 不同前缀能创建嵌套目录
- [ ] 单元测试覆盖 2+ 场景

**耗时**: 2h

---

#### 1.3 实现 MoveObject 方法
**文件**: `internal/objects/service.go`

```go
// MoveObject moves an object to a new location (same or different bucket)
func (s *Service) MoveObject(
    ctx context.Context, 
    accountID, sourceBucket, sourceKey, targetBucket, targetKey string,
) error {
    // 1. 验证源对象存在
    // 2. 调用 CopyObject(sourceBucket/sourceKey -> targetBucket/targetKey)
    // 3. 调用 DeleteObject(sourceBucket/sourceKey)
    // 4. 错误处理
}
```

**验收标准**:
- [ ] 支持同桶移动
- [ ] 支持跨桶移动
- [ ] 移动失败时保留原对象
- [ ] 单元测试覆盖 3+ 场景

**耗时**: 3h

---

#### 1.4 在 app.go 暴露三个方法
**文件**: `app.go`

```go
func (a *App) RenameObject(accountID, bucket, oldKey, newKey string) error
func (a *App) CreateDirectory(accountID, bucket, prefix string) error
func (a *App) MoveObject(accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error
```

**验收标准**:
- [ ] 方法在 Wails 中正确绑定
- [ ] 前端能通过 bridge 调用
- [ ] 错误消息用户友好

**耗时**: 2h

---

### Task 2: 后端 - 存储桶排序与搜索（4h）

#### 2.1 增强 ListBuckets 排序逻辑
**文件**: `internal/buckets/service.go`

在 `ListBuckets` 返回前添加排序选项：

```go
type ListBucketsInput struct {
    SortBy    string // "name" | "created" | "size"
    SortOrder string // "asc" | "desc"
    Prefix    string // 搜索前缀
}

func (s *Service) ListBucketsWithFilter(
    ctx context.Context,
    accountID string,
    input ListBucketsInput,
) ([]BucketInfo, error)
```

**验收标准**:
- [ ] 支持按名称排序
- [ ] 支持按创建时间排序
- [ ] 支持前缀过滤（搜索）
- [ ] 单元测试覆盖排序和过滤

**耗时**: 4h

---

### Task 3: 前端 - ObjectBrowser 核心交互（16h）

#### 3.1 文件重命名功能
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

**需求**:
- 右键菜单 / 或操作栏中添加"重命名"按钮
- 点击后出现输入框
- 调用 `objectsStore.renameObject()`
- 成功后刷新列表

**实现步骤**:
1. 在 ObjectBrowser 中添加 rename 状态
2. 创建 rename 输入框 UI（modal 或 inline）
3. 调用 bridge 的 `RenameObject`
4. 处理错误和成功

**验收标准**:
- [ ] 能打开重命名对话框
- [ ] 输入新名称后提交
- [ ] 重命名成功后刷新列表
- [ ] 错误提示清晰

**耗时**: 4h

---

#### 3.2 虚拟目录创建
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

**需求**:
- 工具栏添加"新建文件夹"按钮
- 点击后出现输入框
- 输入文件夹名称（自动添加 `/` 后缀）
- 调用 `objectsStore.createDirectory()`

**实现步骤**:
1. 添加"新建文件夹"操作
2. 创建输入框 UI
3. 调用 bridge 的 `CreateDirectory`
4. 成功后自动进入该目录或刷新

**验收标准**:
- [ ] 能打开目录创建对话框
- [ ] 输入名称后创建文件夹
- [ ] 新文件夹显示为目录图标
- [ ] 能进入新文件夹

**耗时**: 4h

---

#### 3.3 文件移动功能
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

**需求**:
- 对象右键菜单添加"移动到..."选项
- 弹出对话框选择目标存储桶和目录
- 调用 `objectsStore.moveObject()`

**实现步骤**:
1. 创建"选择目标位置"对话框
2. 显示存储桶列表和目录树
3. 调用 bridge 的 `MoveObject`
4. 成功后刷新原存储桶和目标存储桶

**验收标准**:
- [ ] 能打开移动对话框
- [ ] 能选择目标存储桶
- [ ] 能选择目标目录
- [ ] 移动成功后刷新

**耗时**: 5h

---

#### 3.4 批量删除优化
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

当前的批量删除逻辑需要优化：
- 已实现基本删除，现在需要：
  - 添加选中状态管理
  - 显示"已选 X 个对象"
  - 批量删除前的确认对话框
  - 删除进度提示

**验收标准**:
- [ ] 支持多选对象
- [ ] 显示选中数量
- [ ] 删除前显示确认
- [ ] 删除时显示进度

**耗时**: 3h

---

### Task 4: 前端 - BucketBrowser 增强（10h）

#### 4.1 存储桶排序与搜索
**文件**: `frontend/src/components/buckets/BucketBrowser.tsx`

**需求**:
- 工具栏添加排序按钮（名称 / 创建时间）
- 工具栏添加搜索框（前缀搜索）
- 调用 backend 的 `ListBucketsWithFilter`

**实现步骤**:
1. 添加排序和搜索 UI（下拉菜单 + 输入框）
2. 修改 `bucketsStore.loadBuckets()` 接收参数
3. 后端 API 调用时传递 sortBy、sortOrder、prefix

**验收标准**:
- [ ] 能按名称排序
- [ ] 能按创建时间排序
- [ ] 能前缀搜索
- [ ] 搜索结果实时更新

**耗时**: 6h

---

#### 4.2 存储桶名称验证
**文件**: `frontend/src/components/buckets/BucketBrowser.tsx`

在"创建存储桶"表单中添加实时验证：

```typescript
// S3 桶名称规则
const validateBucketName = (name: string): string | null => {
  // - 3-63 字符
  // - 仅小写字母、数字、-
  // - 以字母或数字开头和结尾
  // - 不能是 IP 地址格式
}
```

**验收标准**:
- [ ] 输入时实时显示验证信息
- [ ] 违规时禁用创建按钮
- [ ] 提示清晰说明规则

**耗时**: 2h

---

#### 4.3 创建/删除操作优化
**文件**: `frontend/src/components/buckets/BucketBrowser.tsx`

- 创建成功后自动刷新列表
- 删除前检查存储桶是否为空（调用 `ListObjects` 检查）
- 为空时允许删除；不为空时提示用户先清空

**验收标准**:
- [ ] 创建后自动出现在列表中
- [ ] 删除前检查是否为空
- [ ] 不为空时显示清晰错误提示

**耗时**: 2h

---

### Task 5: 前端 State 扩展（4h）

#### 5.1 扩展 objects store
**文件**: `frontend/src/state/objects.ts`

添加新的 action：

```typescript
// actions
renameObject: (bucket: string, oldKey: string, newKey: string) => Promise<void>
createDirectory: (bucket: string, prefix: string) => Promise<void>
moveObject: (
  sourceBucket: string,
  sourceKey: string,
  targetBucket: string,
  targetKey: string
) => Promise<void>
```

**耗时**: 2h

---

#### 5.2 扩展 buckets store
**文件**: `frontend/src/state/buckets.ts`

添加排序和搜索状态：

```typescript
type BucketsState = {
  // ... 现有
  sortBy: "name" | "created"
  sortOrder: "asc" | "desc"
  searchPrefix: string
}

// actions
setSortBy: (sortBy: string) => void
setSortOrder: (order: string) => void
setSearchPrefix: (prefix: string) => void
loadBucketsWithFilter: (accountID: string, input) => Promise<void>
```

**耗时**: 2h

---

## 🧪 测试计划（4h）

### 后端单元测试
- [ ] `objects.RenameObject` - 3+ 场景
- [ ] `objects.CreateDirectory` - 2+ 场景
- [ ] `objects.MoveObject` - 3+ 场景
- [ ] `buckets.ListBucketsWithFilter` - 排序 + 搜索

```bash
go test ./internal/objects -v
go test ./internal/buckets -v
```

### 前端手动测试
- [ ] ObjectBrowser 重命名功能
- [ ] ObjectBrowser 创建目录功能
- [ ] ObjectBrowser 移动对象功能
- [ ] BucketBrowser 排序功能
- [ ] BucketBrowser 搜索功能

```bash
pnpm --dir frontend dev
# 手动测试各个功能
```

---

## 📦 代码提交清单

**Commit 消息示例**:

```
feat(objects): implement rename, mkdir, move operations

- Add RenameObject method with copy+delete strategy
- Add CreateDirectory method for virtual directories
- Add MoveObject method supporting same/cross-bucket moves
- Add comprehensive unit tests for all operations
- Expose methods in App struct

Closes #TODO
```

```
feat(buckets): support listing with sorting and filtering

- Add ListBucketsWithFilter to support name, created time sorting
- Add prefix filtering for bucket search
- Implement in service and expose via app.go
- Add unit tests

Closes #TODO
```

```
feat(ui/objects): enhance object browser interactions

- Add rename, mkdir, move operations to ObjectBrowser
- Improve batch delete with multi-select and confirmation
- Add proper error handling and user feedback
- Optimize loading states

Closes #TODO
```

```
feat(ui/buckets): enhance bucket browser with sorting and search

- Add bucket name sorting (by name, created time)
- Add bucket prefix search functionality
- Add bucket name validation (S3 naming rules)
- Optimize create/delete operations

Closes #TODO
```

---

## 🔄 与其他分支的交互点

**完全独立 - 安全并行** ✅
- Branch 2 (文件传输): 完全独立的包和 API，无冲突
- Branch 3 (存储桶配置): 完全独立的包和 API，无冲突

**冲突最少**:
- `app.go`: 仅新增不同的方法
- `internal/`: 各自新增独立的包和文件
- `frontend/src/`: 各自修改独立的组件

---

## ✅ 完成标志（Definition of Done）

- [ ] 所有后端单元测试通过（`go test ./...`）
- [ ] 所有代码通过 `gofmt`, `goimports`, `go vet`
- [ ] 前端代码无 TypeScript 错误
- [ ] 前端手动测试通过所有场景
- [ ] 提交的 PR 包含清晰的 commit 消息
- [ ] 代码审查通过

---

## 📝 Note

本分支可与其他分支完全并行开发，无任何阻塞关系。
各分支独立实现，最后合并时冲突最少。

**推荐**: 三个分支同时启动，预计 2.5-3 周内全部完成。
