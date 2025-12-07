# Sprint 4: 安全硬化与访问控制 (Security & Access Control)

**目标**: 补齐安全短板，确保数据访问权限可精细化管理，保障企业级使用安全。

## 1. 存储桶访问控制列表 (Bucket ACL) 管理
*   **功能描述**: 实现存储桶 ACL 的可视化管理，允许用户设置 Owner、Authenticated Users、Log Delivery 等组的读写权限，以及添加特定规范用户 ID (Canonical User ID) 的授权。
*   **关联文档**: `docs/features.md` (Item 80), `docs/spec/bucket_access_control.md`
*   **关键任务**:
    *   [ ] 后端: 实现 `GetBucketAcl` 和 `PutBucketAcl` 接口适配 (S3/OSS/COS)。
    *   [ ] 前端: 在 `BucketSettings` 中新增 `AccessControlPanel`。
    *   [ ] 前端: 实现 ACL 授权编辑器 UI (Grantees list, Permission dropdowns)。

## 2. 阻止公共访问 (Block Public Access)
*   **功能描述**: 集成 AWS S3 和 Aliyun OSS 的 "Block Public Access" 功能，允许用户一键禁止存储桶及其对象的公共访问。
*   **关联文档**: `docs/features.md` (Item 81)
*   **关键任务**:
    *   [ ] 后端: 实现 `GetPublicAccessBlock` 和 `PutPublicAccessBlock` API。
    *   [ ] 前端: 在安全设置页增加 "Block Public Access" 及其子选项 (BlockPublicAcls, IgnorePublicAcls 等) 的开关。

## 3. 会话安全管理
*   **功能描述**: 增强应用的安全性，增加空闲超时自动注销功能，防止未授权人员在用户离开时操作。
*   **关联文档**: `docs/features.md` (Item 36)
*   **关键任务**:
    *   [ ] 前端: 实现空闲检测 Hook (`useIdleTimer`)。
    *   [ ] 前端: 实现锁屏界面或自动登出逻辑。
    *   [ ] 配置: 在设置页允许用户自定义超时时间 (如 15分钟, 1小时, 从不)。

## 4. 防盗链设置 (OSS/COS 特有)
*   **功能描述**: 为 OSS 和 COS 存储桶配置 Referer 白名单，防止资源被盗用。
*   **关联文档**: `docs/features.md` (Item 82)
*   **关键任务**:
    *   [ ] 后端: 实现 `GetBucketReferer` 和 `PutBucketReferer`。
    *   [ ] 前端: 实现防盗链配置面板 (允许 Empty Referer, Referer List)。
