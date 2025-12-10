# Sprint 14：后端重构补充 TODO

> 目的：记录 Sprint 14 验收中暴露的缺口，确保代码、文档与前端依赖一致，避免上线后能力错配。

---

## 1. `storage.Client` / Vendor SDK 聚合接口对齐（✅ 已完成）

- **处理结果（2025-12-10）**
  - `docs/sprint_14_backend_rearchitecture.md` 已改为 Driver 模式描述，示例代码与 `storage.StorageClient` / OSS/COS adapter 的真实实现一致。
  - Section 4 目录结构同步当前文件布局，不再引用 `Client.SDK` 或 `interface.go`、`s3_impl.go` 等历史文件。
- **后续**
  - 若未来重新引入聚合层（`Client.SDK`），再开启新的 TODO；当前无需额外动作。

---

## 2. `MutationOptions` 落地

- **现状**
  - `DeleteObjectWithOptions`/`RenameObjectWithOptions`/`MoveObjectsWithOptions` 在 `internal/app/objects.go` 中忽略 `MutationOptions`（参数命名为 `_`）。
  - `objects.Service`、底层驱动、审计记录均未消费 requestId/origin，离线队列无法实现幂等回放。
- **TODO**
  1. 把 `MutationOptions` 透传到 `objects.Service`，至少用于：
     - 幂等键构建（e.g. `requestId`）；
     - 操作审计或 tracing（记录 `origin`）。
  2. 设计失败重试 / 去重策略：例如在对象操作前查询最近一次相同 requestId 的结果。
  3. 更新相关测试覆盖（offline manager、service 层）。
- **验收标准**
  - 同一 `requestId` 的重复调用不会产生重复副作用；
  - 有日志或存储可追踪 `origin`。

---

## 3. 分页参数 `Cursor` / `NextCursor`

- **现状**
  - 文档宣称统一 `Cursor` / `NextCursor`，但实际类型仍是 `Marker` / `NextMarker`（`internal/objects/types.go`、`s3ObjectDriver.ListObjects`）。
- **TODO**
  1. 决定命名：若选择 `Cursor`，需要改动：
     - Go 类型、Wails 生成的 TS 模型、前端 state/hooks；
     - S3 驱动把 `ContinuationToken` 映射到 `NextCursor`。
  2. 若维持 `Marker`，需修正文档和所有对外 API 描述。
  3. 补充回归测试：大列表翻页 + Cursor 回传。
- **验收标准**
  - 后端、前端、文档对分页字段有统一命名，且翻页测试通过。

---

## 4. OSS Symlink 元数据链路

- **现状**
  - `storage.ObjectDescriptor` 暴露 `IsSymlink`/`SymlinkTarget`，但 S3 驱动 `ListObjects` 未填充；`objectAdapter.GetSymlink` 无处被调用，`ObjectDriver` 接口也缺 `GetSymlink`。
- **TODO**
  1. 在列举对象时识别 symlink（可通过 OSS SDK `GetSymlink` 或对象元数据）并回填字段；
  2. 若需要单独 API，扩展 `ObjectDriver` 增加 `GetSymlink` 并在 `objects.Service` 暴露；
  3. 更新前端（文件浏览器、Symlink 对话框）对新字段的使用；
  4. 添加集成测试：创建 symlink → 列举/展示。
- **验收标准**
  - 前端能正确显示 symlink icon 与目标；调用文档中的示例代码不会 panic。

---

## 5. COS 多可用区（MAZ）配置

- **现状**
  - 文档扩展矩阵标记 COS 支持 Multi-AZ，但 `bucketAdapter.GetBucketMAZConfig` 返回 `ErrUnsupportedCapability` 且接口未公开。
- **TODO**
  1. 定义 `BucketDriver` 上的 MAZ 相关接口（获取/开启/关闭）或确认不支持；
  2. 若实现：
     - 查明 COS SDK API（可能需要调用 `client.Service.Get()` 或特定 XML）；
     - 在配置服务中暴露开关；
     - 前端 `create-bucket-dialog` 的 MAZ 选项与真实能力绑定。
  3. 若不实现，更新文档与能力矩阵，将 COS 的 MAZ 能力改为 `❌` 并说明原因。
- **验收标准**
  - 能力矩阵与真实功能一致；若实现，提供端到端测试（创建/查询 MAZ）。

---

## 6. 文档与能力矩阵回归（持续）

- **现状**
  - Section 3/4/5 已同步 Driver 模式，但仍需建立机制，确保后续改动不会再次漂移。
- **TODO**
  1. 把“文档核对”加入 PR 模版或 CI Checklist，尤其是：
     - 新增/删除文件需同步目录结构；
     - API 改名需同步 README / Wails TS 定义。
  2. 在能力矩阵中保留“来源”说明（例如 COS MAZ = ❌，原因：SDK 不支持），便于外部沟通。
  3. 与产品/前端协同，确认文档更新后的联动工作已完成。
- **验收标准**
  - 任意工程师阅读文档即可推导出真实代码入口；能力矩阵的 ✅/❌ 均可在代码中找到依据。

---

### 建议的执行顺序
1. `storage.Client` + 文档一致性（影响范围最大）  
2. 分页参数与前端同步（避免 API break）  
3. MutationOptions 幂等支持  
4. Symlink 元数据补齐  
5. COS MAZ 能力（可与配置服务一起迭代）  
6. 最终文档回归、测试验证

完成上述 TODO 后，再次运行 `go test ./...`、`wails build` 并进行手动 Provider 验证，确保 Sprint 14 后端重构真正上线可用。
