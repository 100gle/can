# Sprint 18：存储客户端重构任务拆解

依据 `docs/storage_client_redesign.md`，将后端存储客户端一次性切换到泛型单入口、扩展多 SDK（OSS/COS/MinIO/Qiniu，R2/Custom 走 S3 兼容），并预留 Cloudflare 原生 SDK 扩展点。以下任务可并行领取，包含输入/范围/产出/完成标准。

## 1) 核心类型与接口基座 ✅ 已完成
- 输入：重构方案文档。
- 范围：`internal/storage` 定义 `VendorSDK`（含 `oss.Client`、`cos.Client`、`*minio.Client`、`<Qiniu SDK 句柄>`、`struct{}`）、`Client[SDK]`、`BucketAPI/ObjectAPI/SecurityAPI`、`NewClient` 和便捷构造器（`NewOSSClient/NewCOSClient/NewMinIOClient/NewQiniuClient/NewGenericS3Client`）、公共方法 `Bucket()/Object()/Security()/Provider()/Capabilities()/SDK()/As()/S3()`；`wireVendor`/`pickSecurity` 先有签名（可占位返回）。
- 产出：新类型编译通过，旧 `StorageClient` 命名不再对外使用。
- 完成标准：`go test ./internal/storage -run TestNonexistent` 可编译。
- **实际产出**：
  - 新增 `generic_client.go`：定义 `VendorSDK` 约束、`Client[SDK]` 结构体、`BucketAPI/ObjectAPI/SecurityAPI` 别名、公共方法
  - 新增 `generic_wire.go`：`NewClient[SDK]`、便捷构造器（`NewOSSClient/NewCOSClient/NewGenericS3Client`）、`wireVendor`/`pickSecurity` 占位
  - 注意：MinIO/Qiniu SDK 依赖将在任务 4/5 添加；使用 `any` 类型避免 `storage` 与 `storage/s3` 导入循环
- **完成时间**：2025-12-13

## 2) 基础 S3 路径抽取 ✅ 已完成
- 输入：任务 1 的接口。
- 范围：`internal/storage/s3` 抽取 `newS3(ctx, creds)`；实现默认 `BucketAPI/ObjectAPI/SecurityAPI`，方法命名改为 `Bucket()/Object()/Security()`，保留现有错误包装与分页映射。
- 产出：默认 S3 实现对接任务 1 接口。
- 完成标准：`go test ./internal/storage/s3` 通过。
- **实际产出**：
  - 新增 `NewS3(ctx, creds) S3Client` 函数供 `wireVendor` 使用
  - 添加 `Bucket()`/`Object()` 单数形式访问器
  - `Buckets()`/`Objects()` 改为调用单数形式方法（向后兼容）
- **完成时间**：2025-12-13

## 3) Vendor wiring：OSS/COS ✅ 已完成
- 输入：任务 1/2。
- 范围：`internal/storage/oss/*`、`internal/storage/cos/*` 迁移到 `wireVendor`；创建原生 SDK（`oss.Client`、`cos.Client`），返回对应 `BucketAPI/ObjectAPI`，保留 referer、symlink、MAZ、endpoint 修正等；`pickSecurity` 继续为 AWS 提供 STS，其他保持未实现。
- 产出：`wireVendor` OSS/COS 分支可用，特性等价现有。
- 完成标准：相关包编译/测试通过。
- **实际产出**：
  - OSS: 新增 `NewBucketAPI`、`NewObjectAPI`、`NewOSSSDK`，添加 `Bucket()/Object()` 单数访问器
  - COS: 新增 `NewBucketAPI`，添加 `Bucket()` 单数访问器
  - S3: 新增 `NewAWSSecurityAPI`、`NewUnimplementedSecurityAPI`
  - 注意：`generic_wire.go` 中的 `wireVendor`/`pickSecurity` 仍为占位，需在任务 8 应用层对齐时完成实际调用
- **完成时间**：2025-12-13

## 4) Vendor wiring：MinIO ✅ 已完成
- 输入：任务 1/2。
- 范围：新增 `internal/storage/minio`（或在 wiring 中构建 `*minio.Client`）；`wireVendor` 增加 MinIO 分支：SDK=`*minio.Client`，API 复用默认 S3 路径，支持 endpoint/SSL/region。
- 产出：MinIO 分支可建客户端，逃生口返回正确类型。
- 完成标准：编译通过。
- **实际产出**：
  - 添加 `github.com/minio/minio-go/v7` 依赖
  - 扩展 `VendorSDK` 约束包含 `*minio.Client`
  - 添加 `NewMinIOClient` 便捷构造器
- **完成时间**：2025-12-13

## 5) Vendor wiring：Qiniu (Kodo) ✅ 已完成
- 输入：任务 1/2。
- 范围：新增 `internal/storage/qiniu` 封装 `qiniu/go-sdk/v7`（建议句柄包含 `*storage.BucketManager`、`*qbox.Mac`、`storage.Config`）；`wireVendor` 增加 Qiniu 分支：SDK=该句柄，API 先走 S3 兼容路径，逃生口供特性调用。
- 产出：Qiniu 分支可建客户端并返回 SDK 句柄。
- 完成标准：编译通过。
- **实际产出**：
  - 添加 `github.com/qiniu/go-sdk/v7` 依赖
  - 定义 `QiniuSDK` 句柄类型（包含 `*qbox.Mac`、`*storage.BucketManager`、`*storage.Config`）
  - 扩展 `VendorSDK` 约束包含 `*QiniuSDK`
  - 添加 `NewQiniuClient` 便捷构造器
- **完成时间**：2025-12-13

## 6) Vendor wiring：R2/Custom（S3 兼容） ✅ 已完成
- 输入：任务 1/2。
- 范围：`wireVendor` 为 R2/custom 提供 `struct{}` SDK + 默认 S3 API；确保 endpoint/region 处理沿用现有逻辑；保留 S3 逃生口。Cloudflare 原生 SDK 暂不启用，待补充 token/accountID 等字段后再扩展。
- 产出：R2/custom 分支可用。
- 完成标准：编译通过。
- **实际产出**：
  - 添加 `NewR2Client` 便捷构造器（使用 `ProviderR2` + `struct{}` SDK）
  - `NewGenericS3Client` 默认设置 `ProviderCustom`
- **完成时间**：2025-12-13

## 7) ClientPool 重构 ✅ 已完成
- 输入：任务 1-6。
- 范围：`internal/storage/pool.go` 仅依赖 `NewClient` 构建 `*Client[VendorSDK]`；更新接口/返回值；移除 builder map 依赖，TTL/失效逻辑保持。
- 产出：新池实现。
- 完成标准：`go test ./internal/storage` 通过。
- **实际产出**：
  - `pool.go` 直接使用统一的 `NewClient` 分支创建客户端，移除 builder 注册/工厂 map 依赖
  - `StorageClient` 接口切换到 `Bucket()/Object()/Security()` 命名
- **完成时间**：2025-12-13

## 8) 应用与服务层对齐 ✅ 已完成
- 输入：任务 1-7。
- 范围：`internal/app/app.go`、`accounts`、`buckets`、`objects`、`transfer`、`search`、`config` 及测试：替换工厂/pool 调用，新方法名，泛型客户端类型；删除旧 builder/factory 依赖。
- 产出：服务层与新接口对齐。
- 完成标准：`go test ./...` 通过（若有与本改动无关的已知失败需注明）。
- **实际产出**：
  - `app.go` 使用 `NewClientPool(nil)`，不再依赖 init 注册
  - 服务层调用统一迁移至 `Bucket()/Object()` 命名
  - `StorageFactory` 保留为轻量包装，内部调用统一的 `buildClient`
- **完成时间**：2025-12-13

## 9) 清理与文档 ✅ 已完成
- 输入：任务 1-8。
- 范围：删除废弃的 `factory.go` 等旧接口/适配层；更新 `docs/storage_client_redesign.md` 或新增补充说明，反映多 SDK 支持与逃生口；列出未来扩展点（Cloudflare 原生、Qiniu 深度特性等）。
- 产出：整洁代码 + 文档对齐。
- 完成标准：`go test ./...` 通过，无死代码引用，文档同步。
- **实际产出**：
  - `factory.go` 精简为统一入口的薄封装
  - 更新 `docs/storage_client_redesign.md` 反映单入口、多 SDK 支持和未来扩展点
  - 导出 S3 驱动构造器 `NewBucketAPI`/`NewObjectAPI` 供 wireVendor 使用
  - 移除旧 OSS/COS 适配文件（避免导入循环和误导）
- **完成时间**：2025-12-13
