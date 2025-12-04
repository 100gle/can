# CAN R2 实现快速参考

供实现者快速查阅代码结构、依赖关系和关键接口。

---

## 项目结构速览

```
can/
├── internal/
│   ├── accounts/
│   │   ├── service.go          # 账户业务逻辑
│   │   ├── types.go            # 数据结构（Account, StorageAccount）
│   │   ├── store.go            # 数据持久化接口
│   │   ├── sqlite_store.go    # SQLite 实现
│   │   ├── memory_store.go    # 内存实现（测试用）
│   │   ├── export.go           # 导入导出逻辑
│   │   └── service_test.go     # 单元测试
│   ├── providers/
│   │   ├── providers.go        # 当前：ConnectionCredentials, StubDialer
│   │   └── s3_dialer.go       # TODO: 真实 S3 客户端
│   ├── security/
│   │   ├── cipher.go           # 加密/解密逻辑
│   │   └── crypto.go           # 底层加密函数
│   ├── types/
│   │   └── provider.go         # Provider 枚举（AWS, OSS, COS, R2, Custom）
│   ├── buckets/               # TODO: Phase 2
│   │   ├── types.go          
│   │   └── service.go        
│   └── objects/               # TODO: Phase 3
│       ├── types.go          
│       └── service.go        
├── app.go                     # 应用主结构，绑定到 Wails
├── main.go                    # Wails 应用入口
├── go.mod
└── go.sum

frontend/
├── src/
│   ├── components/
│   │   ├── accounts/
│   │   │   ├── AccountSidebar.tsx
│   │   │   └── AccountFormDrawer.tsx
│   │   ├── buckets/          # TODO: Phase 4.1
│   │   └── objects/          # TODO: Phase 4.3
│   ├── state/
│   │   ├── accounts.ts       # Zustand store for accounts
│   │   ├── buckets.ts        # TODO: Phase 4.2
│   │   └── objects.ts        # TODO: Phase 4.4
│   ├── lib/
│   │   ├── bridge.ts         # Wails 桥接函数
│   │   └── utils.ts
│   ├── App.tsx              # 主应用（需要在 Phase 4.5 更新）
│   └── main.tsx
└── vite.config.ts

docs/
├── features.md              # 完整功能规划
├── spec/                    # 详细功能规格（按功能划分）
├── README.md                # （当前，应迁移到repo根目录）
├── TODO_R2_Implementation.md  # 本次实现的详细计划（新）
├── R2_Testing_Setup.md       # R2 账户配置和测试指南（新）
└── Implementation_Guide.md   # 本文件

build/                      # 编译产物（自动生成）
.git/
.vscode/
```

---

## 关键数据流

### 账户管理流（已完成）
```
Frontend UI (AccountFormDrawer)
  ↓ createAccount(input)
Wails Bridge (app.go)
  ↓ CreateAccount(input)
Backend Service (accounts/service.go)
  ↓ 验证输入 → 加密 Secret Key → 生成 ID
SQLite Store (accounts/sqlite_store.go)
  ↓ INSERT INTO accounts
数据库
```

### 测试连接流（当前 Phase）
```
Frontend: 点击"测试连接"按钮
  ↓ testConnection(accountId)
Wails Bridge: TestAccountConnection(id)
  ↓
accounts/service.go::TestConnection()
  ├─ 从数据库获取账户
  ├─ 解密 Secret Key
  ├─ 构建 ConnectionCredentials
  └─ 调用 providers.Dialer.TestConnection()
      ↓
      providers/providers.go::StubDialer.TestConnection()
      └─ 仅验证字段非空 ⚠️

Frontend: 显示成功/失败提示
```

### 存储桶管理流（Phase 2 后）
```
Frontend: 点击"刷新存储桶"
  ↓ loadBuckets(accountId)
Wails Bridge: ListBuckets(accountId) [新增]
  ↓
buckets/service.go::ListBuckets()
  ├─ 获取账户信息
  ├─ 初始化 S3 客户端
  └─ 调用 s3_client.ListBuckets()
      ↓
      AWS SDK / MinIO SDK
      ↓
Cloudflare R2 API

Frontend: 更新存储桶列表显示
```

---

## 核心接口和类型

### providers/providers.go（现有）

```go
// 连接凭证结构
type ConnectionCredentials struct {
    Provider        types.Provider
    Endpoint        string
    AccessKeyID     string
    SecretAccessKey string
    Region          string
    UseSSL          bool
    Port            int
}

// Dialer 接口（需要实现）
type Dialer interface {
    TestConnection(ctx context.Context, credentials ConnectionCredentials) error
}

// 当前占位符实现
type StubDialer struct{}
func (StubDialer) TestConnection(_ context.Context, creds ConnectionCredentials) error {
    // ⚠️ 仅验证字段非空
}
```

### providers/s3_dialer.go（待实现，Phase 1.2）

```go
// 应该实现的结构
type S3Dialer struct {
    // 可选配置
    timeout time.Duration
}

func (d *S3Dialer) TestConnection(ctx context.Context, creds ConnectionCredentials) error {
    // 1. 根据 creds.Provider 选择 endpoint
    // 2. 初始化 AWS SDK S3 client
    // 3. 调用 ListBuckets() 验证连接
    // 4. 返回 nil（成功）或 error（失败）
    //
    // 伪代码：
    // client := s3.NewClient(config)
    // resp, err := client.ListBuckets(ctx, &s3.ListBucketsInput{})
    // return err
}
```

### types/provider.go（现有）

```go
type Provider string

const (
    ProviderAWS    Provider = "aws"
    ProviderOSS    Provider = "oss"
    ProviderCOS    Provider = "cos"
    ProviderR2     Provider = "r2"      // 支持 R2
    ProviderCustom Provider = "custom"
)

// 用于在 service 中处理提供商差异
func (p Provider) String() string { ... }
func (p Provider) Label() string { ... }
```

### accounts/service.go（现有）

关键方法：

```go
type Service struct {
    store  Store                  // 数据持久化
    cipher security.Cipher        // 加密/解密
    dialer providers.Dialer       // 连接验证 ← 需要替换为 S3Dialer
}

// 这个方法调用 Dialer，需要测试
func (s *Service) TestConnection(ctx context.Context, id string) (ConnectionTestResult, error) {
    record, err := s.store.Get(ctx, id)
    // ... 解密凭证 ...
    creds := providers.ConnectionCredentials{...}
    return s.dialer.TestConnection(ctx, creds)  // ← 这里会用到新的 S3Dialer
}
```

### buckets/types.go（待实现，Phase 2.1）

```go
type BucketInfo struct {
    Name         string    `json:"name"`
    CreatedAt    time.Time `json:"createdAt"`
    Region       string    `json:"region"`
    // 可选字段（不是所有提供商都支持）
    ObjectCount  *int64    `json:"objectCount,omitempty"`
    Size         *int64    `json:"size,omitempty"`
}

// Service 接口
type BucketService interface {
    ListBuckets(ctx context.Context, accountID string) ([]BucketInfo, error)
    CreateBucket(ctx context.Context, accountID string, req CreateBucketRequest) error
    DeleteBucket(ctx context.Context, accountID string, name string) error
    HeadBucket(ctx context.Context, accountID string, name string) error
}
```

### objects/types.go（待实现，Phase 3.1）

```go
type ObjectInfo struct {
    Key           string    `json:"key"`
    Size          int64     `json:"size"`
    LastModified  time.Time `json:"lastModified"`
    ETag          string    `json:"etag"`
    ContentType   string    `json:"contentType,omitempty"`
    IsDir         bool      `json:"isDir"` // 目录模拟标志
}

type ListObjectsInput struct {
    Bucket    string
    Prefix    string      // 文件夹前缀
    Delimiter string      // 通常为 "/"
    MaxKeys   int32       // 分页大小
    Marker    string      // 分页游标
}

// Service 接口
type ObjectService interface {
    ListObjects(ctx context.Context, accountID string, input ListObjectsInput) ([]ObjectInfo, error)
    GetObject(ctx context.Context, accountID string, bucket, key string) (io.ReadCloser, error)
    PutObject(ctx context.Context, accountID string, bucket, key string, data io.Reader) error
    DeleteObject(ctx context.Context, accountID string, bucket, key string) error
    HeadObject(ctx context.Context, accountID string, bucket, key string) (ObjectInfo, error)
}
```

---

## 依赖管理

### 当前依赖（go.mod）

关键库：
- `github.com/wailsapp/wails/v2` - Wails 框架
- `gorm.io/gorm` - ORM 框架（SQLite 持久化）
- `github.com/google/uuid` - UUID 生成

### 需要添加的依赖

**Phase 1.2**（S3 API）：

选项 A：AWS SDK v2（推荐）
```bash
go get github.com/aws/aws-sdk-go-v2
go get github.com/aws/aws-sdk-go-v2/service/s3
go get github.com/aws/aws-sdk-go-v2/credentials
```

选项 B：MinIO SDK
```bash
go get github.com/minio/minio-go/v7
```

**建议**: 使用 **AWS SDK v2**，原因：
- 官方维护，长期支持
- 支持所有 S3 兼容提供商
- 文档完整
- 功能丰富（支持 multipart upload 等高级功能）

### 版本管理

所有新增依赖使用 `go mod tidy` 自动解决版本冲突。

---

## 测试策略

### 单元测试（每个 package）

模式：表驱动测试（table-driven）

```go
func TestS3DialerConnection(t *testing.T) {
    tests := []struct {
        name    string
        creds   ConnectionCredentials
        wantErr bool
    }{
        {
            name: "valid r2 credentials",
            creds: ConnectionCredentials{
                Provider:        types.ProviderR2,
                Endpoint:        "https://xxx.r2.cloudflarestorage.com",
                AccessKeyID:     "valid_key",
                SecretAccessKey: "valid_secret",
            },
            wantErr: false,
        },
        {
            name: "invalid credentials",
            creds: ConnectionCredentials{
                AccessKeyID: "",  // 缺少 key
            },
            wantErr: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            dialer := NewS3Dialer()
            err := dialer.TestConnection(context.Background(), tt.creds)
            if (err != nil) != tt.wantErr {
                t.Errorf("got err=%v, want err=%v", err, tt.wantErr)
            }
        })
    }
}
```

### 集成测试

使用真实 R2 账户（或本地 MinIO 模拟）：

```go
func TestBucketServiceWithR2(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    
    // 从环境变量读取 R2 凭证
    accountID := os.Getenv("TEST_R2_ACCOUNT_ID")
    if accountID == "" {
        t.Skip("TEST_R2_ACCOUNT_ID not set")
    }
    
    service := buckets.NewService(...)
    buckets, err := service.ListBuckets(context.Background(), accountID)
    
    if err != nil {
        t.Fatalf("ListBuckets failed: %v", err)
    }
    
    // 验证返回结果
    if len(buckets) == 0 {
        t.Logf("no buckets found (expected if account is new)")
    }
}
```

运行方式：
```bash
# 只运行单元测试
go test ./...

# 运行所有测试（包括集成测试）
TEST_R2_ACCOUNT_ID=abc123 go test -v ./...
```

---

## 调试技巧

### 1. 启用日志
```bash
# 启用 DEBUG 日志（如果实现了）
DEBUG=1 wails dev
```

### 2. 查看 Wails 桥接调用
在浏览器开发者工具 (F12) 的 Console 中：
```javascript
// 查看所有暴露的方法
window.go.main.App
```

### 3. 数据库检查（SQLite）
```bash
# 连接到本地数据库
sqlite3 ~/.config/can/accounts.db

# 查看表结构
.schema accounts

# 导出账户信息（Secret Key 被加密）
SELECT id, name, provider, endpoint, accessKeyId FROM accounts;
```

### 4. 测试 S3 连接（使用 AWS CLI）
```bash
# 用真实的 R2 凭证测试
export AWS_ACCESS_KEY_ID="your_key"
export AWS_SECRET_ACCESS_KEY="your_secret"

# 列出存储桶
aws s3 ls \
    --endpoint-url https://abc123.r2.cloudflarestorage.com \
    --region auto

# 如果成功，说明凭证有效，SDK 应该也能工作
```

---

## 常见坑点和解决方案

### 坑 1：Endpoint 格式错误
- ❌ 错误: `abc123.r2.cloudflarestorage.com`（缺少 https://）
- ✓ 正确: `https://abc123.r2.cloudflarestorage.com`

### 坑 2：Region 设置不正确
- R2 不区分 region，但 AWS SDK 要求设置 Region
- ✓ 使用 `auto` 或空字符串
- 参考：https://developers.cloudflare.com/r2/api/s3/api/

### 坑 3：Provider 差异导致 API 调用失败
- OSS 的 ListBuckets 返回格式与 S3 不同
- COS 的部分操作需要特殊处理
- **解决**: 在 service 层集中处理这些差异，而不是在 SDK 层

### 坑 4：凭证泄露
- ❌ 不要在日志中打印 Secret Key
- ✓ 使用 `***` 或省略号替换敏感信息
- ✓ 仅在内存中处理凭证，不持久化明文

### 坑 5：超时设置不当
- 上传大文件时超时导致失败
- **解决**: 设置可配置的超时时间（推荐 5-30 分钟，取决于文件大小）

---

## 提交和 Code Review 清单

实现时遵循 AGENTS.md 的约定：

### 代码质量
- [ ] `go fmt` 和 `goimports` 已运行
- [ ] `go vet ./...` 无警告
- [ ] 新增代码 test coverage >= 70%
- [ ] 无 linter 警告

### 文档
- [ ] README 更新（如有新功能）
- [ ] 代码注释完整（特别是 public 函数）
- [ ] 更新 `docs/TODO_R2_Implementation.md` 的进度

### 提交信息（Conventional Commits）
```
feat: implement S3Dialer for R2 connection testing

- Add AWS SDK v2 integration
- Implement TestConnection via ListBuckets
- Support all S3-compatible providers
- Add comprehensive error handling

Refs #123  （如有关联 issue）
```

### Pull Request
- [ ] 标题清晰简洁
- [ ] 描述包含：What、Why、How
- [ ] 包含集成测试的结果截图
- [ ] 列出 breaking changes（如有）

---

## 相关资源

### 文档
- [AWS SDK for Go v2](https://aws.github.io/aws-sdk-go-v2/)
- [S3 API 参考](https://docs.aws.amazon.com/s3/latest/API/)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [Wails 官方文档](https://wails.io/)
- [GORM 文档](https://gorm.io/)

### 类似项目参考
- [MinIO Client](https://github.com/minio/minio-go)
- [S3 Manager](https://github.com/aws/aws-sdk-go-v2/tree/main/service/s3)

### 测试工具
- [LocalStack](https://localstack.cloud/) - 本地 AWS 模拟
- [MinIO](https://min.io/) - 本地 S3 兼容存储（推荐用于快速测试）

---

**最后更新**: 2025-12-04
**版本**: v0.1
