# Sprint 4: 安全硬化与访问控制 (Security & Access Control)

**目标**: 补齐安全短板，确保数据访问权限可精细化管理，保障企业级使用安全。

## 1. 存储桶访问控制列表 (Bucket ACL) 管理
*   **功能描述**: 实现存储桶 ACL 的可视化管理，允许用户设置 Owner、Authenticated Users、Log Delivery 等组的读写权限，以及添加特定规范用户 ID (Canonical User ID) 的授权。
*   **关联文档**: `docs/features.md` (Item 80), `docs/spec/bucket_access_control.md`
*   **关键任务**:
    *   [x] 后端: 实现 `GetBucketAcl` 和 `PutBucketAcl` 接口适配 (S3/OSS/COS)。
    *   [x] 前端: 在 `BucketSettings` 中新增 `AccessControlPanel`。
    *   [x] 前端: 实现 ACL 授权编辑器 UI (Grantees list, Permission dropdowns)。

## 2. 阻止公共访问 (Block Public Access)
*   **功能描述**: 集成 AWS S3 和 Aliyun OSS 的 "Block Public Access" 功能，允许用户一键禁止存储桶及其对象的公共访问。
*   **关联文档**: `docs/features.md` (Item 81)
*   **关键任务**:
    *   [x] 后端: 实现 `GetPublicAccessBlock` 和 `PutPublicAccessBlock` API。
    *   [x] 前端: 在安全设置页增加 "Block Public Access" 及其子选项 (BlockPublicAcls, IgnorePublicAcls 等) 的开关。

## 3. 会话安全管理
*   **功能描述**: 增强应用的安全性，增加空闲超时自动注销功能，防止未授权人员在用户离开时操作。
*   **关联文档**: `docs/features.md` (Item 36)
*   **关键任务**:
    *   [x] 前端: 实现空闲检测 Hook (`useIdleTimer`)。
    *   [x] 前端: 实现锁屏界面或自动登出逻辑。
    *   [x] 配置: 在设置页允许用户自定义超时时间 (如 15分钟, 1小时, 从不)。

## 4. 防盗链设置 (OSS/COS 特有)
*   **功能描述**: 为 OSS 和 COS 存储桶配置 Referer 白名单，防止资源被盗用。
*   **关联文档**: `docs/features.md` (Item 82)
*   **关键任务**:
    *   [x] 后端: 实现 `GetBucketReferer` 和 `PutBucketReferer`。
    *   [x] 前端: 实现防盗链配置面板 (允许 Empty Referer, Referer List)。

## 验收记录（2025-03-05）
- ✅ Bucket ACL：可在 Bucket Settings → 访问控制面板中选择预设 ACL，或切换至“自定义”后为 Canonical User / Group 添加授权，验证 S3/COS 下发成功，OSS 仅允许预设模式。
- ✅ Block Public Access：AWS 账户展示四个开关并能调用 `Get/PutPublicAccessBlock`，OSS/COS 自动退回能力说明。
- ✅ 会话安全：`SessionGuard` + `useIdleTimer` 组合可在 15 分钟空闲后锁屏，并可在设置页切换为 1 小时或“从不”以及“自动注销”策略。
- ✅ Referer 防盗链：OSS/COS 可以编辑白名单、允许空 Referer；AWS 账户显示兼容提示但不会调用 API。
- 🔬 测试：`go test ./...`、`pnpm --dir frontend test`（Vitest，jsdom 中的系统指标读取会输出预期的 mock 警告）。
