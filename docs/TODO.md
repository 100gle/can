# CAN - 综合功能与架构 TODO 清单

**最后更新**: 2025-12-05  
**生成基于**: features.md 功能规划 + spec/ 详细规范 + 代码实现审查

**关联文档**:
- 🚀 [三分支启动指南](QUICKSTART-3BRANCHES.md) - **从这里开始**
- 📋 Branch 1: 对象操作核心增强（需求合并至 `docs/spec/object_basic_operations.md`） - 1-1.5 周 | P0
- 📋 [Branch 2: 文件传输与预签名 URL](TODO-Branch-2-Transfer-Management.md) - 2-2.5 周 | P1
- 📋 [Branch 3: 存储桶配置与搜索](TODO-Branch-3-Bucket-Config-Search.md) - 2-2.5 周 | P3+P4

---

## 📊 概览

| 类别 | 已完成 | 待做 | 进度 |
|-----|--------|------|------|
| 账户管理 | 7/8 | 1 | 87.5% ✓ |
| 存储桶操作 | 10/11 | 1 | 90.9% ✓ |
| 对象浏览与管理 | 13/32 | 19 | 40.6% ⚠️ |
| 高级功能 | 0/63 | 63 | 0% ❌ |
| 监控与统计 | 0/40 | 40 | 0% ❌ |
| 安全与权限 | 0/44 | 44 | 0% ❌ |
| 用户界面 | 2/47 | 45 | 4.3% ❌ |
| **总体** | **32/245** | **213** | **13.1%** |

---

## 🚀 优先级分类

### P0 - 核心功能（第1阶段：立即开始）

#### 对象操作核心 API
- [ ] **后端 - 文件操作**
  - [ ] 实现 `RenameObject` 方法（可通过 CopyObject + DeleteObject 组合）
  - [ ] 实现 `CreateDirectory` 方法（上传空前缀对象）
  - [ ] 实现 `MoveObject` 方法（跨桶 CopyObject + DeleteObject）

- [ ] **后端 - 列表增强**
  - [ ] 在 `buckets.Service` 中添加 `BucketLocation` 方法（已在 app.go，需补充 service）
  - [ ] 支持对象列表排序（ListObjects 返回时按名称/大小/时间排序）
  - [ ] 优化分页逻辑（支持大量对象场景）

#### 前端 - 对象浏览增强
- [ ] **ObjectBrowser 核心功能**
  - [ ] 实现文件重命名功能（UI + API 调用）
  - [ ] 实现虚拟目录创建（前缀上传）
  - [ ] 实现文件移动功能（跨存储桶）
  - [ ] 实现选中多个对象后的批量删除确认

- [ ] **BucketBrowser 增强**
  - [ ] 实现桶名称验证逻辑（S3 命名规则）
  - [ ] 添加存储桶排序功能（按名称/创建时间/大小）
  - [ ] 添加搜索/过滤功能（前缀搜索）

#### 用户界面基础
- [ ] **主题与主观体验**
  - [ ] 实现深色/浅色主题切换（已有 ThemeProvider，需完善 CSS 变量）
  - [ ] 实现响应式布局调整（移动端支持）
  - [ ] 添加快捷键支持（如 Ctrl+F 搜索、Ctrl+U 上传）

---

### P1 - 文件传输（第2阶段：1-2周）

#### 文件上传增强
- [ ] **后端支持**
  - [ ] 实现 `MultipartUpload` API（分片上传，为断点续传做准备）
  - [ ] 实现 `AbortMultipartUpload` 清理未完成的分片

- [ ] **前端实现**
  - [ ] 实现拖拽上传 UI（覆盖 ObjectBrowser）
  - [ ] 实现文件夹上传（保持目录结构）
  - [ ] 实现上传队列管理模块（Zustand store 扩展）
  - [ ] 实现断点续传逻辑（本地存储分片 hash）
  - [ ] 构建上传进度 UI（总进度 + 单文件进度 + 速度显示）
  - [ ] 实现上传失败重试机制（自动/手动）
  - [ ] 实现上传参数表单（Storage Class、Metadata、Content-Type）

#### 文件下载增强
- [ ] **前端实现**
  - [ ] 实现批量下载 ZIP 打包功能（client-side 或 server-side）
  - [ ] 实现文件夹下载（递归 + ZIP）
  - [ ] 实现下载队列管理（并发控制）
  - [ ] 构建下载进度 UI
  - [ ] **生成预签名 URL**（关键功能）
    - [ ] 后端实现 API（使用 SDK 的 presigned URL 生成）
    - [ ] 前端 UI（设置过期时间、复制、QR 码）

#### 传输管理界面
- [ ] 创建传输任务列表页面（上传/下载历史）
- [ ] 实现任务暂停/恢复/取消功能
- [ ] 实现传输速度限制配置
- [ ] 实现传输历史记录持久化

---

### P2 - 文件预览与编辑（第3阶段：2-3周）

#### 文件预览
- [ ] **图片预览**
  - [ ] 集成图片预览组件（支持 JPG、PNG、GIF、WebP）
  - [ ] 实现缩略图显示
  - [ ] 实现全分辨率查看

- [ ] **文本预览与编辑**
  - [ ] 集成文本编辑器（Monaco Editor 或 CodeMirror）
  - [ ] 支持多种语言语法高亮（JSON、XML、JS、Python 等）
  - [ ] 实现在线编辑保存功能
  - [ ] 实现撤销/重做

- [ ] **多媒体预览**
  - [ ] 集成视频播放器（支持 MP4、WebM）
  - [ ] 集成音频播放器（支持 MP3、WAV）
  - [ ] 集成 PDF 查看器

- [ ] 处理不支持格式的提示

#### 文件属性与元数据管理
- [ ] **后端 API**
  - [ ] 实现获取对象元数据接口
  - [ ] 实现设置对象元数据接口
  - [ ] 实现对象标签管理（GetObjectTagging、PutObjectTagging）

- [ ] **前端 UI**
  - [ ] 创建对象详情抽屉（显示元数据、标签、ACL）
  - [ ] 实现元数据编辑表单
  - [ ] 实现标签管理 UI
  - [ ] 实现 ACL 修改功能

---

### P3 - 存储桶高级管理（第4阶段：3-4周）

#### 存储桶属性配置
- [ ] **后端 API**（根据 SDK 支持情况逐个实现）
  - [ ] 版本控制（GetBucketVersioning、PutBucketVersioning）
  - [ ] 加密设置（GetBucketEncryption、PutBucketEncryption）
  - [ ] 生命周期规则（GetBucketLifecycle、PutBucketLifecycle）
  - [ ] CORS 配置（GetBucketCors、PutBucketCors）
  - [ ] 静态网站托管（GetBucketWebsite、PutBucketWebsite）

- [ ] **前端 UI**
  - [ ] 创建存储桶设置页面（标签页式）
  - [ ] 各项配置编辑表单
  - [ ] 配置保存与错误处理

#### 访问控制
- [ ] **后端 API**
  - [ ] 存储桶策略编辑（GetBucketPolicy、PutBucketPolicy）
  - [ ] ACL 管理（GetBucketAcl、PutBucketAcl）
  - [ ] 阻止公共访问（GetPublicAccessBlockConfiguration）

- [ ] **前端 UI**
  - [ ] 存储桶策略编辑器（代码编辑 + 可视化编辑）
  - [ ] ACL 管理界面
  - [ ] 安全配置检查器

#### 批量操作
- [ ] 批量删除对象（已基础实现，需优化）
- [ ] 批量修改 ACL
- [ ] 批量修改元数据
- [ ] 批量修改存储类型（如支持）
- [ ] 批量导出文件列表

---

### P4 - 搜索与过滤（第5阶段：2-3周）

#### 搜索功能
- [ ] **前缀搜索**（基础）
  - [ ] 实现当前桶内前缀搜索 UI
  - [ ] 实现全局搜索（跨所有存储桶）

- [ ] **高级过滤**
  - [ ] 文件大小范围过滤
  - [ ] 修改时间范围过滤
  - [ ] 文件类型过滤
  - [ ] 标签过滤

- [ ] **搜索结果**
  - [ ] 搜索结果导出
  - [ ] 搜索历史记录

#### 排序与排列
- [ ] 实现多维度排序（名称、大小、时间、类型）
- [ ] 记住用户排序偏好

---

### P5 - 监控与统计（第6阶段：3-4周）

#### 存储统计
- [ ] **后端支持**
  - [ ] 计算存储桶总大小
  - [ ] 统计对象数量
  - [ ] 按存储类型分类统计

- [ ] **前端 UI**
  - [ ] 仪表板页面（存储空间使用、对象数量）
  - [ ] 存储类型分布图表
  - [ ] 趋势分析（时间序列）

#### 流量与成本（可选）
- [ ] 上传/下载流量统计（需 CloudWatch 或 API 支持）
- [ ] 成本分析与估算
- [ ] 优化建议

---

### P6 - 高级特性（第7-8阶段）

#### 同步功能
- [ ] 本地文件夹与存储桶同步
- [ ] 双向同步选项
- [ ] 定时同步任务
- [ ] 同步日志查看

#### 数据迁移
- [ ] 跨账户迁移 API
- [ ] 跨服务商迁移
- [ ] 数据对比与校验
- [ ] 迁移进度追踪

#### 开发者工具
- [ ] API 请求日志查看
- [ ] 调试模式
- [ ] 导出配置为代码（SDK 代码生成）
- [ ] Webhook 配置

#### 备份与恢复
- [ ] 配置备份（账户导出已实现）
- [ ] 数据备份策略配置
- [ ] 快速恢复功能

---

## 🏗️ 架构级待办项

### 后端架构完善
- [ ] **包结构优化**
  - [ ] 新建 `internal/transfer` 包（管理上传/下载队列）
  - [ ] 新建 `internal/metadata` 包（管理对象元数据、标签）
  - [ ] 新建 `internal/search` 包（搜索和过滤逻辑）
  - [ ] 新建 `internal/config` 包（存储桶配置管理）

- [ ] **SDK 包装层**
  - [ ] 统一 S3Client 和各厂商 Client 的接口（已部分实现）
  - [ ] 为 OSS、COS 补充 storage client 实现
  - [ ] 规范化错误处理（统一错误类型和消息）

### 前端架构完善
- [ ] **组件库完善**
  - [ ] 补充 UI 基础组件（Dialog、Drawer、Toast、Alert 等）
  - [ ] 创建 Form 组件库（支持验证）
  - [ ] 创建 Table 组件（支持排序、过滤、分页）
  - [ ] 创建 Modal 组件库

- [ ] **状态管理扩展**
  - [ ] 新建 `frontend/src/state/transfers.ts`（上传/下载队列）
  - [ ] 新建 `frontend/src/state/search.ts`（搜索状态）
  - [ ] 新建 `frontend/src/state/bucketConfig.ts`（存储桶配置）
  - [ ] 新建 `frontend/src/state/ui.ts`（全局 UI 状态：主题、侧边栏等）

- [ ] **路由与页面结构**
  - [ ] 创建 `frontend/src/routes/accounts/$accountId/buckets/` 路由
  - [ ] 创建 `frontend/src/routes/accounts/$accountId/transfers/` 路由
  - [ ] 创建 `frontend/src/routes/accounts/$accountId/search/` 路由
  - [ ] 创建 `frontend/src/routes/admin/` 路由（配置、监控等）

### 测试与文档
- [ ] **后端测试**
  - [ ] 为 buckets service 补充单元测试
  - [ ] 为 objects service 补充单元测试
  - [ ] 为 providers 补充集成测试

- [ ] **前端测试**
  - [ ] 为核心组件补充单元测试（React Testing Library）
  - [ ] 为 Zustand store 补充测试

- [ ] **代码文档**
  - [ ] API 接口文档（OpenAPI/Swagger）
  - [ ] 前端组件文档（Storybook）
  - [ ] 架构决策记录（ADR）

---

## 📋 按实现步骤的时间规划

### 第 1 周（共 40h）- P0 核心功能
- [ ] 对象操作 API（RenameObject、CreateDirectory、MoveObject）- 8h
- [ ] ObjectBrowser 核心交互（重命名、删除、目录） - 16h
- [ ] BucketBrowser 增强（排序、搜索、验证） - 12h
- [ ] 主题切换与快捷键 - 4h

### 第 2-3 周（共 80h）- P1 文件传输
- [ ] MultipartUpload 后端实现 - 12h
- [ ] 拖拽上传 + 文件夹上传 - 16h
- [ ] 上传队列与进度管理 - 20h
- [ ] 断点续传逻辑 - 16h
- [ ] 预签名 URL 生成（关键！） - 16h

### 第 4-5 周（共 60h）- P2 文件预览与编辑
- [ ] 图片/文本预览 - 20h
- [ ] 在线编辑器集成 - 20h
- [ ] 对象元数据管理 - 20h

### 第 6-7 周（共 80h）- P3 存储桶配置 + P4 搜索
- [ ] 存储桶高级配置 API 与 UI - 40h
- [ ] 搜索与过滤功能 - 40h

### 第 8 周（共 40h）- P5 监控与统计
- [ ] 仪表板与统计图表 - 40h

---

## 🔗 三分支并行开发 ✅

```
分支 1: 对象操作核心 (1-1.5 周)
分支 2: 文件传输管理 (2-2.5 周)    ← 完全独立
分支 3: 存储桶配置+搜索 (2-2.5 周) ← 完全独立

三个分支同时启动，无任何依赖关系
预计总耗时: 2.5-3 周（由最长的分支决定）
```

**完全并行的原因**:
- 各分支新建独立的包（transfer, config, search）
- 各分支独立实现 API 和前端
- 仅在 `app.go` 新增不同的方法（无冲突）
- 前端组件均新建（无修改现有代码）

**推荐策略**:
1. 同时创建三个分支
2. 每个分支独立开发、测试
3. 分别完成后依次合并到 develop（冲突预期最少）

---

## ⚠️ 技术风险与注意事项

### 1. SDK 兼容性
- **风险**: 不同云服商 API 差异
- **方案**: 为 OSS、COS 补充 storage client 实现，统一接口
- **状态**: 已部分完成（S3 client 完整，OSS/COS 需扩展）

### 2. 大文件上传
- **风险**: 单线程上传效率低
- **方案**: 使用 MultipartUpload + 并发上传
- **优先级**: P1 中必须实现

### 3. 凭证安全
- **风险**: 本地存储密钥可能泄露
- **方案**: 已实现加密存储（security.DefaultCipher），继续维护
- **状态**: ✓ 已实现

### 4. 性能优化
- **虚拟滚动**: 对象列表大于 1000 项时需要虚拟滚动
- **缓存策略**: 考虑缓存存储桶列表、对象元数据
- **并发控制**: 限制并发上传/下载数量（默认 3）

### 5. 多语言支持
- **状态**: 代码中已有中文注释，UI 中文标签
- **待做**: 提取国际化文本，使用 i18n 库（如 react-i18next）

---

## 📌 立即可做的任务（本周开始）

1. ✅ **新建 3 个包** → `internal/transfer`, `internal/metadata`, `internal/search`
2. ✅ **实现 3 个对象操作 API** → `RenameObject`, `CreateDirectory`, `MoveObject`
3. ✅ **增强 ObjectBrowser** → 重命名、虚拟目录、文件移动、多选删除
4. ✅ **增强 BucketBrowser** → 排序、搜索、名称验证
5. ✅ **主题切换完善** → 深色/浅色模式切换

---

## 参考文件结构

```
can/
├── docs/
│   ├── features.md         ✓ 功能规划（完整）
│   ├── spec/               ✓ 详细规范（28 个文档）
│   │   ├── bucket_*.md     3/3 已检查
│   │   ├── object_*.md     3/3 已检查
│   │   ├── file_*.md       2/2 已检查
│   │   └── ...其他         22 个待实现功能
│   └── TODO.md             ← 本文件（新）
│
├── internal/
│   ├── accounts/           ✓ 87.5% 完成
│   ├── buckets/            ✓ 90.9% 完成
│   ├── objects/            ⚠️ 40.6% 完成
│   ├── providers/          ✓ 通用 S3 接口
│   ├── security/           ✓ 加密存储
│   ├── types/              ✓ 枚举定义
│   ├── transfer/           ❌ 待创建
│   ├── metadata/           ❌ 待创建
│   ├── search/             ❌ 待创建
│   └── config/             ❌ 待创建
│
└── frontend/src/
    ├── components/
    │   ├── accounts/       ✓ 完整
    │   ├── buckets/        ⚠️ 需增强
    │   ├── objects/        ⚠️ 需增强
    │   └── ui/             ❌ 需补充基础组件
    ├── pages/              ⚠️ 需增加页面
    ├── routes/             ⚠️ 需扩展路由
    ├── state/              ⚠️ 需扩展 store
    └── hooks/              ❌ 需增加 hooks
```

---

**维护人**: @Team  
**下次审查**: 2025-12-12（一周后）
