# Sprint 13: 后端一致性与传输链路收敛 (Backend Integrity & Transfer Cohesion)

**目标**: 收敛前端/后端的传输链路、补齐浏览器模式能力，并完成一次系统性的后端 API & Provider 覆盖度审计，确保 CAN 仍能面向多家对象存储厂商稳定提供文件管理、浏览与高级配置服务。

---

## 审计复核更新（Desktop 上传链路）

- ✅ 桌面端所有入口（浏览器工具栏、右键菜单、原生拖拽）均统一调用 `transfersStore.uploadFilesFromPaths`，并在成功入队后触发 `syncBackendTasks`，UI 仅消费后端任务快照。
- ✅ 目录上传通过 `OpenDirectoryDialogWithFiles` 与 `DropOverlay` 传入 `basePath`，Go 端 `UploadFilesFromPaths` 依据相对路径构造对象 key，多级目录不再被拍平。
- ✅ 原生拖拽流程在 `frontend/src/routes/__root.tsx` 挂载 `<DropOverlay />`，`useFileDrop` 能捕获 Wails `OnFileDrop` 事件并直接推送到传输队列。
- 🔍 验证命令：`npm run build`（前端 TypeScript/Vite 构建）与 `go test ./...`（后端单元与服务测试）。

## 1. 桌面上传链路统一
* **问题现状**：目前 `frontend/src/state/transfers.ts:210-258` 直接在前端维护 `localRuntimes` 并调用 `UploadPart`，绕过了 `internal/transfer.Service` 的队列、限速和断点续传能力，导致：
  * 设置页的并发/限速配置无法生效（仅影响后端任务）；
  * 应用重启或崩溃后任务无法恢复；
  * 前端独立维护的状态与后端任务列表存在双源冲突。
* **关键任务**：
  1. 将桌面端上传改为走 `UploadObject` → `transfer.Service.EnqueueUpload` 流程（Wails 可通过 `SelectLocalFolder`/`dialog` 获取文件路径；浏览器模式保留现有逻辑但需显式降级）。
  2. 统一进度/状态来源，前端仅消费 `ListTransferTasks`，移除 `source: "local"` 的分支。
  3. 为新的路径补充集成测试：模拟上传中断、进程重启、限速变更等场景。
* **验收**：
  - 设置页中修改并发/限速后，对所有上传任务（含 UI 直接触发的）立即生效；
  - 任务列表只展示来自后端的任务快照，刷新/重启仍能看到上传进度；
  - 桌面端上传与离线队列均复用同一 `transfer` store，错误文案保持一致。

## 2. 分片编码与内存占用
* **问题现状**：`processUploadTask` 在 `frontend/src/state/transfers.ts:426-444` 使用 `btoa(String.fromCharCode(...payload))` 将 5MB（默认）分片展开为函数参数，Chrome/Wails 均会抛出 `RangeError: Maximum call stack size exceeded`，同时会瞬时复制两份内存。
* **关键任务**：
  - 抽象一层 `encodeChunkToBase64(chunk: ArrayBuffer)`：使用 `Buffer.from(payload).toString("base64")`（Wails 内置 Node polyfill）或逐块拼接，避免将 `Uint8Array` 展开为参数；
  - 根据文件尺寸自适应分片：大于 256MB 的文件自动降级为 8MB/16MB 分片，减少 `UploadPart` 次数；
  - 在 Vitest/E2E 中覆盖 1GB 以上文件的分片编码，避免回归。
* **验收**：
  - 5MB～100MB 的分片上传不再抛出 `RangeError`；
  - 内存峰值和 CPU 使用量明显下降（观察 Chrome DevTools / Wails 调试窗口）。

## 3. 浏览器模式下载与批量下载打通
* **问题现状**：
  - `frontend/src/state/transfers.ts:256-258` 的 `downloadFiles` 函数只是提示「敬请期待」，对象浏览器的批量下载入口会静默失败；
  - `frontend/src/state/objects.ts:357-375` 中在非桥接环境直接注释「浏览器模式尚未实现下载」，用户无任何反馈。
* **关键任务**：
  1. 在浏览器模式下使用 `GetPresignedDownloadURL` + `fetch`/`streamsaver` 完成单文件下载，并提供失败提示；
  2. 扩展 `downloadFiles`，根据运行环境选择：
     - 桌面：走 `DownloadBatch` → `transfer.Service`；
     - 浏览器：生成打包任务（Web Worker + `JSZip` 或后端临时归档 API）；
  3. 统一批量下载入口的提示语（例如下载目录、归档名称、冲突策略）。
* **验收**：
  - 桌面端批量下载能生成归档任务并显示在传输列表；
  - 浏览器模式至少支持逐个触发 `fetch` 下载 + 清晰的 toast 提示；
  - 任何环境下用户都能获得「已发起/失败原因」的反馈。

## 4. 批量操作与 Provider 能力映射
* **问题现状**：
  - `internal/objects/service.go:162-194` 逐个调用 `DeleteObject`，大量对象删除非常缓慢，且与 AWS/COS 的 `DeleteObjects` API 能力不匹配；
  - 高级桶配置由 `internal/config/service.go:42-67` 提供，但 `supportsConfig` 仅允许 `aws`，即便 `types.ProviderCapabilities` 标记了 OSS/COS 的 Referer/ACL 能力，依旧被拒绝；
  - 前端没有读取 `types.ProviderCapability` 结果，只能靠手工维护“支持矩阵”，容易与后端真实能力偏离。
* **关键任务**：
  1. 为支持批量删除的驱动实现 `DeleteObjects`，并在 `objects.Service.BatchDeleteObjects` 中根据 `driver.SupportsBatchDelete()`（新增接口）分支处理；
  2. 拆分 `BucketConfigService`：支持 Referer/ACL 等“非 AWS 专属”能力时直接走 OSS/COS SDK，或在 facade 中根据 capability 选择不同实现；
  3. 前端 `useCapabilities()`（新增 hook）按 account/provider 自动控制功能入口，避免误操作；
  4. 文档与功能矩阵需由同一 JSON/TS 定义生成，避免再出现 `features.md` 与代码定义不一致的情况。
* **验收**：
  - AWS/COS 批量删除 1k+ 对象耗时明显下降，并输出成功/失败统计；
  - OSS/COS 的 Referer/ACL 配置可以在 UI 中打开/保存，不再提示「供应商不支持」；
  - 切换不同账户时，UI 仅展示真实可用的配置项，能力矩阵由后端接口驱动。

## 5. 后端 API 与多厂商支持调查结果
> 以下内容基于本轮审阅，对后端模块的现状、风险与 TODO 进行分组记录，并直接纳入 Sprint 范围。

### 5.1 账户与 Provider 工厂
- **现状**：`accounts.Service` 统一管理会话、加密存储、连接测试；`providers.ClientPool` + `storage_factory` 已为 S3/OSS/COS/R2（走 S3 builder）提供工厂，凭证缓存 TTL 5 分钟。
- **风险**：缺少针对多供应商的冒烟测试，无法验证 OSS/COS/R2 在真实 API 层面的兼容性。
- **任务**：
  1. 编写 matrix 测试（可用 MinIO/LocalStack/OSS Mock）覆盖 ListBuckets/ListObjects/上传/复制场景；
  2. 将测试结果写入文档，作为后续回归基线。

### 5.2 Bucket 配置 Facade
- **现状**：`config.BucketConfigService.supportsConfig` 仅允许 `aws`，与 capability matrix 不一致（例如 `types.ProviderOSS` 支持 Referer，`ProviderCOS` 支持 ACL）。
- **任务**：
  - 拆分配置项：Referer/ACL 使用各自 StorageClient 实现；真正只在 AWS 提供的能力再走 S3 Client；
  - 通过 `types.ProviderCapability` 动态决定是否开放入口，并在错误信息中透出供应商限制。

### 5.3 对象与批量操作
- **现状**：`objects.Service` 功能齐全，但批量删除、批量复制尚未利用 SDK 的批处理 API；离线/并发逻辑集中在前端。
- **任务**：
  - 为 `StorageClient` 增加 `DeleteObjects(ctx, bucket, keys []string)` 可选接口；
  - 后端 `BatchDeleteObjects` 优先尝试批量，再回退逐条；为 UI 提供进度和失败清单。

### 5.4 传输子系统
- **现状**：`internal/transfer.Service` 已支持恢复、限速、压缩下载、离线任务；但前端未充分利用（见章节 1&2）。
- **任务**：
  - 将前端上传/下载统一迁移到 `transfer.Service`，并为服务补充 worker 监控指标（活动 worker、平均吞吐）用于 `SettingsPage`；
  - 提供 CLI / API 级的自检接口，让 DevTools 页面（未来可能恢复）可以查看队列状态。

### 5.5 Provider 驱动能力
- **现状**：
  - S3 驱动覆盖版本控制、加密、生命周期、ACL、Public Access Block 等主流 API；
  - OSS/COS 驱动在 `oss_storage_client.go`、`cos_storage_client.go` 中对部分 API 返回 `ErrUnsupportedCapability`，但文档/前端尚未与之联动；
  - R2 走默认 S3 驱动，缺少自定义域名、生命周期等特殊逻辑。
- **任务**：
  1. 将 `ErrUnsupportedCapability` 透传到 `configfacade`，并在 capability matrix 中自动同步；
  2. 为 R2 补充最小实现（例如 `ListBuckets` 仅返回命名空间、禁用 ACL/Policy 操作）；
  3. 输出《Provider 能力对照表》附在 docs/spec 中，成为后续 spec/产品的一致来源。

---

## 验收标准
- 桌面端上传、批量下载均复用后端 `transfer.Service`，并能在任务页看到统一的进度/限速。
- 浏览器模式拥有清晰的单文件/批量下载 fallback，不再出现静默失败。
- 批量删除、Referer/ACL 等能力会根据 provider 自动开关，且操作走对应 SDK 的批处理/专属 API。
- 完成多厂商冒烟测试并形成记录，确保 AWS/OSS/COS/R2 至少覆盖「列举/上传/下载/删除」基础链路。
- Sprint 文档同步标注所有已识别的风险与 TODO，为后续拆分任务提供依据。***
