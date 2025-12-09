# Provider 能力对照表

本文档记录 CAN 支持的各个云存储服务商的功能差异和 API 能力矩阵。

## 快速参考

| 能力 | AWS S3 | 阿里云 OSS | 腾讯云 COS | Cloudflare R2 | Custom S3 |
|-----|:------:|:--------:|:--------:|:------------:|:---------:|
| 基础对象操作 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 批量删除 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 预签名 URL | ✅ | ✅ | ✅ | ✅ | ✅ |
| 分片上传 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 对象软链接 | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bucket ACL | ✅ | ✅ | ✅ | ❌ | ❌ |
| 防盗链 Referer | ❌ | ✅ | ✅ | ❌ | ❌ |
| 公共访问阻断 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bucket Policy | ✅ | ⏳ | ⏳ | ❌ | ❌ |
| 版本控制 | ✅ | ⏳ | ⏳ | ⏳ | ❌ |
| 默认加密 | ✅ | ⏳ | ⏳ | ❌ | ❌ |
| 生命周期 | ✅ | ⏳ | ⏳ | ⏳ | ❌ |
| CORS 规则 | ✅ | ⏳ | ⏳ | ⏳ | ❌ |
| 静态网站 | ✅ | ⏳ | ⏳ | ❌ | ❌ |
| 多 AZ 冗余 | ✅ | ❌ | ✅ | ❌ | ❌ |
| 存储类型选择 | ✅ | ✅ | ✅ | ❌ | ❌ |
| STS 临时凭证 | ✅ | ⏳ | ⏳ | ❌ | ❌ |

**图例**: ✅ 支持 | ❌ 不支持 | ⏳ SDK 支持但 CAN 尚未实现

---

## AWS S3

**完整支持的功能**:
- 基础对象操作（上传/下载/删除/复制/重命名）
- 批量删除（支持单次 1000 个对象）
- 分片上传（Multipart Upload）
- Bucket/Object ACL 管理
- Public Access Block 阻断公共访问
- Bucket Policy 编辑
- 版本控制（Versioning）
- 服务端加密（SSE-S3/SSE-KMS）
- 生命周期规则（Lifecycle）
- CORS 规则配置
- 静态网站托管
- 预签名 URL（GET/PUT）
- Object Lock 与 Legal Hold

**不支持**:
- 对象软链接（S3 原生不支持）
- Referer 防盗链（需通过 Bucket Policy 实现）

---

## 阿里云 OSS

**已支持功能**:
- 基础对象操作
- 批量删除
- 分片上传
- Bucket/Object ACL
- 防盗链 Referer 白名单
- 对象软链接（Symlink）
- 存储类型选择（Standard/IA/Archive）
- 预签名 URL

**CAN 待实现**:
- 版本控制管理
- 默认加密配置
- 生命周期规则
- CORS 规则
- 静态网站托管
- Bucket Policy

**平台限制**:
- Public Access Block 不可用（使用 ACL + Referer 替代）

---

## 腾讯云 COS

**已支持功能**:
- 基础对象操作
- 批量删除
- 分片上传
- Bucket ACL
- 防盗链 Referer
- 多 AZ 冗余（创建时指定）
- 存储类型选择
- 预签名 URL

**CAN 待实现**:
- 版本控制管理
- 默认加密配置
- 生命周期规则
- CORS 规则
- Bucket Policy

**平台限制**:
- 对象软链接不支持
- Public Access Block 不可用

---

## Cloudflare R2

**已支持功能**:
- 基础对象操作
- 批量删除
- 分片上传
- 预签名 URL
- 自定义域名绑定

**平台限制**:
- 仅单一存储类型
- 无 ACL 管理（通过 Cloudflare Dashboard 控制）
- 无 Bucket Policy
- 无 Referer 防盗链（通过 Cloudflare Rules 实现）
- 无版本控制 UI（控制台功能）

---

## 运行集成测试

```bash
# MinIO 本地测试
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
go test -v ./internal/providers/... -run Integration

# AWS S3 测试
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_TEST_BUCKET=your-bucket
go test -v ./internal/providers/... -run Integration

# 完整测试（需配置所有环境变量）
go test -v ./internal/providers/... -run Integration
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|-----|------|-----|
| 1.0 | 2024-12 | Sprint 13 - 初始版本，添加批量删除支持 |
