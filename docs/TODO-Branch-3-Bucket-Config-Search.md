# Branch 3: 存储桶配置与搜索功能

**分支名**: `feat/bucket-config-and-search`  
**预估工期**: 2-2.5 周  
**优先级**: P3 (配置) + P4 (搜索)  
**并行开发**: ✅ 完全独立，无任何依赖  
**关键特性**: 存储桶高级配置 + 全局搜索

---

## 📋 任务概览

**目标**: 实现存储桶属性配置、访问控制、以及文件搜索与过滤功能。

**关键特性**:
- 存储桶版本控制、加密、生命周期配置
- 存储桶 ACL 与策略管理
- 前缀搜索与高级过滤
- 排序与结果导出

**新增包**: `internal/config`, `internal/search`（可选）

**文件修改范围**（相对独立，最少冲突）:
```
后端修改:
  ✏️ internal/config/service.go       (新建，存储桶配置管理)
  ✏️ internal/search/service.go       (新建，搜索逻辑)
  ✏️ internal/buckets/service.go      (扩展，支持配置查询)
  ✏️ app.go                           (新增 6+ 方法)

前端修改:
  ✏️ frontend/src/state/bucketConfig.ts  (新建)
  ✏️ frontend/src/routes/accounts/$accountId/buckets/$bucketId/settings.tsx (新建)
  ✏️ frontend/src/routes/accounts/$accountId/search.tsx (新建)
  ✏️ frontend/src/components/buckets/BucketSettings.tsx (新建)
  ✏️ frontend/src/components/search/SearchPanel.tsx (新建)
```

---

## 🎯 详细任务清单

### Task 1: 新建 config 和 search 包（6h）

#### 1.1 创建 config 包结构
**目录**: `internal/config/`

```
internal/config/
├── service.go              # BucketConfigService
├── types.go                # BucketConfig 等类型
├── versioning.go           # 版本控制相关
├── encryption.go           # 加密配置
├── lifecycle.go            # 生命周期规则
├── cors.go                 # CORS 配置
└── service_test.go         # 单元测试
```

**耗时**: 1h

---

#### 1.2 创建 search 包结构
**目录**: `internal/search/`

```
internal/search/
├── service.go              # SearchService
├── types.go                # SearchQuery, SearchResult
├── filter.go               # 过滤逻辑
└── service_test.go         # 单元测试
```

**耗时**: 1h

---

#### 1.3 定义配置相关类型
**文件**: `internal/config/types.go`

```go
package config

import "time"

// BucketVersioning 版本控制配置
type BucketVersioning struct {
    Status  string // "Enabled" | "Suspended" | "Disabled"
    Updated time.Time
}

// BucketEncryption 加密配置
type BucketEncryption struct {
    Enabled      bool
    Algorithm    string // "AES256" | "aws:kms"
    KmsKeyID     string // 如果使用 KMS
    Updated      time.Time
}

// LifecycleRule 生命周期规则
type LifecycleRule struct {
    ID                    string
    Prefix                string
    Status                string // "Enabled" | "Disabled"
    ExpirationDays        int    // 多少天后过期
    TransitionDays        int    // 多少天后转换为低频
    NoncurrentDays        int    // 非当前版本保留天数
}

// BucketCORS CORS 配置
type BucketCORS struct {
    Rules []CORSRule
}

type CORSRule struct {
    AllowedOrigins []string
    AllowedMethods []string // GET, PUT, POST, DELETE, HEAD
    AllowedHeaders []string
    ExposeHeaders  []string
    MaxAgeSeconds  int
}

// BucketWebsite 静态网站配置
type BucketWebsite struct {
    Enabled      bool
    IndexKey     string // index.html
    ErrorKey     string // error.html
}

// BucketPolicy 存储桶策略（JSON）
type BucketPolicy struct {
    Version   string
    Statement []PolicyStatement
}

type PolicyStatement struct {
    Effect    string
    Principal string
    Action    []string
    Resource  string
    Condition interface{}
}
```

**验收标准**:
- [ ] 类型定义完整覆盖常见配置
- [ ] 字段说明清晰

**耗时**: 2h

---

#### 1.4 定义搜索相关类型
**文件**: `internal/search/types.go`

```go
package search

import "time"

// SearchQuery 搜索查询参数
type SearchQuery struct {
    AccountID       string
    Bucket          string
    Prefix          string
    SearchText      string        // 搜索关键词
    SortBy          string        // "name" | "size" | "time" | "type"
    SortOrder       string        // "asc" | "desc"
    
    // 高级过滤
    MinSize         int64
    MaxSize         int64
    StartTime       *time.Time
    EndTime         *time.Time
    FileTypes       []string      // .pdf, .txt, .jpg 等
    Tags            map[string]string
    
    // 分页
    Limit           int           // 默认 100
    Offset          int           // 默认 0
}

// SearchResult 搜索结果
type SearchResult struct {
    Key             string
    Bucket          string
    Size            int64
    LastModified    time.Time
    ETag            string
    ContentType     string
    StorageClass    string
    Tags            map[string]string
    Score           float64       // 匹配度评分
}

// SearchResponse 搜索响应
type SearchResponse struct {
    Results        []*SearchResult
    Total          int64
    HasMore        bool
    NextOffset     int
}
```

**耗时**: 2h

---

### Task 2: 后端 - 存储桶配置管理（16h）

#### 2.1 实现 BucketConfigService - 版本控制
**文件**: `internal/config/versioning.go`

```go
// GetVersioning 获取版本控制状态
func (s *BucketConfigService) GetVersioning(
    ctx context.Context,
    accountID, bucket string,
) (*BucketVersioning, error)

// EnableVersioning 启用版本控制
func (s *BucketConfigService) EnableVersioning(
    ctx context.Context,
    accountID, bucket string,
) error

// SuspendVersioning 暂停版本控制（新上传不记录版本，但保留历史）
func (s *BucketConfigService) SuspendVersioning(
    ctx context.Context,
    accountID, bucket string,
) error
```

**验收标准**:
- [ ] 能获取当前版本控制状态
- [ ] 能启用/暂停版本控制
- [ ] 单元测试覆盖各状态

**耗时**: 3h

---

#### 2.2 实现 BucketConfigService - 加密
**文件**: `internal/config/encryption.go`

```go
// GetEncryption 获取加密配置
func (s *BucketConfigService) GetEncryption(
    ctx context.Context,
    accountID, bucket string,
) (*BucketEncryption, error)

// SetEncryption 设置加密
func (s *BucketConfigService) SetEncryption(
    ctx context.Context,
    accountID, bucket string,
    encryption *BucketEncryption,
) error

// DeleteEncryption 删除加密配置
func (s *BucketConfigService) DeleteEncryption(
    ctx context.Context,
    accountID, bucket string,
) error
```

**耗时**: 3h

---

#### 2.3 实现 BucketConfigService - 生命周期
**文件**: `internal/config/lifecycle.go`

```go
// GetLifecycle 获取生命周期规则
func (s *BucketConfigService) GetLifecycle(
    ctx context.Context,
    accountID, bucket string,
) ([]*LifecycleRule, error)

// PutLifecycle 添加/更新生命周期规则
func (s *BucketConfigService) PutLifecycle(
    ctx context.Context,
    accountID, bucket string,
    rules []*LifecycleRule,
) error

// DeleteLifecycle 删除所有生命周期规则
func (s *BucketConfigService) DeleteLifecycle(
    ctx context.Context,
    accountID, bucket string,
) error
```

**耗时**: 3h

---

#### 2.4 实现 BucketConfigService - CORS 和其他
**文件**: `internal/config/cors.go`

```go
// GetCORS 获取 CORS 配置
func (s *BucketConfigService) GetCORS(
    ctx context.Context,
    accountID, bucket string,
) (*BucketCORS, error)

// PutCORS 设置 CORS
func (s *BucketConfigService) PutCORS(
    ctx context.Context,
    accountID, bucket string,
    cors *BucketCORS,
) error

// DeleteCORS 删除 CORS 配置
func (s *BucketConfigService) DeleteCORS(
    ctx context.Context,
    accountID, bucket string,
) error

// 类似的还有 Website、Policy 等...
```

**耗时**: 4h

---

#### 2.5 在 app.go 暴露配置管理方法
**文件**: `app.go`

```go
// 版本控制
func (a *App) GetBucketVersioning(accountID, bucket string) (*config.BucketVersioning, error)
func (a *App) EnableBucketVersioning(accountID, bucket string) error
func (a *App) SuspendBucketVersioning(accountID, bucket string) error

// 加密
func (a *App) GetBucketEncryption(accountID, bucket string) (*config.BucketEncryption, error)
func (a *App) SetBucketEncryption(accountID, bucket string, encryption *config.BucketEncryption) error

// 生命周期
func (a *App) GetBucketLifecycle(accountID, bucket string) ([]*config.LifecycleRule, error)
func (a *App) SetBucketLifecycle(accountID, bucket string, rules []*config.LifecycleRule) error

// CORS
func (a *App) GetBucketCORS(accountID, bucket string) (*config.BucketCORS, error)
func (a *App) SetBucketCORS(accountID, bucket string, cors *config.BucketCORS) error
```

**耗时**: 2h

---

### Task 3: 后端 - 搜索与过滤（8h）

#### 3.1 实现 SearchService - 前缀搜索
**文件**: `internal/search/service.go`

```go
// SearchObjects 搜索对象
func (s *SearchService) SearchObjects(
    ctx context.Context,
    query *SearchQuery,
) (*SearchResponse, error) {
    // 1. 获取账户凭证和 S3 client
    // 2. 如果只需前缀搜索：调用 ListObjects 并过滤
    // 3. 对结果排序
    // 4. 分页返回
}
```

**实现思路**:
- 前缀搜索由 S3 ListObjects 直接支持（prefix 参数）
- 关键词搜索：列出所有对象，在内存中过滤（简单实现）
- 高级过滤：按大小、时间、标签等过滤

**验收标准**:
- [ ] 前缀搜索工作正常
- [ ] 排序正确
- [ ] 分页正确
- [ ] 单元测试覆盖各搜索类型

**耗时**: 4h

---

#### 3.2 实现高级过滤
**文件**: `internal/search/filter.go`

```go
// ApplyFilters 应用过滤条件
func ApplyFilters(
    objects []ObjectInfo,
    query *SearchQuery,
) []ObjectInfo {
    // 1. 按大小过滤
    // 2. 按时间过滤
    // 3. 按文件类型过滤
    // 4. 按标签过滤
    // 5. 按关键词过滤（模糊匹配文件名）
}
```

**耗时**: 2h

---

#### 3.3 在 app.go 暴露搜索方法
**文件**: `app.go`

```go
func (a *App) SearchObjects(
    accountID string, 
    query *search.SearchQuery,
) (*search.SearchResponse, error)

func (a *App) ExportSearchResults(
    accountID string,
    query *search.SearchQuery,
    format string, // "csv" | "json"
) ([]byte, error)
```

**耗时**: 1h

---

### Task 4: 前端 - 存储桶设置页面（12h）

#### 4.1 创建路由与布局
**文件**: `frontend/src/routes/accounts/$accountId/buckets/$bucketId/settings.tsx`

**结构**:
```
BucketSettings (页面)
  ├── SettingsNavTabs (左侧导航)
  │   ├── 版本控制
  │   ├── 加密
  │   ├── 生命周期
  │   ├── CORS
  │   ├── 静态网站
  │   └── 访问控制
  └── SettingsContent (右侧内容)
      ├── VersioningPanel
      ├── EncryptionPanel
      ├── LifecyclePanel
      └── ...
```

**耗时**: 2h

---

#### 4.2 实现版本控制面板
**文件**: `frontend/src/components/buckets/VersioningPanel.tsx`

**功能**:
- 显示当前版本控制状态
- 单选框选择：Enabled / Suspended / Disabled
- 保存按钮
- 说明文本

**实现**:
- 使用 `bucketConfigStore` 获取和更新状态
- 调用 `GetBucketVersioning` / `EnableBucketVersioning` / `SuspendBucketVersioning`

**验收标准**:
- [ ] 能显示当前状态
- [ ] 能切换状态
- [ ] 显示成功/失败提示
- [ ] 禁用相应状态转换

**耗时**: 3h

---

#### 4.3 实现加密配置面板
**文件**: `frontend/src/components/buckets/EncryptionPanel.tsx`

**功能**:
- 切换加密开关
- 选择加密算法（AES256 / KMS）
- 如果选择 KMS，填写 Key ID
- 保存按钮

**耗时**: 3h

---

#### 4.4 实现生命周期规则面板
**文件**: `frontend/src/components/buckets/LifecyclePanel.tsx`

**功能**:
- 显示现有规则列表
- "添加规则"按钮
- 规则编辑表单：
  - ID / Prefix / Status
  - 过期天数 / 转换天数 / 非当前版本天数
- 保存和删除规则

**耗时**: 3h

---

#### 4.5 实现 CORS / 静态网站等面板
**文件**: `frontend/src/components/buckets/CORSPanel.tsx` 等

**功能类似**:
- 表单编辑
- 列表显示
- 添加/删除/修改

**耗时**: 3h

---

### Task 5: 前端 - 搜索与过滤页面（12h）

#### 5.1 创建搜索路由和状态
**文件**: `frontend/src/routes/accounts/$accountId/search.tsx`

**路由结构**:
```
/accounts/{accountId}/search
  - 搜索表单（前缀、关键词、过滤条件）
  - 搜索结果列表
  - 结果导出选项
```

**耗时**: 2h

---

#### 5.2 创建搜索 store
**文件**: `frontend/src/state/search.ts`

```typescript
type SearchState = {
  query: SearchQuery
  results: SearchResult[]
  loading: boolean
  error?: string
  total: number
  hasMore: boolean
  
  // Actions
  setQuery: (query: Partial<SearchQuery>) => void
  search: (query: SearchQuery) => Promise<void>
  loadMore: () => Promise<void>
  exportResults: (format: "csv" | "json") => Promise<void>
  clear: () => void
}
```

**耗时**: 2h

---

#### 5.3 实现搜索表单
**文件**: `frontend/src/components/search/SearchForm.tsx`

**字段**:
- 搜索范围：单桶 / 全局
- 存储桶选择（如果全局）
- 前缀输入
- 关键词输入
- 高级过滤：
  - 文件大小范围（slider）
  - 修改时间范围（date picker）
  - 文件类型（checkbox）
- 排序选项

**验收标准**:
- [ ] 表单字段完整
- [ ] 验证逻辑正确
- [ ] 提交搜索正常

**耗时**: 4h

---

#### 5.4 实现搜索结果显示
**文件**: `frontend/src/components/search/SearchResults.tsx`

**显示**:
- 结果表格：文件名、大小、修改时间、存储类型、操作
- 分页或虚拟滚动
- 多选和批量操作
- "导出结果"按钮

**耗时**: 4h

---

#### 5.5 实现结果导出
**文件**: `frontend/src/components/search/ExportDialog.tsx`

**功能**:
- 选择格式：CSV / JSON
- 选择导出字段
- 下载按钮

**CSV 格式**:
```
文件名,大小,修改时间,存储桶,类型
file.txt,1024,2025-12-05,my-bucket,text
```

**耗时**: 2h

---

### Task 6: 前端 - 状态管理与集成（6h）

#### 6.1 创建 bucketConfig store
**文件**: `frontend/src/state/bucketConfig.ts`

```typescript
type BucketConfigState = {
  currentBucket?: string
  versioning?: BucketVersioning
  encryption?: BucketEncryption
  lifecycle?: LifecycleRule[]
  cors?: BucketCORS
  website?: BucketWebsite
  loading: boolean
  error?: string
  
  // Actions
  loadConfig: (accountID: string, bucket: string) => Promise<void>
  saveVersioning: (config: BucketVersioning) => Promise<void>
  saveEncryption: (config: BucketEncryption) => Promise<void>
  // ... 等等
}
```

**耗时**: 3h

---

#### 6.2 在 BucketBrowser 中添加"设置"链接
**文件**: `frontend/src/components/buckets/BucketBrowser.tsx`

- 在存储桶列表或详情中添加"设置"按钮
- 点击导航到 `/accounts/{accountId}/buckets/{bucketId}/settings`

**耗时**: 1h

---

#### 6.3 在 ObjectBrowser 中集成搜索功能
**文件**: `frontend/src/components/objects/ObjectBrowser.tsx`

- 在工具栏添加"搜索"按钮
- 打开搜索面板或导航到搜索页面
- 搜索结果中的对象可直接下载/删除

**耗时**: 2h

---

### Task 7: 测试与集成（6h）

#### 单元测试
```bash
go test ./internal/config -v
go test ./internal/search -v
go test ./internal/buckets -v  # 扩展部分
```

#### 集成测试
- [ ] 版本控制启用/暂停/禁用正常
- [ ] 加密配置保存和读取正常
- [ ] 生命周期规则正常工作
- [ ] 搜索功能返回正确结果
- [ ] 过滤条件工作正常
- [ ] 排序正确
- [ ] 导出功能生成正确文件

#### 前端测试
- [ ] 设置页面导航正常
- [ ] 表单验证正常
- [ ] 保存成功/失败提示清晰
- [ ] 搜索表单输入正常
- [ ] 搜索结果显示正确
- [ ] 导出功能工作正常

---

## 📦 代码提交清单

**Commit 1: Config 包创建**
```
feat(config): create bucket configuration service

- Create internal/config package with versioning, encryption, lifecycle support
- Define BucketConfig and related types
- Implement BucketConfigService with read/write operations
- Add unit tests

Closes #TODO
```

**Commit 2: Search 包创建**
```
feat(search): create object search service

- Create internal/search package
- Define SearchQuery and SearchResult types
- Implement SearchService with prefix and advanced filtering
- Add unit tests

Closes #TODO
```

**Commit 3: Backend - Configuration APIs**
```
feat(buckets): add configuration management APIs

- Implement versioning, encryption, lifecycle, CORS, website APIs
- Expose all methods in app.go
- Add comprehensive error handling
- Add unit and integration tests

Closes #TODO
```

**Commit 4: Backend - Search API**
```
feat(objects): add search and export API

- Implement object search with filtering and sorting
- Support result export (CSV, JSON)
- Add pagination support
- Add unit tests

Closes #TODO
```

**Commit 5: Frontend - Bucket Settings**
```
feat(ui/buckets): implement bucket settings pages

- Create BucketSettings page with tabs
- Implement version control, encryption, lifecycle, CORS panels
- Add form validation and save functionality
- Add success/error notifications

Closes #TODO
```

**Commit 6: Frontend - Search**
```
feat(ui/objects): implement search and filtering

- Create search page with advanced filters
- Implement SearchForm and SearchResults components
- Add result export functionality
- Integrate search into ObjectBrowser

Closes #TODO
```

**Commit 7: Frontend - State & Integration**
```
feat(state): add bucket config and search stores

- Create bucketConfig and search Zustand stores
- Integrate stores with components
- Add proper state management and sync

Closes #TODO
```

---

## ✅ 完成标志（Definition of Done）

- [ ] 所有后端单元测试通过（`go test ./...`）
- [ ] 所有前端 TypeScript 检查通过
- [ ] 存储桶配置页面功能完整
- [ ] 搜索功能返回正确结果
- [ ] 导出功能生成有效文件
- [ ] 前端手动测试通过所有场景
- [ ] 提交的 PR 清晰有力

---

## 🔄 与其他分支的交互点

**完全独立 - 安全并行** ✅
- Branch 1 (对象操作): 完全独立，无依赖
- Branch 2 (文件传输): 完全独立，无依赖

**冲突最少 - 原因**:
- 新建独立的包 (`internal/config`, `internal/search`)
- 新建独立的前端路由和 store
- `app.go` 仅新增不同的方法（无冲突）
- 前端组件均新建（无覆盖或修改现有）

---

## 📊 UI 布局参考

### 存储桶设置页面
```
BucketSettings
├── 面包屑: 账户 > 存储桶 > 设置
├── 左侧导航栏 (sticky)
│   ├── 版本控制
│   ├── 加密
│   ├── 生命周期
│   ├── CORS
│   ├── 静态网站
│   ├── 访问控制
│   └── 删除存储桶 (danger)
└── 右侧内容区
    └── [对应的配置面板]
        ├── 标题
        ├── 说明文本
        ├── 表单/配置UI
        └── 保存按钮
```

### 搜索页面
```
SearchPage
├── 面包屑: 账户 > 搜索
├── SearchForm (粘性顶部)
│   ├── 搜索范围选择
│   ├── 前缀 / 关键词输入
│   ├── 高级过滤 (collapsible)
│   │   ├── 文件大小范围
│   │   ├── 修改时间范围
│   │   ├── 文件类型
│   │   └── 标签
│   ├── 排序选项
│   └── 搜索按钮
└── SearchResults
    ├── 结果表格（或列表）
    ├── 多选复选框
    ├── 操作栏（下载、删除、复制链接）
    ├── 分页/加载更多
    ├── 导出按钮
    └── 清空搜索
```

---

**下一步**: 三个分支同时启动，预计 2.5-3 周内全部完成后合并。

**可选优化**（后续迭代）:
- 搜索结果缓存（前 100 条）
- 存储最近搜索历史
- 保存搜索预设
- 按标签聚类结果
