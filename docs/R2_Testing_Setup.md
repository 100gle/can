# Cloudflare R2 测试配置指南

本文档说明如何为 CAN 配置 Cloudflare R2 账户并进行本地测试。

---

## 第一步：获取 R2 API Token

### 1.1 登录 Cloudflare Dashboard
- 访问 https://dash.cloudflare.com
- 登录你的 Cloudflare 账户

### 1.2 获取 Account ID
1. 左侧菜单 → **R2**
2. 右上角显示 `Account ID`，记录该值（格式：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

### 1.3 创建 API Token
1. 左侧菜单 → **Account Settings** → **API Tokens**
2. 点击 **Create Token**
3. 选择 **Create Custom Token**（而不是预设模板）
4. **权限配置**:
   - **Permissions** → **Object Storage**：
     - 选中 `Edit`（包含 read/write 权限）
   - **Account Resources**：
     - 选中 `All resources`（或特定 bucket，根据需要）
5. **TTL**（可选）：
   - 设置过期时间（开发测试可设置 30 天）
6. 点击 **Create Token**
7. **记录以下信息**（复制到安全位置）：
   - `Access Key ID`
   - `Secret Access Key`

⚠️ **重要**: Secret Access Key 只会显示一次，务必立即保存！

---

## 第二步：确定 R2 Endpoint

R2 Endpoint 有两种格式：

### 2.1 标准 Endpoint（推荐用于测试）
```
https://{account_id}.r2.cloudflarestorage.com
```

替换 `{account_id}` 为你的 Account ID。

**示例**:
```
https://abc123def456ghi789.r2.cloudflarestorage.com
```

### 2.2 自定义域名 Endpoint（可选）
如果已在 R2 中配置自定义域名，也可使用：
```
https://r2.yourdomain.com
```

本指南使用 **标准 Endpoint**。

---

## 第三步：在 CAN 中配置账户

### 3.1 启动 CAN
```bash
cd /home/vm/can
wails dev
```

### 3.2 创建新账户
1. 点击 UI 中的 **新建账户** 按钮
2. 填写以下信息：

| 字段 | 值 | 说明 |
|------|-----|------|
| **账户名称** | `My R2 Storage` | 自定义名称，用于本地识别 |
| **服务商** | `Cloudflare R2` | 从下拉菜单选择 |
| **Endpoint** | `https://{account_id}.r2.cloudflarestorage.com` | 替换 account_id |
| **Access Key ID** | `{api_token_access_key}` | 从第一步复制 |
| **Secret Access Key** | `{api_token_secret_key}` | 从第一步复制 |
| **Region** | `auto` 或 `wnam`（北美）| 可留空或选择区域 |
| **使用 SSL** | ✓ 勾选 | R2 强制使用 HTTPS |
| **自定义端口** | 空 | 保持默认 443 |

### 3.3 完整示例

假设你的信息如下：
- Account ID: `abc123def456ghi789`
- Access Key: `1234567890abcdef`
- Secret Key: `abcdefg1234567890xyz`

则填写：

```
账户名称：           My R2 Storage
服务商：             Cloudflare R2
Endpoint：           https://abc123def456ghi789.r2.cloudflarestorage.com
Access Key ID：      1234567890abcdef
Secret Access Key：  abcdefg1234567890xyz
Region：             auto
使用 SSL：           ✓
自定义端口：         (空)
```

### 3.4 保存账户
点击 **创建** 或 **保存** 按钮。

---

## 第四步：测试连接

### 4.1 当前功能（阶段 1）

目前的 **测试连接** 按钮只验证字段的基本格式（非空且有效的 URL）。

⚠️ **不会真实连接到 R2**，仅为占位符实现。

### 4.2 预期行为
- ✓ 通过验证：所有必填字段都非空
- ✗ 失败：Access Key 或 Secret Key 为空

### 4.3 后续更新（Phase 1.2）

一旦完成 `internal/providers/s3_dialer.go` 的实现，测试连接将：
- 真实连接到 R2
- 调用 `ListBuckets` 验证凭证
- 返回详细的错误信息（如认证失败、网络超时）

---

## 第五步：验证账户已保存

### 5.1 检查本地数据库
- **默认位置**: `~/.config/can/accounts.db`（SQLite）
- 或根据 `CAN_DB_DSN` 环境变量指定的位置

### 5.2 导出账户配置
1. 点击 UI 中的 **导出账户** 按钮
2. 保存 `.canx` 文件（加密格式）
3. 验证文件大小 > 0

---

## 常见问题

### Q1: Endpoint 填错了怎么办？
**A**: 在 UI 中选中账户，点击 **编辑**，修改 Endpoint 后保存。

### Q2: Secret Key 忘记了怎么办？
**A**: 
1. 登录 Cloudflare Dashboard
2. 进入 **API Tokens** 列表
3. 找到对应的 token，点击 **Roll** 重新生成（旧 token 失效）
4. 复制新的 Secret Key

### Q3: 能否同时配置多个 R2 账户？
**A**: 可以。每次点击 **新建账户**，填写不同的 Account ID 和 API Token。

### Q4: 测试连接一直失败怎么办？

**检查清单**:
1. 确认 Account ID 和 Access/Secret Key 正确（无多余空格）
2. 确认 Endpoint URL 格式正确（`https://...` 而不是 `http://`）
3. 检查 API Token 权限是否包含 **Object Storage > Edit**
4. 确认网络连接正常（可用 `ping` 或 `curl` 测试 Endpoint）

### Q5: 为什么看不到存储桶列表？
**A**: 这是正常现象。当前版本（Phase 1）只支持账户管理。

存储桶浏览功能需要完成 **Phase 2** 的实现（见 `TODO_R2_Implementation.md`）。

---

## 后续步骤

1. **Phase 1 完成后**（1-2 周）：
   - 真实的连接测试功能可用
   - 验证凭证时会调用 R2 API

2. **Phase 2 完成后**（3-4 周）：
   - 可以查看存储桶列表
   - 可以创建/删除存储桶

3. **Phase 3 完成后**（6-8 周）：
   - 可以浏览、上传、下载文件
   - 完整的文件管理功能

---

## 安全建议

1. **不要在代码或日志中提交凭证**
   - CAN 已使用 ChaCha20-Poly1305 加密存储 Secret Key
   - 数据库文件权限设置为 `0600`（仅所有者可读）

2. **定期轮换 API Token**
   - 在 Cloudflare Dashboard 中点击 **Roll** 生成新 token
   - 在 CAN 中更新对应账户

3. **使用最小权限原则**
   - 如果只需要读操作，API Token 权限可设为 `Read`
   - 避免 `All resources`，改为特定 bucket

4. **备份账户配置**
   - 定期使用 **导出账户** 功能备份 `.canx` 文件
   - 存放在安全位置（加密驱动器、密码管理器等）

---

## 参考

- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [R2 API 参考](https://developers.cloudflare.com/r2/api/s3/api/)
- [AWS S3 API 兼容性](https://developers.cloudflare.com/r2/api/s3/compatibility/)

---

**最后更新**: 2025-12-04
**版本**: v0.1（Phase 1）
