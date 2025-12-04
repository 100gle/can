# CAN · S3 兼容对象存储工具

跨平台的 Wails + React 客户端，用于管理多账户的 S3 兼容对象存储（AWS、阿里云 OSS、腾讯云 COS、Cloudflare R2 等）。

## 开发与调试

- `wails dev`：同时热重载 Go + Vite，桌面端端到端联调；
- `pnpm --dir frontend dev`：仅前端预览，独立于 Wails；
- `go test ./...`：运行所有 Go 单元测试。

## 构建

```
pnpm --dir frontend build && wails build
```

构建后的桌面产物位于 `build/` 目录。

## 数据库存储

账户配置默认保存在 SQLite 数据库，并可通过环境变量切换：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CAN_DB_DRIVER` | `sqlite` | 支持 `sqlite`（ORM 持久化）或 `memory`（内存演示）。 |
| `CAN_DB_DSN` | `%USER_CONFIG%/can/accounts.db` | SQLite 文件路径；当 driver 为 `sqlite` 且未显式设置时自动创建。 |

切换为内存模式时（`CAN_DB_DRIVER=memory`）不会持久化任何账户，仅适合演示或测试。

## 更多配置

应用打包、窗口配置等均在 `wails.json` 中维护，详见官方文档：https://wails.io/docs/reference/project-config
