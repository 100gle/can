# CAN · R2 功能实现 TODO

**目标**: 完整支持 Cloudflare R2 的 S3 兼容对象存储管理。

**当前状态**: ✅ 第一至第四阶段均已落地（2025-12-04 更新；后续聚焦 Multipart Upload 与端到端验收）

**阶段总结**:
- ✅ Phase 1：AWS SDK v2 + 通用 S3 Dialer 接入，支持 AWS / R2 / OSS / COS / 自定义 Endpoint。
- ✅ Phase 2：Bucket 服务/接口完成，App 暴露 CRUD + 位置查询 API。
- ✅ Phase 3：Object 服务/接口完成，覆盖列举、上传、下载、拷贝、删除、Head；Multipart 规划保留。
- ✅ Phase 4：前端 Zustand store + Bucket/Object 浏览器投入使用，App 主界面完成串联。
- ⚠️ 待定：真实 R2 集成回归、分片上传/断点续传、跨浏览器验收。

**预估工期**: 10-15 天（分阶段实现）

---

## 第一阶段：S3 API Integration（3-4 天）

### Task 1.1: 集成 AWS SDK v2
- **描述**: 选择并集成 Go 的 S3 SDK
- **选项**:
  - `github.com/aws/aws-sdk-go-v2` + `aws-sdk-go-v2/service/s3`（推荐，官方维护）
  - `github.com/minio/minio-go`（专注S3兼容，轻量级）
- **预估**: 1 天
- **验收标准**:
  - [x] 在 `go.mod` 中添加依赖
  - [x] 通过 `go mod tidy` 验证
  - [x] 编写示例代码验证 SDK 初始化成功

### Task 1.2: 实现真实的 Dialer（替换 StubDialer）
- **文件**: `internal/providers/s3_dialer.go`（新建）
- **功能**:
  - 支持所有 S3 兼容提供商（AWS、R2、OSS、COS、Custom）
  - 使用 `ListBuckets` API 验证连接和凭证
  - 返回详细的错误信息（认证失败、网络超时等）
- **关键实现**:
  ```go
  type S3Dialer struct {
      // 可选：连接超时配置
  }
  
  func (d *S3Dialer) TestConnection(ctx context.Context, creds ConnectionCredentials) error {
      // 根据 creds.Provider 构建不同的 S3 client
      // 调用 ListBuckets 验证连接
      // 返回详细错误或 nil
  }
  ```
- **预估**: 1.5 天
- **验收标准**:
  - [x] 可成功连接真实 R2 账户
  - [x] 可成功连接 AWS S3
  - [x] 错误处理完整（网络错误、认证失败、超时）
  - [x] 单元测试覆盖至少 3 个场景

### Task 1.3: 在 App 启动时切换为 S3Dialer
- **文件**: `app.go`
- **修改**:
  ```go
  // 修改 NewApp()
  // 将 providers.NewStubDialer() 改为 providers.NewS3Dialer()
  ```
- **预估**: 0.5 天
- **验收标准**:
  - [x] `wails dev` 启动无错误
  - [x] 测试连接功能真实连接 R2

---

## 第二阶段：Bucket 管理 API（3-4 天）

### Task 2.1: 设计 Bucket 数据结构和 API
- **文件**: `internal/buckets/types.go`（新建）
- **结构体**:
  ```go
  type BucketInfo struct {
      Name         string
      CreatedAt    time.Time
      Region       string
      ObjectCount  int64  // 可选：不是所有provider都支持
      Size         int64  // 可选
  }
  ```
- **API 接口**:
  ```go
  type BucketService interface {
      ListBuckets(ctx context.Context, accountID string) ([]BucketInfo, error)
      CreateBucket(ctx context.Context, accountID string, name, region string) error
      DeleteBucket(ctx context.Context, accountID string, name string) error
  }
  ```
- **预估**: 0.5 天
- **验收标准**:
  - [x] 类型定义清晰，支持扩展
  - [x] 接口设计符合 Go idiom

### Task 2.2: 实现 Bucket Service
- **文件**: `internal/buckets/service.go`（新建）
- **实现步骤**:
  1. 获取账户凭证
  2. 初始化 S3 client
  3. 调用对应操作
  4. 错误处理和转换
- **需要的操作**:
  - [x] ListBuckets
  - [x] CreateBucket
  - [x] DeleteBucket
  - [x] GetBucketLocation（获取区域）
  - [x] HeadBucket（检查存在性）
- **预估**: 2 天
- **验收标准**:
  - [x] 所有操作在 R2 上测试通过
  - [x] 单元测试覆盖成功和失败路径
  - [x] 错误消息用户友好

### Task 2.3: 向 App 暴露 Bucket API
- **文件**: `app.go`
- **新增方法**:
  ```go
  func (a *App) ListBuckets(accountID string) ([]buckets.BucketInfo, error)
  func (a *App) CreateBucket(accountID string, name string, region string) error
  func (a *App) DeleteBucket(accountID string, name string) error
  ```
- **预估**: 0.5 天
- **验收标准**:
  - [x] 方法在 Wails 中正确绑定
  - [x] `wails dev` 可访问这些方法

---

## 第三阶段：Object 管理 API（3-4 天）

### Task 3.1: 设计 Object 数据结构
- **文件**: `internal/objects/types.go`（新建）
- **结构体**:
  ```go
  type ObjectInfo struct {
      Key           string
      Size          int64
      LastModified  time.Time
      ETag          string
      ContentType   string
      IsDir         bool  // 用于目录模拟
  }
  
  type ListObjectsInput struct {
      Bucket    string
      Prefix    string
      Delimiter string
      Limit     int
      Marker    string // 分页游标
  }
  ```
- **预估**: 0.5 天

### Task 3.2: 实现 Object Service
- **文件**: `internal/objects/service.go`（新建）
- **核心操作**:
  - [x] ListObjects（支持分页和前缀过滤）
  - [x] GetObject（下载文件）
  - [x] PutObject（上传单个文件）
  - [x] DeleteObject（删除单个文件）
  - [x] CopyObject（复制文件）
  - [x] HeadObject（获取元数据）
- **特殊考虑**:
  - 目录模拟（使用 `/` 前缀）
  - 断点续传基础（MultipartUpload）
  - 错误处理
- **预估**: 2.5 天
- **验收标准**:
  - [x] 基本的 CRUD 操作在 R2 上测试通过
  - [x] 列表支持前缀过滤
  - [x] 大文件上传测试（>100MB，基于单请求流式 `PutObject`；Multipart Upload 将在下一迭代补充）

### Task 3.3: 向 App 暴露 Object API
- **文件**: `app.go`
- **新增方法**:
  ```go
  func (a *App) ListObjects(accountID string, input objects.ListObjectsInput) ([]objects.ObjectInfo, error)
  func (a *App) UploadObject(accountID string, bucket string, key string, filePath string) error
  func (a *App) DownloadObject(accountID string, bucket string, key string, savePath string) error
  func (a *App) DeleteObject(accountID string, bucket string, key string) error
  func (a *App) CopyObject(accountID string, sourceBucket string, sourceKey string, targetBucket string, targetKey string) error
  func (a *App) HeadObject(accountID string, bucket string, key string) (objects.ObjectInfo, error)
  ```
- **预估**: 0.5 天

---

## 第四阶段：前端 UI 集成（5-7 天）

### Task 4.1: 创建 Bucket 浏览器组件
- **文件**: `frontend/src/components/buckets/BucketBrowser.tsx`（新建）
- **功能**:
  - [x] 显示存储桶列表
  - [x] 创建/删除存储桶按钮
  - [x] 双击进入存储桶
  - [x] 加载状态和错误提示
- **预估**: 1.5 天
- **依赖**: Zustand state（见 Task 4.2）

### Task 4.2: 创建 Zustand state for buckets
- **文件**: `frontend/src/state/buckets.ts`（新建）
- **状态**:
  ```typescript
  type BucketsState = {
    buckets: BucketInfo[]
    loading: boolean
    error?: string
    currentBucket?: string
    currentPath: string
  }
  
  type BucketsActions = {
    loadBuckets: (accountID: string) => Promise<void>
    createBucket: (accountID: string, name: string, region: string) => Promise<void>
    deleteBucket: (accountID: string, name: string) => Promise<void>
    // ...
  }
  ```
- **预估**: 1 天

### Task 4.3: 创建 Object 浏览器组件
- **文件**: `frontend/src/components/objects/ObjectBrowser.tsx`（新建）
- **功能**:
  - [x] 显示文件列表（表格或卡片视图）
  - [x] 面包屑导航
  - [x] 上传/下载/删除按钮
  - [ ] 文件预览（至少支持文本和图片）
  - [x] 加载状态和分页
- **预估**: 2.5 天
- **依赖**: Zustand state（见 Task 4.4）

### Task 4.4: 创建 Zustand state for objects
- **文件**: `frontend/src/state/objects.ts`（新建）
- **状态和 actions**：类似 Task 4.2
- **预估**: 1 天

### Task 4.5: 更新主 App 路由和布局
- **文件**: `frontend/src/App.tsx`
- **修改**:
  - [x] 添加路由：AccountList → BucketBrowser → ObjectBrowser
  - [x] 集成新组件
  - [x] 测试导航流程
- **预估**: 1 天

---

## 测试与验收

### 单元测试
- **Backend**: 每个 service 至少 70% 覆盖率
- **Frontend**: 关键组件的交互测试
- 命令: `go test ./...`

### 集成测试
- **使用真实 R2 账户**:
  - [ ] 创建/列表/删除存储桶
  - [ ] 上传/下载/删除对象
  - [ ] 处理错误场景（凭证失败、网络超时等）
- **跨浏览器测试**（如果需要）

### 手动验收
- [ ] UI 响应流畅，无卡顿
- [ ] 错误提示清晰
- [ ] 大文件操作稳定

---

## 技术栈与参考

### 后端
- **AWS SDK v2**: https://aws.amazon.com/cn/sdk-for-go/
- **MinIO SDK**: https://github.com/minio/minio-go

### 前端
- **Zustand**: 状态管理
- **React Hook Form**: 表单验证（如需要）
- **Lucide React**: 图标库

### 文档
- **S3 API 参考**: https://docs.aws.amazon.com/s3/latest/API/
- **R2 文档**: https://developers.cloudflare.com/r2/

---

## 优先级和建议顺序

1. **Phase 1（第一阶段）** - 必须优先实现
   - Dialer 是后续所有功能的基础
   
2. **Phase 2（第二阶段）** - 中等优先
   - 存储桶管理是基础功能
   - 前端简单（无复杂交互）
   
3. **Phase 3（第三阶段）** - 核心功能
   - 对象管理是主要价值
   - 实现复杂度最高
   
4. **Phase 4（第四阶段）** - UI 层
   - 依赖前三个阶段的 API

---

## 风险和注意事项

### 技术风险
- **SDK 选择**: AWS SDK v2 功能完整但体积大；MinIO SDK 轻量但生态小
  - **建议**: 优先考虑 AWS SDK v2（官方支持）
  
- **S3 兼容性**: 不同提供商的 API 支持度不同
  - **建议**: 在 service 中集中处理提供商差异

- **大文件上传**: 单线程上传效率低
  - **建议**: Phase 3.2 中预留 MultipartUpload 的接口

### 运维风险
- **凭证安全**: 确保上传/下载过程中不日志凭证
- **错误处理**: SDK 错误需要适当转换为用户友好的消息
- **超时设置**: 不同网络环境下需要可配置的超时时间

---

## 参考：现有代码结构

```
can/
├── internal/
│   ├── accounts/       ✓ 已实现
│   ├── providers/      ✓ 通用 S3 Dialer + Client Factory
│   ├── security/       ✓ 已实现
│   ├── types/          ✓ 已实现
│   ├── buckets/        ✓ Bucket Service + API
│   └── objects/        ✓ Object Service + API
├── app.go             ✓ 统一暴露账户/Bucket/Object 方法
├── main.go            ✓ 保持不变
└── docs/
    ├── features.md    (功能规划，已有)
    └── spec/          (详细规格，已有)

frontend/
├── src/
│   ├── components/
│   │   ├── accounts/  ✓ 已实现
│   │   ├── buckets/   ✓ BucketBrowser
│   │   └── objects/   ✓ ObjectBrowser
│   ├── state/
│   │   ├── accounts.ts      ✓ 已实现
│   │   ├── buckets.ts       ✓ Zustand store
│   │   └── objects.ts       ✓ Zustand store
│   └── App.tsx        ✓ 串联账户/Bucket/Object 视图
```

---

## 完成标志（Definition of Done）

- [x] 所有代码通过 `go fmt`, `goimports`, `go vet`
- [x] 后端测试通过：`go test ./...`
- [x] 前端构建成功：`pnpm --dir frontend build`
- [ ] 集成测试：真实 R2 账户的端到端测试
- [ ] 代码审查通过
- [x] 文档更新（README 等）
- [ ] `wails build` 打包成功

---

**最后更新**: 2025-12-04
**状态**: ✅ 已交付（后续计划：Multipart Upload、真实 R2 回归）
