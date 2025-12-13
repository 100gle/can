# Sprint 18：存储客户端包结构整理与S3优先策略落地计划

## 目标
- 根包只保留通用入口与类型；各 provider 逻辑迁移到子包，避免膨胀和重复实现。
- 桶/对象主路径统一走 S3 API，SDK 仅在少数特性上作为装饰层。
- 错误包装与安全接口保持单一来源，减少漂移。

## 范围
- 包：`internal/storage` 及子包 `s3`、`oss`、`cos`（MinIO/Qiniu 主要为 SDK 句柄）。  
- 文档：`docs/storage_client_redesign.md`、本计划。  
- 不兼容改动允许；聚焦可维护性与一致性。

## 交付物
1) 包结构调整  
   - 子包：`internal/storage/oss/{sdk.go,bucket_api.go,object_api.go}`，`internal/storage/cos/{sdk.go,bucket_api.go}`。  
   - 根包：`generic_client.go`、`generic_wire.go`（仅调度）、`security.go`、`types*.go`、`s3_bridge.go`。  
   - `wireVendor` 仅 import 子包公开的 `NewSDK/NewBucketAPI/NewObjectAPI`。

2) S3 优先 + 装饰器  
   - OSS：`ListObjects` 先用 S3 API，endpoint mismatch 时再 SDK fallback；Symlink/Referer 用 SDK，其余委托 base。  
   - COS：MAZ 创建/Referer 用 SDK，其余委托 base。  
   - 其他 provider：纯 S3 基线，SDK 仅 escape hatch。

3) 防腐层与类型收敛  
   - 子包内部定义装饰接口，外部仍暴露 `storage.BucketAPI/ObjectAPI`。  
   - SDK-only 能力加注释标明“非通用能力”。  
   - 错误包装、安全接口只留根包实现，子包复用。

4) 文档与验证  
   - 更新 `docs/storage_client_redesign.md`，记录子包拆分与 S3 优先策略。  
   - 回归 `go test ./...`。

## 里程碑与执行顺序
1. 包布局迁移（拆子包，wireVendor 只依赖子包导出）。  
2. S3 优先装饰实现（OSS/COS 特性隔离）。  
3. 防腐与注释收敛（接口/错误/安全单一来源）。  
4. 文档同步与回归测试。

## 未完事项（滚动清单）
- 服务层仍通过根包类型别名访问，如需进一步解耦可逐步改为直接 import `internal/storage/api`（低优先）。  
- MinIO/Qiniu 目前仅提供 SDK 句柄 + S3 基线，是否需要子包化以支持未来特性待定。  
- 文档后续可补充各子包内特性覆盖矩阵（OSS symlink/Referer fallback、COS MAZ/Referer）。  
- Cloudflare 原生 SDK 未接入，仍通过 S3 兼容路径。

## 风险与缓解
- 导入循环：通过 `s3_bridge` 继续注入构造器，子包不反向依赖根包业务。  
- 特性遗漏：保持现有 OSS/COS 功能（Referer/Symlink/MAZ），新增装饰时先用现有实现验证。  
- 大范围移动：分阶段提交，保证每步编译通过。
