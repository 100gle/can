# 三分支并行开发快速指南

**总耗时**: 2.5-3 周  
**同时启动**: Day 0  
**合并顺序**: 任意（冲突最少）

---

## 🚀 快速启动

### Step 1: 从三个分支文档选择你的工作

- **Frontend Dev** → 优先看 **Branch 1** 或 **Branch 2** (UI 工作量大)
- **Backend Dev** → 优先看 **Branch 2** 或 **Branch 3** (API 工作量大)  
- **Full Stack** → 随意选择任一分支

### Step 2: 阅读对应分支文档

| 分支 | 工作量 | 重点 |
|------|--------|------|
| **Branch 1** | 中等 | 对象操作 API + ObjectBrowser UI |
| **Branch 2** | 大 | Transfer 包 + 上传/下载 UI + 预签名 URL |
| **Branch 3** | 大 | Config/Search 包 + 配置页面 + 搜索页面 |

### Step 3: 开始编码

```bash
# 本地环境准备
wails dev
pnpm --dir frontend dev

# 按照分支文档的任务顺序逐个完成
# 定期运行测试
go test ./...
pnpm --dir frontend lint
```

---

## 📋 三分支任务速览

### Branch 1: 对象操作核心 (1-1.5 周)

**后端** (8h):
```
RenameObject → CreateDirectory → MoveObject → 在 app.go 暴露
```

**前端** (16h):
```
ObjectBrowser: 重命名 + 新建目录 + 移动 + 批量删除
BucketBrowser: 排序 + 搜索 + 验证名称
```

**测试** (4h)

### Branch 2: 文件传输 (2-2.5 周)

**后端** (12h):
```
MultipartUpload (初始化/上传/完成/中止) → 预签名 URL
```

**前端** (22h):
```
Transfer store → 拖拽上传 → 文件夹上传 → 上传进度 → 预签名对话框
```

**断点续传** (8h)

**测试** (6h)

### Branch 3: 存储桶配置+搜索 (2-2.5 周)

**后端** (16h):
```
Config: 版本/加密/生命周期/CORS/网站/策略
Search: 前缀搜索 + 过滤 + 排序
```

**前端** (18h):
```
BucketSettings 页面 (6 个配置面板)
SearchPage (表单 + 结果 + 导出)
```

**测试** (6h)

---

## ⚠️ 关键注意事项

### 1. 完全独立开发

```bash
# 各分支独立
git checkout develop
git checkout -b feat/branch-name-here

# 定期 pull 上游（保持最新）
# 但通常无冲突
```

### 2. 最后合并

合并顺序**无所谓**（都是独立的）：

```bash
# 示例: 合并顺序可以是 1,2,3 或 3,2,1 等
git checkout develop
git merge feat/object-operations-core
git merge feat/transfer-management
git merge feat/bucket-config-search
```

### 3. app.go 冲突处理（唯一可能的冲突）

当合并第 2、3 个分支时，可能在 `app.go` 出现冲突（新增方法）：

```go
// 冲突示例
<<<<<<< HEAD (develop 已有 Branch 1 的方法)
func (a *App) RenameObject(...) error
func (a *App) CreateDirectory(...) error
=======  (incoming Branch 2 的方法)
func (a *App) InitiateMultipartUpload(...) (string, error)
func (a *App) UploadPart(...) (string, error)
>>>>>>>

// 解决: 保留两者
func (a *App) RenameObject(...) error
func (a *App) CreateDirectory(...) error
func (a *App) InitiateMultipartUpload(...) (string, error)
func (a *App) UploadPart(...) (string, error)
```

**简单解决**: 保留所有新增方法即可。

---

## 🧪 测试检查清单

在完成每个分支前运行：

```bash
# 后端
go test ./...
go vet ./...
gofmt -d .
goimports -d .

# 前端
pnpm --dir frontend lint
pnpm --dir frontend build

# 集成
wails dev  # 手动验证功能
```

---

## 📝 提交消息规范

```
feat(objects): implement rename, mkdir, move operations

- Add RenameObject, CreateDirectory, MoveObject methods
- Implement comprehensive unit tests
- Update ObjectBrowser and BucketBrowser UI

Closes #TODO
```

关键词: `feat`, `fix`, `refactor`, `docs`, `test`

---

## 🎯 预期时间线

| Week | 进度 |
|------|------|
| **W1** | 三个分支并行开发中 |
| **W2** | Branch 1 完成，Branch 2/3 继续 |
| **W2-W3** | Branch 2/3 接近完成 |
| **W3 结束** | 所有分支完成，合并，测试 |

---

## 💡 建议

1. **每个分支 1 人** 或 **分工合作**
2. **每天 sync** (10 分钟)：进度 + 遇到的问题
3. **完成每个 Task** 后立即推送（便于 code review）
4. **并行不等于孤立** - 遇到问题及时沟通

---

## 🔗 更多信息

- 详细任务: 见各分支文档
- 总体规划: 见 `TODO.md`
- 功能规划: 见 `features.md`
- 详细规范: 见 `spec/` 目录

---

**Happy coding! 🚀**
