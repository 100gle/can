# Sprint 14: 后端架构重构 (Backend Rearchitecture)

本次 Sprint 针对当前 MVP 的 Go 后端进行一次性重构，目标是让实际实现与 README 中的 Mermaid 架构图保持一致：`Desktop UI → Backend Controller → Unified Interface → Providers`。既然尚无线上用户，可彻底调整模块边界、命名与数据流，确保未来扩展时无需再次大范围迁移。

---

## 1. 目标与范围

- **架构对齐**：让 `internal/app` 中的聚合服务严格映射到「Backend Controller」层，对外暴露清晰的 App Facade；`internal/providers` 则抽象为「Unified Interface Layer」，隔离供应商差异。
- **模块聚合**：重构 `accounts/buckets/objects/transfers/configfacade` 等模块，使其依赖方向符合分层约束（Controller → Domain Service → Provider Driver）。
- **跨前后端契约**：梳理 Wails 暴露的 API（位于 `internal/app/*.go`），保证命名与行为与新架构一致，并为前端提供可扩展的对象分页/任务流/能力矩阵接口。
- **可维护性**：统一日志、错误语义与审计链路，便于单元测试与冒烟测试覆盖多厂商 S3 兼容性。

> **假设**：暂无历史数据与用户，无需双写或兼容旧 API，可优先选择最干净的设计方案。

---

## 2. 架构映射与目录调整

| Mermaid 区块 | 现有实现 | 重构动作 |
| --- | --- | --- |
| Desktop / Frontend | `frontend` + `wails` bindings | 保持不变，重点是稳定 Wails API 契约 |
| Backend Controller | `internal/app/app.go` 聚合 `accounts/buckets/...` | 引入 `controller` 包（或沿用 `internal/app`），仅编排 use case，禁止直接操作 Provider |
| Unified Interface Layer | `internal/providers`、`configfacade` | 将 SDK 调用集中在 `providers`，通过 `ClientPool` + `StorageFactory` 提供接口；`configfacade` 只做 use case 组合 |
| Providers | `providers/s3_*`, `providers/oss_*`, `providers/cos_*` | 保留驱动实现，补充能力探测，并在 `types.CapabilityMatrix` 中自动导出 |

具体步骤：
1. **App Facade 收敛**：`internal/app/*.go` 中的公开方法统一调用新的 `controller` 层（示例：`app.ListObjects → controller.Objects.List`），Wails 只依赖 Facade。
2. **Service Interface 固化**：为账户、对象、传输、配置等服务定义 interface（可放在 `internal/domain` 或 `internal/ports`），Controller 只依赖 interface，方便注入 mock 与后续扩展。
3. **事件与状态同步**：重新梳理 `transfer.Service`、`objects.Service` 与 `security.Service` 的依赖关系，确保传输队列成为唯一的上传下载入口，审计 Hook 覆盖所有敏感操作，搜索/备份等模块仅消费 Domain 服务。

---

## 3. 核心重构任务

### 3.1 Controller / Use Case 层

- 在 `internal/app/app.go` 中将字段替换为 interface，并新增 `controller` 包：`AccountsController`, `ObjectsController`, `TransfersController`, `ConfigController`, `SearchController`。
- Controller 负责输入校验、超时、审计触发，业务逻辑仍在 Domain Service 中。
- 抽象 `RequestContextManager`，封装 `context.WithTimeout`、请求 ID、审计元信息，避免重复样板。
- 向前端暴露新的观测 API：`ListProviderCapabilities`, `ListTransferMetrics`, `DescribeBackendHealth`，方便 UI 自适应。

### 3.2 Domain Service 梳理

- **Accounts/Sessions** (`internal/accounts`): 拆分 `Repository`、`Dialer`、`SessionCache`，所有服务通过 `ResolveProviderClient(accountID)` 获取驱动，禁止自行创建 SDK 客户端。
- **Objects Service** (`internal/objects`):
  - 将 `ListObjects`, `BatchDelete`, `MoveObjects`, `GetPresigned*` 拆分为 Query/Command 方法。
  - 统一分页结构（cursor + limit），向前端暴露筛选 + 分页组合能力，为 Sprint 15 的分页 UI 做准备。
- **Transfers Service** (`internal/transfer`):
  - Wails 上传/下载入口全部迁移到 `transfer.Service`，Go 端负责限速、断点续传、错误恢复。
  - 新增 Worker Monitor（活动 worker 数、吞吐、失败队列），供设置页或调试页面展示。
- **Config/Capability** (`internal/config`, `configfacade`):
  - 所有配置项操作先查询 `types.CapabilityMatrix`，拒绝不受支持的操作。
  - `configfacade.Service` 只组合业务流程，不再深度依赖具体 Provider 的实现细节。

### 3.3 Provider & Interface 层

- 规范 `internal/providers/storage.go` 的 `ListObjects`、`DeleteObjects`、`Presign` 等接口，使分页与批量操作语义一致。
- `s3_storage_client.go`、`oss_storage_client.go`、`cos_storage_client.go` 统一实现 ListObjectsV2 语义，支持 `Prefix + Delimiter + ContinuationToken` 组合。
- 扩展 `providers.ClientPool`：支持懒加载、健康检查、provider 级别的连接统计。
- 将 `types.CapabilityMatrix` 生成逻辑与驱动实现绑定，确保 UI 与文档（`docs/provider_capabilities.md`）同步。

### 3.4 Observability 与测试

- 在 Controller 入口打印结构化日志（请求 ID、account/provider/bucket/key）。
- 扩展 `internal/providers/integration_test.go`，执行 AWS、OSS、COS、R2 的 matrix 冒烟测试，覆盖 List/Upload/Delete/BatchDelete/Presign。
- 为 `transfer.Service`、`objects.Service` 增加断网与限速场景测试，确保离线/重启后的行为稳定。

---

## 4. 迁移策略

1. **建立新包结构**：创建 `internal/controller` 并提供 interface，完成依赖注入。
2. **逐个 Wails Endpoint 切换**：以 `@wailsjs/go/app/App` 暴露的方法为单位迁移，完成一个即删除旧逻辑，避免双写。
3. **Provider 层对齐**：统一 `ListObjects`/`DeleteObjects` 签名，补充 capability，更新 `types.CapabilityMatrix` 与文档。
4. **前端契约更新**：导出新的 API 文档（建议新增 `docs/spec/backend_api.md`），更新 Wails 生成的 TS 定义，确保前端无缝衔接。
5. **验证**：执行 `go test ./...`、`wails build`，并使用 MinIO/LocalStack/OSS Mock 完成端到端冒烟。

---

## 5. 风险与缓解

- **跨层耦合遗漏**：部分前端入口仍可能绕过新 Controller（例如旧的 direct upload）。需要配合 Sprint 15 清点所有 `@wailsjs/go/app/App` 调用，并限制只走新 Facade。
- **Provider 差异**：OSS/COS 对分页、ACL、Referer 等 API 的限制不同，必须通过 Capability Matrix 驱动 UI 行为，避免硬编码。
- **测试缺失**：大规模重构后需先补齐集成测试基线，再推进代码迁移，降低回归风险。

---

## 6. 验收标准

- `internal/app` 只承担 Facade 职责，核心逻辑在 Controller + Domain Service 中实现。
- 所有前端调用均通过统一 API，不再暴露 Provider 细节。
- `ListObjects` 支持分页/筛选组合；`DeleteObjects` 在可用 Provider 上走批量 API，其余 Provider 自动回退单条删除。
- Capability Matrix 与 UI/文档一致，禁用功能不会在界面展示。
- MinIO/LocalStack/OSS/COS 冒烟通过，`go test ./...` 与前端 `pnpm test` 均稳定。

---

## 7. 输出物

- 重构后的 Go 代码与接口说明（建议同步更新 `docs/spec/`）。
- 若架构图有调整，更新 `docs/architecture.png` 或补充 v2 版本。
- Provider 冒烟与传输队列监控文档，作为后续维护基线。

